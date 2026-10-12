// Everyone on your list, who said yes to emails, and what they did with the last ones.
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, UserPlus, Check, CircleSlash, MinusCircle, Trash2, MousePointerClick, MailOpen, MessageSquare } from 'lucide-react'
import { useMarketing } from '../MarketingContext.jsx'
import { canEmail, TYPE_LABEL } from '../data/segments.js'
import { Avatar, Button, Pill, Empty, cx } from '../ui/core.jsx'
import { Field, Input, Select, Switch, Textarea, Check2 } from '../ui/fields.jsx'
import { Sheet } from '../ui/Sheet.jsx'
import { useToast } from '../ui/Toast.jsx'
import { ago, shortDate, toDateInput, plural } from '../lib/format.js'

const EASE = [0.2, 0.7, 0.2, 1]
const MIX = [
  { type: 'client', label: 'Current clients', color: '#D95926' },
  { type: 'past', label: 'Past clients', color: '#199E70' },
  { type: 'lead', label: 'Leads', color: '#3987E5' },
]

const FILTERS = [
  { id: 'all', label: 'Everyone', test: () => true },
  { id: 'client', label: 'Current clients', test: (c) => c.type === 'client' },
  { id: 'past', label: 'Past clients', test: (c) => c.type === 'past' },
  { id: 'lead', label: 'Leads', test: (c) => c.type === 'lead' },
  { id: 'notyet', label: 'Not asked yet', test: (c) => !c.optedIn && !c.unsubscribed },
  { id: 'unsub', label: 'Unsubscribed', test: (c) => c.unsubscribed },
]

function Consent({ person }) {
  if (person.unsubscribed)
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-danger">
        <CircleSlash size={14} /> Unsubscribed
      </span>
    )
  if (!person.optedIn)
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-faint">
        <MinusCircle size={14} /> Not asked yet
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-live">
      <Check size={14} strokeWidth={2.6} /> Said yes
    </span>
  )
}

const ACT_ICON = { opened: MailOpen, clicked: MousePointerClick, inquired: MessageSquare }
const ACT_TEXT = { opened: 'Opened', clicked: 'Clicked in', inquired: 'Reached out after' }

function Activity({ act, now }) {
  if (!act) return <span className="text-[13px] text-faint">No opens yet</span>
  const Icon = ACT_ICON[act.kind]
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-mute">
      <Icon size={14} className={cx('shrink-0', act.kind === 'inquired' ? 'text-ember' : 'text-faint')} />
      <span className="truncate">
        {ACT_TEXT[act.kind]} {act.name}
      </span>
    </span>
  )
}

