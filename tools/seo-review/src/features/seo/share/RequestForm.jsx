// "Request implementation" on the client report: the owner ticks the fixes they want, picks a
// package, and leaves a way to reach them. Christian gets an email; payment, when a Stripe
// Payment Link is set for the package, happens on Stripe and never touches this site.
import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { cx } from '../lib.js'
import { requestWork, tokenFromLocation } from './shareApi.js'

const field = 'h-[52px] w-full rounded-[14px] border border-line2 bg-transparent px-4 text-[16px] text-bone placeholder:text-faint focus:border-[rgb(var(--lamp-rgb))] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--lamp-rgb)/0.15)]'

function Box({ checked }) {
  return (
    <span aria-hidden="true" className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[8px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(var(--lamp-rgb))]', checked ? 'border-[rgb(var(--lamp-rgb))] bg-[rgb(var(--lamp-rgb))] text-[rgb(17_36_72)]' : 'border-line2 text-transparent')}>
      <Check size={14} strokeWidth={3} />
    </span>
  )
}

export function RequestForm({ data }) {
  const { tasks, offers, recommended, brand } = data
  const [picked, setPicked] = useState(() => new Set(tasks.map((t) => t.order)))
  const [offer, setOffer] = useState(recommended || '')
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' })
  const [state, setState] = useState({ status: 'idle' }) // idle, sending, sent, error
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: null }))
  }
  const toggle = (order) =>
    setPicked((s) => {
      const next = new Set(s)
      next.has(order) ? next.delete(order) : next.add(order)
      return next
    })

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Add your name.'
    if (!form.email.trim() && !form.phone.trim()) next.email = 'Add an email or a phone number.'
    else if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) next.email = 'That email address does not look right.'
    if (!picked.size && !offer) next.picks = 'Pick at least one fix or a package.'
    setErrors(next)
    if (Object.keys(next).length) return
    setState({ status: 'sending' })
    try {
      const out = await requestWork(tokenFromLocation(), { ...form, tasks: [...picked], offer: offer || null })
      setState({ status: 'sent', payUrl: out.payUrl })
    } catch (err) {
      setState({ status: 'error', error: err.message })
    }
  }

  if (state.status === 'sent') {
    const chosen = offers.find((o) => o.key === offer)
    return (
      <section id="c-request" aria-labelledby="c-request-h" className="keep mt-20 rounded-[26px] border border-line bg-panel p-6 sm:p-10">
        <p className="grid h-12 w-12 place-items-center rounded-full bg-[rgb(var(--lamp-rgb))] text-[rgb(17_36_72)]">
          <Check size={22} strokeWidth={3} />
        </p>
        <h2 id="c-request-h" className="display mt-5 text-[clamp(30px,5vw,40px)] leading-[1.05]" tabIndex={-1}>
          Request sent
        </h2>
        <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-mute">
          {brand.person} has your list and will get back to you to confirm the details and a start date. If it is urgent, call {brand.phone}.
        </p>
        {state.payUrl && chosen && (
          <a href={state.payUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex h-[54px] items-center justify-center gap-2 rounded-full bg-[rgb(var(--lamp-rgb))] px-7 text-[16px] font-semibold text-[rgb(17_36_72)]">
            Pay for the {chosen.name} on Stripe <ArrowRight size={17} aria-hidden="true" />
          </a>
        )}
      </section>
    )
  }

  return (
    <section id="c-request" aria-labelledby="c-request-h" className="no-print mt-20 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14">
      <div>
        <h2 id="c-request-h" className="display text-[clamp(30px,5vw,40px)] leading-[1.05]">
          Request implementation
        </h2>
        <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-mute">Pick what you want done. {brand.person} will confirm the price and timing before any work starts.</p>
      </div>
      <form onSubmit={submit} noValidate className="min-w-0">
        {tasks.length > 0 && (
          <fieldset>
            <legend className="text-[14px] font-semibold">The fixes</legend>
            <ul className="mt-3 border-t border-line">
              {tasks.map((t) => (
                <li key={t.order} className="border-b border-line">
                  <label className="flex min-h-[52px] cursor-pointer items-start gap-3.5 py-3.5">
                    <input type="checkbox" className="peer sr-only" checked={picked.has(t.order)} onChange={() => toggle(t.order)} />
                    <Box checked={picked.has(t.order)} />
                    <span className="text-[15.5px] leading-snug">{t.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        <fieldset className="mt-8">
          <legend className="text-[14px] font-semibold">Package</legend>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {[{ key: '', name: 'Just the fixes I picked', price: 'Quoted for you' }, ...offers].map((o) => (
              <label key={o.key || 'none'} className={cx('flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[16px] border px-4 py-3 transition-colors', offer === o.key ? 'border-[rgb(var(--lamp-rgb))] bg-[rgb(var(--lamp-rgb)/0.08)]' : 'border-line2')}>
                <input type="radio" name="offer" value={o.key} checked={offer === o.key} onChange={() => setOffer(o.key)} className="h-[18px] w-[18px] shrink-0 accent-[rgb(var(--lamp-rgb))]" />
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-snug">{o.name}</span>
                  <span className="block text-[13px] text-mute">{o.price}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.picks && <p className="mt-2 text-[13.5px] text-danger">{errors.picks}</p>}
        </fieldset>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="r-name" className="mb-2 block text-[13.5px] font-medium">Your name</label>
            <input id="r-name" autoComplete="name" value={form.name} onChange={set('name')} className={cx(field, errors.name && 'border-danger')} />
            {errors.name && <p className="mt-2 text-[13px] text-danger">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="r-email" className="mb-2 block text-[13.5px] font-medium">Email</label>
            <input id="r-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} className={cx(field, errors.email && 'border-danger')} />
            {errors.email && <p className="mt-2 text-[13px] text-danger">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="r-phone" className="mb-2 block text-[13.5px] font-medium">Phone</label>
            <input id="r-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="r-msg" className="mb-2 block text-[13.5px] font-medium">Anything Christian should know (optional)</label>
            <textarea id="r-msg" rows={3} value={form.message} onChange={set('message')} className={cx(field, 'h-auto py-3 leading-relaxed')} />
          </div>
          {/* Hidden from people; bots fill it in and their request is dropped. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="r-website">Website</label>
            <input id="r-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
          </div>
        </div>
        {state.status === 'error' && <p className="mt-5 text-[14px] text-danger" role="alert">{state.error}</p>}
        <button type="submit" disabled={state.status === 'sending'} className="mt-7 inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[rgb(var(--lamp-rgb))] px-7 text-[16px] font-semibold text-[rgb(17_36_72)] transition-transform active:scale-[0.98] disabled:opacity-60 sm:w-auto">
          {state.status === 'sending' ? 'Sending' : 'Send request'} {state.status !== 'sending' && <ArrowRight size={17} aria-hidden="true" />}
        </button>
        <p className="mt-3 text-[13px] text-faint">Nothing is charged here. You get a confirmation first.</p>
      </form>
    </section>
  )
}
