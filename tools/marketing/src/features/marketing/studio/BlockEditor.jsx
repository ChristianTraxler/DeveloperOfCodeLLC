// The settings for one section of an email.
import { useRef, useState } from 'react'
import { ArrowLeft, Copy, Trash2, Upload, Check, ChevronUp, ChevronDown, Plus, X, PanelTop, Heading, AlignLeft, Image as ImageIcon, MousePointerClick, Ticket, LayoutTemplate, ListChecks, ListOrdered, Quote, Contact, Minus, MoveVertical, PanelBottom } from 'lucide-react'
import { BLOCK_INFO } from '../data/blocks.js'
import { IMAGES, WORK, SERVICES, LINKS, BUSINESS, imageById, workById, mailto } from '../data/library.js'
import { Button, cx } from '../ui/core.jsx'
import { Field, Input, Textarea, Segmented, Switch, Select } from '../ui/fields.jsx'
import { fileToDataUrl } from '../ui/hooks.js'
import { useToast } from '../ui/Toast.jsx'
import { RichText } from './RichText.jsx'
import { MERGE_TAGS } from '../lib/rich.js'

export const BLOCK_ICONS = {
  header: PanelTop,
  heading: Heading,
  text: AlignLeft,
  image: ImageIcon,
  button: MousePointerClick,
  offer: Ticket,
  work: LayoutTemplate,
  services: ListChecks,
  steps: ListOrdered,
  quote: Quote,
  contact: Contact,
  divider: Minus,
  spacer: MoveVertical,
  footer: PanelBottom,
}

// Text input with buttons that drop a merge tag at the cursor
export function TagInput({ id, value, onChange, placeholder, multiline = false, rows = 2, maxHint }) {
  const ref = useRef(null)
  const insert = (token) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }
  const Comp = multiline ? Textarea : Input
  return (
    <div>
      <Comp ref={ref} id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} size="sm" rows={rows} />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {MERGE_TAGS.map((t) => (
          <button key={t.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(t.token)} className="h-7 rounded-full border border-line px-2.5 text-[12px] font-medium text-mute transition-colors hover:border-ember/40 hover:text-bone">
            + {t.label}
          </button>
        ))}
        {maxHint && <span className="ml-auto text-[12px] tabular-nums text-faint">{maxHint}</span>}
      </div>
    </div>
  )
}

const ALIGN = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
]

