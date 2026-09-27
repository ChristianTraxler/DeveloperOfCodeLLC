import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ScrollTop from '../components/ScrollTop.jsx'
import ExtLink from '../components/ExtLink.jsx'
import { Field } from '../components/FormFields.jsx'
import { CrmSpecimen, FamilySpecimen, SoloSpecimen } from '../components/Specimens.jsx'
import { images, software } from '../content.js'
import { PREVIEW, pages } from '../site.js'

// Sign-ups go to the existing Resend function (/api/notify) with the same fields as the old page:
// product, name, email, and the botcheck honeypot.
const ENDPOINT = '/api/notify'
const GENERAL = 'General (no product specified)'
const SPECIMENS = { crm: CrmSpecimen, solo: SoloSpecimen }

const fields = {
  product: {
    kind: 'cards',
    name: 'product',
    label: 'Which one?',
    hint: 'Pick one, or skip it to hear about both.',
    cols: 2,
    options: software.map((item) => ({ value: item.name, label: item.name, detail: item.short })),
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
}

function problemWith(field, value) {
  const text = (value || '').trim()
  if (field.required && !text) return field.error
  if (field.kind === 'email' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text))
    return 'Enter an email address like name@example.com.'
  return null
}

function productFromUrl() {
  try {
    return (new URLSearchParams(window.location.search).get('product') || '').trim().slice(0, 80)
  } catch {
    return ''
  }
}

function Spec({ term, children }) {
  return (
    <div className="rule-t grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3.5">
      <dt className="t-label pt-0.5 text-muted">{term}</dt>
      <dd className="t-small">{children}</dd>
    </div>
  )
}

export default function NotifyPage() {
  const [values, setValues] = useState(() => ({ product: productFromUrl(), name: '', email: '' }))
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(null)
  const title = useRef(null)

  const product = values.product
  const item = software.find((entry) => entry.name === product)
  const Specimen = item ? SPECIMENS[item.specimen] : FamilySpecimen
  const problems = attempted
    ? { name: problemWith(fields.name, values.name), email: problemWith(fields.email, values.email) }
    : {}
  const setValue = (name, value) => setValues((previous) => ({ ...previous, [name]: value }))

  useEffect(() => {
    document.title = `${product ? `Notify me: ${product}` : 'Get notified'} | Developer of Code, LLC`
  }, [product])

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
        text: 'This preview can’t send sign-ups, so nothing went out. On the live site, this adds you to the launch list.',
      })
      return
    }

    setSending(true)
    setStatus(null)
    const payload = {
      botcheck: form.elements.namedItem('botcheck')?.value || '',
      product: product || GENERAL,
      name: values.name.trim(),
      email: values.email.trim(),
    }
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))
      if (response.ok && result.success) {
        setDone({ name: payload.name.split(/\s+/)[0], email: payload.email, product: product || 'Relay' })
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
      <Header current="notify" />
      <main id="main" tabIndex={-1}>
        <section className="page-hero theme-dusk" aria-labelledby="page-title">
          <div className="wrap grid grid-cols-12 gap-x-6 gap-y-14 lg:items-center">
            <div className="col-span-12 lg:col-span-6">
              <h1 id="page-title" ref={title} tabIndex={-1} className="t-page-sm">
                {done
                  ? `You’re on the list${done.name ? `, ${done.name}` : ''}.`
                  : `Get notified when ${product || 'Relay'} launches.`}
              </h1>

              {done ? (
                <>
                  <p className="t-lede mt-6 max-w-[34rem] text-fg/85">
                    I’ll email {done.email} the moment {done.product} is ready to buy. Thanks for the interest.
                  </p>
                  <p className="t-small mt-8 max-w-[30rem] text-fg/75">
                    While you wait, the Notion templates are available now.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <ExtLink href={pages.products} className="btn btn-solid">
                      Back to the shop
                    </ExtLink>
                    <ExtLink href={pages.home} className="btn btn-line">
                      Visit the home page
                    </ExtLink>
                  </div>
                </>
              ) : (
                <>
                  <p className="t-lede mt-6 max-w-[34rem] text-fg/85">
                    Leave your name and email and I’ll send one note the moment it’s ready to buy. No spam and no
                    newsletter, just the launch email.
                  </p>
                  <form className="mt-10" noValidate onSubmit={onSubmit}>
                    <Field field={fields.product} values={values} onChange={setValue} />
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
                    </div>
                    <div className="hp" aria-hidden="true">
                      <label>
                        Leave this empty
                        <input type="text" name="botcheck" tabIndex={-1} autoComplete="off" />
                      </label>
                    </div>
                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                      <button type="submit" className="btn btn-solid" disabled={sending}>
                        {sending ? 'Sending…' : 'Notify me'}
                      </button>
                      <p className="t-small text-muted">Your email is only used for the launch note.</p>
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

            <div className="col-span-12 lg:col-span-5 lg:col-start-8">
              <div key={item ? item.id : 'family'} className="notify-stage">
                <Specimen className="theme-light" />
              </div>
              {item ? (
                <dl className="rule-b mt-8">
                  <Spec term="Built for">{item.audience}</Spec>
                  <Spec term="Highlights">{item.features}</Spec>
                  <Spec term="Pricing">{item.price}</Spec>
                </dl>
              ) : (
                <p className="t-small mt-8 max-w-[30rem] text-fg/80">
                  Two versions are on the way: Relay CRM for small teams and growing agencies, and Relay Solo for
                  solopreneurs and one-person agencies.
                </p>
              )}
            </div>
          </div>
          <div className="roofline" aria-hidden="true" style={{ backgroundImage: `url(${images.heroDesk})` }} />
        </section>
      </main>
      <Footer current="notify" />
      <ScrollTop />
    </>
  )
}
