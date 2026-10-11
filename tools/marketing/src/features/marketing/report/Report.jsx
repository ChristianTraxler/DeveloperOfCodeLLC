// How one email did: delivered, opened, clicked, who reached out, and who to follow up with.
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Copy, Eye, MessageSquare, MousePointerClick, Table2, LineChart, Check } from 'lucide-react'
import { useMarketing } from '../MarketingContext.jsx'
import { audienceLabel, TYPE_LABEL } from '../data/segments.js'
import { Avatar, Button, Pill, Empty, ExampleTag, cx } from '../ui/core.jsx'
import { EmailFrame } from '../ui/EmailFrame.jsx'
import { DeviceSwitch, InboxMock, PhoneFrame } from '../ui/preview.jsx'
import { useToast } from '../ui/Toast.jsx'
import { copyText } from '../ui/hooks.js'
import { dayDate, time, pct, plural } from '../lib/format.js'
import { OpensChart, OpensTable } from './OpensChart.jsx'

const EASE = [0.2, 0.7, 0.2, 1]

function Tile({ label, value, sub, accent, delay, className = '' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: EASE }} className={cx('rounded-[22px] border p-4 sm:p-5', accent ? 'border-ember/35 bg-ember/[0.06]' : 'border-line bg-white/[0.015]', className)}>
      <p className="text-[13.5px] text-mute">{label}</p>
      <p className="wide mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] sm:text-[34px]">{value}</p>
      <p className="mt-2 text-[12.5px] text-faint">{sub}</p>
    </motion.div>
  )
}