function MixBar({ contacts }) {
  const total = contacts.length || 1
  const counts = MIX.map((m) => ({ ...m, n: contacts.filter((c) => c.type === m.type).length }))
  return (
    <div className="rounded-[22px] border border-line bg-white/[0.015] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px]">
          <span className="wide text-[22px] font-semibold">{contacts.filter(canEmail).length}</span>
          <span className="text-mute"> of {plural(contacts.length, 'person', 'people')} can get your emails</span>
        </p>
      </div>
      <div className="mt-4 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={counts.map((c) => `${c.label}: ${c.n}`).join(', ')}>
        {counts.map((c) => (
          <div key={c.type} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(c.n / total) * 100}%`, background: c.color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {counts.map((c) => (
          <li key={c.type} className="flex items-center gap-2 text-[13px] text-mute">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} aria-hidden="true" />
            {c.label} <span className="tabular-nums text-bone">{c.n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function People() {
  const { contacts, derived, now, actions } = useMarketing()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(40)
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) || FILTERS[0]
    const q = query.trim().toLowerCase()
    return contacts
      .filter(f.test)
      .filter((c) => !q || `${c.first} ${c.last} ${c.business} ${c.email} ${c.city}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const order = { client: 0, past: 1, lead: 2 }
        if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type]
        return new Date(b.since) - new Date(a.since)
      })
  }, [contacts, query, filter])

  const person = contacts.find((c) => c.id === openId) || null

  return (
    <div className="space-y-8">
      <MixBar contacts={contacts} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search people</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(40)
            }}
            placeholder="Search by name, business or email"
            className="h-12 w-full rounded-full border border-line2 bg-black/30 pl-11 pr-4 text-[15.5px] placeholder:text-faint focus:border-ember/70 focus:outline-none focus:ring-4 focus:ring-ember/10"
          />
        </label>
        <Button variant="ember" size="lg" onClick={() => setAdding(true)}>
          <UserPlus size={18} /> Add a person
        </Button>
      </div>

      <div className="mk-noscrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((f) => {
          const n = contacts.filter(f.test).length
          const on = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setFilter(f.id)
                setLimit(40)
              }}
              className={cx('flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors', on ? 'border-bone bg-bone text-ink' : 'border-line2 text-mute hover:border-white/30 hover:text-bone')}
            >
              {f.label}
              <span className={cx('tabular-nums', on ? 'text-ink/60' : 'text-faint')}>{n}</span>
            </button>
          )
        })}
      </div>

      {list.length ? (
        <div>
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_130px_minmax(0,1.6fr)] gap-4 border-b border-line px-4 pb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-faint lg:grid">
            <span>Person</span>
            <span>Email</span>
            <span>Emails</span>
            <span>Latest</span>
          </div>
          <ul>
            {list.slice(0, limit).map((c, i) => (
              <motion.li key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.015, ease: EASE }} className="list-none border-b border-line last:border-b-0">
                <button type="button" onClick={() => setOpenId(c.id)} className="grid w-full grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-[16px] px-2 py-3.5 text-left transition-colors hover:bg-white/[0.03] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_130px_minmax(0,1.6fr)] lg:gap-4 lg:px-4">
                  <span className="contents lg:flex lg:min-w-0 lg:items-center lg:gap-3">
                    <Avatar person={c} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-medium">{[c.first, c.last].filter(Boolean).join(' ') || c.email}</span>
                        <Pill tone={c.type === 'client' ? 'scheduled' : 'neutral'} className="hidden sm:inline-flex">
                          {TYPE_LABEL[c.type]}
                        </Pill>
                      </span>
                      <span className="block truncate text-[13px] text-mute">{c.business || 'No business name yet'}</span>
                    </span>
                  </span>
                  <span className="col-start-2 truncate text-[13px] text-faint lg:col-start-auto lg:text-[13.5px] lg:text-mute">{c.email}</span>
                  <span className="col-start-2 lg:col-start-auto">
                    <Consent person={c} />
                  </span>
                  <span className="col-start-2 hidden min-w-0 lg:col-start-auto lg:block">
                    <Activity act={derived.activity.get(c.id)} now={now} />
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
          {list.length > limit && (
            <div className="mt-6 flex justify-center">
              <Button variant="ghost" onClick={() => setLimit((n) => n + 60)}>
                Show more ({list.length - limit} left)
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Empty>{query ? `No one matches "${query}".` : 'No one here yet.'}</Empty>
      )}

      <PersonSheet
        person={person}
        open={!!person}
        onClose={() => setOpenId(null)}
        onRemove={(p) => {
          const undo = actions.removeContact(p.id)
          setOpenId(null)
          toast(`Removed ${p.first || p.email}`, { action: { label: 'Undo', onClick: undo } })
        }}
      />
      <AddPersonSheet
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(fields) => {
          actions.addContact(fields)
          setAdding(false)
          toast(fields.optedIn ? `Added ${fields.first || fields.email}. They can get your emails.` : `Added ${fields.first || fields.email}. Ask them before you send anything.`)
        }}
      />
    </div>
  )
}

const TYPE_OPTIONS = [
  { value: 'lead', label: 'Lead' },
  { value: 'client', label: 'Current client' },
  { value: 'past', label: 'Past client' },
]
const SOURCE_OPTIONS = ['Contact form', 'Quote request', 'BusinessLaunchList', 'Referral', 'Phone call', 'In person', 'Facebook', 'Added by hand'].map((s) => ({ value: s, label: s }))

