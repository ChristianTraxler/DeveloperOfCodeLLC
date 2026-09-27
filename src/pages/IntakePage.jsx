import { useCallback, useEffect, useRef, useState } from 'react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ScrollTop from '../components/ScrollTop.jsx'
import PageHero from '../components/PageHero.jsx'
import ExtLink from '../components/ExtLink.jsx'
import { Field, Switch, fieldId } from '../components/FormFields.jsx'
import { CheckIcon } from '../components/Icons.jsx'
import { contact, images, links, pricing } from '../content.js'
import { PREVIEW, pages } from '../site.js'
import { STORE_TRIGGERS, WEB3FORMS, requiredFields, sections } from '../intakeForm.js'

const DRAFT_KEY = 'doc-intake-draft-v1'
const SPAN = {
  full: 'col-span-6',
  half: 'col-span-6 sm:col-span-3',
  third: 'col-span-6 sm:col-span-3 lg:col-span-2',
}
const pad = (n) => String(n).padStart(2, '0')

const filled = (value) =>
  Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim() !== '' : value != null
const namesOf = (field) => field.names || [field.name]

function problemWith(field, value) {
  if (field.required && !filled(value)) return field.error
  if (!filled(value)) return null
  if (field.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()))
    return 'Enter an email address like name@example.com.'
  if (field.kind === 'tel' && value.replace(/\D/g, '').length < 7) return 'Enter a phone number with the area code.'
  return null
}

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || {}
  } catch {
    return {}
  }
}

const isShown = (section, field, values, storeOn) =>
  (!section.gate || storeOn) && (!field.showIf || values[field.showIf.name] === field.showIf.equals)

function findProblems(values, storeOn) {
  const found = {}
  for (const section of sections) {
    for (const field of section.fields) {
      if (!field.name || !isShown(section, field, values, storeOn)) continue
      const problem = problemWith(field, values[field.name])
      if (problem) found[field.name] = problem
    }
  }
  return found
}

function buildSubmission(values, storeOn, botcheck) {
  const data = new FormData()
  data.append('access_key', WEB3FORMS.accessKey)
  data.append('subject', WEB3FORMS.subject)
  data.append('from_name', WEB3FORMS.fromName)
  data.append('botcheck', botcheck)
  for (const section of sections) {
    for (const field of section.fields) {
      if (!isShown(section, field, values, storeOn)) continue
      for (const name of namesOf(field)) {
        const value = values[name]
        if (filled(value)) data.append(name, Array.isArray(value) ? value.join(', ') : String(value).trim())
      }
    }
  }
  return data
}

function sectionStates(values, storeOn, attempted) {
  return sections.map((section) => {
    const required = section.fields.filter((field) => field.required)
    if (required.length) {
      if (required.every((field) => !problemWith(field, values[field.name]))) return 'done'
      return attempted ? 'missing' : 'todo'
    }
    const answered = section.fields.some(
      (field) => isShown(section, field, values, storeOn) && namesOf(field).some((name) => filled(values[name])),
    )
    return answered ? 'done' : 'optional'
  })
}

function RailState({ state }) {
  if (state === 'done')
    return (
      <span className="rail-state is-done">
        <CheckIcon />
        <span className="sr-only">Complete</span>
      </span>
    )
  if (state === 'missing') return <span className="rail-state is-missing">Needs answers</span>
  if (state === 'optional') return <span className="rail-state">Optional</span>
  return null
}

function StatusMessage({ status }) {
  if (!status) return null
  const email = (
    <a className="u-link" href={links.email}>
      {contact.email}
    </a>
  )
  let body = status.text
  if (status.kind === 'preview')
    body = (
      <>
        This preview can’t send forms, so nothing went out. On the live site, this button sends your answers straight
        to Christian. Your answers stay saved on this device, or you can email them to {email}.
      </>
    )
  if (status.kind === 'failed')
    body = (
      <>
        Your project details didn’t send{status.reason ? ` (${status.reason})` : ''}. Check your connection and try again.
        Your answers stay saved on this device, and you can always email {email}.
      </>
    )
  return (
    <div className="form-status" data-tone={status.tone}>
      {body}
    </div>
  )
}

