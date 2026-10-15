// Phase 4: the leads list (#/leads), one lead (#/leads/<id>), and the lead box on a review.
// A lead holds every review of one business, its score history and the day 0, 1, 3 and 7
// follow-ups after the report goes out.
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check, Copy, Mail, Phone, Plus, RotateCw, Trash2, UserRound } from 'lucide-react'
import { api, isDemo } from './api.js'
import { Button, Field, Input, inputClass } from './ui/core.jsx'
import { Sheet } from './ui/Sheet.jsx'
import { useToast } from './ui/Toast.jsx'
import { cx, domainOf, plural, when } from './lib.js'
import { payMessage } from '../../../../../api/_lib/seo-leads.mjs'

const DAY = 86_400_000
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const fDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dayLabel = (iso) => (iso ? fDay.format(new Date(`${iso}T00:00:00Z`)) : '')

// "Overdue 2 days", "Today", "Tomorrow", "Oct 22", with a tone.
export function dueInfo(iso) {
  if (!iso) return { text: 'No follow-up set', tone: 'text-faint' }
  const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / DAY)
  if (days < 0) return { text: `Overdue ${plural(-days, 'day')}`, tone: 'text-danger', due: true }
  if (days === 0) return { text: 'Due today', tone: 'text-amber', due: true }
  if (days === 1) return { text: 'Tomorrow', tone: 'text-bone' }
  return { text: dayLabel(iso), tone: 'text-mute' }
}

// The payment link for one request, and the note to send the client with it.
function RequestPay({ request, business, onSave }) {
  const toast = useToast()
  const [link, setLink] = useState(request.payUrl || '')
  const [copied, setCopied] = useState(false)
  useEffect(() => setLink(request.payUrl || ''), [request.payUrl])
  const id = `pay-${request.id}`
  const dirty = link.trim() !== (request.payUrl || '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payMessage(request, business))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      toast('Copied. Paste it into your email or text to the client.')
    } catch {
      toast('Copying did not work in this browser.')
    }
  }

  return (
    <div className="mt-4 border-t border-ember/20 pt-4">
      <label htmlFor={id} className="mb-2 block text-[13.5px] font-medium text-bone/85">
        Payment link
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && dirty && onSave(link.trim())}
          placeholder="Paste a Stripe, Square or PayPal link"
          className="sm:flex-1"
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="lg" className="flex-1 sm:flex-none" disabled={!dirty} onClick={() => onSave(link.trim())}>
            Save
          </Button>
          <Button variant="ember" size="lg" className="flex-1 sm:flex-none" disabled={!request.payUrl || dirty} onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy message'}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-faint">
        {request.price ? `Listed as ${request.price}. Edit the price in the message if you quoted an exact tier.` : 'No package picked, so the message leaves the price out.'}
      </p>
    </div>
  )
}

const STATUS_TONE = {
  new: 'border-line2 text-mute',
  audit_run: 'border-line2 text-bone',
  report_sent: 'border-ember/40 text-ember',
  walkthrough: 'border-ember/40 text-ember',
  proposal: 'border-amber/40 text-amber',
  won: 'border-live/40 text-live',
  lost: 'border-line2 text-faint',
}
const scoreTone = (n) => (n == null ? 'text-faint' : n >= 80 ? 'text-live' : n >= 50 ? 'text-amber' : 'text-danger')

function StatusChip({ status, meta }) {
  return <span className={cx('inline-flex h-7 items-center rounded-full border px-3 text-[12.5px] font-medium', STATUS_TONE[status])}>{meta?.leadStatuses?.[status] || status}</span>
}

const selectClass = cx(inputClass, 'h-[52px] appearance-none pr-10')
// The same field look without the full width, for selects that sit inline.
const inlineSelect = inputClass.replace('w-full ', '')
function Select({ value, onChange, options, id, placeholder }) {
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={selectClass}>
      {placeholder && <option value="">{placeholder}</option>}
      {Object.entries(options).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  )
}

