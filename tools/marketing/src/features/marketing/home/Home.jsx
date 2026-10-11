// Marketing home: what's working, templates to start from, and every email you've made.
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, Copy, Eye, MapPin, Pencil, Send, Trash2, Undo2, BarChart3, ArrowRight } from 'lucide-react'
import { useMarketing } from '../MarketingContext.jsx'
import { TEMPLATES } from '../data/templates.js'
import { fromTemplate } from '../data/templates.js'
import { resolveAudience, audienceLabel } from '../data/segments.js'
import { Button, Pill, STATUS, SectionHead, Empty, ExampleTag, cx } from '../ui/core.jsx'
import { Tabs } from '../ui/fields.jsx'
import { Menu } from '../ui/Menu.jsx'
import { EmailThumb } from '../ui/EmailFrame.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useTablet } from '../ui/hooks.js'
import { ago, pct, plural, relativeDayTime, shortDate } from '../lib/format.js'

const EASE = [0.2, 0.7, 0.2, 1]

function Stat({ label, value, sub, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      className="rounded-[22px] border border-line bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-4 sm:p-5"
    >
      <p className="text-[13.5px] leading-snug text-mute">{label}</p>
      <p className="wide mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] sm:text-[34px]">{value}</p>
      {sub && <p className="mt-2 text-[12.5px] leading-snug text-faint">{sub}</p>}
    </motion.div>
  )
}

export function SetupCard({ onOpenSettings, waiting }) {
  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-ember/30 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(255,90,31,0.14),transparent_60%)] p-5 sm:flex-row sm:items-center sm:p-6">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-ember/30 bg-ember/10 text-ember">
        <MapPin size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold">Add your mailing address before your first send</p>
        <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-mute">
          Marketing emails need a postal address in the footer. A P.O. box or a private mailbox works fine.
          {waiting ? ` "${waiting.name}" waits for it before it goes out.` : ''}
        </p>
      </div>
      <Button variant="ember" size="md" onClick={onOpenSettings} className="self-start sm:self-auto">
        Add address
      </Button>
    </div>
  )
}

function TemplateCard({ tpl, settings, onPick, index }) {
  const sample = useMemo(() => fromTemplate(tpl.id, settings, new Date()), [tpl.id, settings])
  return (
    <motion.button
      type="button"
      onClick={() => onPick(tpl.id)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.1 + index * 0.04, ease: EASE }}
      className="group flex w-[78%] shrink-0 snap-start flex-col rounded-[24px] border border-line bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-2 text-left transition-[border-color,transform] duration-300 hover:border-ember/40 sm:w-[46%] md:w-auto"
      aria-label={`Start from ${tpl.name}`}
    >
      <div className="relative overflow-hidden rounded-[18px] bg-raised ring-1 ring-inset ring-white/10">
        <div className="transition-transform duration-700 ease-out group-hover:scale-[1.03]">
          <EmailThumb campaign={sample} settings={settings} height={196} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11.5px] font-semibold text-bone backdrop-blur-md">{tpl.tag}</span>
      </div>
      <div className="px-2.5 pb-2.5 pt-4">
        <p className="wide text-[16.5px] font-semibold leading-tight">{tpl.name}</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">{tpl.blurb}</p>
      </div>
    </motion.button>
  )
}

function Metric({ value, label }) {
  return (
    <div className="text-right">
      <p className="text-[17px] font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[12px] text-faint">{label}</p>
    </div>
  )
}

