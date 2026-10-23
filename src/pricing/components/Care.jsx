import { carePlans, compareRows, extraHourRate, careTerm, money } from '../pricing.js'
import { Reveal, SectionHead, Check, Dash } from './ui.jsx'

function Cell({ v }) {
  if (v === true) return <Check className="text-live" />
  if (v === false) return <Dash className="text-snow/25" />
  return <span>{v}</span>
}

export default function Care() {
  return (
    <section id="care" aria-labelledby="care-title" className="grain bg-dusk py-24 sm:py-32">
      <div className="wrap">
        <SectionHead
          id="care-title"
          eyebrow="Step two · After launch"
          title="Care, every month."
          lede={`Pick the care plan that fits how often your site changes. Every plan is a ${careTerm.label}, and billing starts on the day your site launches.`}
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3 lg:gap-6">
          {carePlans.map((p, i) => {
            const rec = p.recommended
            return (
              <Reveal
                key={p.id}
                delay={i * 90}
                className={`relative flex flex-col rounded-[22px] p-7 sm:p-9 ${
                  rec ? 'bg-snow text-ink shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] lg:-my-4 lg:py-12' : 'border border-snow/15 bg-night/30'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[22px] font-semibold tracking-tight">{p.name}</h3>
                  {rec && <span className="rounded-full bg-lamp px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-night">Recommended</span>}
                </div>
                <p className={`mt-2 text-[15px] ${rec ? 'text-ink-muted' : 'text-snow-muted'}`}>{p.blurb}</p>

                <p className="mt-8 flex items-baseline gap-1.5">
                  <span className="display num text-[4.6rem] sm:text-[5.2rem]">{money(p.price)}</span>
                  <span className={`text-[15px] font-medium ${rec ? 'text-ink-muted' : 'text-snow-muted'}`}>/ month</span>
                </p>

                <div className={`mt-6 flex items-center justify-between rounded-xl px-4 py-3 text-[14px] ${rec ? 'bg-ink/[0.06]' : 'bg-snow/[0.06]'}`}>
                  <span className={rec ? 'text-ink-muted' : 'text-snow-muted'}>Response time</span>
                  <span className="font-semibold">{p.response}</span>
                </div>

                <ul className="mt-7 space-y-3.5 text-[15px]">
                  {p.inherits && (
                    <li className={`font-semibold ${rec ? 'text-ink' : 'text-snow'}`}>Everything in {p.inherits}, plus:</li>
                  )}
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className={`mt-1 ${rec ? 'text-lamp-ink' : 'text-live'}`} />
                      <span className={rec ? 'text-ink/85' : 'text-snow/85'}>{f}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )
          })}
        </div>

        <Reveal className="mt-10 grid gap-4 rounded-[18px] border border-snow/15 p-6 text-[15px] sm:grid-cols-2 sm:p-7">
          <p className="flex gap-3">
            <span className="display num text-[1.9rem] leading-none text-lamp">{money(extraHourRate)}</span>
            <span className="text-snow/85">an hour for any work beyond the hours in your plan.</span>
          </p>
          <p className="flex gap-3 sm:border-l sm:border-snow/15 sm:pl-6">
            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-snow/40" aria-hidden="true" />
            <span className="text-snow/85">Unused hours do not roll over to the next month.</span>
          </p>
        </Reveal>

        {/* Comparison */}
        <Reveal className="mt-16">
          <h3 className="eyebrow text-snow-muted">Compare plans side by side</h3>
          <div className="mt-5 overflow-hidden rounded-[18px] border border-snow/15" role="table" aria-label="Care plan comparison">
            <div role="row" className="grid grid-cols-3 bg-night/40 text-[13px] font-semibold md:grid-cols-[1.6fr_1fr_1fr_1fr]">
              <span role="columnheader" className="hidden px-5 py-4 text-snow-muted md:block">Included</span>
              {carePlans.map((p) => (
                <span role="columnheader" key={p.id} className="px-3 py-4 text-center sm:px-5">
                  {p.name} <span className="block font-normal text-snow-muted md:inline">{money(p.price)}/mo</span>
                </span>
              ))}
            </div>
            {compareRows.map((r) => (
              <div role="row" key={r.label} className="grid grid-cols-3 border-t border-snow/10 text-[14px] md:grid-cols-[1.6fr_1fr_1fr_1fr]">
                <span role="rowheader" className="col-span-3 px-5 pb-1 pt-4 font-medium text-snow md:col-span-1 md:py-4">{r.label}</span>
                {carePlans.map((p) => (
                  <span role="cell" key={p.id} className="flex items-center justify-center px-2 pb-4 pt-1 text-center text-snow/80 md:py-4">
                    <Cell v={r[p.id]} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
