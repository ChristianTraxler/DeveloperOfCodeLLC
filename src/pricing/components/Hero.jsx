import { site, url } from '../site.config.js'
import { carePlans, setupSizes, careTerm } from '../pricing.js'
import { Arrow } from './ui.jsx'

const lowestSetup = Math.min(...setupSizes.map((s) => s.price))
const lowestCare = Math.min(...carePlans.map((p) => p.price))

function Tag({ kicker, price, unit, note, rotate, delay, tone = 'paper' }) {
  const paper = tone === 'paper'
  return (
    <div className="rise" style={{ '--d': `${delay}ms` }}>
      <div className="tag-sway origin-[0%_50%]" style={{ '--r': rotate }}>
        <div
          className={`relative flex items-center gap-4 py-5 pl-12 pr-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] sm:pl-14 sm:pr-8 ${
            paper ? 'bg-paper text-ink' : 'bg-lamp text-night'
          }`}
          style={{ clipPath: 'polygon(28px 0, 100% 0, 100% 100%, 28px 100%, 0 50%)' }}
        >
          <span className="absolute left-[22px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-dusk shadow-inner" aria-hidden="true" />
          <div>
            <p className={`eyebrow ${paper ? 'text-ink-muted' : 'text-night/70'}`}>{kicker}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[13px] font-medium opacity-70">from</span>
              <span className="display num text-[3rem] sm:text-[3.6rem]">${price}</span>
              {unit && <span className="text-[15px] font-medium opacity-70">{unit}</span>}
            </p>
            <p className={`text-[13.5px] ${paper ? 'text-ink-muted' : 'text-night/75'}`}>{note}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="grain relative overflow-hidden bg-dusk pt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_80%_0%,rgb(var(--c-dusk-2))_0%,transparent_60%),linear-gradient(180deg,rgb(var(--c-dusk))_0%,rgb(var(--c-deep))_100%)]" aria-hidden="true" />
      <div className="wrap relative grid gap-14 pb-20 pt-14 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-28 lg:pt-24">
        <div className="lg:col-span-7">
          <p className="eyebrow rise text-lamp">Pricing</p>
          <h1 id="hero-title" className="display rise mt-5 text-[3.3rem] sm:text-[4.6rem] lg:text-[5.6rem]" style={{ '--d': '80ms' }}>
            Plain prices, <span className="italic text-snow/80">no</span> surprises.
          </h1>
          <p className="rise mt-7 max-w-xl text-[17.5px] leading-relaxed text-snow/85" style={{ '--d': '160ms' }}>
            Every site is two numbers: a one-time setup fee that covers the build, and a monthly care plan that keeps it
            fast, safe and up to date after launch. Here is every price, on one page.
          </p>
          <div className="rise mt-9 flex flex-col gap-3 sm:flex-row" style={{ '--d': '240ms' }}>
            <a href="#estimate" className="btn-snow">
              Build an estimate <Arrow />
            </a>
            <a href={url(site.consult)} className="btn-ghost">Book a free consultation</a>
          </div>
        </div>

        <div className="relative lg:col-span-5" aria-label="Pricing at a glance">
          {/* the string the tags hang from */}
          <svg className="absolute -top-6 left-3 hidden h-[calc(100%+1.5rem)] w-6 sm:block" viewBox="0 0 24 400" preserveAspectRatio="none" aria-hidden="true">
            <path d="M12 0 C 4 120, 20 220, 12 400" fill="none" stroke="rgb(var(--c-snow) / 0.25)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="flex flex-col gap-6 sm:pl-2">
            <Tag kicker="Setup fee, paid once" price={lowestSetup} note="Covers the design and build." rotate="-2.5deg" delay={300} />
            <Tag kicker="Care plan, monthly" price={lowestCare} unit="/ month" note={`On a ${careTerm.label}.`} rotate="1.8deg" delay={420} tone="lamp" />
            <div className="rise flex items-start gap-3 pl-2 text-[14px] text-snow-muted" style={{ '--d': '560ms' }}>
              <span className="mt-2 h-px w-6 flex-none bg-snow/40" aria-hidden="true" />
              <p>Hosting is separate. You hold the hosting account and pay the provider directly, so the site is always yours.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap relative">
        <ol className="grid grid-cols-1 border-t border-snow/10 py-6 text-[13.5px] text-snow-muted sm:grid-cols-3 sm:gap-6">
          {[
            ['01', 'Sign the agreement and pay setup'],
            ['02', 'I design and build your site'],
            ['03', 'Monthly care starts on launch day'],
          ].map(([n, t]) => (
            <li key={n} className="flex items-center gap-3 border-b border-snow/10 py-3 last:border-0 sm:border-0 sm:py-0">
              <span className="num wide font-semibold text-lamp">{n}</span>
              {t}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