function CampaignRow({ c, view, contacts, settings, now, onOpen, onEdit, onReport, onPreview, onDuplicate, onDelete, onUnschedule, onSendNow, index }) {
  const tablet = useTablet()
  const status = STATUS[c.status]
  const live = view?.live
  const count = c.status === 'sent' ? view?.recipients : resolveAudience(contacts, c.audience, now).recipients.length
  let when
  if (c.status === 'scheduled') when = new Date(c.scheduledFor) <= now ? 'Waiting on your mailing address to go out' : `Goes out ${relativeDayTime(c.scheduledFor, now)}`
  else if (c.status === 'sent') when = `Sent ${shortDate(c.sentAt, now)} to ${plural(count, 'person', 'people')}`
  else when = `Edited ${ago(c.updatedAt, now)}`

  const items =
    c.status === 'sent'
      ? [
          { label: 'See the report', icon: <BarChart3 size={17} />, onClick: onReport },
          { label: 'Preview the email', icon: <Eye size={17} />, onClick: onPreview },
          { label: 'Use as a starting point', icon: <Copy size={17} />, onClick: onDuplicate },
          { divider: true, key: 'd' },
          { label: 'Delete', icon: <Trash2 size={17} />, onClick: onDelete, danger: true },
        ]
      : [
          { label: 'Edit', icon: <Pencil size={17} />, onClick: onEdit },
          { label: 'Preview the email', icon: <Eye size={17} />, onClick: onPreview },
          c.status === 'scheduled' && { label: 'Send now instead', icon: <Send size={17} />, onClick: onSendNow },
          c.status === 'scheduled' && { label: 'Unschedule', icon: <Undo2 size={17} />, onClick: onUnschedule },
          { label: 'Use as a starting point', icon: <Copy size={17} />, onClick: onDuplicate },
          { divider: true, key: 'd' },
          { label: 'Delete', icon: <Trash2 size={17} />, onClick: onDelete, danger: true },
        ]

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.03, ease: EASE }}
      className="list-none"
    >
      <div className="group flex items-center gap-3 rounded-[22px] border border-line bg-white/[0.015] p-2.5 pr-1.5 transition-colors hover:border-line2 hover:bg-white/[0.03] sm:gap-4 sm:p-3 sm:pr-2">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4" aria-label={`${c.status === 'sent' ? 'Open the report for' : 'Edit'} ${c.name}`}>
          <div className="relative w-[58px] shrink-0 overflow-hidden rounded-[12px] bg-raised ring-1 ring-inset ring-white/10 sm:w-[84px]">
            <EmailThumb campaign={c} settings={settings} height={tablet ? 104 : 72} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="wide min-w-0 truncate text-[16px] font-semibold leading-tight">{c.name}</p>
              <Pill tone={live ? 'sending' : status.tone} dot>
                {live ? 'Sending' : status.label}
              </Pill>
            </div>
            <p className="mt-1 truncate text-[13.5px] text-mute">{c.subject || 'No subject yet'}</p>
            <p className={cx('mt-1 flex items-center gap-1.5 truncate text-[12.5px]', c.status === 'scheduled' ? 'text-[#ff9a6e]' : 'text-faint')}>
              {c.status === 'scheduled' && <CalendarClock size={13} className="shrink-0" />}
              <span className="truncate">{when}</span>
            </p>
            {c.status === 'sent' && view && (
              <p className="mt-1 truncate text-[12.5px] text-mute md:hidden">
                <span className="font-semibold tabular-nums text-bone">{pct(view.opened, view.delivered)}%</span> opened, <span className="font-semibold tabular-nums text-bone">{pct(view.clicked, view.delivered)}%</span> clicked, <span className="font-semibold tabular-nums text-bone">{view.inquiries}</span> reached out
              </p>
            )}
          </div>
          {c.status === 'sent' && view && (
            <div className="hidden shrink-0 items-center gap-6 pr-2 md:flex">
              <Metric value={`${pct(view.opened, view.delivered)}%`} label="opened" />
              <Metric value={`${pct(view.clicked, view.delivered)}%`} label="clicked" />
              <Metric value={view.inquiries} label="reached out" />
            </div>
          )}
          {c.status !== 'sent' && (
            <span className="hidden shrink-0 pr-2 text-[13px] text-faint md:block">{plural(count, 'person', 'people')}</span>
          )}
        </button>
        <Menu items={items} label={`Actions for ${c.name}`} />
      </div>
    </motion.li>
  )
}

