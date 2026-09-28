import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ScrollTop from '../components/ScrollTop.jsx'
import ExtLink from '../components/ExtLink.jsx'
import { Field } from '../components/FormFields.jsx'
import { contact, images, links } from '../content.js'
import { PREVIEW, pages } from '../site.js'

// Requests go to the Resend function (/api/consult), which emails them to the owner inbox.
const ENDPOINT = '/api/consult'

const fields = {
  topic: {
    kind: 'cards',
    name: 'topic',
    label: 'What would you like to talk about?',
    hint: 'Pick the closest fit, or skip it.',
    cols: 2,
    options: [
      { value: 'A new website', label: 'A new website', detail: 'Starting from scratch' },
      { value: 'A redesign', label: 'A redesign', detail: 'Refresh a site you already have' },
      { value: 'Changes or fixes', label: 'Changes or fixes', detail: 'Updates to a live site' },
      { value: 'Not sure yet', label: 'Not sure yet', detail: 'Help me figure it out' },
    ],
  },
  name: { kind: 'text', name: 'name', label: 'Name', required: true, quietRequired: true, error: 'Enter your name.', autoComplete: 'name' },
  email: {
    kind: 'email',
    name: 'email',
    label: 'Email',
    required: true,
    quietRequired: true,
    error: 'Enter your email address.',
    autoComplete: 'email',
    placeholder: 'you@example.com',
  },
  phone: { kind: 'tel', name: 'phone', label: 'Phone (optional)', autoComplete: 'tel', inputMode: 'tel' },
  business: { kind: 'text', name: 'business', label: 'Business name (optional)', autoComplete: 'organization' },
  method: {
    kind: 'segmented',
    name: 'method',
    label: 'Best way to meet',
    options: [
      { value: 'Phone call', label: 'Phone call' },
      { value: 'Video call', label: 'Video call' },
      { value: 'Email', label: 'Email' },
    ],
  },
  times: {
    kind: 'text',
    name: 'times',
    label: 'Days and times that work (optional)',
    placeholder: 'Weekday mornings, Tuesday after 3pm…',
  },
  message: {
    kind: 'textarea',
    name: 'message',
    label: 'Anything I should know? (optional)',
    hint: 'A sentence or two about the business or the project is plenty.',
    rows: 4,
  },
}

function problemWith(field, value) {
  const text = (value || '').trim()
  if (field.required && !text) return field.error
  if (field.kind === 'email' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text))
    return 'Enter an email address like name@example.com.'
  return null
}

function Spec({ term, children }) {
  return (
    <div className="rule-t grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3.5">
      <dt className="t-label pt-0.5 text-muted">{term}</dt>
      <dd className="t-small">{children}</dd>
    </div>
  )
}

const EMPTY = { topic: '', name: '', email: '', phone: '', business: '', method: 'Phone call', times: '', message: '' }

