import { setupSizes, money } from '../pricing.js'
import { Reveal, SectionHead, Check } from './ui.jsx'

export default function Setup() {
  return (
    <section id="setup" aria-labelledby="setup-title" className="bg-deep py-24 sm:py-32">
      <div className="wrap">
        <SectionHead
          id="setup-title"
          eyebrow="Step one · The build"
          title="Setup, paid once."
          lede="One fee covers designing and building your site. It is paid before work starts, and the build begins once your agreement is signed."
        />

        <ol className="mt-14 grid gap-px overflow-hidden rounded-[22px] border border-snow/10 bg-snow/10 md:grid-cols-3">
          {setupSizes.map((s, i) => (
            <Reveal as="li" key={s.id} delay={i * 90} className="flex flex-col bg-deep p-7 sm:p-9">
              <div className="flex items-center justify-between">
                <p className="eyebrow text-snow-muted">{s.name}</p>
                <span className="num wide text-[12px] font-semibold text-snow/40">0{i + 1}</span>
              </div>
              <p className="mt-7 flex items-baseline gap-2">
                <span className="display num text-[4.2rem] sm:text-[4.8rem]">{money(s.price)}</span>
                {s.from && <span className="text-[15px] font-medium text-lamp">and up</span>}
              </p>
              <p className="mt-2 text-[15px] font-semibold">{s.pages}</p>
              <ul className="mt-6 space-y-3 border-t border-snow/10 pt-6 text-[15px] text-snow/80">
                {s.scope.map((t) => (
                  <li key={t} className="flex gap-3"><Check className="mt-1 text-live" />{t}</li>
                ))}
              </ul>
              {s.from && (
                <a href="#add-ons" className="mt-auto pt-8 text-[14px] font-semibold text-lamp underline decoration-lamp/40 underline-offset-4 hover:decoration-lamp">
                  See add-ons for large builds
                </a>
              )}
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-8 flex flex-col gap-2 text-[14.5px] text-snow-muted sm:flex-row sm:items-center sm:gap-6">
          <p>One-time fee, in US dollars.</p>
          <span className="hidden h-1 w-1 rounded-full bg-snow/30 sm:block" aria-hidden="true" />
          <p>Bigger or unusual projects get a written custom quote.</p>
        </Reveal>
      </div>
    </section>
  )
}