export function Home({ navigate, onOpenSettings, onPreview }) {
  const { campaigns, contacts, settings, now, actions, derived } = useMarketing()
  const toast = useToast()
  const [filter, setFilter] = useState('all')

  const sorted = useMemo(() => {
    const rank = { scheduled: 0, draft: 1, sent: 2 }
    return campaigns.slice().sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
      if (a.status === 'scheduled') return new Date(a.scheduledFor) - new Date(b.scheduledFor)
      if (a.status === 'sent') return new Date(b.sentAt) - new Date(a.sentAt)
      return new Date(b.updatedAt) - new Date(a.updatedAt)
    })
  }, [campaigns])
  const counts = useMemo(() => ({
    all: campaigns.length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    scheduled: campaigns.filter((c) => c.status === 'scheduled').length,
    sent: campaigns.filter((c) => c.status === 'sent').length,
  }), [campaigns])
  const list = filter === 'all' ? sorted : sorted.filter((c) => c.status === filter)

  const startFrom = (id) => {
    const newId = actions.createFromTemplate(id)
    navigate(`edit/${newId}`)
  }
  const remove = (c) => {
    const undo = actions.remove(c.id)
    toast(`Deleted "${c.name}"`, { action: { label: 'Undo', onClick: undo } })
  }
  const duplicate = (c) => {
    const id = actions.duplicate(c.id)
    toast('Copy made. It opens as a draft.')
    navigate(`edit/${id}`)
  }

  const sentCount = counts.sent
  return (
    <div className="space-y-14 sm:space-y-16">
      {!settings.mailingAddress?.trim() && <SetupCard onOpenSettings={onOpenSettings} waiting={derived.scheduled[0]} />}

      <section aria-labelledby="mk-stats">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="mk-stats" className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mute">How it's going</h2>
          <ExampleTag />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Stat label="People you can email" value={derived.reachable.toLocaleString('en-US')} sub={`Said yes, out of ${derived.total} on your list`} delay={0.05} />
          <Stat label="Average open rate" value={`${derived.avgOpen}%`} sub={`Across your last ${plural(sentCount, 'email', 'emails')}`} delay={0.1} />
          <Stat label="Clicks, last 90 days" value={derived.clicks90.toLocaleString('en-US')} sub="On buttons, links and projects" delay={0.15} />
          <Stat label="Reached out after an email" value={derived.inquiries90.toLocaleString('en-US')} sub="Replied or asked for a quote within 2 weeks" delay={0.2} />
        </div>
      </section>

      <section aria-labelledby="mk-templates">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2 id="mk-templates" className="display text-[28px] leading-none sm:text-[32px]">Start a new email</h2>
          <p className="max-w-[46ch] text-[14px] leading-snug text-mute sm:text-right">Pick a starting point. Every word, image and color can change.</p>
        </div>
        <div className="mk-noscrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4">
          {TEMPLATES.map((tpl, i) => (
            <TemplateCard key={tpl.id} tpl={tpl} settings={settings} onPick={startFrom} index={i} />
          ))}
        </div>
      </section>

      <section aria-labelledby="mk-emails">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h2 id="mk-emails" className="display text-[28px] leading-none sm:text-[32px]">Your emails</h2>
            <span className="text-[15px] tabular-nums text-faint">{counts.all}</span>
          </div>
          <div className="mk-noscrollbar -mx-4 w-[calc(100%+32px)] overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0">
            <Tabs
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'draft', label: 'Drafts', count: counts.draft },
                { value: 'scheduled', label: 'Scheduled', count: counts.scheduled },
                { value: 'sent', label: 'Sent', count: counts.sent },
              ]}
            />
          </div>
        </div>
        {list.length ? (
          <ul className="space-y-2.5">
            {list.map((c, i) => (
              <CampaignRow
                key={c.id}
                index={i}
                c={c}
                view={derived.views.get(c.id)}
                contacts={contacts}
                settings={settings}
                now={now}
                onOpen={() => navigate(c.status === 'sent' ? `report/${c.id}` : `edit/${c.id}`)}
                onEdit={() => navigate(`edit/${c.id}`)}
                onReport={() => navigate(`report/${c.id}`)}
                onPreview={() => onPreview(c.id)}
                onDuplicate={() => duplicate(c)}
                onDelete={() => remove(c)}
                onUnschedule={() => {
                  actions.unschedule(c.id)
                  toast('Unscheduled. It is a draft again.')
                }}
                onSendNow={() => {
                  actions.sendNow(c.id)
                  toast('Sending now. Watch the results come in.')
                  navigate(`report/${c.id}`)
                }}
              />
            ))}
          </ul>
        ) : (
          <Empty
            action={
              <Button variant="ghost" onClick={() => startFrom('blank')}>
                Start from scratch <ArrowRight size={16} />
              </Button>
            }
          >
            {filter === 'scheduled' ? 'Nothing is scheduled. Pick a time on the Review step and it lands here.' : filter === 'draft' ? 'No drafts right now.' : filter === 'sent' ? 'Nothing sent yet. Your reports will show up here.' : 'No emails yet.'}
          </Empty>
        )}
      </section>
    </div>
  )
}

export { audienceLabel }