function Card({ title, hint, action, children, className = '' }) {
  return (
    <section className={cx('min-w-0 rounded-[26px] border border-line bg-gradient-to-b from-white/[0.03] to-white/[0.008] p-4 sm:p-6', className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="wide text-[18px] font-semibold">{title}</h2>
          {hint && <p className="mt-1 text-[13.5px] text-mute">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function ClickBars({ links }) {
  const sorted = links.slice().sort((a, b) => b.clicks - a.clicks)
  const max = Math.max(1, ...sorted.map((l) => l.clicks))
  if (!sorted.length) return <p className="text-[14px] text-mute">This email had no links to click.</p>
  return (
    <ul className="space-y-4">
      {sorted.map((l) => (
        <li key={l.label} tabIndex={0} title={`${l.label}: ${l.clicks} ${l.clicks === 1 ? 'click' : 'clicks'}`} className="group rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ember/60">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate">{l.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{l.clicks}</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full rounded-[4px] bg-white/[0.05]">
            <div className="h-full rounded-r-[4px] bg-ember transition-[width] duration-500 group-hover:bg-[#ff7a45]" style={{ width: `${(l.clicks / max) * 100}%`, minWidth: l.clicks ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function FollowUp({ people, contacts }) {
  const toast = useToast()
  const [all, setAll] = useState(false)
  const rows = useMemo(() => {
    const byId = new Map(contacts.map((c) => [c.id, c]))
    const order = { lead: 0, past: 1, client: 2 }
    return people
      .filter((p) => p.inquired || p.clicks.length)
      .map((p) => ({ ...p, person: byId.get(p.id) }))
      .filter((p) => p.person)
      .sort((a, b) => Number(b.inquired) - Number(a.inquired) || b.clicks.length - a.clicks.length || order[a.person.type] - order[b.person.type])
  }, [people, contacts])
  if (!rows.length) return <p className="text-[14px] text-mute">No clicks yet. People who click or reach out show up here.</p>
  const shown = all ? rows : rows.slice(0, 6)
  return (
    <>
      <ul className="divide-y divide-line">
        {shown.map((r) => {
          const did = r.inquired ? 'Reached out' : r.clicks.length > 1 ? `Clicked ${r.clicks[0]} and more` : `Clicked ${r.clicks[0]}`
          return (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <Avatar person={r.person} size={38} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate text-[14.5px] font-medium">{[r.person.first, r.person.last].filter(Boolean).join(' ') || r.person.email}</span>
                  <span className="hidden shrink-0 text-[12px] text-faint sm:inline">{TYPE_LABEL[r.person.type]}</span>
                </p>
                <p className={cx('flex items-center gap-1.5 truncate text-[13px]', r.inquired ? 'text-[#ff9a6e]' : 'text-mute')}>
                  {r.inquired ? <MessageSquare size={13} className="shrink-0" /> : <MousePointerClick size={13} className="shrink-0" />}
                  <span className="truncate">
                    {did}
                    {r.person.business ? `, ${r.person.business}` : ''}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(r.person.email)
                  toast(ok ? `Copied ${r.person.email}` : r.person.email, ok ? {} : { tone: 'warn' })
                }}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line2 px-3 text-[13px] font-medium text-mute transition-colors hover:border-white/30 hover:text-bone"
                aria-label={`Copy ${r.person.email}`}
              >
                <Copy size={14} /> <span className="hidden sm:inline">Copy email</span>
              </button>
            </li>
          )
        })}
      </ul>
      {rows.length > 6 && (
        <Button variant="quiet" size="sm" className="mt-3" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </Button>
      )}
    </>
  )
}

export function Report({ id, navigate, onPreview }) {
  const { campaigns, contacts, settings, derived, actions, now } = useMarketing()
  const toast = useToast()
  const [table, setTable] = useState(false)
  const [device, setDevice] = useState('phone')
  const campaign = campaigns.find((c) => c.id === id)
  const view = campaign ? derived.views.get(campaign.id) : null

  if (!campaign || !view) {
    return (
      <main className="mx-auto max-w-[1120px] px-4 pb-24 pt-12 sm:px-6 lg:px-10">
        <Empty action={<Button onClick={() => navigate('')}>Back to emails</Button>}>This report isn't available. The email may have been deleted or not sent yet.</Empty>
      </main>
    )
  }

  const sample = contacts.find((c) => c.id === view.people[0]?.id) || contacts[0]
  const openRate = pct(view.opened, view.delivered)
  const clickRate = pct(view.clicked, view.delivered)

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:px-10">
      <button type="button" onClick={() => navigate('')} className="-ml-3 flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-mute transition-colors hover:bg-white/[0.07] hover:text-bone">
        <ArrowLeft size={17} /> All emails
      </button>

      <header className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Pill tone={view.live ? 'sending' : 'sent'} dot>
              {view.live ? 'Sending now' : 'Sent'}
            </Pill>
            <span className="text-[13.5px] text-mute">
              {dayDate(campaign.sentAt, now)} at {time(campaign.sentAt)}
            </span>
            <ExampleTag />
          </div>
          <h1 className="display mt-4 text-balance text-[clamp(36px,8vw,64px)] leading-[0.98]">{campaign.name}</h1>
          <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-mute">
            "{campaign.subject}" to {plural(view.recipients, 'person', 'people')} in {audienceLabel(campaign.audience)}.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="md" onClick={() => onPreview(campaign.id)}>
            <Eye size={16} /> Preview
          </Button>
          <Button
            variant="solid"
            size="md"
            onClick={() => {
              const copy = actions.duplicate(campaign.id)
              toast('Copy made. It opens as a draft.')
              navigate(`edit/${copy}`)
            }}
          >
            <Copy size={16} /> Use as a starting point
          </Button>
        </div>
      </header>

      {view.live && (
        <div className="mt-8 flex items-center gap-3 rounded-[18px] border border-ember/30 bg-ember/[0.07] px-4 py-3 text-[14px]">
          <span className="mk-pulse h-2 w-2 shrink-0 rounded-full bg-ember" aria-hidden="true" />
          <span>Results are coming in. This preview plays the first 48 hours in under a minute.</span>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-6 lg:grid-cols-5 lg:gap-4">
        <Tile className="sm:col-span-2 lg:col-span-1" label="Delivered" value={view.delivered} sub={view.bounced ? `${view.bounced} bounced` : 'None bounced'} delay={0.05} />
        <Tile className="sm:col-span-2 lg:col-span-1" label="Opened" value={`${openRate}%`} sub={plural(view.opened, 'person', 'people')} delay={0.1} />
        <Tile className="sm:col-span-2 lg:col-span-1" label="Clicked" value={`${clickRate}%`} sub={plural(view.totalClicks, 'click', 'clicks')} delay={0.15} />
        <Tile className="sm:col-span-3 lg:col-span-1" label="Reached out" value={view.inquiries} sub="Within 2 weeks" accent={view.inquiries > 0} delay={0.2} />
        <Tile className="col-span-2 sm:col-span-3 lg:col-span-1" label="Unsubscribed" value={view.unsubscribed} sub={view.delivered ? `${((view.unsubscribed / view.delivered) * 100).toFixed(1)}% of delivered` : '0%'} delay={0.25} />
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6">
        <Card
          title="When people opened it"
          hint="Opens so far, hour by hour after it went out."
          action={
            <Button variant="ghost" size="xs" onClick={() => setTable((v) => !v)} aria-pressed={table}>
              {table ? <LineChart size={15} /> : <Table2 size={15} />} {table ? 'Show chart' : 'Show as table'}
            </Button>
          }
        >
          {table ? <OpensTable people={view.people} delivered={view.delivered} /> : <OpensChart curve={view.curve} total={view.opened} sentAt={campaign.sentAt} live={view.live} />}
        </Card>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
          <Card title="What they clicked" hint={plural(view.totalClicks, 'click', 'clicks') + ' in total'}>
            <ClickBars links={view.links} />
          </Card>
          <Card title="Follow up while it's warm" hint="People who clicked or reached out, leads first.">
            <FollowUp people={view.people} contacts={contacts} />
          </Card>
        </div>

        <Card title="The email" hint="Exactly what went out." action={<DeviceSwitch value={device} onChange={setDevice} />}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className={cx('mk-desk rounded-[20px] p-4 sm:p-6', device === 'phone' ? 'h-[620px]' : 'h-[640px]')}>
              {device === 'phone' ? (
                <PhoneFrame className="max-w-[360px]">
                  <EmailFrame campaign={campaign} settings={settings} contact={sample} interactive={false} title="Sent email" />
                </PhoneFrame>
              ) : (
                <div className="h-full overflow-hidden rounded-[14px] ring-1 ring-white/10">
                  <EmailFrame campaign={campaign} settings={settings} contact={sample} interactive={false} title="Sent email" />
                </div>
              )}
            </div>
            <div className="space-y-4">
              <InboxMock campaign={campaign} contact={sample} time={time(campaign.sentAt)} />
              <ul className="space-y-2 text-[14px]">
                {[
                  ['Opened in the first hour', view.curve[1]?.opens ?? view.opened],
                  ['Clicked at least once', view.clicked],
                  ['Clicks per person who clicked', view.clicked ? (view.totalClicks / view.clicked).toFixed(1) : '0'],
                ].map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3 border-b border-line pb-2">
                    <span className="text-mute">{k}</span>
                    <span className="tabular-nums">{v}</span>
                  </li>
                ))}
              </ul>
              <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-faint">
                <Check size={14} className="mt-0.5 shrink-0" /> Opens are estimates. Some inboxes load images for privacy, which can count as an open.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
