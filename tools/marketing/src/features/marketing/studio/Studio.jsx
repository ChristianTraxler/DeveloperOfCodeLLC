// The full-screen email editor: Design, Audience and Review, with undo and redo.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Undo2, Redo2, ArrowRight, ArrowLeft, Check, CloudOff, Send, CalendarClock, FlaskConical } from 'lucide-react'
import { useMarketing } from '../MarketingContext.jsx'
import { resolveAudience } from '../data/segments.js'
import { makeBlock } from '../data/blocks.js'
import { reviewChecks, blockingCount } from '../email/checks.js'
import { Button, Pill, cx } from '../ui/core.jsx'
import { Segmented } from '../ui/fields.jsx'
import { useDesktop, useLockBody } from '../ui/hooks.js'
import { useToast } from '../ui/Toast.jsx'
import { relativeDayTime, plural } from '../lib/format.js'
import { useHistory } from './useHistory.js'
import { DesignStep } from './DesignStep.jsx'
import { AudienceStep } from './AudienceStep.jsx'
import { ReviewStep, TestSheet, ScheduleSheet, SendSheet } from './ReviewStep.jsx'

const STEPS = [
  { id: 'design', label: 'Design' },
  { id: 'audience', label: 'Audience' },
  { id: 'review', label: 'Review' },
]

