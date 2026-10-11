// Audience: pick groups, add specific people, and see exactly who gets it and who is left out.
import { useMemo, useState } from 'react'
import { Check, Search, X, Users, ArrowRight } from 'lucide-react'
import { SEGMENTS, segmentNote, segmentCount, resolveAudience, TYPE_LABEL } from '../data/segments.js'
import { Avatar, Button, cx } from '../ui/core.jsx'
import { Sheet } from '../ui/Sheet.jsx'
import { plural } from '../lib/format.js'

function SegmentCard({ seg, audience, count, on, onToggle, onParam }) {
  return (
    <div className={cx('rounded-[20px] border p-1 transition-colors', on ? 'border-ember/60 bg-ember/[0.06]' : 'border-line hover:border-line2')}>
      <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} className="flex w-full items-start gap-3 rounded-[16px] p-3 text-left">
        <span className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border transition-colors', on ? 'border-ember bg-ember text-[#1c0a02]' : 'border-line2 text-transparent')}>
          <Check size={15} strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[15.5px] font-semibold leading-tight">{seg.name}</span>
            <span className="shrink-0 text-[13px] tabular-nums text-mute">{plural(count, 'person', 'people')}</span>
          </span>
          <span className="mt-1 block text-[13px] leading-snug text-faint">{segmentNote(seg, audience)}</span>
        </span>
      </button>
      {seg.param && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-3 pl-12">
          {seg.param.options.map((v) => {
            const sel = (audience[seg.param.key] || seg.param.options[1]) === v
            return (
              <button key={v} type="button" aria-pressed={sel} onClick={() => onParam(seg.param.key, v)} className={cx('h-7 rounded-full border px-2.5 text-[12px] font-medium transition-colors', sel ? 'border-bone/70 bg-bone/10 text-bone' : 'border-line2 text-mute hover:text-bone')}>
                {v} {seg.param.unit}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Summary({ result, onSeeAll, footer }) {
  const by = (type) => result.recipients.filter((c) => c.type === type).length
  const out = result.notOptedIn.length + result.unsubscribed.length + result.noEmail.length
  return (
    <div className="rounded-[24px] border border-line bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mute">Who gets it</p>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="wide text-[44px] font-semibold leading-none tracking-[-0.02em]">{result.recipients.length.toLocaleString('en-US')}</span>
        <span className="text-[15px] text-mute">{result.recipients.length === 1 ? 'person' : 'people'}</span>
      </p>
      <ul className="mt-4 space-y-1.5 text-[14px]">
        {[
          ['client', 'Current clients'],
          ['past', 'Past clients'],
          ['lead', 'Leads'],
        ].map(([type, label]) => (
          <li key={type} className="flex justify-between gap-3">
            <span className="text-mute">{label}</span>
            <span className="tabular-nums">{by(type)}</span>
          </li>
        ))}
      </ul>
      {out > 0 && (
        <div className="mt-4 rounded-[14px] border border-line bg-black/20 p-3 text-[13px] leading-relaxed text-mute">
          <p className="font-medium text-bone">{plural(out, 'person is', 'people are')} left out</p>
          {result.notOptedIn.length > 0 && <p>{result.notOptedIn.length} {result.notOptedIn.length === 1 ? "hasn't" : "haven't"} said yes to emails yet</p>}
          {result.unsubscribed.length > 0 && <p>{result.unsubscribed.length} unsubscribed</p>}
          {result.noEmail.length > 0 && <p>{result.noEmail.length} without an email address</p>}
        </div>
      )}
      {result.recipients.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={onSeeAll}>
          <Users size={16} /> See everyone
        </Button>
      )}
      {footer}
    </div>
  )
}

export function EveryoneSheet({ open, onClose, people }) {
  const [q, setQ] = useState('')
  const list = people.filter((c) => `${c.first} ${c.last} ${c.business} ${c.email}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Sheet open={open} onClose={onClose} kicker="Who gets this email" title={plural(people.length, 'person', 'people')}>
      <label className="relative mb-4 block">
        <span className="sr-only">Search</span>
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="h-11 w-full rounded-full border border-line2 bg-black/30 pl-10 pr-4 text-[15px] placeholder:text-faint focus:border-ember/70 focus:outline-none" />
      </label>
      <ul className="divide-y divide-line">
        {list.slice(0, 300).map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-3">
            <Avatar person={c} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px]">{[c.first, c.last].filter(Boolean).join(' ') || c.email}</span>
              <span className="block truncate text-[12.5px] text-faint">{c.business || c.email}</span>
            </span>
            <span className="shrink-0 text-[12.5px] text-mute">{TYPE_LABEL[c.type]}</span>
          </li>
        ))}
      </ul>
      {!list.length && <p className="py-10 text-center text-[14px] text-mute">No one matches that.</p>}
    </Sheet>
  )
}

export function AudienceStep({ campaign, contacts, change, now, onNext, desktop }) {
  const audience = campaign.audience
  const [q, setQ] = useState('')
  const [seeAll, setSeeAll] = useState(false)
  const result = useMemo(() => resolveAudience(contacts, audience, now), [contacts, audience, now])

  const set = (patch) => change((c) => ({ ...c, audience: { ...c.audience, ...patch } }))
  const toggle = (id) => {
    const has = audience.segments.includes(id)
    set({ segments: has ? audience.segments.filter((s) => s !== id) : [...audience.segments, id] })
  }
  const added = audience.people.map((id) => contacts.find((c) => c.id === id)).filter(Boolean)
  const matches = q.trim()
    ? contacts
        .filter((c) => !audience.people.includes(c.id))
        .filter((c) => `${c.first} ${c.last} ${c.business} ${c.email}`.toLowerCase().includes(q.trim().toLowerCase()))
        .slice(0, 6)
    : []

  return (
    <div className="mk-scroll h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-[1120px] px-4 pb-32 pt-8 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-10 lg:pt-12">
        <div className="min-w-0">
          <h2 className="display text-[34px] leading-[1.02] sm:text-[44px]">Who gets this email?</h2>
          <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-mute">Pick one or more groups. Someone in two groups still gets it once, and only people who said yes to emails are included.</p>

          {!desktop && (
            <div className="mt-6">
              <Summary result={result} onSeeAll={() => setSeeAll(true)} />
            </div>
          )}

          <div className="mt-8 grid items-start gap-3 sm:grid-cols-2">
            {SEGMENTS.map((seg) => (
              <SegmentCard
                key={seg.id}
                seg={seg}
                audience={audience}
                count={segmentCount(contacts, seg.id, audience, now)}
                on={audience.segments.includes(seg.id)}
                onToggle={() => toggle(seg.id)}
                onParam={(key, v) => set({ [key]: v, segments: audience.segments.includes(seg.id) ? audience.segments : [...audience.segments, seg.id] })}
              />
            ))}
          </div>

          <div className="mt-12">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mute">Add specific people</h3>
            <p className="mt-1 text-[13.5px] text-faint">For someone outside these groups, like a client you just talked to.</p>
            <label className="relative mt-4 block max-w-[520px]">
              <span className="sr-only">Find a person</span>
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, business or email" className="h-12 w-full rounded-full border border-line2 bg-black/30 pl-11 pr-4 text-[15px] placeholder:text-faint focus:border-ember/70 focus:outline-none focus:ring-4 focus:ring-ember/10" />
            </label>
            {matches.length > 0 && (
              <ul className="mt-2 max-w-[520px] overflow-hidden rounded-[18px] border border-line2 bg-raised">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        set({ people: [...audience.people, c.id] })
                        setQ('')
                      }}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      <Avatar person={c} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px]">{[c.first, c.last].filter(Boolean).join(' ') || c.email}</span>
                        <span className="block truncate text-[12.5px] text-faint">{c.business || c.email}</span>
                      </span>
                      <span className={cx('shrink-0 text-[12.5px]', c.optedIn && !c.unsubscribed ? 'text-mute' : 'text-[#F2B544]')}>{c.unsubscribed ? 'Unsubscribed' : c.optedIn ? 'Add' : 'Not asked yet'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {added.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {added.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-full border border-line2 py-1 pl-1 pr-1.5">
                    <Avatar person={c} size={26} />
                    <span className="text-[13.5px]">{[c.first, c.last].filter(Boolean).join(' ') || c.email}</span>
                    <button type="button" aria-label={`Remove ${c.first}`} onClick={() => set({ people: audience.people.filter((id) => id !== c.id) })} className="grid h-7 w-7 place-items-center rounded-full text-mute hover:bg-white/[0.08] hover:text-bone">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {desktop && (
          <aside className="self-start lg:sticky lg:top-8">
            <Summary
              result={result}
              onSeeAll={() => setSeeAll(true)}
              footer={
                <Button variant="ember" size="lg" className="mt-3 w-full" onClick={onNext}>
                  Next: Review <ArrowRight size={17} />
                </Button>
              }
            />
          </aside>
        )}
      </div>
      <EveryoneSheet open={seeAll} onClose={() => setSeeAll(false)} people={result.recipients} />
    </div>
  )
}
