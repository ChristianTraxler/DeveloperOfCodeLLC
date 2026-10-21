import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Dialog } from './overlay'
import { isUrl } from './Composer'
import { fromInputs, monthDay, toInputs } from '../lib/dates'
import { PLATFORM_BY_ID } from '../lib/platforms'
import { useQueue } from '../data/QueueContext'

export function MarkPostedDialog({ post, onCancel, onConfirm }) {
  const [url, setUrl] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!post) return
    const past = post.scheduledAt && new Date(post.scheduledAt) < new Date()
    const v = toInputs(past ? post.scheduledAt : new Date().toISOString())
    setUrl(post.liveUrl || '')
    setDate(v.date)
    setTime(v.time)
    setError('')
  }, [post])

  const submit = (e) => {
    e?.preventDefault()
    const u = url.trim()
    if (!u) return setError('Paste the link to the live post so you can open it from the queue.')
    if (!isUrl(u)) return setError('That link needs to start with https:// to open.')
    onConfirm(post, { liveUrl: u, postedAt: fromInputs(date, time) || new Date().toISOString() })
  }

  const where = PLATFORM_BY_ID[post?.platform]?.label
  return (
    <Dialog
      open={!!post}
      onClose={onCancel}
      title="Mark as posted"
      description={`"${post?.title || 'Untitled post'}"${where ? ` on ${where}` : ''}. Save the live link so the queue can take you straight to it.`}
      labelledBy="cq-posted-title"
      footer={
        <>
          <button className="cq-btn-quiet" onClick={onCancel}>
            Cancel
          </button>
          <button className="cq-btn-primary" onClick={submit}>
            <Check size={16} /> Mark as posted
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="cq-posted-url" className="cq-field-label">
            Live post link
          </label>
          <input
            id="cq-posted-url"
            data-autofocus
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => (setUrl(e.target.value), setError(''))}
            placeholder="https://"
            aria-invalid={!!error}
            aria-describedby="cq-posted-help"
            className="cq-input"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <p id="cq-posted-help" className={`mt-2 text-[13px] leading-snug ${error ? 'text-danger' : 'text-faint'}`} role={error ? 'alert' : undefined}>
            {error || 'Open the post, use its Share or Copy link option, and paste it here.'}
          </p>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="cq-field-label">Went out on</legend>
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2.5">
            <input id="cq-posted-date" aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="cq-input" />
            <input id="cq-posted-time" aria-label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="cq-input" />
          </div>
        </fieldset>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  )
}

const AUDIENCES = [
  { id: 'clients', label: 'Current clients' },
  { id: 'past', label: 'Past clients' },
  { id: 'leads', label: 'Leads who opted in' },
]

export function PromoteDialog({ post, onCancel, onSave, onRemove }) {
  const { accountById } = useQueue()
  const [aud, setAud] = useState(['leads'])
  const [error, setError] = useState('')
  useEffect(() => {
    if (post) {
      setAud(post.promo?.audiences?.length ? post.promo.audiences : ['leads'])
      setError('')
    }
  }, [post])

  const account = accountById(post?.account)
  const pre = (post?.body || post?.notes || '').replace(/\s+/g, ' ').trim().slice(0, 150)
  const toggle = (id) => (setError(''), setAud((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id])))

  return (
    <Dialog
      open={!!post}
      onClose={onCancel}
      width={520}
      title="Promote via email"
      description="Sending arrives with the Marketing tool. Save this post as a promotion now and it will be waiting there, with the audience already picked."
      labelledBy="cq-promo-title"
      footer={
        <>
          {post?.promo && (
            <button className="cq-btn-ghost mr-auto" onClick={() => onRemove(post)}>
              Remove promotion
            </button>
          )}
          <button className="cq-btn-quiet" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="cq-btn-primary"
            data-autofocus
            onClick={() => (aud.length ? onSave(post, aud) : setError('Pick at least one group to send to.'))}
          >
            {post?.promo ? 'Update promotion' : 'Save for Marketing'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="overflow-hidden rounded-[12px] border border-line bg-well">
          <div className="border-b border-line px-4 py-3">
            <div className="cq-label mb-1.5">Email preview</div>
            <div className="text-[13px] text-mute">From {account.name}</div>
            <div className="mt-0.5 font-display text-[17px] font-[450] leading-snug text-bone">{post?.title || 'Untitled post'}</div>
          </div>
          <div className="px-4 py-3.5 text-[14px] leading-relaxed text-mute">
            {pre ? `${pre}${pre.length >= 150 ? '...' : ''}` : 'The email will use the opening of the post.'}
            <div className="mt-3">
              <span className="inline-flex rounded-[8px] border border-line2 px-3 py-1.5 text-[13px] text-bone">{post?.liveUrl ? 'Read the full post' : 'Link added once posted'}</span>
            </div>
          </div>
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="cq-field-label">Send to</legend>
          <div className="flex flex-col gap-1.5">
            {AUDIENCES.map((a) => {
              const on = aud.includes(a.id)
              return (
                <label key={a.id} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 text-[14.5px] transition-colors ${on ? 'border-line2 bg-raised text-bone' : 'border-line text-mute hover:border-line2'}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="peer sr-only" id={`cq-aud-${a.id}`} />
                  <span className={`grid h-5 w-5 place-items-center rounded-[5px] border peer-focus-visible:ring-2 peer-focus-visible:ring-ember/70 ${on ? 'border-bone bg-bone text-ink' : 'border-line2'}`} aria-hidden="true">
                    {on && <Check size={14} strokeWidth={2.5} />}
                  </span>
                  {a.label}
                </label>
              )
            })}
          </div>
          {error && (
            <p className="mt-2 text-[13px] text-danger" role="alert">
              {error}
            </p>
          )}
        </fieldset>
        {post?.promo && <p className="text-[13px] text-faint">Saved {monthDay(post.promo.queuedAt)}.</p>}
      </div>
    </Dialog>
  )
}
