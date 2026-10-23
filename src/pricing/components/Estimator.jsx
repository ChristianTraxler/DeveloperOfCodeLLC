import { useMemo, useState } from 'react'
import { setupSizes, carePlans, addOnGroups, careTerm, money, priceLabel } from '../pricing.js'
import { estimate } from '../lib/estimate.js'
import { site, url } from '../site.config.js'
import { Reveal, Money, Arrow } from './ui.jsx'
import logo from '../assets/logo-mark.webp'

function Segmented({ label, options, value, onChange, render }) {
  return (
    <fieldset>
      <legend className="eyebrow text-ink-muted">{label}</legend>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-ink/[0.07] p-1">
        {options.map((o) => {
          const on = o.id === value
          return (
            <label
              key={o.id}
              className={`relative flex cursor-pointer flex-col items-center rounded-xl px-2 py-3 text-center transition ${
                on ? 'bg-paper shadow-[0_6px_16px_-8px_rgba(20,33,61,0.45)]' : 'hover:bg-paper/50'
              }`}
            >
              <input type="radio" name={label} value={o.id} checked={on} onChange={() => onChange(o.id)} className="peer sr-only" />
              {render(o, on)}
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-lamp peer-focus-visible:ring-2" aria-hidden="true" />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function Stepper({ value, max, onChange, label }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-ink/[0.07] p-1" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Fewer: ${label}`}
        className="grid h-9 w-9 place-items-center rounded-full text-lg transition hover:bg-paper disabled:opacity-30">−</button>
      <span className="num w-7 text-center text-[15px] font-semibold" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More: ${label}`}
        className="grid h-9 w-9 place-items-center rounded-full text-lg transition hover:bg-paper disabled:opacity-30">+</button>
    </div>
  )
}

export default function Estimator() {
  const [size, setSize] = useState('standard')
  const [plan, setPlan] = useState('standard')
  const [addOns, setAddOns] = useState({})
  const e = useMemo(() => estimate({ size, plan, addOns }), [size, plan, addOns])
  const large = size === 'large'

  const toggle = (a) => {
    setAddOns((cur) => {
      const next = { ...cur, [a.id]: cur[a.id] ? 0 : 1 }
      // Only one CMS at a time.
      if (a.group === 'cms' && next[a.id]) for (const g of addOnGroups) for (const x of g.items) if (x.group === 'cms' && x.id !== a.id) next[x.id] = 0
      return next
    })
  }
  const setQty = (id, q) => setAddOns((cur) => ({ ...cur, [id]: q }))
  const reset = () => { setAddOns({}); setSize('standard'); setPlan('standard') }

  const setupText = e.min === e.max ? null : `${money(e.min)} to ${money(e.max)}`
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <section id="estimate" aria-labelledby="estimate-title" className="bg-sand py-24 text-ink sm:py-32">
      <div className="wrap">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <Reveal className="md:col-span-7">
            <p className="eyebrow text-lamp-ink">Estimator</p>
            <h2 id="estimate-title" className="display mt-4 text-[2.6rem] sm:text-[3.4rem] lg:text-[4.1rem]">Price out your site.</h2>
          </Reveal>
          <Reveal delay={120} className="text-ink-muted md:col-span-5 md:pb-2">
            <p className="max-w-md text-[16.5px] leading-relaxed">Choose a size, any add-ons and a care plan. The ticket keeps a running total, so you know the range before we ever talk.</p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Controls */}
          <div className="space-y-10 lg:col-span-7">
            <Segmented
              label="Project size"
              options={setupSizes}
              value={size}
              onChange={setSize}
              render={(o, on) => (
                <>
                  <span className={`text-[15px] font-semibold ${on ? 'text-ink' : 'text-ink/75'}`}>{o.name}</span>
                  <span className="num mt-0.5 text-[13px] text-ink-muted">{money(o.price)}{o.from ? '+' : ''}</span>
                  <span className="mt-1 hidden text-[12px] text-ink-muted sm:block">{o.pages}</span>
                </>
              )}
            />

            <fieldset>
              <legend className="eyebrow text-ink-muted">Add-ons</legend>
              {!large ? (
                <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-ink/25 p-5 text-[15px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
                  <p>Booking, stores, logins and the rest are added to Large builds.</p>
                  <button type="button" onClick={() => setSize('large')} className="flex-none rounded-full border border-ink/30 px-4 py-2 text-[14px] font-semibold text-ink transition hover:bg-ink hover:text-snow">
                    Switch to Large
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-6">
                  {addOnGroups.map((g) => (
                    <div key={g.title}>
                      <p className="mb-2 text-[13px] font-semibold text-ink/70">{g.title}</p>
                      <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-paper/70">
                        {g.items.map((a) => {
                          const qty = addOns[a.id] ?? 0
                          const counted = a.kind === 'per' || a.kind === 'perRange'
                          return (
                            <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                              <div className="min-w-0">
                                <p className="text-[15px] font-semibold">{a.name}</p>
                                <p className="num text-[13px] text-ink-muted">{priceLabel(a)}</p>
                              </div>
                              {counted ? (
                                <Stepper value={qty} max={a.maxQty} onChange={(q) => setQty(a.id, q)} label={a.name} />
                              ) : (
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={!!qty}
                                  aria-label={a.name}
                                  onClick={() => toggle(a)}
                                  className={`relative h-8 w-14 flex-none rounded-full transition ${qty ? 'bg-ink' : 'bg-ink/15'}`}
                                >
                                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-paper shadow transition-all ${qty ? 'left-7' : 'left-1'}`} />
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>

            <Segmented
              label="Care plan"
              options={carePlans}
              value={plan}
              onChange={setPlan}
              render={(o, on) => (
                <>
                  <span className={`text-[15px] font-semibold ${on ? 'text-ink' : 'text-ink/75'}`}>{o.name}</span>
                  <span className="num mt-0.5 text-[13px] text-ink-muted">{money(o.price)}/mo</span>
                  <span className="mt-1 hidden text-[12px] text-ink-muted sm:block">{o.responseShort} response</span>
                </>
              )}
            />
          </div>

          {/* Ticket */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <div className="ticket rounded-[4px] px-6 pb-8 pt-7 shadow-[0_40px_70px_-40px_rgba(20,33,61,0.55)] sm:px-8" aria-live="polite">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <img src={logo} alt="" className="h-6 w-auto" />
                    <div>
                      <p className="text-[13px] font-semibold leading-tight">Developer of Code</p>
                      <p className="text-[11.5px] text-ink-muted">Estimate · {today}</p>
                    </div>
                  </div>
                  <p className="eyebrow rounded-full border border-ink/25 px-2.5 py-1 text-[10px] text-ink-muted">Not a quote</p>
                </div>

                <div className="dash-line mt-6" />
                <p className="eyebrow mt-5 text-ink-muted">Setup, paid once</p>
                <ul className="mt-3 space-y-2.5 text-[14.5px]">
                  {e.lines.map((l) => (
                    <li key={l.label} className="flex justify-between gap-4">
                      <span className="text-ink/80">{l.label}</span>
                      <span className="num flex-none font-semibold">{l.min === l.max ? money(l.min) : `${money(l.min)} to ${money(l.max)}`}</span>
                    </li>
                  ))}
                  {e.quoteOnly.map((q) => (
                    <li key={q} className="flex justify-between gap-4">
                      <span className="text-ink/80">{q}</span>
                      <span className="flex-none font-semibold text-lamp-ink">Quoted</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-ink/15 pt-4">
                  <span className="text-[14px] font-semibold">Setup total</span>
                  <span className="display text-right text-[2.1rem] leading-none">
                    {setupText ? (
                      <span className="num text-[1.7rem] sm:text-[1.9rem]">{setupText}</span>
                    ) : (
                      <Money value={e.min} />
                    )}
                  </span>
                </div>

                <div className="dash-line mt-6" />
                <p className="eyebrow mt-5 text-ink-muted">Care, monthly</p>
                <div className="mt-3 flex items-baseline justify-between gap-4">
                  <span className="text-[14.5px] text-ink/80">{e.plan.name} plan · {e.plan.response} response</span>
                  <span className="display text-[2.1rem] leading-none"><Money value={e.monthly} /><span className="text-[14px] text-ink-muted">/mo</span></span>
                </div>
                <p className="mt-2 text-[13px] text-ink-muted">
                  {careTerm.months} months of care: <span className="num font-semibold text-ink">{money(e.firstYearCare)}</span>, billed monthly from launch.
                </p>

                {e.needsQuote && (
                  <div className="mt-6 rounded-xl bg-lamp/15 px-4 py-3.5 text-[14px] leading-snug text-ink">
                    <span className="font-semibold">This one gets a written quote.</span> With this many moving parts, I price it as a custom project so the number is exact.
                  </div>
                )}

                <div className="dash-line mt-6" />
                <div className="mt-6 flex flex-col gap-3">
                  <a href={url(site.intake)} className="btn-ink">Start your project <Arrow /></a>
                  <button type="button" onClick={reset} className="text-[13.5px] font-semibold text-ink-muted underline decoration-ink/25 underline-offset-4 hover:text-ink">
                    Reset the estimate
                  </button>
                </div>
              </div>
              <p className="mt-6 text-[13px] leading-relaxed text-ink-muted">
                Estimates are a guide, not a quote. Your written quote and service agreement set the final price. Hosting is not included.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