function HeaderForm({ block, set }) {
  return (
    <div className="space-y-6">
      <Field label="Layout">
        <div className="grid grid-cols-2 gap-2">
          {[
            ['left', 'Logo on the left'],
            ['center', 'Centered logo'],
            ['band', 'Dark band'],
            ['minimal', 'Small logo only'],
          ].map(([v, label]) => (
            <button key={v} type="button" aria-pressed={block.layout === v} onClick={() => set({ layout: v })} className={cx('flex h-11 items-center justify-center rounded-[12px] border px-3 text-[13.5px] font-medium transition-colors', block.layout === v ? 'border-ember/60 bg-ember/10 text-bone' : 'border-line2 text-mute hover:text-bone')}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      {block.layout !== 'minimal' && (
        <>
          <Switch checked={block.showTagline} onChange={(v) => set({ showTagline: v })} label="Show a tagline" hint={`Under or beside your logo, like "${BUSINESS.tagline}".`} />
          {block.showTagline && (
            <Field label="Tagline" htmlFor="e-tagline">
              <Input id="e-tagline" value={block.tagline} onChange={(e) => set({ tagline: e.target.value }, 'tagline')} size="sm" />
            </Field>
          )}
        </>
      )}
    </div>
  )
}

function HeadingForm({ block, set }) {
  return (
    <div className="space-y-6">
      <Field label="Small line above (optional)" htmlFor="e-eyebrow" hint="A short label, like the month or what this is about.">
        <Input id="e-eyebrow" value={block.eyebrow} onChange={(e) => set({ eyebrow: e.target.value }, 'eyebrow')} size="sm" placeholder="October studio notes" />
      </Field>
      <Field label="Headline" htmlFor="e-heading">
        <TagInput id="e-heading" value={block.text} onChange={(v) => set({ text: v }, 'text')} placeholder="Say the main thing in a few words" multiline rows={2} />
      </Field>
      <Field label="Size">
        <Segmented value={block.size} onChange={(v) => set({ size: v })} label="Headline size" options={[{ value: 'm', label: 'Medium' }, { value: 'l', label: 'Large' }, { value: 'xl', label: 'Extra large' }]} />
      </Field>
      <Field label="Alignment">
        <Segmented value={block.align} onChange={(v) => set({ align: v })} label="Alignment" options={ALIGN} />
      </Field>
    </div>
  )
}

function TextForm({ block, set }) {
  return (
    <div className="space-y-6">
      <RichText id="e-text" value={block.html} onChange={(html) => set({ html }, 'html')} placeholder="Write a few lines. Short paragraphs read best on phones." />
      <Field label="Alignment">
        <Segmented value={block.align} onChange={(v) => set({ align: v })} label="Alignment" options={ALIGN} />
      </Field>
      <Field label="Style">
        <Segmented value={block.tone} onChange={(v) => set({ tone: v })} label="Text style" options={[{ value: 'normal', label: 'Normal' }, { value: 'fine', label: 'Small print' }]} />
      </Field>
    </div>
  )
}

function ImageForm({ block, set }) {
  const toast = useToast()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const choose = (img) => set({ image: img.id, upload: null, uploadName: '', alt: block.alt && block.upload ? '' : img.alt })
  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const data = await fileToDataUrl(file)
      set({ upload: data, uploadName: file.name.replace(/\.[^.]+$/, ''), alt: '' })
      toast('Photo added. Give it a short description below.')
    } catch {
      toast("That file couldn't be opened as a photo. Try a JPG or PNG.", { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }
  const groups = [
    ['work', 'Sites you built'],
    ['studio', 'Studio graphics'],
  ]
  return (
    <div className="space-y-6">
      {groups.map(([g, label]) => (
        <Field key={g} label={label}>
          <div className="grid grid-cols-2 gap-2">
            {IMAGES.filter((i) => i.group === g).map((img) => {
              const on = !block.upload && block.image === img.id
              return (
                <button key={img.id} type="button" onClick={() => choose(img)} aria-pressed={on} className={cx('group relative overflow-hidden rounded-[12px] border-2 text-left transition-colors', on ? 'border-ember' : 'border-transparent hover:border-line2')}>
                  <img src={img.src} alt="" className="block aspect-[16/10] w-full object-cover" />
                  <span className="block truncate bg-raised px-2.5 py-1.5 text-[12px] text-mute">{img.name}</span>
                  {on && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ember text-[#1c0a02]">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Field>
      ))}
      <div>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Upload a photo" />
        <button type="button" onClick={() => fileRef.current?.click()} className={cx('flex w-full items-center gap-3 rounded-[14px] border border-dashed px-4 py-4 text-left transition-colors', block.upload ? 'border-ember/60 bg-ember/[0.06]' : 'border-line2 hover:border-ember/50')}>
          {block.upload ? <img src={block.upload} alt="" className="h-12 w-16 shrink-0 rounded-[8px] object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] border border-line2 text-mute"><Upload size={18} /></span>}
          <span className="min-w-0">
            <span className="block text-[14.5px] font-medium">{busy ? 'Adding your photo...' : block.upload ? block.uploadName || 'Your photo' : 'Upload your own photo'}</span>
            <span className="block text-[12.5px] text-faint">{block.upload ? 'Tap to swap it for another' : 'JPG or PNG. Resized to fit email.'}</span>
          </span>
        </button>
      </div>
      <Field label="Describe the image" htmlFor="e-alt" hint="Shown when inboxes hide images, and read aloud by screen readers.">
        <Input id="e-alt" value={block.alt} onChange={(e) => set({ alt: e.target.value }, 'alt')} size="sm" placeholder={block.upload ? 'What is in your photo?' : imageById(block.image)?.alt} />
      </Field>
      <Field label="Link (optional)" htmlFor="e-imglink" hint="Where people go if they tap the image.">
        <Input id="e-imglink" value={block.url} onChange={(e) => set({ url: e.target.value }, 'url')} size="sm" placeholder="https://" />
      </Field>
      <Field label="Width">
        <Segmented value={block.width} onChange={(v) => set({ width: v })} label="Image width" options={[{ value: 'full', label: 'Edge to edge' }, { value: 'inset', label: 'With margins' }]} />
      </Field>
    </div>
  )
}

function linkKind(url) {
  if (!url) return 'site'
  if (url.startsWith('mailto:')) return 'email'
  if (url.startsWith('tel:')) return 'call'
  if (url === BUSINESS.website) return 'site'
  if (url === LINKS.find((l) => l.id === 'bll').url) return 'bll'
  const w = WORK.find((x) => x.url === url)
  if (w) return `work:${w.id}`
  return 'custom'
}

function ButtonForm({ block, set }) {
  const kind = linkKind(block.url)
  const subject = block.url?.startsWith('mailto:') ? decodeURIComponent((block.url.split('subject=')[1] || '').replace(/\+/g, ' ')) : ''
  const options = [
    { value: 'site', label: 'Your website' },
    { value: 'email', label: 'Reply by email' },
    { value: 'call', label: 'Call you' },
    { value: 'bll', label: 'BusinessLaunchList' },
    ...WORK.map((w) => ({ value: `work:${w.id}`, label: `${w.name} site` })),
    { value: 'custom', label: 'Another web address' },
  ]
  const pick = (v) => {
    if (v === 'site') set({ url: BUSINESS.website })
    else if (v === 'email') set({ url: mailto(subject || block.label || '') })
    else if (v === 'call') set({ url: BUSINESS.phoneHref })
    else if (v === 'bll') set({ url: LINKS.find((l) => l.id === 'bll').url })
    else if (v.startsWith('work:')) set({ url: workById(v.slice(5)).url })
    else set({ url: 'https://' })
  }
  return (
    <div className="space-y-6">
      <Field label="Button text" htmlFor="e-btn" hint="Say what happens: Book a call, See the site, Reply to grab a spot.">
        <Input id="e-btn" value={block.label} onChange={(e) => set({ label: e.target.value }, 'label')} size="sm" />
      </Field>
      <Field label="Where it goes" htmlFor="e-btnlink">
        <Select id="e-btnlink" value={kind} onChange={pick} options={options} />
      </Field>
      {kind === 'email' && (
        <Field label="Email subject" htmlFor="e-btnsubj" hint={`Opens a new email to ${BUSINESS.email} with this subject.`}>
          <Input id="e-btnsubj" value={subject} onChange={(e) => set({ url: mailto(e.target.value) }, 'url')} size="sm" />
        </Field>
      )}
      {kind === 'custom' && (
        <Field label="Web address" htmlFor="e-btnurl">
          <Input id="e-btnurl" value={block.url} onChange={(e) => set({ url: e.target.value }, 'url')} size="sm" placeholder="https://" inputMode="url" />
        </Field>
      )}
      <Field label="Style">
        <Segmented value={block.style} onChange={(v) => set({ style: v })} label="Button style" options={[{ value: 'filled', label: 'Filled' }, { value: 'outline', label: 'Outline' }, { value: 'link', label: 'Text link' }]} />
      </Field>
      <Field label="Alignment">
        <Segmented value={block.align} onChange={(v) => set({ align: v })} label="Alignment" options={ALIGN} />
      </Field>
    </div>
  )
}

function OfferForm({ block, set }) {
  return (
    <div className="space-y-5">
      <Field label="Small label" htmlFor="e-olabel">
        <Input id="e-olabel" value={block.label} onChange={(e) => set({ label: e.target.value }, 'label')} size="sm" placeholder="This month only" />
      </Field>
      <Field label="The offer" htmlFor="e-ohead">
        <Input id="e-ohead" value={block.headline} onChange={(e) => set({ headline: e.target.value }, 'headline')} size="sm" placeholder="Free site checkup" />
      </Field>
      <Field label="Details" htmlFor="e-odetails">
        <Textarea id="e-odetails" value={block.details} onChange={(e) => set({ details: e.target.value }, 'details')} rows={2} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code (optional)" htmlFor="e-ocode">
          <Input id="e-ocode" value={block.code} onChange={(e) => set({ code: e.target.value.toUpperCase() }, 'code')} size="sm" placeholder="CHECKUP" />
        </Field>
        <Field label="Good through" htmlFor="e-oends">
          <Input id="e-oends" type="date" value={block.ends} onChange={(e) => set({ ends: e.target.value })} size="sm" />
        </Field>
      </div>
      <Field label="Fine print" htmlFor="e-onote">
        <Input id="e-onote" value={block.note} onChange={(e) => set({ note: e.target.value }, 'note')} size="sm" />
      </Field>
    </div>
  )
}

function PickList({ items, selected, max, onToggle, render }) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const index = selected.indexOf(item.id)
        const on = index >= 0
        const full = !on && max && selected.length >= max
        return (
          <button key={item.id} type="button" disabled={full} aria-pressed={on} onClick={() => onToggle(item.id)} className={cx('flex w-full items-center gap-3 rounded-[14px] border p-2.5 text-left transition-colors disabled:opacity-40', on ? 'border-ember/60 bg-ember/[0.07]' : 'border-line hover:border-line2')}>
            {render(item)}
            <span className={cx('ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold', on ? 'bg-ember text-[#1c0a02]' : 'border border-line2 text-transparent')}>{on ? (max ? index + 1 : <Check size={14} strokeWidth={3} />) : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

function WorkForm({ block, set }) {
  const toggle = (id) => set({ items: block.items.includes(id) ? block.items.filter((x) => x !== id) : [...block.items, id].slice(0, 3) })
  return (
    <div className="space-y-6">
      <Field label="Section title (optional)" htmlFor="e-wtitle">
        <Input id="e-wtitle" value={block.title} onChange={(e) => set({ title: e.target.value }, 'title')} size="sm" placeholder="Recent work" />
      </Field>
      <Field label="Projects" aside={`${block.items.length} of 3`} hint="They show in the order you pick them. Once connected, this list comes from shipped projects in your Projects Tracker.">
        <PickList
          items={WORK}
          selected={block.items}
          max={3}
          onToggle={toggle}
          render={(w) => (
            <>
              <img src={imageById(w.image).src} alt="" className="h-12 w-[76px] shrink-0 rounded-[8px] object-cover" />
              <span className="min-w-0">
                <span className="block truncate text-[14.5px] font-medium">{w.name}</span>
                <span className="block truncate text-[12.5px] text-faint">{w.kind}</span>
              </span>
            </>
          )}
        />
      </Field>
      <Field label="Link text" htmlFor="e-wcta">
        <Input id="e-wcta" value={block.cta} onChange={(e) => set({ cta: e.target.value }, 'cta')} size="sm" />
      </Field>
    </div>
  )
}

function ServicesForm({ block, set }) {
  const toggle = (id) => {
    const next = block.items.includes(id) ? block.items.filter((x) => x !== id) : [...block.items, id]
    set({ items: SERVICES.map((s) => s.id).filter((s) => next.includes(s)) })
  }
  return (
    <div className="space-y-6">
      <Field label="Section title (optional)" htmlFor="e-stitle">
        <Input id="e-stitle" value={block.title} onChange={(e) => set({ title: e.target.value }, 'title')} size="sm" />
      </Field>
      <Field label="Services to show">
        <PickList
          items={SERVICES}
          selected={block.items}
          onToggle={toggle}
          render={(s) => (
            <span className="min-w-0">
              <span className="block text-[14.5px] font-medium">{s.name}</span>
              <span className="block text-[12.5px] leading-snug text-faint">{s.line}</span>
            </span>
          )}
        />
      </Field>
    </div>
  )
}

function StepsForm({ block, set }) {
  const update = (i, patch, key) => set({ items: block.items.map((s, j) => (j === i ? { ...s, ...patch } : s)) }, key)
  const move = (i, dir) => {
    const items = block.items.slice()
    const j = i + dir
    if (j < 0 || j >= items.length) return
    ;[items[i], items[j]] = [items[j], items[i]]
    set({ items })
  }
  return (
    <div className="space-y-6">
      <Field label="Section title (optional)" htmlFor="e-sttitle">
        <Input id="e-sttitle" value={block.title} onChange={(e) => set({ title: e.target.value }, 'title')} size="sm" placeholder="How it works" />
      </Field>
      <ol className="space-y-3">
        {block.items.map((s, i) => (
          <li key={i} className="rounded-[16px] border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-ember/15 text-[13px] font-bold text-[#ff9a6e]">{i + 1}</span>
              <span className="text-[13px] text-faint">Step {i + 1}</span>
              <span className="ml-auto flex">
                <button type="button" aria-label="Move step up" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-white/[0.07] disabled:opacity-30">
                  <ChevronUp size={16} />
                </button>
                <button type="button" aria-label="Move step down" disabled={i === block.items.length - 1} onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-white/[0.07] disabled:opacity-30">
                  <ChevronDown size={16} />
                </button>
                <button type="button" aria-label="Remove step" disabled={block.items.length <= 2} onClick={() => set({ items: block.items.filter((_, j) => j !== i) })} className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-white/[0.07] disabled:opacity-30">
                  <X size={16} />
                </button>
              </span>
            </div>
            <Input value={s.title} onChange={(e) => update(i, { title: e.target.value }, `t${i}`)} size="sm" aria-label={`Step ${i + 1} title`} placeholder="Step name" />
            <Textarea className="mt-2" value={s.text} onChange={(e) => update(i, { text: e.target.value }, `x${i}`)} rows={2} aria-label={`Step ${i + 1} description`} placeholder="What happens in this step" />
          </li>
        ))}
      </ol>
      {block.items.length < 5 && (
        <Button variant="ghost" onClick={() => set({ items: [...block.items, { title: '', text: '' }] })}>
          <Plus size={16} /> Add a step
        </Button>
      )}
    </div>
  )
}

function QuoteForm({ block, set }) {
  return (
    <div className="space-y-5">
      <div className="rounded-[14px] border border-line bg-white/[0.02] p-3.5 text-[13px] leading-relaxed text-mute">Use a client's real words, and ask them first. A short line about what changed for them works best.</div>
      <Field label="Their words" htmlFor="e-qtext">
        <Textarea id="e-qtext" value={block.text} onChange={(e) => set({ text: e.target.value }, 'text')} rows={3} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" htmlFor="e-qname">
          <Input id="e-qname" value={block.name} onChange={(e) => set({ name: e.target.value }, 'name')} size="sm" />
        </Field>
        <Field label="Business" htmlFor="e-qbiz">
          <Input id="e-qbiz" value={block.business} onChange={(e) => set({ business: e.target.value }, 'business')} size="sm" />
        </Field>
      </div>
    </div>
  )
}

function ContactForm({ block, set, settings }) {
  return (
    <div className="space-y-3">
      <Switch checked={block.phone} onChange={(v) => set({ phone: v })} label="Phone" hint={settings.phone || BUSINESS.phone} />
      <Switch checked={block.email} onChange={(v) => set({ email: v })} label="Email" hint={settings.replyTo || BUSINESS.email} />
      <Switch checked={block.website} onChange={(v) => set({ website: v })} label="Website" hint={BUSINESS.websiteLabel} />
    </div>
  )
}

function FooterForm({ block, set, settings, onOpenSettings }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[16px] border border-line bg-white/[0.02] p-4 text-[14px] leading-relaxed">
        <p className="font-medium">Added to every email for you</p>
        <ul className="mt-2 space-y-1 text-mute">
          <li>Your business name and mailing address</li>
          <li>An unsubscribe link that works on its own</li>
        </ul>
        <p className={cx('mt-3 text-[13px]', settings.mailingAddress?.trim() ? 'text-faint' : 'text-[#ff9a6e]')}>{settings.mailingAddress?.trim() ? settings.mailingAddress.split('\n').join(', ') : 'Your mailing address is missing.'}</p>
        <Button variant="ghost" size="xs" className="mt-3" onClick={() => onOpenSettings('address')}>
          Edit mailing address
        </Button>
      </div>
      <Field label="Why they're getting this" htmlFor="e-reason" hint="One plain sentence. It helps people remember they asked to hear from you.">
        <Textarea id="e-reason" value={block.reason} onChange={(e) => set({ reason: e.target.value }, 'reason')} rows={3} />
      </Field>
    </div>
  )
}

function DividerForm({ block, set }) {
  return (
    <Field label="Style">
      <Segmented value={block.style} onChange={(v) => set({ style: v })} label="Divider style" options={[{ value: 'line', label: 'Thin line' }, { value: 'dots', label: 'Three dots' }]} />
    </Field>
  )
}

function SpacerForm({ block, set }) {
  return (
    <Field label="Height">
      <Segmented value={block.size} onChange={(v) => set({ size: v })} label="Space height" options={[{ value: 's', label: 'Small' }, { value: 'm', label: 'Medium' }, { value: 'l', label: 'Large' }]} />
    </Field>
  )
}

const FORMS = { divider: DividerForm, spacer: SpacerForm, header: HeaderForm, heading: HeadingForm, text: TextForm, image: ImageForm, button: ButtonForm, offer: OfferForm, work: WorkForm, services: ServicesForm, steps: StepsForm, quote: QuoteForm, contact: ContactForm, footer: FooterForm }

export function BlockEditor({ block, onPatch, onBack, onDuplicate, onRemove, settings, onOpenSettings }) {
  const Form = FORMS[block.type]
  const info = BLOCK_INFO[block.type]
  const Icon = BLOCK_ICONS[block.type]
  const fixed = block.type === 'header' || block.type === 'footer'
  const set = (patch, key) => onPatch(patch, key ? `${block.id}:${key}` : null)
  return (
    <div className="px-4 pb-10 pt-4 sm:px-6">
      <div className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-2 border-b border-line bg-ink/90 px-2 py-2 backdrop-blur-xl sm:-mx-6 sm:px-4">
        <button type="button" onClick={onBack} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-mute transition-colors hover:bg-white/[0.07] hover:text-bone">
          <ArrowLeft size={17} /> All sections
        </button>
        {!fixed && (
          <span className="ml-auto flex">
            <button type="button" onClick={onDuplicate} aria-label="Duplicate this section" title="Duplicate" className="grid h-10 w-10 place-items-center rounded-full text-mute hover:bg-white/[0.07] hover:text-bone">
              <Copy size={17} />
            </button>
            <button type="button" onClick={onRemove} aria-label="Remove this section" title="Remove" className="grid h-10 w-10 place-items-center rounded-full text-mute hover:bg-danger/10 hover:text-danger">
              <Trash2 size={17} />
            </button>
          </span>
        )}
      </div>
      <div className="mb-6 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-ember/25 bg-ember/10 text-ember">
          <Icon size={19} />
        </span>
        <div>
          <h3 className="wide text-[19px] font-semibold leading-tight">{info.label}</h3>
          <p className="mt-0.5 text-[13.5px] text-mute">{info.hint}</p>
        </div>
      </div>
      {Form ? <Form block={block} set={set} settings={settings} onOpenSettings={onOpenSettings} /> : <p className="text-[14px] text-mute">Nothing to set here. Use the arrows in the list to move it.</p>}
    </div>
  )
}