function StepBar({ step, setStep, className = '' }) {
  return (
    <nav aria-label="Steps" className={cx('flex rounded-full border border-line bg-black/30 p-1', className)}>
      {STEPS.map((s, i) => {
        const on = s.id === step
        return (
          <button key={s.id} type="button" aria-current={on ? 'step' : undefined} onClick={() => setStep(s.id)} className={cx('flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-[14px] font-medium transition-colors sm:flex-none sm:px-4', on ? 'bg-bone text-ink' : 'text-mute hover:text-bone')}>
            <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums', on ? 'bg-ink text-bone' : 'bg-white/[0.08] text-mute')}>{i + 1}</span>
            <span className="truncate">{s.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function Missing({ onClose }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink p-6 text-center">
      <div>
        <p className="display text-[34px]">This email isn't here anymore</p>
        <p className="mt-2 text-mute">It may have been deleted.</p>
        <Button variant="solid" size="md" className="mt-6" onClick={onClose}>
          Back to emails
        </Button>
      </div>
    </div>
  )
}

export function Studio({ id, navigate, onOpenSettings }) {
  const { campaigns, contacts, settings, actions, now, saved } = useMarketing()
  const campaign = campaigns.find((c) => c.id === id)
  const desktop = useDesktop()
  const toast = useToast()
  const [step, setStep] = useState('design')
  const [selected, setSelected] = useState(null)
  const [mobileView, setMobileView] = useState('edit')
  const [sheet, setSheet] = useState(null)
  const [contactId, setContactId] = useState(null)
  useLockBody(true)

  const commit = useCallback((next) => actions.set(next), [actions])
  const { change, undo, redo, canUndo, canRedo } = useHistory(campaign, commit)

  const close = () => navigate('')

  useEffect(() => {
    if (campaign?.status === 'sent') navigate(`report/${campaign.id}`)
  }, [campaign?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => (campaign ? resolveAudience(contacts, campaign.audience, now) : null), [contacts, campaign, now])
  const people = result?.recipients.length ? result.recipients : contacts
  const contact = (contactId && (people.find((p) => p.id === contactId) || (contactId === '__noname' ? { id: '__noname', first: '', last: '', business: '' } : null))) || people[0] || null
  const checks = useMemo(() => (campaign && result ? reviewChecks(campaign, { settings, audience: result }) : []), [campaign, settings, result])
  const blocking = blockingCount(checks)

  if (!campaign) return <Missing onClose={close} />

  const goStep = (s) => {
    setStep(s)
    if (s === 'design') setMobileView('edit')
  }

  const focusField = (fieldId) => {
    setTimeout(() => {
      const el = document.getElementById(fieldId)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el.focus({ preventScroll: true })
      }
    }, 120)
  }

  const onFix = (fix) => {
    if (fix.kind === 'settings') return onOpenSettings('address')
    if (fix.kind === 'test') return setSheet('test')
    if (fix.kind === 'step') return goStep(fix.target)
    goStep('design')
    if (fix.kind === 'field') {
      setSelected(null)
      focusField(fix.target === 'subject' ? 'mk-subject' : 'mk-preheader')
    } else if (fix.kind === 'block') {
      setSelected(fix.target)
      focusField(fix.target)
    } else if (fix.kind === 'style') {
      setSelected(null)
      focusField('mk-fallback')
    } else if (fix.kind === 'add') {
      const b = makeBlock('button')
      change((c) => {
        const list = c.blocks.slice()
        const at = list.findIndex((x) => x.type === 'footer')
        list.splice(at < 0 ? list.length : at, 0, b)
        return { ...c, blocks: list }
      })
      setSelected(b.id)
    }
  }

  const sendNow = () => {
    actions.sendNow(campaign.id)
    setSheet(null)
    toast(`Sending to ${plural(result.recipients.length, 'person', 'people')}. Results come in as people open it.`)
    navigate(`report/${campaign.id}`)
  }
  const schedule = (when) => {
    actions.schedule(campaign.id, when)
    setSheet(null)
    toast(`Scheduled for ${relativeDayTime(when, now)}`)
    navigate('')
  }
  const unschedule = () => {
    actions.unschedule(campaign.id)
    toast('Unscheduled. It is a draft again.')
  }

  const scheduled = campaign.status === 'scheduled'
  const nextStep = step === 'design' ? 'audience' : step === 'audience' ? 'review' : null

  return (
    <motion.div
      className="mk-studio-bg fixed inset-0 z-[60] flex flex-col"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label={`Editing ${campaign.name}`}
    >
      <header className="shrink-0 border-b border-line bg-ink/80 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex h-14 items-center gap-2 px-2 sm:h-16 sm:px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={close} aria-label="Close and go back to emails" className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[14px] font-medium text-mute transition-colors hover:bg-white/[0.07] hover:text-bone sm:px-3">
              <X size={19} />
              <span className="hidden sm:inline">Close</span>
            </button>
            <span className="hidden h-6 w-px bg-line2 sm:block" aria-hidden="true" />
            <label className="min-w-0 flex-1">
              <span className="sr-only">Email name</span>
              <input value={campaign.name} onChange={(e) => change({ name: e.target.value }, 'name')} className="wide h-10 w-full min-w-0 truncate rounded-[10px] border border-transparent bg-transparent px-2 text-[15.5px] font-semibold transition-colors hover:border-line focus:border-ember/60 focus:bg-black/30 focus:outline-none sm:text-[16px]" />
            </label>
            {scheduled && (
              <Pill tone="scheduled" dot className="hidden md:inline-flex">
                Scheduled
              </Pill>
            )}
          </div>
          {desktop && <StepBar step={step} setStep={goStep} />}
          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">
            <span className="mr-1 hidden items-center gap-1.5 text-[12.5px] text-faint xl:flex" aria-live="polite">
              {saved ? <Check size={14} /> : <CloudOff size={14} />}
              {saved ? 'Saved' : 'Not saved in this browser'}
            </span>
            <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo" className="grid h-10 w-10 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.07] hover:text-bone disabled:opacity-30">
              <Undo2 size={18} />
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo" className="grid h-10 w-10 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.07] hover:text-bone disabled:opacity-30">
              <Redo2 size={18} />
            </button>
            {desktop && nextStep && (
              <Button variant="ember" size="sm" className="ml-1.5" onClick={() => goStep(nextStep)}>
                Next: {nextStep === 'audience' ? 'Audience' : 'Review'} <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </div>
        {!desktop && (
          <div className="px-3 pb-2.5">
            <StepBar step={step} setStep={goStep} className="w-full" />
          </div>
        )}
      </header>

      {scheduled && (
        <div className="flex shrink-0 items-center gap-3 border-b border-ember/25 bg-ember/[0.07] px-4 py-2 text-[13.5px] sm:px-6">
          <CalendarClock size={15} className="shrink-0 text-ember" />
          <p className="min-w-0 flex-1 leading-snug">
            Goes out {relativeDayTime(campaign.scheduledFor, now)}.<span className="hidden text-mute sm:inline"> Changes save to the scheduled email.</span>
          </p>
          <button type="button" onClick={unschedule} className="shrink-0 font-medium text-[#ff9a6e] underline-offset-2 hover:underline">
            Unschedule
          </button>
        </div>
      )}

      <main className="min-h-0 flex-1">
        {step === 'design' && (
          <DesignStep
            campaign={campaign}
            settings={settings}
            change={change}
            selected={selected}
            setSelected={setSelected}
            onPreviewSelect={(bid) => {
              setSelected(bid)
              if (!desktop) setMobileView('edit')
            }}
            people={people}
            contact={contact}
            setContact={(p) => setContactId(p?.id || null)}
            desktop={desktop}
            mobileView={mobileView}
            onOpenSettings={onOpenSettings}
          />
        )}
        {step === 'audience' && <AudienceStep campaign={campaign} contacts={contacts} change={change} now={now} desktop={desktop} onNext={() => goStep('review')} />}
        {step === 'review' && (
          <ReviewStep
            campaign={campaign}
            contacts={contacts}
            settings={settings}
            now={now}
            desktop={desktop}
            contact={contact}
            onFix={onFix}
            onTest={() => setSheet('test')}
            onSchedule={() => setSheet('schedule')}
            onSend={() => setSheet('send')}
            onUnschedule={unschedule}
          />
        )}
      </main>

      {!desktop && (
        <footer className="shrink-0 border-t border-line bg-ink/90 px-3 pt-2.5 backdrop-blur-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
          {step === 'design' && (
            <div className="flex items-center gap-2">
              <Segmented
                value={mobileView}
                onChange={setMobileView}
                label="Edit or preview"
                className="max-w-[220px]"
                options={[
                  { value: 'edit', label: 'Edit' },
                  { value: 'preview', label: 'Preview' },
                ]}
              />
              <Button variant="ember" size="md" className="ml-auto" onClick={() => goStep('audience')}>
                Next <ArrowRight size={16} />
              </Button>
            </div>
          )}
          {step === 'audience' && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="md" onClick={() => goStep('design')}>
                <ArrowLeft size={16} /> Design
              </Button>
              <Button variant="ember" size="md" className="ml-auto" onClick={() => goStep('review')}>
                Review, {plural(result.recipients.length, 'person', 'people')} <ArrowRight size={16} />
              </Button>
            </div>
          )}
          {step === 'review' && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="md" onClick={() => setSheet('test')} aria-label="Send yourself a test">
                <FlaskConical size={16} /> Test
              </Button>
              <Button variant="ghost" size="md" disabled={!!blocking} onClick={() => setSheet('schedule')}>
                <CalendarClock size={16} /> {scheduled ? 'Change' : 'Later'}
              </Button>
              <Button variant="ember" size="md" className="ml-auto" disabled={!!blocking} onClick={() => setSheet('send')}>
                <Send size={16} /> Send
              </Button>
            </div>
          )}
        </footer>
      )}

      <TestSheet
        open={sheet === 'test'}
        onClose={() => setSheet(null)}
        campaign={campaign}
        defaultTo={settings.testEmail}
        onSend={(to) => {
          actions.markTest(campaign.id, to)
          setSheet(null)
          toast(`Test marked as sent to ${to}. This preview never sends real email.`)
        }}
      />
      {sheet === 'schedule' && <ScheduleSheet open onClose={() => setSheet(null)} campaign={campaign} now={now} onSchedule={schedule} />}
      <SendSheet open={sheet === 'send'} onClose={() => setSheet(null)} campaign={campaign} count={result.recipients.length} onConfirm={sendNow} />
    </motion.div>
  )
}

