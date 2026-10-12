// Review: a checklist with one-tap fixes, a final look, a test, then send now or schedule.
import { useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, CircleCheck, Send, CalendarClock, FlaskConical, Clock } from 'lucide-react'
import { reviewChecks, blockingCount } from '../email/checks.js'
import { resolveAudience, audienceLabel } from '../data/segments.js'
import { Button, cx } from '../ui/core.jsx'
import { Field, Input } from '../ui/fields.jsx'
import { Sheet } from '../ui/Sheet.jsx'
import { EmailFrame } from '../ui/EmailFrame.jsx'
import { InboxMock, PhoneFrame } from '../ui/preview.jsx'
import { addDays, atTime, nextWeekday, relativeDayTime, plural, fromInputs, toDateInput, toTimeInput, timeZoneLabel, weekdayShort, time, dayDate } from '../lib/format.js'

const LEVEL = {
  error: { icon: AlertCircle, cls: 'text-danger', ring: 'border-danger/30 bg-danger/[0.05]', label: 'Needs a fix' },
  warn: { icon: AlertTriangle, cls: 'text-[#F2B544]', ring: 'border-[#F2B544]/25 bg-[#F2B544]/[0.04]', label: 'Worth a look' },
  ok: { icon: CircleCheck, cls: 'text-live', ring: 'border-line', label: 'Looks good' },
}

export function TestSheet({ open, onClose, campaign, defaultTo, onSend }) {
  const [to, setTo] = useState(defaultTo || '')
  const [error, setError] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) return setError('Enter an email address you can check.')
    onSend(to.trim())
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker={campaign.name}
      title="Send yourself a test"
      variant="dialog"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ember" className="ml-auto" type="submit" form="mk-test">
            <Send size={16} /> Send test
          </Button>
        </>
      }
    >
      <form id="mk-test" onSubmit={submit} noValidate className="space-y-4">
        <p className="text-[14.5px] leading-relaxed text-mute">Open it on your phone to check images, links and spelling before anyone else sees it.</p>
        <Field label="Send the test to" htmlFor="t-to" error={error} hint={'The subject starts with "Test:" so it is easy to spot.'}>
          <Input id="t-to" data-autofocus type="email" value={to} onChange={(e) => { setTo(e.target.value); setError('') }} size="sm" invalid={!!error} />
        </Field>
      </form>
    </Sheet>
  )
}