function Sent({ who, headingRef }) {
  const steps = [
    'I read through your answers and follow up with any questions.',
    'You get a written proposal with the scope, timeline, and price.',
    'Once you approve it, we schedule a kickoff and start building.',
  ]
  return (
    <section id="intake" className="theme-light section" aria-labelledby="sent-title">
      <div className="wrap grid grid-cols-12 gap-x-6 gap-y-14 lg:items-center">
        <div className="col-span-12 lg:col-span-6">
          <h2 id="sent-title" ref={headingRef} tabIndex={-1} className="t-h2 outline-none">
            Thanks{who.name ? `, ${who.name}` : ''}. Your project details are on my desk.
          </h2>
          <p className="t-lede mt-6 max-w-[34rem] text-fg/85">
            I’ll read through everything and reply to {who.email || 'you'} with a custom proposal, including the scope,
            timeline, and price in writing.
          </p>
          <ol className="rule-b mt-10">
            {steps.map((step, index) => (
              <li key={step} className="rule-t grid grid-cols-[2.75rem_1fr] gap-3 py-4">
                <span className="t-label pt-0.5 text-muted">{pad(index + 1)}</span>
                <span className="t-small">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ExtLink href={pages.home} className="btn btn-solid">
              Back to the home page
            </ExtLink>
            <ExtLink href={links.booking} className="btn btn-line">
              Book a free consultation
            </ExtLink>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-5 lg:col-start-8">
          <div className="photo-frame">
            <img src={images.door} alt="The Developer of Code office at night, with the lights on inside." loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default function IntakePage() {
  const [values, setValues] = useState(() => readDraft().values || {})
  const [storeChoice, setStoreChoice] = useState(() => {
    const saved = readDraft().storeChoice
    return typeof saved === 'boolean' ? saved : null
  })
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [active, setActive] = useState(0)
  const sentHeading = useRef(null)

  const autoStore = (values.Functionality || []).some((value) => STORE_TRIGGERS.includes(value))
  const storeOn = storeChoice ?? autoStore
  const problems = attempted ? findProblems(values, storeOn) : {}
  const states = sectionStates(values, storeOn, attempted)
  const total = requiredFields.length
  const done = requiredFields.filter((field) => !problemWith(field, values[field.name])).length
  const percent = Math.round((done / total) * 100)

  const setValue = useCallback((name, value) => setValues((previous) => ({ ...previous, [name]: value })), [])

  // Keep an unsent draft on this device.
  useEffect(() => {
    if (sent) return undefined
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ values, storeChoice }))
      } catch {
        /* storage is optional */
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [values, storeChoice, sent])

  // Follow which section is on screen for the progress rail.
  useEffect(() => {
    if (sent) return undefined
    let frame = 0
    const update = () => {
      frame = 0
      const line = window.innerHeight * 0.38
      let index = 0
      sections.forEach((section, i) => {
        const element = document.getElementById(`s-${section.id}`)
        if (element && element.getBoundingClientRect().top <= line) index = i
      })
      setActive(index)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [sent])

  useEffect(() => {
    if (!sent) return
    document.getElementById('intake')?.scrollIntoView({ block: 'start' })
    sentHeading.current?.focus({ preventScroll: true })
  }, [sent])

  const onSubmit = async (event) => {
    event.preventDefault()
    if (sending) return
    const form = event.currentTarget
    setAttempted(true)
    const found = findProblems(values, storeOn)
    const count = Object.keys(found).length
    if (count) {
      setStatus({
        tone: 'error',
        text:
          count === 1
            ? 'One answer needs attention before this can send.'
            : `${count} answers need attention before this can send.`,
      })
      const first = sections.flatMap((section) => section.fields).find((field) => field.name && found[field.name])
      const id = fieldId(first.name)
      const target = document.getElementById(`${id}-0`) || document.getElementById(id)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      target?.closest('.field')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      target?.focus({ preventScroll: true })
      return
    }

    setSending(true)
    setStatus(null)
    try {
      const response = await fetch(WEB3FORMS.endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: buildSubmission(values, storeOn, form.elements.namedItem('botcheck')?.value || ''),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false) {
        setStatus({ tone: 'error', kind: 'failed', reason: typeof result.message === 'string' ? result.message.slice(0, 200) : '' })
        return
      }
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* storage is optional */
      }
      setSent({ name: (values['Full Name'] || '').trim().split(/\s+/)[0], email: (values.Email || '').trim() })
    } catch {
      setStatus(PREVIEW ? { tone: 'note', kind: 'preview' } : { tone: 'error', kind: 'failed' })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header current="intake" />
      <main id="main" tabIndex={-1}>
        <PageHero
          title="Tell me about your project."
          lede="The more I know up front, the better the proposal. I read every answer myself and reply with a custom plan, timeline, and price."
          aside={
            <div className="t-small space-y-4 text-fg/85">
              <p className="t-label flex items-center gap-2.5 text-fg/80">
                <span className="status-dot" aria-hidden="true" />
                Taking on new projects
              </p>
              <p>{pricing.note}</p>
              <p>
                Rather talk it through first?{' '}
                <ExtLink className="u-link font-semibold text-fg" href={links.booking}>
                  Book a free consultation
                </ExtLink>
                .
              </p>
              <p>
                Questions? Email{' '}
                <a className="u-link" href={links.email}>
                  {contact.email}
                </a>{' '}
                or call{' '}
                <a className="u-link whitespace-nowrap" href={links.phone}>
                  {contact.phone}
                </a>
                .
              </p>
            </div>
          }
        />

        {sent ? (
          <Sent who={sent} headingRef={sentHeading} />
        ) : (
          <section id="intake" className="theme-light pb-24 pt-10 lg:pb-40 lg:pt-24" aria-label="Project intake form">
            <div className="wrap grid grid-cols-12 gap-x-6">
              <aside className="hidden lg:col-span-3 lg:block">
                <nav className="form-rail" aria-label="Form sections">
                  <p className="t-subhead">
                    {done} of {total} required answers
                  </p>
                  <div className="meter mt-3" aria-hidden="true">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                  <ol className="mt-7">
                    {sections.map((section, index) => (
                      <li key={section.id}>
                        <a
                          href={`#s-${section.id}`}
                          className="rail-link"
                          aria-current={active === index ? 'step' : undefined}
                        >
                          <span className="rail-num">{pad(index + 1)}</span>
                          <span>{section.title}</span>
                          <RailState state={states[index]} />
                        </a>
                      </li>
                    ))}
                  </ol>
                  <p className="t-small mt-7 text-muted">Your answers stay saved on this device until you send them.</p>
                </nav>
              </aside>

              <form className="col-span-12 lg:col-span-8 lg:col-start-5" noValidate onSubmit={onSubmit}>
                <div className="mobile-progress lg:hidden" aria-hidden="true">
                  <div className="t-label flex items-center justify-between gap-4">
                    <span className="min-w-0 truncate">
                      <span className="text-muted">{pad(active + 1)}</span>
                      <span className="ml-3">{sections[active].title}</span>
                    </span>
                    <span className="flex-none text-muted">
                      {done} of {total} required
                    </span>
                  </div>
                  <div className="meter mt-2.5">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </div>

                <p className="t-small mt-8 max-w-[36rem] text-muted lg:mt-0">
                  Required answers are marked. Everything else is optional, so skip anything that doesn’t apply.
                </p>

                <div className="hp" aria-hidden="true">
                  <label>
                    Leave this empty
                    <input type="text" name="botcheck" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>

                {sections.map((section, index) => (
                  <section
                    key={section.id}
                    id={`s-${section.id}`}
                    className="form-section"
                    aria-labelledby={`s-${section.id}-title`}
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="t-label text-muted" aria-hidden="true">
                        {pad(index + 1)}
                      </span>
                      <h2 id={`s-${section.id}-title`} className="t-h3">
                        {section.title}
                      </h2>
                    </div>
                    {section.intro && <p className="t-small mt-3 max-w-[36rem] text-muted">{section.intro}</p>}
                    {section.gate && (
                      <div className="mt-6">
                        <Switch checked={storeOn} onChange={setStoreChoice} label={section.gate.label} />
                        {!storeOn && <p className="t-small mt-3 max-w-[36rem] text-muted">{section.gate.off}</p>}
                      </div>
                    )}
                    {(!section.gate || storeOn) && (
                      <div className="mt-8 grid grid-cols-6 gap-x-5 gap-y-9">
                        {section.fields
                          .filter((field) => isShown(section, field, values, storeOn))
                          .map((field) => (
                            <Field
                              key={field.name || field.names[0]}
                              field={field}
                              values={values}
                              onChange={setValue}
                              error={field.name ? problems[field.name] : undefined}
                              className={SPAN[field.span || 'full']}
                            />
                          ))}
                      </div>
                    )}
                  </section>
                ))}

                <div className="send-panel theme-dusk">
                  <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <div>
                      <h2 className="t-h3">Ready when you are.</h2>
                      <p className="t-small mt-3 max-w-[30rem] text-fg/80">
                        Your answers go straight to Christian. You’ll get a custom proposal back with the scope,
                        timeline, and price in writing.
                      </p>
                    </div>
                    <button type="submit" className="btn btn-solid" disabled={sending}>
                      <span className="status-dot" aria-hidden="true" />
                      {sending ? 'Sending…' : 'Send project details'}
                    </button>
                  </div>
                  <p className="t-label mt-6 text-muted">
                    {done} of {total} required answers complete
                  </p>
                  <div role="status" aria-live="polite">
                    <StatusMessage status={status} />
                  </div>
                </div>
              </form>
            </div>
          </section>
        )}
      </main>
      <Footer current="intake" />
      <ScrollTop />
    </>
  )
}
