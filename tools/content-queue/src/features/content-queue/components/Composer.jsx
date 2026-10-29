import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ImagePlus, Mail, MoreHorizontal, Trash2, X } from 'lucide-react'
import { AccountSelect } from './Businesses'
import { resolveImage } from '../lib/images'
import { useQueue } from '../data/QueueContext'
import { isUploadedImage, uploadImage } from '../data/client'
import { PLATFORMS, PLATFORM_BY_ID, STATUSES, measure } from '../lib/platforms'
import { addDays, at, fromInputs, startOfDay, toInputs } from '../lib/dates'
import { StatusGlyph } from './marks'
import { Dialog, Menu, MenuItem, useScrollLock } from './overlay'
import Preview from './Preview'
import TagInput from './TagInput'

export const isUrl = (v) => {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** Shrinks a picked photo to a JPEG no wider or taller than `max`, ready to upload. */
function shrinkImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('decode'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.85)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function validate(d) {
  const e = {}
  if (!d.title.trim() && !d.body.trim()) e.title = 'Add a title or some post text before saving.'
  if (d.status === 'scheduled') {
    if (!d.platform) e.platform = 'Pick where this goes out before scheduling it.'
    if (!d.scheduledAt) e.schedule = 'Pick a date and time to schedule this post.'
    const m = measure(d.platform, d.body, d.title)
    if (d.platform && m.over && !m.soft) e.body = `This is over the ${PLATFORM_BY_ID[d.platform].label} limit. Shorten it, or save it as a draft for now.`
  }
  if (d.status === 'posted') {
    if (d.liveUrl.trim() && !isUrl(d.liveUrl.trim())) e.liveUrl = 'That link needs to start with https:// to open.'
  }
  if (d.imageUrl && !d.imageUrl.startsWith('data:image/') && !isUrl(d.imageUrl)) {
    e.imageUrl = 'Image links need to start with https://'
  }
  return e
}

export default function Composer({ initial, isNew, focus, notice, paused, onClose, onSave, onDelete, onMarkPosted, onPromote }) {
  const { allTags } = useQueue()
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState({})
  const [tab, setTab] = useState('write')
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [addingBusiness, setAddingBusiness] = useState(false)
  const moreBtn = useRef(null)
  const scroller = useRef(null)
  const fileInput = useRef(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  useScrollLock(true)
  useEffect(() => {
    document.documentElement.dataset.cqComposer = '1'
    return () => delete document.documentElement.dataset.cqComposer
  }, [])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial])
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }))
    const keys = Object.keys(patch)
    if (keys.some((k) => errors[k] || (k === 'scheduledAt' && errors.schedule))) {
      setErrors((e) => {
        const n = { ...e }
        keys.forEach((k) => delete n[k])
        if (keys.includes('scheduledAt')) delete n.schedule
        return n
      })
    }
  }

  const tryClose = () => (dirty ? setConfirmClose(true) : onClose())

  useEffect(() => {
    const h = (e) => {
      if (paused || addingBusiness) return
      if (e.key === 'Escape' && !confirmClose && !confirmDelete && !moreOpen) tryClose()
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // Open with the right field in focus (for example, the date when scheduling from the board).
  useEffect(() => {
    const id = focus ? `cq-c-${focus}` : isNew ? 'cq-c-title' : null
    if (!id) return
    const t = setTimeout(() => {
      const el = document.getElementById(id)
      el?.focus({ preventScroll: true })
      el?.scrollIntoView({ block: 'center' })
    }, 60)
    return () => clearTimeout(t)
  }, [focus, isNew])

  const save = () => {
    const clean = { ...draft, title: draft.title.trim(), liveUrl: draft.liveUrl.trim(), imageUrl: draft.imageUrl.trim() }
    if (clean.status === 'posted' && !clean.postedAt) clean.postedAt = new Date().toISOString()
    const e = validate(clean)
    setErrors(e)
    if (Object.keys(e).length) {
      setTab('write')
      const first = ['title', 'platform', 'body', 'imageUrl', 'schedule', 'liveUrl'].find((k) => e[k])
      setTimeout(() => {
        const el = document.getElementById(`cq-c-${first}`)
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el?.focus({ preventScroll: true })
      }, 30)
      return
    }
    onSave(clean)
  }

  const m = measure(draft.platform, draft.body, draft.title)
  const p = PLATFORM_BY_ID[draft.platform]
  const { date, time: timeStr } = toInputs(draft.scheduledAt)
  const today = new Date()
  const nextMonday = startOfDay(addDays(today, ((8 - today.getDay()) % 7) || 7))
  const imgSrc = resolveImage(draft.imageUrl)
  const titleHint = p?.id === 'email' ? 'Used as the subject line.' : p?.id === 'blog' ? 'Used as the article headline.' : 'Only you see this. It names the post in your queue.'

  const pickFile = async (file) => {
    if (!file) return
    setUploadError('')
    if (!file.type.startsWith('image/')) return setUploadError('That file is not an image. Pick a JPG, PNG or WebP.')
    let blob
    try {
      blob = await shrinkImage(file)
    } catch {
      return setUploadError('That image could not be read. Try a JPG or PNG.')
    }
    setUploading(true)
    try {
      set({ imageUrl: await uploadImage(draft.id, blob) })
    } catch {
      setUploadError('The image did not upload. Check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }

  const statusLabel = STATUSES.find((s) => s.id === draft.status)?.label

  return (
    <div className="cq-root fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 hidden animate-fade bg-black/55 lg:block" onClick={tryClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cq-composer-title"
        className="relative flex h-full w-full animate-slidein flex-col bg-ink lg:w-[min(1120px,calc(100vw-56px))] lg:border-l lg:border-line2"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Header */}
        <header
          className="flex h-[60px] shrink-0 items-center gap-2 border-b border-line"
          style={{ paddingLeft: 'max(10px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
        >
          <button type="button" className="cq-icon-btn" onClick={tryClose} aria-label="Close composer">
            <X size={20} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <StatusGlyph status={draft.status} />
            <h2 id="cq-composer-title" className="truncate font-display text-[19px] font-[450] tracking-[-0.01em] text-bone">
              {isNew ? 'New post' : draft.title || 'Untitled post'}
            </h2>
            {dirty && <span className="hidden shrink-0 font-mono text-[11px] text-faint sm:inline">Unsaved</span>}
          </div>
          <div className="flex rounded-[10px] border border-line p-0.5 lg:hidden" role="tablist" aria-label="Composer view">
            {['write', 'preview'].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`h-9 rounded-[8px] px-3.5 text-[13.5px] capitalize transition-colors ${tab === t ? 'bg-raised text-bone' : 'text-mute'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Editor */}
          <div
            ref={scroller}
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${tab === 'write' ? 'block' : 'hidden'} lg:block`}
            style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
          >
            <form className="mx-auto flex max-w-[640px] flex-col gap-6 py-6 lg:py-8" onSubmit={(e) => (e.preventDefault(), save())} noValidate>
              {notice && (
                <p className="flex items-start gap-2.5 rounded-[10px] border border-ember/40 bg-ember-soft px-3.5 py-3 text-[14px] leading-snug text-bone">
                  <StatusGlyph status="scheduled" className="mt-[2px]" />
                  {notice}
                </p>
              )}
              <Field id="cq-c-title" label="Title" hint={titleHint} error={errors.title}>
                <input
                  id="cq-c-title"
                  value={draft.title}
                  onChange={(e) => set({ title: e.target.value })}
                  aria-invalid={!!errors.title}
                  className="cq-input font-display text-[18px] font-[430]"
                  placeholder="Name this post"
                />
              </Field>

              <div className="grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
                <Field id="cq-c-account" label="For">
                  <AccountSelect
                    id="cq-c-account"
                    value={draft.account}
                    onChange={(account) => set({ account })}
                    onDialog={setAddingBusiness}
                    className="cq-input h-[46px] py-0"
                  />
                </Field>
                <Field id="cq-c-platform" label="Platform" error={errors.platform} as="fieldset">
                  <div id="cq-c-platform" tabIndex={-1} className="flex flex-wrap gap-1.5 outline-none">
                    {PLATFORMS.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        aria-pressed={draft.platform === pl.id}
                        onClick={() => set({ platform: draft.platform === pl.id ? null : pl.id })}
                        className="cq-chip h-9 min-h-0 rounded-[9px] px-2.5"
                      >
                        {pl.shortLabel || pl.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <Field id="cq-c-body" label={p?.id === 'blog' ? 'Article' : p?.id === 'email' ? 'Email text' : 'Post text'} error={errors.body}>
                <AutoGrow
                  id="cq-c-body"
                  value={draft.body}
                  onChange={(v) => set({ body: v })}
                  invalid={!!errors.body}
                  placeholder={p ? `Write the ${p.label} ${p.kind === 'long' ? (p.id === 'email' ? 'email' : 'article') : 'post'}` : 'Write the post. Pick a platform to see its limit.'}
                />
                <Counter m={m} platform={p} />
              </Field>

              <Field id="cq-c-imageUrl" label="Image" hint={p?.needsImage ? 'Instagram posts need an image.' : 'Optional. Paste a direct link to an image, or upload one.'} error={errors.imageUrl || uploadError}>
                <div className="flex gap-2.5">
                  {imgSrc ? (
                    <img src={imgSrc} alt="" className="h-[46px] w-[46px] shrink-0 rounded-[9px] border border-line object-cover" />
                  ) : (
                    <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[9px] border border-dashed border-line2 text-faint">
                      <ImagePlus size={18} />
                    </span>
                  )}
                  {draft.imageUrl.startsWith('data:') || isUploadedImage(draft.imageUrl) ? (
                    <div className="flex min-h-[46px] min-w-0 flex-1 items-center justify-between gap-2 rounded-[10px] border border-line bg-well pl-3 pr-1 text-[14px] text-mute">
                      <span className="truncate">Uploaded image</span>
                      <button type="button" className="cq-btn-ghost min-h-[36px] px-2.5 text-[13px]" onClick={() => set({ imageUrl: '' })}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <input
                      id="cq-c-imageUrl"
                      type="url"
                      inputMode="url"
                      value={draft.imageUrl}
                      onChange={(e) => set({ imageUrl: e.target.value })}
                      aria-invalid={!!errors.imageUrl}
                      placeholder="https://"
                      className="cq-input min-w-0 flex-1"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  )}
                  <button type="button" className="cq-btn-quiet h-[46px] shrink-0" disabled={uploading} onClick={() => fileInput.current?.click()}>
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                  <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => (pickFile(e.target.files?.[0]), (e.target.value = ''))} />
                </div>
              </Field>

              <Field
                id="cq-c-schedule"
                label="Scheduled for"
                error={errors.schedule || (draft.status === 'scheduled' && draft.scheduledAt && new Date(draft.scheduledAt) < today ? 'This time has passed. Pick a new one, or mark the post as posted if it went out.' : '')}
                as="fieldset"
              >
                <div className="grid grid-cols-[minmax(0,14rem)_minmax(0,10rem)] gap-4">
                  <label className="sr-only" htmlFor="cq-c-schedule">
                    Date
                  </label>
                  <input
                    id="cq-c-schedule"
                    type="date"
                    value={date}
                    onChange={(e) => set({ scheduledAt: e.target.value ? fromInputs(e.target.value, timeStr || '09:00') : null })}
                    aria-invalid={!!errors.schedule}
                    className="cq-input cq-input-dt"
                  />
                  <label className="sr-only" htmlFor="cq-c-time">
                    Time
                  </label>
                  <input
                    id="cq-c-time"
                    type="time"
                    value={timeStr}
                    disabled={!date}
                    onChange={(e) => set({ scheduledAt: fromInputs(date, e.target.value || '09:00') })}
                    className="cq-input cq-input-dt disabled:opacity-50"
                  />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button type="button" className="cq-chip" onClick={() => set({ scheduledAt: at(1, 9) })}>
                    Tomorrow, 9 AM
                  </button>
                  <button type="button" className="cq-chip" onClick={() => set({ scheduledAt: new Date(nextMonday.setHours(9, 0, 0, 0)).toISOString() })}>
                    Next Monday, 9 AM
                  </button>
                  {draft.scheduledAt && (
                    <button type="button" className="cq-chip" onClick={() => set({ scheduledAt: null })}>
                      Clear date
                    </button>
                  )}
                </div>
              </Field>

              <Field id="cq-c-status" label="Status" as="fieldset">
                <div id="cq-c-status" className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Status">
                  {STATUSES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={draft.status === s.id}
                      onClick={() => set({ status: s.id, ...(s.id === 'posted' && !draft.postedAt ? { postedAt: new Date().toISOString() } : {}) })}
                      className={`flex h-11 items-center justify-center gap-2 rounded-[10px] border text-[13.5px] transition-colors ${
                        draft.status === s.id ? 'border-bone bg-raised text-bone' : 'border-line text-mute hover:border-line2 hover:text-bone'
                      }`}
                    >
                      <StatusGlyph status={s.id} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>

              {draft.status === 'posted' && (
                <Field id="cq-c-liveUrl" label="Live post link (optional)" error={errors.liveUrl} hint="Where the post lives now, so you can open it from the queue.">
                  <input
                    id="cq-c-liveUrl"
                    type="url"
                    inputMode="url"
                    value={draft.liveUrl}
                    onChange={(e) => set({ liveUrl: e.target.value })}
                    aria-invalid={!!errors.liveUrl}
                    placeholder="https://"
                    className="cq-input"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </Field>
              )}

              <Field id="cq-c-tags" label="Tags">
                <TagInput id="cq-c-tags" value={draft.tags} onChange={(tags) => set({ tags })} suggestions={allTags} />
              </Field>

              <Field id="cq-c-notes" label="Notes" hint="Private. Angles, sources, who asked for it.">
                <textarea id="cq-c-notes" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} className="cq-input resize-y text-[14px] leading-relaxed" />
              </Field>
              <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
            </form>
          </div>

          {/* Preview */}
          <aside
            className={`min-h-0 overflow-y-auto overscroll-contain border-line bg-well lg:block lg:w-[440px] lg:shrink-0 lg:border-l ${tab === 'preview' ? 'block flex-1' : 'hidden'}`}
            aria-label="Live preview"
            style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
          >
            <div className="flex flex-col gap-4 py-6 lg:px-4 lg:py-8">
              <div className="flex items-baseline justify-between gap-3">
                <span className="cq-label">Preview{p ? ` / ${p.label}` : ''}</span>
                <span className="text-[12px] text-faint">Close to the real thing, not exact</span>
              </div>
              <Preview post={draft} />
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer
          className="flex shrink-0 items-center gap-2 border-t border-line bg-ink py-3"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          {!isNew && (
            <button type="button" className="cq-btn-ghost hidden text-danger hover:text-danger sm:inline-flex" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Delete
            </button>
          )}
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <button type="button" className="cq-btn-ghost" onClick={() => onPromote(draft)}>
              <Mail size={16} /> Promote via email
            </button>
            {draft.status !== 'posted' && (
              <button type="button" className="cq-btn-quiet" onClick={() => onMarkPosted(draft)}>
                <CheckCircle2 size={16} /> Mark as posted
              </button>
            )}
          </div>
          <button ref={moreBtn} type="button" className="cq-icon-btn border border-line sm:hidden" aria-label="More actions" aria-haspopup="menu" onClick={() => setMoreOpen((o) => !o)}>
            <MoreHorizontal size={18} />
          </button>
          <Menu anchor={moreBtn.current} open={moreOpen} onClose={() => setMoreOpen(false)} align="start">
            <MenuItem icon={Mail} onSelect={() => (setMoreOpen(false), onPromote(draft))}>
              Promote via email
            </MenuItem>
            {draft.status !== 'posted' && (
              <MenuItem icon={CheckCircle2} onSelect={() => (setMoreOpen(false), onMarkPosted(draft))}>
                Mark as posted
              </MenuItem>
            )}
            {!isNew && (
              <MenuItem icon={Trash2} danger onSelect={() => (setMoreOpen(false), setConfirmDelete(true))}>
                Delete
              </MenuItem>
            )}
          </Menu>
          <button type="button" className="cq-btn-primary min-w-[132px] flex-1 sm:flex-none" onClick={save}>
            {isNew ? 'Add to queue' : 'Save changes'}
          </button>
        </footer>
      </div>

      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Discard your changes?"
        description="You have edits that are not saved yet. Closing now throws them away."
        width={420}
        labelledBy="cq-discard-title"
        footer={
          <>
            <button className="cq-btn-quiet" data-autofocus onClick={() => setConfirmClose(false)}>
              Keep editing
            </button>
            <button className="cq-btn cq-btn-quiet border-danger/50 text-danger hover:bg-danger/10" onClick={onClose}>
              Discard changes
            </button>
          </>
        }
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this post?"
        description={`"${draft.title || 'Untitled post'}" leaves the queue. You can undo for a few seconds after.`}
        width={420}
        labelledBy="cq-delete-title"
        footer={
          <>
            <button className="cq-btn-quiet" data-autofocus onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button className="cq-btn cq-btn-quiet border-danger/50 text-danger hover:bg-danger/10" onClick={() => onDelete(initial)}>
              Delete post
            </button>
          </>
        }
      />
      <span className="sr-only" aria-live="polite">
        {statusLabel}
      </span>
    </div>
  )
}

function Field({ id, label, hint, error, children, as = 'div' }) {
  const Tag = as
  return (
    <Tag className="m-0 min-w-0 border-0 p-0">
      {as === 'fieldset' ? (
        <legend className="cq-field-label">{label}</legend>
      ) : (
        <label htmlFor={id} className="cq-field-label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-2 text-[13px] leading-snug text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-[12.5px] leading-snug text-faint">{hint}</p>
      ) : null}
    </Tag>
  )
}

function AutoGrow({ id, value, onChange, invalid, placeholder }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(180, el.scrollHeight + 2)}px`
  }, [value])
  return (
    <textarea
      id={id}
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid}
      placeholder={placeholder}
      className="cq-input min-h-[180px] resize-none overflow-hidden rounded-b-none text-[15.5px] leading-[1.6]"
    />
  )
}

function Counter({ m, platform }) {
  const pct = m.limit ? Math.min(1, m.ratio) : 0
  const near = m.limit && m.ratio >= 0.9 && !m.over
  const tone = m.over ? 'bg-danger' : near ? 'bg-ember' : 'bg-mute'
  return (
    <div className="rounded-b-[10px] border border-t-0 border-line bg-panel px-3 py-2.5">
      {m.limit ? (
        <div className="mb-2 h-[3px] overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className={`h-full rounded-full transition-[width] duration-200 ${tone}`} style={{ width: `${pct * 100}%` }} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={`font-mono text-[12px] tabular-nums ${m.over ? 'text-danger' : near ? 'text-ember' : 'text-bone'}`} aria-live="polite">
          {m.label ? `${m.label} ` : ''}
          {m.used.toLocaleString()}
          {m.limit ? ` / ${m.limit.toLocaleString()}` : platform ? '' : ' characters'}
        </span>
        {m.over && <span className="text-[12px] text-danger">{m.soft ? 'Long subject lines get cut off in most inboxes' : `${(m.used - m.limit).toLocaleString()} over`}</span>}
        {m.extra?.map((x) => (
          <span key={x} className="text-[12px] text-faint">
            {x}
          </span>
        ))}
        {platform?.id === 'x' && <span className="text-[12px] text-faint">Links count as 23</span>}
      </div>
    </div>
  )
}
