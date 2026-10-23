import { careTerm } from '../pricing.js'
import { Reveal, SectionHead } from './ui.jsx'

const steps = [
  { n: '01', title: 'Agree and pay setup', body: `You sign the ${careTerm.label} and pay the setup fee. The build starts after both.` },
  { n: '02', title: 'Design and build', body: 'I design and build your site, from the first call to launch day.' },
  { n: '03', title: 'Launch', body: 'Your site goes live, and monthly care billing starts on the launch date.' },
  { n: '04', title: 'Care, month after month', body: 'Updates, monitoring and changes, with the response time your plan promises.' },
]

const yours = [
  ['Your domain', 'You own it.'],
  ['Your content', 'Everything you supply: words, photos, logos.'],
  ['Your site', 'A license to use the finished site.'],
  ['Your hosting', 'You hold the hosting account and pay the provider directly. Hosting is not part of any plan.'],
]

const fine = [
  ['Late payment', 'If a payment is 14 days late, maintenance pauses. Your site stays live.'],
  ['Cancelling', 'Either side can end the agreement with 30 days of written notice.'],
  ['Leaving', 'After the end date, you get your site files and a content export within 10 business days.'],
  ['What I keep', 'Reusable code, templates and components stay with the studio.'],
]

export default function Terms() {
  return (
    <>
      <section id="how" aria-labelledby="how-title" className="grain bg-dusk py-24 sm:py-32">
        <div className="wrap">
          <SectionHead
            id="how-title"
            eyebrow="How it works"
            title="From handshake to launch."
            lede="The same four steps for every project, so you always know what you are paying for and when."
          />
          <ol className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
            <span className="absolute left-[11px] top-3 h-[calc(100%-1.5rem)] w-px bg-snow/15 md:left-0 md:right-0 md:top-[11px] md:h-px md:w-full" aria-hidden="true" />
            {steps.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 100} className="relative pl-10 md:pl-0 md:pt-12">
                <span className="absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-full border border-snow/30 bg-dusk" aria-hidden="true">
                  <span className={`h-2 w-2 rounded-full ${i === 2 ? 'bg-lamp' : 'bg-snow/60'}`} />
                </span>
                <p className="num wide text-[12px] font-semibold text-lamp">{s.n}</p>
                <h3 className="display mt-2 text-[1.8rem]">{s.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-snow/75">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="ownership" aria-labelledby="own-title" className="bg-deep py-24 sm:py-32">
        <div className="wrap grid gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="eyebrow text-lamp">Ownership</p>
              <h2 id="own-title" className="display mt-4 text-[2.6rem] sm:text-[3.4rem]">What stays yours.</h2>
              <p className="mt-6 max-w-md text-[16.5px] leading-relaxed text-snow-muted">
                You are never locked in. The accounts that matter are in your name, and if we part ways, you leave with your files.
              </p>
            </Reveal>
          </div>
          <div className="grid gap-12 sm:grid-cols-2 lg:col-span-7">
            <div>
              <Reveal as="h3" className="eyebrow text-snow-muted">Yours</Reveal>
              <dl className="mt-4">
                {yours.map(([t, d], i) => (
                  <Reveal key={t} delay={i * 70} className="border-t border-snow/10 py-5">
                    <dt className="text-[16px] font-semibold">{t}</dt>
                    <dd className="mt-1 text-[15px] leading-relaxed text-snow-muted">{d}</dd>
                  </Reveal>
                ))}
              </dl>
            </div>
            <div>
              <Reveal as="h3" className="eyebrow text-snow-muted">The fine print, in plain words</Reveal>
              <dl className="mt-4">
                {fine.map(([t, d], i) => (
                  <Reveal key={t} delay={i * 70} className="border-t border-snow/10 py-5">
                    <dt className="text-[16px] font-semibold">{t}</dt>
                    <dd className="mt-1 text-[15px] leading-relaxed text-snow-muted">{d}</dd>
                  </Reveal>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
