// Christian's price sheet (#/pricing): every offer, its tiers and what each one includes.
// Read straight from OFFERS, so it always matches the prices on the client report.
import { ArrowLeft, Check } from 'lucide-react'
import { OFFERS } from '../../../../../api/_lib/seo-config.mjs'
import { Button } from './ui/core.jsx'

export function Pricing({ onBack }) {
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-10">
      <Button variant="quiet" onClick={onBack} className="-ml-3">
        <ArrowLeft size={16} /> Reviews
      </Button>
      <header className="mt-10">
        <h1 className="display text-[clamp(52px,12vw,96px)] leading-[0.88]">Pricing</h1>
        <p className="mt-5 max-w-[48ch] text-[16px] leading-relaxed text-mute">
          What you offer and what each price includes. Clients see the package name and price range on their report. The tiers are for you to quote from.
        </p>
      </header>

      {OFFERS.map((o) => (
        <section key={o.key} aria-labelledby={`offer-${o.key}`} className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
            <h2 id={`offer-${o.key}`} className="display text-[30px] leading-none sm:text-[36px]">
              {o.name}
            </h2>
            <p className="text-[14px] text-mute">
              <span className="font-semibold tabular-nums text-bone">{o.price}</span> <span className="text-faint">· {o.billing}</span>
            </p>
          </div>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-mute">
            <span className="text-faint">On the report: </span>
            {o.blurb}
          </p>
          <ul className={`mt-6 grid gap-4 ${o.tiers.length > 1 ? 'md:grid-cols-3' : 'md:max-w-[420px]'}`}>
            {o.tiers.map((t) => (
              <li key={t.name} className="rounded-[22px] border border-line2 bg-white/[0.02] p-6">
                <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-faint">{t.name}</p>
                <p className="display mt-2 text-[40px] leading-none tabular-nums text-bone">{t.price}</p>
                <ul className="mt-5 space-y-2.5 text-[15px] leading-snug text-bone/90">
                  {t.includes.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-ember" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {o.includes.length > 0 && <p className="mt-4 text-[14px] text-mute">Every tier includes: {o.includes.join(', ').toLowerCase()}.</p>}
        </section>
      ))}

      <p className="mt-16 text-[13.5px] text-faint">To change a price or what a tier includes, edit OFFERS in api/_lib/seo-config.mjs.</p>
    </main>
  )
}
