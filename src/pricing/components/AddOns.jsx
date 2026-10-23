import { addOnGroups, addOnNotes, largeBase, money, priceLabel } from '../pricing.js'
import { Reveal, SectionHead, Check } from './ui.jsx'

export default function AddOns() {
  return (
    <section id="add-ons" aria-labelledby="addons-title" className="bg-deep py-24 sm:py-32">
      <div className="wrap">
        <SectionHead
          id="addons-title"
          eyebrow="Large builds"
          title="Add what your business needs."
          lede="Large projects start from a base and add only the features you need. Each add-on is added to the setup fee once."
        />

        <Reveal className="mt-14 grid gap-6 rounded-[22px] bg-snow p-7 text-ink sm:p-9 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5">
            <p className="eyebrow text-lamp-ink">The large base</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="display num text-[4rem] sm:text-[4.6rem]">{money(largeBase.price)}</span>
              <span className="text-[15px] font-medium text-ink-muted">setup</span>
            </p>
          </div>
          <ul className="grid gap-3 text-[15.5px] sm:grid-cols-2 md:col-span-7">
            {largeBase.includes.map((t) => (
              <li key={t} className="flex items-center gap-3 rounded-xl bg-ink/[0.05] px-4 py-3"><Check className="text-lamp-ink" />{t}</li>
            ))}
          </ul>
        </Reveal>

        <div className="mt-16 space-y-14">
          {addOnGroups.map((g) => (
            <div key={g.title}>
              <Reveal as="h3" className="eyebrow text-snow-muted">{g.title}</Reveal>
              <ul className="mt-4">
                {g.items.map((a, i) => (
                  <Reveal
                    as="li"
                    key={a.id}
                    delay={i * 60}
                    className="grid gap-1 border-t border-snow/10 py-5 last:border-b sm:grid-cols-12 sm:items-baseline sm:gap-6 sm:py-6"
                  >
                    <span className="display text-[1.55rem] sm:col-span-4 sm:text-[1.75rem]">{a.name}</span>
                    <span className="text-[15px] text-snow-muted sm:col-span-5">{a.note}</span>
                    <span className={`num mt-2 text-[15.5px] font-semibold sm:col-span-3 sm:mt-0 sm:text-right ${a.kind === 'quote' ? 'text-lamp' : 'text-snow'}`}>
                      {priceLabel(a)}
                    </span>
                  </Reveal>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Reveal className="mt-12 grid gap-4 sm:grid-cols-2">
          {addOnNotes.map((n) => (
            <p key={n} className="flex gap-3 text-[14.5px] leading-relaxed text-snow-muted">
              <span className="mt-2.5 h-1 w-3 flex-none bg-lamp/70" aria-hidden="true" />
              {n}
            </p>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