export default function ConsultPage() {
  const [values, setValues] = useState(EMPTY)
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(null)
  const title = useRef(null)

  const problems = attempted
    ? { name: problemWith(fields.name, values.name), email: problemWith(fields.email, values.email) }
    : {}
  const setValue = (name, value) => setValues((previous) => ({ ...previous, [name]: value }))

  useEffect(() => {
    if (done) title.current?.focus()
  }, [done])

  const onSubmit = async (event) => {
    event.preventDefault()
    if (sending) return
    const form = event.currentTarget
    setAttempted(true)
    const nameProblem = problemWith(fields.name, values.name)
    const emailProblem = problemWith(fields.email, values.email)
    if (nameProblem || emailProblem) {
      setStatus(null)
      document.getElementById(nameProblem ? 'f-name' : 'f-email')?.focus()
      return
    }
    if (PREVIEW) {
      setStatus({
        tone: 'note',
        text: 'This preview can’t send requests, so nothing went out. On the live site, this books your consultation.',
      })
      return
    }

    setSending(true)
    setStatus(null)
    const payload = { botcheck: form.elements.namedItem('botcheck')?.value || '' }
    for (const key of Object.keys(EMPTY)) payload[key] = values[key].trim()
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))
      if (response.ok && result.success) {
        setDone({ name: payload.name.split(/\s+/)[0], email: payload.email })
      } else {
        setStatus({ tone: 'error', text: result.message || 'That didn’t go through. Try again in a moment.' })
      }
    } catch {
      setStatus({ tone: 'error', text: 'That didn’t go through. Check your connection and try again.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header current="consult" />
      <main id="main" tabIndex={-1}>
        <section className="page-hero theme-dusk" aria-labelledby="page-title">
          <div className="wrap grid grid-cols-12 gap-x-6 gap-y-14">
            <div className="col-span-12 lg:col-span-7">
              <h1 id="page-title" ref={title} tabIndex={-1} className="t-page-sm">
                {done ? `Thanks${done.name ? `, ${done.name}` : ''}. Your request is in.` : 'Book a free consultation.'}
              </h1>

              {done ? (
                <>
                  <p className="t-lede mt-6 max-w-[34rem] text-fg/85">
                    I’ll reach out within one business day to set a time. A confirmation is on its way to {done.email}.
                  </p>
                  <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <ExtLink href={pages.home} className="btn btn-solid">
                      Back to the home page
                    </ExtLink>
                    <ExtLink href={links.intake} className="btn btn-line">
                      Start a project
                    </ExtLink>
                  </div>
                </>
              ) : (
                <>
                  <p className="t-lede mt-6 max-w-[34rem] text-fg/85">
                    A no-pressure conversation about your business and what you want your website to do. Tell me a
                    little below and I’ll get back to you to set a time.
                  </p>
                  <form className="mt-10" noValidate onSubmit={onSubmit}>
                    <Field field={fields.topic} values={values} onChange={setValue} />
                    <div className="mt-8 grid grid-cols-6 gap-x-4 gap-y-6">
                      <Field
                        field={fields.name}
                        values={values}
                        onChange={setValue}
                        error={problems.name}
                        className="col-span-6 sm:col-span-3"
                      />
                      <Field
                        field={fields.email}
                        values={values}
                        onChange={setValue}
                        error={problems.email}
                        className="col-span-6 sm:col-span-3"
                      />
                      <Field field={fields.phone} values={values} onChange={setValue} className="col-span-6 sm:col-span-3" />
                      <Field field={fields.business} values={values} onChange={setValue} className="col-span-6 sm:col-span-3" />
                      <Field field={fields.method} values={values} onChange={setValue} className="col-span-6" />
                      <Field field={fields.times} values={values} onChange={setValue} className="col-span-6" />
                      <Field field={fields.message} values={values} onChange={setValue} className="col-span-6" />
                    </div>
                    <div className="hp" aria-hidden="true">
                      <label>
                        Leave this empty
                        <input type="text" name="botcheck" tabIndex={-1} autoComplete="off" />
                      </label>
                    </div>
                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                      <button type="submit" className="btn btn-solid" disabled={sending}>
                        {sending ? 'Sending…' : 'Book consultation'}
                      </button>
                      <p className="t-small text-muted">Free, and there’s no obligation.</p>
                    </div>
                    <div role="status" aria-live="polite">
                      {status && (
                        <div className="form-status" data-tone={status.tone}>
                          {status.text}
                        </div>
                      )}
                    </div>
                  </form>
                </>
              )}
            </div>

            <div className="col-span-12 lg:col-span-4 lg:col-start-9">
              <div className="photo-frame">
                <img src={images.door} alt="The Developer of Code office at night, with the lights on inside." loading="lazy" />
              </div>
              <dl className="rule-b mt-8">
                <Spec term="Length">About 20 to 30 minutes</Spec>
                <Spec term="Cost">Free, with no obligation</Spec>
                <Spec term="With">Christian, the person who builds your site</Spec>
                <Spec term="Reply">Within one business day</Spec>
              </dl>
              <p className="t-small mt-8 text-fg/80">
                Rather call? Reach me at{' '}
                <a className="u-link" href={links.phone}>
                  {contact.phone}
                </a>
                .
              </p>
            </div>
          </div>
          <div className="roofline" aria-hidden="true" style={{ backgroundImage: `url(${images.heroDesk})` }} />
        </section>
      </main>
      <Footer current="consult" />
      <ScrollTop />
    </>
  )
}