export function ScheduleSheet({ open, onClose, campaign, now, onSchedule }) {
  const picks = useMemo(() => {
    const list = [
      { id: 'tomorrow', label: 'Tomorrow morning', when: atTime(addDays(now, 1), 9, 0) },
      { id: 'tue', label: 'Tuesday morning', when: nextWeekday(now, 2, 9, 0) },
      { id: 'thu', label: 'Thursday morning', when: nextWeekday(now, 4, 9, 0) },
    ]
    const seen = new Set()
    return list.filter((p) => {
      const k = p.when.toDateString()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [now])
  const start = campaign.scheduledFor ? new Date(campaign.scheduledFor) : picks[0].when
  const [choice, setChoice] = useState(campaign.scheduledFor ? 'custom' : picks[0].id)
  const [date, setDate] = useState(toDateInput(start))
  const [clock, setClock] = useState(toTimeInput(start))
  const [error, setError] = useState('')
  const when = choice === 'custom' ? fromInputs(date, clock) : picks.find((p) => p.id === choice)?.when
  const zone = timeZoneLabel()

  const submit = () => {
    if (!when) return setError('Pick a day and a time.')
    if (when.getTime() < Date.now() + 5 * 60000) return setError('Pick a time at least five minutes from now.')
    onSchedule(when)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker={campaign.name}
      title="Schedule for later"
      variant="dialog"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ember" className="ml-auto" onClick={submit}>
            <CalendarClock size={16} /> {when ? `Schedule for ${weekdayShort(when)} ${time(when)}` : 'Schedule'}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="mb-4 text-[14.5px] leading-relaxed text-mute">Weekday mornings tend to get the most opens from business owners.</p>
        {picks.map((p) => (
          <button key={p.id} type="button" aria-pressed={choice === p.id} onClick={() => { setChoice(p.id); setError('') }} className={cx('flex w-full items-center justify-between gap-3 rounded-[16px] border px-4 py-3.5 text-left transition-colors', choice === p.id ? 'border-ember/60 bg-ember/[0.07]' : 'border-line hover:border-line2')}>
            <span className="text-[15px] font-medium">{p.label}</span>
            <span className="text-[13.5px] text-mute">{dayDate(p.when, now)}, {time(p.when)}</span>
          </button>
        ))}
        <button type="button" aria-pressed={choice === 'custom'} onClick={() => setChoice('custom')} className={cx('flex w-full items-center justify-between gap-3 rounded-[16px] border px-4 py-3.5 text-left transition-colors', choice === 'custom' ? 'border-ember/60 bg-ember/[0.07]' : 'border-line hover:border-line2')}>
          <span className="text-[15px] font-medium">Pick a day and time</span>
          <Clock size={16} className="text-mute" />
        </button>
        {choice === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Field label="Day" htmlFor="sch-date">
              <Input id="sch-date" type="date" value={date} min={toDateInput(now)} onChange={(e) => { setDate(e.target.value); setError('') }} size="sm" />
            </Field>
            <Field label="Time" htmlFor="sch-time">
              <Input id="sch-time" type="time" value={clock} onChange={(e) => { setClock(e.target.value); setError('') }} size="sm" />
            </Field>
          </div>
        )}
        {error && <p className="pt-2 text-[13px] text-danger">{error}</p>}
        <p className="pt-3 text-[12.5px] text-faint">Times are in your time zone{zone ? ` (${zone})` : ''}. You can change or cancel it until it goes out.</p>
      </div>
    </Sheet>
  )
}

export function SendSheet({ open, onClose, campaign, count, onConfirm }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker={campaign.name}
      title="Send this email now?"
      variant="dialog"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Go back
          </Button>
          <Button variant="ember" className="ml-auto" onClick={onConfirm} data-autofocus>
            <Send size={16} /> Send to {plural(count, 'person', 'people')}
          </Button>
        </>
      }
    >
      <dl className="divide-y divide-line rounded-[18px] border border-line">
        {[
          ['Subject', campaign.subject || 'No subject'],
          ['From', campaign.fromName],
          ['Going to', `${plural(count, 'person', 'people')} in ${audienceLabel(campaign.audience)}`],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 px-4 py-3.5">
            <dt className="text-[13px] text-faint">{k}</dt>
            <dd className="text-[14.5px]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-[13.5px] leading-relaxed text-mute">Once it goes out it can't be called back. You'll see opens and clicks come in on the report.</p>
    </Sheet>
  )
}

export function ReviewStep({ campaign, contacts, settings, now, desktop, onFix, onTest, onSchedule, onSend, onUnschedule, contact }) {
  const result = useMemo(() => resolveAudience(contacts, campaign.audience, now), [contacts, campaign.audience, now])
  const checks = useMemo(() => reviewChecks(campaign, { settings, audience: result }), [campaign, settings, result])
  const blocking = blockingCount(checks)
  const warns = checks.filter((c) => c.level === 'warn').length

  return (
    <div className="mk-scroll h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-[1120px] px-4 pb-36 pt-8 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10 lg:px-10 lg:pt-12">
        <div className="min-w-0">
          <h2 className="display text-[34px] leading-[1.02] sm:text-[44px]">Check it, then send</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mute">
            {blocking ? `${plural(blocking, 'thing needs', 'things need')} a fix before it can go out.` : warns ? `Ready to send. ${plural(warns, 'thing is', 'things are')} worth a quick look.` : 'Everything looks good. Send a test or pick a time.'}
          </p>

          <ul className="mt-8 space-y-2.5">
            {checks.map((c) => {
              const L = LEVEL[c.level]
              const Icon = L.icon
              return (
                <li key={c.id + c.title} className={cx('flex items-start gap-3 rounded-[18px] border p-4', L.ring)}>
                  <Icon size={20} className={cx('mt-0.5 shrink-0', L.cls)} aria-label={L.label} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium leading-snug">{c.title}</p>
                    {c.detail && <p className="mt-0.5 text-[13.5px] leading-relaxed text-mute">{c.detail}</p>}
                  </div>
                  {c.fix && (
                    <Button variant={c.level === 'error' ? 'solid' : 'ghost'} size="xs" className="shrink-0" onClick={() => onFix(c.fix)}>
                      {c.fix.label}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>

          <dl className="mt-10 divide-y divide-line rounded-[20px] border border-line">
            {[
              ['From', `${campaign.fromName} <${settings.fromEmail}>`],
              ['Replies go to', settings.replyTo],
              ['Subject', campaign.subject || 'No subject yet'],
              ['Preview text', campaign.preheader || 'None'],
              ['Going to', `${plural(result.recipients.length, 'person', 'people')} in ${audienceLabel(campaign.audience)}`],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-1 gap-1 px-4 py-3.5 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4">
                <dt className="text-[13px] text-faint">{k}</dt>
                <dd className="break-words text-[14.5px]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="mt-10 self-start lg:sticky lg:top-8 lg:mt-0">
          <InboxMock campaign={campaign} contact={contact} />
          <div className="mt-4 h-[520px] lg:h-[430px]">
            <PhoneFrame>
              <EmailFrame campaign={campaign} settings={settings} contact={contact} interactive={false} title="Final look" />
            </PhoneFrame>
          </div>
          {desktop && (
            <div className="mt-5 space-y-2.5">
              {campaign.status === 'scheduled' && (
                <div className="flex items-center gap-2 rounded-[16px] border border-ember/30 bg-ember/[0.07] px-4 py-3 text-[14px]">
                  <CalendarClock size={16} className="shrink-0 text-ember" />
                  <span className="min-w-0 flex-1">Goes out {relativeDayTime(campaign.scheduledFor, now)}</span>
                  <button type="button" onClick={onUnschedule} className="shrink-0 text-[13px] font-medium text-[#ff9a6e] hover:underline">
                    Unschedule
                  </button>
                </div>
              )}
              <Button variant="ember" size="lg" className="w-full" disabled={!!blocking} onClick={onSend}>
                <Send size={17} /> {campaign.status === 'scheduled' ? 'Send now instead' : `Send now to ${plural(result.recipients.length, 'person', 'people')}`}
              </Button>
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="ghost" size="md" disabled={!!blocking} onClick={onSchedule}>
                  <CalendarClock size={16} /> {campaign.status === 'scheduled' ? 'Change time' : 'Schedule'}
                </Button>
                <Button variant="ghost" size="md" onClick={onTest}>
                  <FlaskConical size={16} /> Test
                </Button>
              </div>
              {blocking > 0 && <p className="pt-1 text-center text-[13px] text-mute">Fix the {plural(blocking, 'item', 'items')} marked in red to send.</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
