import { site, url } from '../site.config.js'
import { extraHourRate, careTerm, money } from '../pricing.js'
import { Reveal, Arrow, LiveDot } from './ui.jsx'
import logo from '../assets/logo-mark.webp'

const faqs = [
  {
    q: 'Why two prices instead of one?',
    a: 'The setup fee pays for designing and building your site. The care plan pays for keeping it updated, monitored and changing with your business after launch. Splitting them keeps the upfront cost low.',
  },
  {
    q: `Why a ${careTerm.months}-month agreement?`,
    a: `Care plans run for ${careTerm.months} months, starting on the day your site launches. Billing is monthly, not upfront.`,
  },
  {
    q: 'Is hosting included?',
    a: 'No. You hold the hosting account and pay the provider directly. That keeps your site in your name, on an account you control.',
  },
  {
    q: 'What if I need more work than my plan covers?',
    a: `Extra work is ${money(extraHourRate)} an hour. Plan hours reset each month, and unused hours do not roll over.`,
  },
  {
    q: 'Which care plan fits a site with logins or a store?',
    a: 'Sites with client logins or several integrations are usually a better fit for Plus, which includes 5 hours of changes a month and same business day responses.',
  },
  {
    q: 'I already pay for WordPress or Sanity. Do I pay you for that too?',
    a: 'No. If you use a hosted CMS, you keep paying that subscription directly. Each CMS I set up includes one hour of training, and more training is $75 an hour.',
  },
  {
    q: 'What happens if a payment is late?',
    a: 'After 14 days, maintenance pauses until the account is current. Your site stays live the whole time.',
  },
  {
    q: 'Can I cancel?',
    a: 'Either side can end the agreement with 30 days of written notice. The full cancellation terms are spelled out in your service agreement. After the end date, you get your site files and a content export within 10 business days.',
  },
]

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="grain bg-dusk py-24 sm:py-32">
      <div className="wrap grid gap-12 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow text-lamp">Questions</p>
          <h2 id="faq-title" className="display mt-4 text-[2.6rem] sm:text-[3.4rem]">Good to know.</h2>
          <p className="mt-6 max-w-sm text-[16px] leading-relaxed text-snow-muted">
            Something not covered here? Ask on a free consultation. No pressure, and no jargon.
          </p>
        </Reveal>
        <div className="lg:col-span-8">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 40}>
              <details className="group border-t border-snow/12 py-1 last:border-b" style={{ borderColor: 'rgb(var(--c-snow) / 0.12)' }}>
                <summary className="flex items-center justify-between gap-6 py-5 text-[17px] font-semibold sm:text-[18px]">
                  {f.q}
                  <span className="chev grid h-8 w-8 flex-none place-items-center rounded-full border border-snow/25 text-lg leading-none transition-transform duration-300" aria-hidden="true">+</span>
                </summary>
                <p className="max-w-2xl pb-6 text-[15.5px] leading-relaxed text-snow/75">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Closing() {
  return (
    <>
      <section id="contact" aria-labelledby="cta-title" className="relative overflow-hidden bg-[rgb(8_13_25)] py-28 sm:py-36">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-lamp/10 blur-3xl" aria-hidden="true" />
        <div className="wrap relative">
          <Reveal>
            <p className="eyebrow flex items-center gap-2.5 text-snow-muted"><LiveDot /> Taking on new projects</p>
            <h2 id="cta-title" className="display mt-6 max-w-4xl text-[3rem] sm:text-[4.4rem] lg:text-[5.4rem]">
              Ready for a real number?
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-snow/80">
              Tell me about your business and I will send a written quote. You talk to the person who designs and builds your site, from the first call on.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href={url(site.intake)} className="btn-snow">Start your project <Arrow /></a>
              <a href={url(site.consult)} className="btn-ghost">Book a free consultation</a>
            </div>
            <div className="mt-14 flex flex-col gap-3 border-t border-snow/10 pt-8 text-[15px] sm:flex-row sm:gap-10">
              <a href={`mailto:${site.email.toLowerCase()}`} className="text-snow/85 hover:text-snow">{site.email}</a>
              <a href={site.phoneHref} className="num text-snow/85 hover:text-snow">{site.phone}</a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="bg-night py-14 text-[14px] text-snow-muted">
        <div className="wrap grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <a href={url('/#top')} className="flex items-center gap-2.5 font-semibold text-snow">
              <img src={logo} alt="" className="h-7 w-auto" /> Developer of Code
            </a>
            <p className="mt-4 max-w-sm leading-relaxed">Veteran-owned web studio in North Carolina since 2019.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-3 md:col-span-4">
            {[['Work', '/#work'], ['Services', '/#services'], ['Process', '/#process'], ['About', '/#about'], ['Shop', '/#shop'], ['Client support', site.support]].map(([l, h]) => (
              <a key={l} href={url(h)} className="hover:text-snow">{l}</a>
            ))}
          </nav>
          <div className="md:col-span-3">
            <a href={url('/privacy.html')} className="hover:text-snow">Privacy Policy</a>
          </div>
          <p className="border-t border-snow/10 pt-8 text-[12.5px] leading-relaxed text-snow-muted/80 md:col-span-12">
            Prices are in US dollars. Estimates on this page are a guide, not a quote. Your written quote and service agreement set the final price and terms.
            {' '}© {new Date().getFullYear()} Developer of Code, LLC.
          </p>
        </div>
      </footer>
    </>
  )
}