function PersonSheet({ person, open, onClose, onRemove }) {
  const { actions, campaigns, derived, now } = useMarketing()
  const history = useMemo(() => {
    if (!person) return []
    return campaigns
      .filter((c) => c.status === 'sent' && c.stats)
      .map((c) => {
        const view = derived.views.get(c.id)
        const got = c.stats.people.find((p) => p.id === person.id)
        const seen = view?.people.find((p) => p.id === person.id)
        return { c, seen, got }
      })
      .filter((h) => h.got)
      .sort((a, b) => new Date(b.c.sentAt) - new Date(a.c.sentAt))
  }, [person, campaigns, derived])
  if (!person) return <Sheet open={false} onClose={onClose} title="" />
  const set = (patch) => actions.updateContact(person.id, patch)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker={TYPE_LABEL[person.type]}
      title={[person.first, person.last].filter(Boolean).join(' ') || person.email}
      footer={
        <>
          <Button variant="dangerGhost" onClick={() => onRemove(person)}>
            <Trash2 size={16} /> Remove
          </Button>
          <Button variant="solid" className="ml-auto" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="p-first">
            <Input id="p-first" value={person.first} onChange={(e) => set({ first: e.target.value })} size="sm" />
          </Field>
          <Field label="Last name" htmlFor="p-last">
            <Input id="p-last" value={person.last} onChange={(e) => set({ last: e.target.value })} size="sm" />
          </Field>
        </div>
        <Field label="Email" htmlFor="p-email">
          <Input id="p-email" type="email" value={person.email} onChange={(e) => set({ email: e.target.value })} size="sm" />
        </Field>
        <Field label="Business" htmlFor="p-biz" hint="Shown wherever an email says {Business}.">
          <Input id="p-biz" value={person.business} onChange={(e) => set({ business: e.target.value })} size="sm" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Relationship" htmlFor="p-type">
            <Select id="p-type" value={person.type} onChange={(v) => set({ type: v, plan: v === 'client' ? person.plan || 'care' : null })} options={TYPE_OPTIONS} />
          </Field>
          {person.type === 'client' ? (
            <Field label="Working on" htmlFor="p-plan">
              <Select id="p-plan" value={person.plan || 'care'} onChange={(v) => set({ plan: v })} options={[{ value: 'care', label: 'Care plan' }, { value: 'build', label: 'Site in progress' }]} />
            </Field>
          ) : person.type === 'lead' ? (
            <Field label="How they found you" htmlFor="p-src">
              <Select id="p-src" value={person.source || 'Added by hand'} onChange={(v) => set({ source: v })} options={SOURCE_OPTIONS} />
            </Field>
          ) : (
            <Field label="Site launched" htmlFor="p-launch">
              <Input id="p-launch" type="date" value={person.launched ? toDateInput(person.launched) : ''} onChange={(e) => set({ launched: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} size="sm" />
            </Field>
          )}
        </div>
        {person.unsubscribed ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/[0.06] p-4 text-[14px] leading-relaxed">
            <p className="font-medium text-danger">Unsubscribed {person.unsubscribedAt ? shortDate(person.unsubscribedAt, now) : ''}</p>
            <p className="mt-1 text-mute">They won't get marketing emails. Only they can sign back up, by asking you or using a sign-up form.</p>
          </div>
        ) : (
          <Switch checked={!!person.optedIn} onChange={(v) => set({ optedIn: v })} label="Said yes to emails" hint="Only turn this on if they agreed to hear from you, for example on a form or in your contract." />
        )}
        <Field label="Notes" htmlFor="p-notes">
          <Textarea id="p-notes" value={person.notes || ''} onChange={(e) => set({ notes: e.target.value })} rows={3} placeholder="Anything worth remembering" />
        </Field>

        <div>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-faint">Emails they got</p>
          {history.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {history.map(({ c, seen }) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px]">{c.name}</span>
                    <span className="block text-[12.5px] text-faint">{shortDate(c.sentAt, now)}</span>
                  </span>
                  <span className="shrink-0 text-[13px] text-mute">
                    {!seen ? 'Not opened' : seen.inquired ? 'Reached out' : seen.clicks.length ? `Clicked ${seen.clicks[0]}` : 'Opened'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-mute">No marketing emails yet.</p>
          )}
          <p className="mt-3 text-[12.5px] text-faint">On your list since {shortDate(person.since, now)}{person.city ? `, ${person.city}` : ''}.</p>
        </div>
      </div>
    </Sheet>
  )
}

const EMPTY = { first: '', last: '', email: '', business: '', type: 'lead', source: 'Contact form', optedIn: false }

function AddPersonSheet({ open, onClose, onSave }) {
  const { contacts } = useMarketing()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setError('')
  }
  const submit = (e) => {
    e.preventDefault()
    const email = form.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter an email address like name@business.com.')
    if (contacts.some((c) => c.email.toLowerCase() === email.toLowerCase())) return setError('That email is already on your list.')
    onSave({ ...form, email, first: form.first.trim(), last: form.last.trim(), business: form.business.trim(), plan: form.type === 'client' ? 'build' : null })
    setForm(EMPTY)
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker="People"
      title="Add a person"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ember" className="ml-auto" type="submit" form="mk-add-person">
            Add to list
          </Button>
        </>
      }
    >
      <form id="mk-add-person" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="a-first">
            <Input id="a-first" data-autofocus value={form.first} onChange={(e) => set({ first: e.target.value })} size="sm" autoComplete="off" />
          </Field>
          <Field label="Last name" htmlFor="a-last">
            <Input id="a-last" value={form.last} onChange={(e) => set({ last: e.target.value })} size="sm" autoComplete="off" />
          </Field>
        </div>
        <Field label="Email" htmlFor="a-email" error={error}>
          <Input id="a-email" type="email" inputMode="email" value={form.email} onChange={(e) => set({ email: e.target.value })} size="sm" invalid={!!error} autoComplete="off" />
        </Field>
        <Field label="Business" htmlFor="a-biz">
          <Input id="a-biz" value={form.business} onChange={(e) => set({ business: e.target.value })} size="sm" autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Relationship" htmlFor="a-type">
            <Select id="a-type" value={form.type} onChange={(v) => set({ type: v })} options={TYPE_OPTIONS} />
          </Field>
          {form.type === 'lead' && (
            <Field label="How they found you" htmlFor="a-src">
              <Select id="a-src" value={form.source} onChange={(v) => set({ source: v })} options={SOURCE_OPTIONS} />
            </Field>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
          <Check2 checked={form.optedIn} onChange={(v) => set({ optedIn: v })}>
            They agreed to get emails from Developer of Code
          </Check2>
          <p className="mt-2 pl-8 text-[12.5px] leading-snug text-faint">Leave this off if you only have their email from a quote or a phone call. They stay on your list but won't get marketing emails.</p>
        </div>
      </form>
    </Sheet>
  )
}