// ── The form, for a new lead or to edit one ─────────────────────────────────

const EMPTY = { business: '', site: '', city: '', service: '', contact: '', email: '', phone: '', source: null, status: 'new', carePlan: false, notes: '' }

function LeadForm({ open, onClose, initial, meta, onSaved, fromAuditId }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ...initial })
      setError(null)
    }
  }, [open, initial])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))
  const submit = async (e) => {
    e.preventDefault()
    if (!form.business.trim()) return setError('Enter the business name.')
    setSaving(true)
    setError(null)
    try {
      const { id, business, site, city, service, contact, email, phone, source, status, carePlan, notes } = form
      const out = await api.saveLead({ ...(id ? { id } : {}), ...(fromAuditId ? { fromAuditId } : {}), business, site, city, service, contact, email, phone, source, status, carePlan, notes })
      onSaved(out)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  const text = (key, label, props = {}) => (
    <Field label={label} htmlFor={`lead-${key}`}>
      <Input id={`lead-${key}`} value={form[key] || ''} onChange={set(key)} {...props} />
    </Field>
  )
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={form.id ? 'Edit lead' : 'New lead'}
      kicker={fromAuditId ? 'From this review' : undefined}
      footer={
        <>
          {error && <p className="mr-auto text-[13.5px] text-danger">{error}</p>}
          <Button variant="quiet" onClick={onClose} className={error ? '' : 'mr-auto'}>
            Cancel
          </Button>
          <Button variant="ember" type="submit" form="lead-form" disabled={saving}>
            {saving ? 'Saving' : 'Save lead'}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={submit} noValidate className="space-y-5">
        {text('business', 'Business name', { 'data-autofocus': true, autoComplete: 'organization' })}
        {!fromAuditId && text('site', 'Website', { inputMode: 'url', autoCapitalize: 'off', placeholder: 'example.com' })}
        {!fromAuditId && (
          <div className="grid gap-5 sm:grid-cols-2">
            {text('city', 'City', { placeholder: 'Hickory, NC' })}
            {text('service', 'Main service', { placeholder: 'Roofing' })}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          {text('contact', 'Contact name', { autoComplete: 'name' })}
          {text('phone', 'Phone', { inputMode: 'tel', autoComplete: 'tel' })}
        </div>
        {text('email', 'Email', { type: 'email', inputMode: 'email', autoCapitalize: 'off', autoComplete: 'email' })}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Where the lead came from" htmlFor="lead-source">
            <Select id="lead-source" value={form.source} onChange={set('source')} options={meta?.leadSources || {}} placeholder="Pick one" />
          </Field>
          <Field label="Status" htmlFor="lead-status">
            <Select id="lead-status" value={form.status} onChange={(v) => set('status')(v || 'new')} options={meta?.leadStatuses || {}} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-mute">
          <input type="checkbox" checked={!!form.carePlan} onChange={set('carePlan')} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[rgb(var(--ember-rgb))]" />
          <span>
            <span className="font-medium text-bone">Website Care client.</span> Once won, the site is reviewed again every {meta?.rescanDays || 30} days and you get an email with the new score.
          </span>
        </label>
        <Field label="Notes" htmlFor="lead-notes">
          <textarea id="lead-notes" rows={4} value={form.notes || ''} onChange={set('notes')} className={cx(inputClass, 'py-3 leading-relaxed')} />
        </Field>
      </form>
    </Sheet>
  )
}

// ── On a review: which lead it belongs to ───────────────────────────────────

export function LeadControl({ audit, leads, meta, toast, onOpenLead, onLinked }) {
  const [form, setForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const lead = leads.find((l) => l.id === audit.lead_id)
  const link = async (leadId) => {
    setBusy(true)
    try {
      await api.linkReview(audit.id, leadId)
      onLinked(leadId)
      toast(leadId ? 'Filed under the lead.' : 'Taken off the lead.')
    } catch (e) {
      toast(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-label="Lead" className="mt-4 flex flex-col gap-4 rounded-[22px] border border-line bg-panel/60 p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[15.5px] font-semibold">
          <UserRound size={16} className="text-mute" /> {lead ? `Lead: ${lead.business}` : audit.lead_id ? 'Filed under a lead' : 'Not on a lead yet'}
        </p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-mute">
          {audit.lead_id ? 'The lead keeps every review of this business, the score history and the follow-ups.' : 'Make it a lead to track the follow-ups and see the score change over time.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {audit.lead_id ? (
          <>
            <Button variant="ghost" onClick={() => onOpenLead(audit.lead_id)}>
              Open lead <ArrowUpRight size={15} />
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => link(null)}>
              Take off
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setForm(true)}>
              <Plus size={15} /> New lead
            </Button>
            {leads.length > 0 && (
              <select aria-label="File under an existing lead" disabled={busy} value="" onChange={(e) => e.target.value && link(e.target.value)} className={cx(inlineSelect, 'h-10 w-auto max-w-[220px] appearance-none rounded-full pr-8 text-[14px]')}>
                <option value="">Add to a lead</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.business}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
      </div>
      <LeadForm
        open={form}
        onClose={() => setForm(false)}
        initial={{ business: audit.business_name }}
        fromAuditId={audit.id}
        meta={meta}
        onSaved={(out) => {
          setForm(false)
          onLinked(out.lead.id)
          toast(`Made a lead for ${out.lead.business}.`)
        }}
      />
    </section>
  )
}

// ── #/leads ─────────────────────────────────────────────────────────────────

const FILTERS = { open: 'Open', due: 'Due', won: 'Won', all: 'All' }

export function LeadsList({ onOpen, onBack }) {
  const [state, setState] = useState({ status: 'loading', leads: [], meta: null })
  const [filter, setFilter] = useState('open')
  const [form, setForm] = useState(false)
  const load = () =>
    api
      .listLeads()
      .then((d) => setState({ status: 'ready', ...d }))
      .catch((e) => setState((s) => ({ ...s, status: 'error', error: e.message })))
  useEffect(() => {
    load()
  }, [])

  const { leads, meta } = state
  const shown = leads.filter((l) =>
    filter === 'all' ? true : filter === 'won' ? l.status === 'won' : filter === 'due' ? dueInfo(l.nextFollowUp).due && l.status !== 'won' && l.status !== 'lost' : l.status !== 'won' && l.status !== 'lost',
  )
  const dueCount = leads.filter((l) => dueInfo(l.nextFollowUp).due && l.status !== 'won' && l.status !== 'lost').length

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-10">
      <Button variant="quiet" onClick={onBack} className="-ml-3">
        <ArrowLeft size={16} /> Reviews
      </Button>
      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-[clamp(52px,12vw,96px)] leading-[0.88]">Leads</h1>
          <p className="mt-5 max-w-[44ch] text-[16px] leading-relaxed text-mute">
            {dueCount ? `${plural(dueCount, 'follow-up')} due today or overdue.` : 'Every business you have reviewed or pitched, with the next follow-up first.'}
          </p>
        </div>
        <Button variant="ember" size="md" onClick={() => setForm(true)} className="w-full sm:w-auto">
          <Plus size={16} /> New lead
        </Button>
      </div>

      <div role="tablist" aria-label="Show leads" className="mt-10 flex gap-1 overflow-x-auto border-b border-line">
        {Object.entries(FILTERS).map(([k, v]) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={cx('-mb-px min-h-[44px] border-b-2 px-4 text-[14.5px] font-medium transition-colors', filter === k ? 'border-ember text-bone' : 'border-transparent text-mute hover:text-bone')}
          >
            {v}
            {k === 'due' && dueCount > 0 && <span className="ml-2 rounded-full bg-danger/15 px-2 py-0.5 text-[12px] tabular-nums text-danger">{dueCount}</span>}
          </button>
        ))}
      </div>

      {state.status === 'loading' && <p className="mt-10 text-[15px] text-mute">Loading leads</p>}
      {state.status === 'error' && (
        <div className="mt-8 rounded-[24px] border border-danger/30 bg-danger/[0.06] px-6 py-6">
          <p className="text-[15px] text-bone">The leads did not load. {state.error}</p>
          <Button variant="ghost" className="mt-4" onClick={load}>
            <RotateCw size={15} /> Try again
          </Button>
        </div>
      )}
      {state.status === 'ready' && shown.length === 0 && (
        <div className="mt-8 rounded-[24px] border border-dashed border-line2 px-6 py-12 text-center">
          <p className="mx-auto max-w-[44ch] text-[15.5px] leading-relaxed text-mute">
            {leads.length ? 'Nothing in this view.' : 'No leads yet. Add one here, or open a review and choose "New lead" to file it.'}
          </p>
        </div>
      )}
      {state.status === 'ready' && shown.length > 0 && (
        <ul className="divide-y divide-line">
          {shown.map((l) => {
            const due = dueInfo(l.nextFollowUp)
            const closed = l.status === 'won' || l.status === 'lost'
            return (
              <li key={l.id}>
                <button type="button" onClick={() => onOpen(l.id)} className="group flex w-full items-center gap-4 px-1 py-5 text-left sm:gap-6 sm:px-3">
                  <span className={cx('display grid h-14 w-14 shrink-0 place-items-center rounded-full border border-line2 text-[22px] tabular-nums', scoreTone(l.latestScore))} title={l.latestScore != null ? `Latest score ${l.latestScore}` : 'No score yet'}>
                    {l.latestScore ?? '–'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="display line-clamp-2 block text-[22px] leading-tight group-hover:text-white sm:text-[24px]">{l.business}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px] text-mute">
                      <StatusChip status={l.status} meta={meta} />
                      {l.site && <span className="truncate">{domainOf(l.site)}</span>}
                      <span className="text-faint">{plural(l.reviews, 'review')}</span>
                      {l.carePlan && <span className="text-live">Care plan</span>}
                    </span>
                  </span>
                  <span className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex">
                    {!closed && <span className={cx('text-[14px] font-medium', due.tone)}>{due.text}</span>}
                    {l.lastContact && <span className="text-[13px] text-faint">Last contact {dayLabel(l.lastContact)}</span>}
                  </span>
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line2 text-mute transition-colors group-hover:border-ember group-hover:bg-ember group-hover:text-[#1c0a02]">
                    <ArrowUpRight size={17} />
                  </span>
                </button>
                {!closed && (
                  <p className={cx('-mt-3 pb-4 pl-[76px] text-[13.5px] sm:hidden', due.tone)}>{due.text}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <LeadForm open={form} onClose={() => setForm(false)} initial={EMPTY} meta={meta} onSaved={(out) => onOpen(out.lead.id)} />
    </main>
  )
}

// ── #/leads/<id> ────────────────────────────────────────────────────────────

function History({ history }) {
  if (!history.length) return <p className="mt-5 text-[15px] text-mute">No finished reviews yet.</p>
  const w = 640
  const h = 180
  const pad = 24
  const x = (i) => (history.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (history.length - 1))
  const y = (s) => pad + ((100 - s) * (h - pad * 2)) / 100
  const first = history[0].overall
  const last = history.at(-1).overall
  return (
    <div className="mt-6">
      <p className="text-[15px] text-mute">
        {history.length === 1 ? (
          <>One review so far: <span className={cx('font-semibold', scoreTone(last))}>{last}</span>.</>
        ) : (
          <>
            From <span className={cx('font-semibold', scoreTone(first))}>{first}</span> to <span className={cx('font-semibold', scoreTone(last))}>{last}</span> over {plural(history.length, 'review')}
            {last !== first && <span className={last > first ? 'text-live' : 'text-danger'}> ({last > first ? '+' : ''}{last - first})</span>}.
          </>
        )}
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-auto w-full" role="img" aria-label={`Score history: ${history.map((p) => p.overall).join(', ')}`}>
        {[0, 50, 80, 100].map((g) => (
          <g key={g}>
            <line x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} stroke="rgba(236,232,223,0.08)" strokeDasharray={g === 0 || g === 100 ? '' : '3 5'} />
            <text x={0} y={y(g) + 4} fontSize="11" fill="rgba(236,232,223,0.38)">
              {g}
            </text>
          </g>
        ))}
        {history.length > 1 && <polyline fill="none" stroke="rgb(var(--ember-rgb))" strokeWidth="2.5" strokeLinejoin="round" points={history.map((p, i) => `${x(i)},${y(p.overall)}`).join(' ')} />}
        {history.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.overall)} r="5" fill="rgb(var(--ink-rgb, 7 10 18))" stroke="rgb(var(--ember-rgb))" strokeWidth="2.5" />
        ))}
      </svg>
    </div>
  )
}

export function LeadView({ id, onBack, onOpenAudit, onNewReview, onChanged }) {
  const toast = useToast()
  const [state, setState] = useState({ status: 'loading' })
  const [form, setForm] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [notes, setNotes] = useState('')
  const load = () =>
    api
      .getLead(id)
      .then((d) => {
        setState({ status: 'ready', ...d })
        setNotes(d.lead.notes)
      })
      .catch((e) => setState({ status: 'error', error: e.message }))
  useEffect(() => {
    load()
  }, [id])

  const save = async (fn, fields, message) => {
    try {
      const d = await fn(fields)
      setState({ status: 'ready', ...d })
      onChanged()
      if (message) toast(message)
    } catch (e) {
      toast(e.message)
    }
  }

  if (state.status === 'loading') return <main className="mx-auto max-w-[1120px] px-4 pt-14 text-mute sm:px-6 lg:px-10">Loading the lead</main>
  if (state.status === 'error') {
    return (
      <main className="mx-auto max-w-[1120px] px-4 pt-14 sm:px-6 lg:px-10">
        <h1 className="display text-[44px] leading-none">This lead did not open</h1>
        <p className="mt-4 text-[16px] text-mute">{state.error}</p>
        <Button variant="ghost" className="mt-6" onClick={onBack}>
          <ArrowLeft size={16} /> All leads
        </Button>
      </main>
    )
  }

  const { lead, audits, history, plan, requests, meta } = state
  const closed = lead.status === 'won' || lead.status === 'lost'
  const due = dueInfo(lead.nextFollowUp)

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-10">
      <div className="flex items-center justify-between gap-3">
        <Button variant="quiet" onClick={onBack} className="-ml-3">
          <ArrowLeft size={16} /> All leads
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setForm(true)}>
            Edit
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete this lead" onClick={() => setConfirm(true)}>
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <header className="mt-10">
        <h1 className="display text-balance text-[clamp(42px,8vw,80px)] leading-[0.92]">{lead.business}</h1>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-[15px] text-mute">
          <label className="sr-only" htmlFor="lead-status-quick">
            Status
          </label>
          <select
            id="lead-status-quick"
            value={lead.status}
            onChange={(e) => save(api.saveLead, { id: lead.id, status: e.target.value }, `Status: ${meta.leadStatuses[e.target.value]}.`)}
            className={cx(inlineSelect, 'h-11 w-auto appearance-none rounded-full pr-8 text-[14.5px] font-medium')}
          >
            {Object.entries(meta.leadStatuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {lead.site && (
            <a href={/^https?:/i.test(lead.site) ? lead.site : `https://${lead.site}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 underline decoration-line2 underline-offset-4 hover:text-white">
              {domainOf(lead.site)} <ArrowUpRight size={14} />
            </a>
          )}
          {lead.phone && (
            <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-1.5 hover:text-white">
              <Phone size={14} /> {lead.phone}
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="inline-flex min-h-[44px] items-center gap-1.5 hover:text-white">
              <Mail size={14} /> {lead.email}
            </a>
          )}
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-[14.5px] sm:grid-cols-4 sm:gap-x-10">
          <div>
            <dt className="text-faint">Contact</dt>
            <dd className="mt-1 text-bone">{lead.contact || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-faint">Came from</dt>
            <dd className="mt-1 text-bone">{meta.leadSources[lead.source] || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-faint">Search</dt>
            <dd className="mt-1 text-bone">{lead.service && lead.city ? `${lead.service} in ${lead.city}` : 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-faint">Last contact</dt>
            <dd className="mt-1 text-bone">{lead.lastContact ? dayLabel(lead.lastContact) : 'None yet'}</dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="lead-follow" className="mt-14 grid gap-6 rounded-[30px] border border-line bg-panel/70 p-6 sm:p-9 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
        <div>
          <h2 id="lead-follow" className="display text-[30px] leading-[1.05] sm:text-[34px]">
            Follow-ups
          </h2>
          {closed ? (
            <p className="mt-3 text-[14.5px] leading-relaxed text-mute">This lead is {meta.leadStatuses[lead.status].toLowerCase()}, so there are no more follow-ups.</p>
          ) : (
            <>
              <p className={cx('mt-3 text-[16px] font-semibold', due.tone)}>{due.text}</p>
              <label htmlFor="lead-next" className="mt-4 block text-[13px] text-faint">
                Next follow-up
              </label>
              <input
                id="lead-next"
                type="date"
                value={lead.nextFollowUp || ''}
                onChange={(e) => save(api.saveLead, { id: lead.id, nextFollowUp: e.target.value || null })}
                className={cx(inputClass, 'mt-1.5 h-11 [color-scheme:dark]')}
              />
            </>
          )}
        </div>
        <div>
          {!plan.anchor && <p className="mb-3 text-[14px] text-mute">The dates fill in once the first review of this business finishes.</p>}
          <ol className="border-t border-line">
            {plan.steps.map((s) => {
              const isNext = plan.next?.day === s.day
              return (
                <li key={s.day} className="border-b border-line last:border-b-0">
                  <label className="flex cursor-pointer items-start gap-4 py-4">
                    <input type="checkbox" className="peer sr-only" checked={!!s.doneOn} onChange={(e) => save(({ day, done }) => api.setFollowUp(lead.id, day, done), { day: s.day, done: e.target.checked }, e.target.checked ? 'Done. Last contact set to today.' : null)} />
                    <span aria-hidden="true" className={cx('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ember peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink', s.doneOn ? 'border-live/50 bg-live/15 text-live' : 'border-line2 text-transparent')}>
                      <Check size={15} strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx('block text-[16px] font-semibold leading-snug', s.doneOn && 'text-faint line-through decoration-faint/60')}>
                        <span className="mr-2 tabular-nums text-faint">Day {s.day}.</span>
                        {s.label}
                      </span>
                      <span className={cx('mt-1 block text-[13px]', s.doneOn ? 'text-faint' : isNext ? dueInfo(s.due).tone : 'text-mute')}>
                        {s.doneOn ? `Done ${dayLabel(s.doneOn)}` : s.due ? `Due ${dayLabel(s.due)}` : 'No date yet'}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section aria-labelledby="lead-history" className="mt-16 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
        <div>
          <h2 id="lead-history" className="display text-[30px] leading-[1.05] sm:text-[34px]">
            Score history
          </h2>
          {lead.carePlan && <p className="mt-3 text-[14px] leading-relaxed text-mute">Care plan: reviewed again every {meta.rescanDays} days once won.</p>}
          <Button variant="ghost" className="mt-5" onClick={() => onNewReview(lead)} disabled={!lead.site}>
            <RotateCw size={15} /> Run a review
          </Button>
          {!lead.site && <p className="mt-2 text-[13px] text-faint">Add the website first.</p>}
        </div>
        <div className="min-w-0">
          <History history={history} />
          {audits.length > 0 && (
            <ul className="mt-6 divide-y divide-line border-t border-line">
              {audits.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => onOpenAudit(a.id)} disabled={a.status !== 'complete'} className="group flex min-h-[56px] w-full items-center gap-4 py-3 text-left disabled:cursor-default">
                    <span className={cx('display w-12 text-[26px] tabular-nums', scoreTone(a.overall))}>{a.overall ?? '–'}</span>
                    <span className="min-w-0 flex-1 text-[14.5px]">
                      <span className="block text-bone">{when(a.createdAt)}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-mute">
                        {a.status === 'failed' ? <span className="text-danger">Stopped early</span> : a.status === 'running' ? 'Still running' : null}
                        {a.monthly && <span className="text-ember">Monthly re-scan</span>}
                        {a.reviewedAt && <span className="text-live">Reviewed</span>}
                      </span>
                    </span>
                    <ArrowUpRight size={16} className="text-mute group-hover:text-bone group-disabled:opacity-0" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {requests.length > 0 && (
        <section aria-labelledby="lead-requests" className="mt-16">
          <h2 id="lead-requests" className="display text-[30px] leading-none sm:text-[34px]">
            Requests from the report
          </h2>
          <ul className="mt-6 space-y-4">
            {requests.map((r) => (
              <li key={r.id} className="rounded-[22px] border border-ember/30 bg-ember/[0.05] p-5">
                <p className="text-[15px] font-semibold">
                  {r.name} asked for {r.offer || plural(r.tasks.length, 'fix', 'fixes')} <span className="font-normal text-mute">{when(r.created_at)}</span>
                </p>
                {r.tasks.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-mute">
                    {r.tasks.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                {r.message && <p className="mt-3 text-[14px] italic text-bone/85">{r.message}</p>}
                <p className="mt-3 flex flex-wrap gap-x-5 text-[13.5px] text-mute">
                  {r.email && <a className="hover:text-white" href={`mailto:${r.email}`}>{r.email}</a>}
                  {r.phone && <a className="hover:text-white" href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a>}
                </p>
                <RequestPay request={r} business={lead.business} onSave={(payUrl) => save(api.setPayLink, { id: r.id, payUrl }, payUrl ? 'Payment link saved.' : 'Payment link removed.')} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="lead-notes-h" className="mt-16">
        <h2 id="lead-notes-h" className="display text-[30px] leading-none sm:text-[34px]">
          Notes
        </h2>
        <textarea
          aria-labelledby="lead-notes-h"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== lead.notes && save(api.saveLead, { id: lead.id, notes }, 'Notes saved.')}
          placeholder="What they said, what they care about, what to bring up next time."
          className={cx(inputClass, 'mt-5 py-3 leading-relaxed')}
        />
      </section>

      <LeadForm open={form} onClose={() => setForm(false)} initial={lead} meta={meta} onSaved={(d) => { setForm(false); setState({ status: 'ready', ...d }); setNotes(d.lead.notes); onChanged() }} />
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        variant="dialog"
        title={`Delete the lead for ${lead.business}?`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              className="ml-auto"
              onClick={async () => {
                try {
                  await api.deleteLead(lead.id)
                  onChanged()
                  toast(`Deleted the lead for ${lead.business}.`)
                  onBack()
                } catch (e) {
                  toast(e.message)
                }
              }}
            >
              Delete lead
            </Button>
          </>
        }
      >
        <p className="text-[15px] leading-relaxed text-mute">Its reviews stay in the Reviews list. {isDemo ? 'In this preview it comes back when you reload.' : 'This cannot be undone.'}</p>
      </Sheet>
    </main>
  )
}
