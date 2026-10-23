import * as data from '../data/videoServices'
import { isPlaceholder } from '../lib/format'
import { Button, Eyebrow, Reveal, Section, SectionHead, Text } from '../components/video/ui'
import { Icon, VeteranBadge } from '../components/video/Icons'
import { MockReel, PhoneFrame, SampleVideo } from '../components/video/Phone'
import VideoCard from '../components/video/VideoCard'
import StepCard from '../components/video/StepCard'
import PricingCard from '../components/video/PricingCard'
import AddOnRow from '../components/video/AddOnRow'
import FAQItem from '../components/video/FAQItem'
import { ResultCard, TestimonialCard } from '../components/video/Proof'
import Seo from '../components/video/Seo'
import { ctaProps } from '../lib/track'

const { links, sections: on } = data

export default function VideoServicePage() {
  return (
    <>
      <Seo data={data} />
      <Hero />
      {on.problem && <Problem />}
      {on.showcase && <Showcase />}
      {on.howItWorks && <HowItWorks />}
      {on.packages && <Packages />}
      {on.addOns && <AddOns />}
      {on.why && <Why />}
      {on.bundle && <Bundle />}
      {on.proof && <ProofSection />}
      {on.faq && <Faq />}
      {on.finalCta && <FinalCta />}
    </>
  )
}

/* 1. Hero ------------------------------------------------------------------ */
function Hero() {
  const { hero, samples } = data
  const featured = samples.find((s) => s.id === hero.featuredSampleId && s.src)
  const [left, right] = hero.sidePhoneIds.map((id) => samples.find((s) => s.id === id && s.src))
  return (
    <section aria-labelledby="video-hero-title" className="relative overflow-hidden bg-night text-paper">
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute -bottom-40 left-1/2 h-[38rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(240,122,69,.30),transparent)]" />
        <div className="absolute -top-40 right-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(43,69,166,.45),transparent)]" />
        <div className="grain absolute inset-0 opacity-[0.18] mix-blend-overlay" />
      </div>

      <div className="relative mx-auto grid max-w-page gap-14 px-5 pb-20 pt-32 sm:px-8 sm:pt-40 lg:grid-cols-[1.08fr_1fr] lg:items-center lg:gap-10 lg:pb-28">
        <div>
          <div className="animate-rise motion-reduce:animate-none">
            <Eyebrow>{hero.eyebrow}</Eyebrow>
          </div>
          <h1
            id="video-hero-title"
            className="mt-6 animate-rise text-balance font-display text-[2.7rem] font-light leading-[0.98] tracking-[-0.03em] [animation-delay:80ms] motion-reduce:animate-none sm:text-6xl xl:text-[4.6rem]"
          >
            {hero.titleLead} <em className="font-normal italic text-ember">{hero.titleAccent}</em>
            <span className="mt-3 block text-[0.52em] leading-[1.15] tracking-[-0.01em] text-fog">{hero.titleTail}</span>
          </h1>
          <p className="mt-7 max-w-xl animate-rise text-pretty text-lg leading-relaxed text-fog [animation-delay:160ms] motion-reduce:animate-none sm:text-xl">
            {hero.body}
          </p>
          <div className="mt-9 flex animate-rise flex-col gap-3 [animation-delay:240ms] motion-reduce:animate-none sm:flex-row sm:flex-wrap">
            <Button href={links.booking} cta="book_call" location="hero">
              {hero.primaryCta}
            </Button>
            <Button href="#packages" cta="see_packages" location="hero" variant="ghostDark" arrow={false}>
              {hero.secondaryCta}
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fog">
            {hero.reassurance.map((r) => (
              <li key={r} className="flex items-center gap-2">
                <Icon name="check" className="h-4 w-4 text-signal" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Three phones. The middle one plays the featured real sample. */}
        <div className="relative mx-auto flex w-full max-w-[34rem] items-center justify-center" aria-label="Example short videos" role="group">
          <div className="-mr-8 w-[30%] translate-y-8 rotate-[-6deg] opacity-90 sm:-mr-10">
            <div className="animate-drift [animation-delay:-2s] motion-reduce:animate-none">
              <PhoneFrame>
                {left ? <SampleVideo sample={left} mode="manual" location="hero" mini /> : <MockReel caption="Your business, every week" tag="Your video here" tone="ember" compact mini />}
              </PhoneFrame>
            </div>
          </div>
          <div className="relative z-10 w-[42%] animate-drift motion-reduce:animate-none">
            <PhoneFrame size="lg">
              {featured ? (
                <SampleVideo sample={featured} mode="auto" location="hero" />
              ) : (
                <MockReel caption="Your business, every week" tag="Your video here" tone="navy" />
              )}
            </PhoneFrame>
            {featured && (
              <p className="absolute -bottom-10 left-1/2 w-max -translate-x-1/2 text-xs text-fog">
                Real sample: {featured.title}
              </p>
            )}
          </div>
          <div className="-ml-8 w-[30%] -translate-y-6 rotate-[6deg] opacity-90 sm:-ml-10">
            <div className="animate-drift [animation-delay:-4.5s] motion-reduce:animate-none">
              <PhoneFrame>
                {right ? <SampleVideo sample={right} mode="manual" location="hero" mini /> : <MockReel caption="Your business, every week" tag="Your video here" tone="cobalt" compact mini />}
              </PhoneFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* 2. The problem ----------------------------------------------------------- */
function Problem() {
  const { problem } = data
  const icons = ['clock', 'shuffle', 'frame']
  return (
    <Section id="problem" tone="light" labelledBy="problem-title">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-20">
        <div>
          <SectionHead id="problem-title" eyebrow={problem.eyebrow} title={problem.title} />
          <Reveal delay={120}>
            <p className="mt-6 max-w-md border-l-2 border-ember pl-5 font-display text-xl font-light italic leading-relaxed text-ink/80">
              <Text>{problem.empathy}</Text>
            </p>
          </Reveal>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {problem.points.map((p, i) => (
            <Reveal
              as="li"
              key={p.title}
              delay={i * 110}
              className="group flex flex-col rounded-[1.5rem] bg-white p-7 shadow-card ring-1 ring-ink/[0.05] transition duration-500 hover:-translate-y-1"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-ember/10 text-ember-deep transition-colors group-hover:bg-ember group-hover:text-night">
                <Icon name={icons[i]} className="h-5 w-5" />
              </span>
              <h3 className="mt-6 font-display text-2xl font-light leading-tight text-ink">
                <Text>{p.title}</Text>
              </h3>
              <p className="mt-2 leading-relaxed text-mute">
                <Text>{p.body}</Text>
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  )
}

/* 3. What the videos look like ----------------------------------------------- */
function Showcase() {
  const { showcase, samples } = data
  return (
    <Section id="samples" tone="dark" labelledBy="samples-title">
      <div aria-hidden="true" className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,rgba(43,69,166,.35),transparent)]" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHead id="samples-title" eyebrow={showcase.eyebrow} title={showcase.title} body={showcase.body} tone="dark" />
        <p className="text-sm text-fog sm:hidden">Swipe to see all {samples.filter((s) => s.src).length}</p>
      </div>
      {/* Swipeable row on phones, grid from tablet up. */}
      <ul className="no-scrollbar relative -mx-5 mt-14 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-14 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {samples.filter((s) => s.src).map((s, i) => (
          <Reveal as="li" key={s.id} delay={(i % 3) * 100} className="w-[72vw] max-w-[17.5rem] shrink-0 snap-start sm:w-auto sm:max-w-none">
            <VideoCard sample={s} />
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}

/* 4. How it works ---------------------------------------------------------------- */
function HowItWorks() {
  const { steps } = data
  return (
    <Section id="how-it-works" tone="light" labelledBy="how-title">
      <SectionHead id="how-title" eyebrow={steps.eyebrow} title={steps.title} />
      <ol className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {steps.items.map((s, i) => (
          <StepCard key={s.title} step={s} index={i} delay={i * 110} />
        ))}
      </ol>
      {/* AI note: shows only if `steps.aiNote` is uncommented in src/data/videoServices.js */}
      {steps.aiNote && (
        <Reveal className="mt-16 flex max-w-3xl gap-4 rounded-[1.25rem] bg-bone p-6 text-[0.95rem] leading-relaxed text-ink/80">
          <Icon name="edit" className="mt-0.5 h-5 w-5 shrink-0 text-ember-deep" />
          <p>
            <Text>{steps.aiNote}</Text>
          </p>
        </Reveal>
      )}
    </Section>
  )
}

/* 5. Packages ------------------------------------------------------------------------ */
function Packages() {
  const { packages } = data
  return (
    <Section id="packages" tone="dark" labelledBy="packages-title">
      <div aria-hidden="true" className="absolute -left-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(240,122,69,.18),transparent)]" />
      <div className="relative">
        <SectionHead id="packages-title" eyebrow={packages.eyebrow} title={packages.title} body={packages.body} tone="dark" align="center" />
        <div className="mt-20 grid gap-8 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 xl:items-stretch xl:gap-5">
          {packages.tiers.map((t, i) => (
            <PricingCard key={t.id} tier={t} delay={i * 90} />
          ))}
        </div>
        <Reveal className="mx-auto mt-14 max-w-2xl space-y-3 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-medium text-paper ring-1 ring-white/10">
            <Icon name="handshake" className="h-4 w-4 text-ember-soft" />
            <Text>{packages.bundleNote}</Text>
          </p>
          <p className="text-sm leading-relaxed text-fog">
            <Text>{packages.honesty}</Text>
          </p>
        </Reveal>
      </div>
    </Section>
  )
}

/* 6. A la carte add-ons ---------------------------------------------------------- */
function AddOns() {
  const { addOns } = data
  return (
    <Section id="add-ons" tone="bone" labelledBy="addons-title">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead id="addons-title" eyebrow={addOns.eyebrow} title={addOns.title} body={addOns.body} />
          <Reveal delay={150} className="mt-8">
            <Button href={links.booking} cta="book_call" location="add_ons" variant="ghostLight">
              Ask about a custom mix
            </Button>
          </Reveal>
        </div>
        <Reveal>
          <ul className="border-t border-ink/10">
            {addOns.items.map((item) => (
              <AddOnRow key={item.name} item={item} />
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  )
}

/* 7. Why work with me ---------------------------------------------------------------- */
function Why() {
  const { why } = data
  const icons = ['star', 'handshake', 'bolt', 'pin']
  return (
    <Section id="why" tone="navy" labelledBy="why-title">
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-20">
        <Reveal className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-night ring-1 ring-white/10">
            {why.headshot ? (
              <img src={why.headshot} alt={why.headshotAlt} loading="lazy" width="800" height="1000" className="h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_80%_at_50%_100%,rgba(240,122,69,.35),transparent),linear-gradient(160deg,#16294f,#0a1328)]">
                <div className="text-center">
                  <span className="font-display text-8xl font-extralight text-paper/80">CT</span>
                  {import.meta.env.DEV && (
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-fog">
                      <Text>[HEADSHOT]</Text>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <VeteranBadge className="absolute -bottom-4 left-6 shadow-lg" />
        </Reveal>

        <div>
          <SectionHead id="why-title" eyebrow={why.eyebrow} title={why.title} tone="dark" />
          <Reveal delay={100} className="mt-7 space-y-3 text-lg leading-relaxed text-fog">
            {why.blurb.filter((line) => import.meta.env.DEV || !isPlaceholder(line)).map((line, i) => (
              <p key={i}>
                <Text>{line}</Text>
              </p>
            ))}
            <p className="pt-2 text-sm text-paper">
              <span className="font-semibold">{why.founderName}</span>, {why.founderRole}
            </p>
          </Reveal>
          <ul className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {why.points.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 90} className="border-t border-white/15 pt-5">
                <Icon name={icons[i]} className="h-5 w-5 text-ember-soft" />
                <h3 className="mt-3 font-display text-xl font-light text-paper">{p.title}</h3>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-fog">{p.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}

/* 8. Bundle with a website ------------------------------------------------------------- */
function Bundle() {
  const { bundle } = data
  return (
    <section aria-labelledby="bundle-title" className="bg-ember text-night">
      <div className="mx-auto flex max-w-page flex-col gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-12">
        <Reveal className="max-w-2xl">
          <h2 id="bundle-title" className="text-balance font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
            <Text>{bundle.title}</Text>
          </h2>
          <p className="mt-3 text-pretty text-[1.02rem] leading-relaxed text-night/80">
            <Text>{bundle.body}</Text>
          </p>
        </Reveal>
        <Reveal delay={120} className="shrink-0">
          <Button href={links.websiteServices} cta="website_services" location="bundle" variant="navy">
            {bundle.cta}
          </Button>
        </Reveal>
      </div>
    </section>
  )
}

/* 9. Proof (hidden until something is verified) --------------------------------- */
function ProofSection() {
  const { proof } = data
  const preview = import.meta.env.DEV && proof.previewInDev
  const testimonials = proof.testimonials.filter((t) => t.verified || preview)
  const results = proof.results.filter((r) => r.verified || preview)
  const anyVerified = [...proof.testimonials, ...proof.results].some((e) => e.verified)
  if (!anyVerified && !preview) return null
  return (
    <Section id="results" tone="light" labelledBy="proof-title">
      {preview && !anyVerified && (
        <p className="mb-8 inline-block rounded-full bg-ember/15 px-4 py-1.5 text-xs font-semibold text-ember-deep">
          Dev preview only. Hidden on the live site until an entry has verified: true.
        </p>
      )}
      <SectionHead id="proof-title" eyebrow={proof.eyebrow} title={proof.title} />
      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {results.map((r, i) => (
          <ResultCard key={`r${i}`} r={r} delay={i * 90} />
        ))}
        {testimonials.map((t, i) => (
          <TestimonialCard key={`t${i}`} t={t} delay={(i + results.length) * 90} />
        ))}
      </div>
    </Section>
  )
}

/* 10. FAQ ------------------------------------------------------------------------------ */
function Faq() {
  const { faq } = data
  return (
    <Section id="faq" tone="light" labelledBy="faq-title">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead id="faq-title" eyebrow={faq.eyebrow} title={faq.title} />
          <Reveal delay={120} className="mt-6 text-mute">
            <p>
              Something else on your mind?{' '}
              <a
                href={`mailto:${links.email}`}
                {...ctaProps('email', 'faq')}
                className="font-semibold text-ink underline decoration-ember decoration-2 underline-offset-4 hover:text-ember-deep"
              >
                Email me
              </a>
              .
            </p>
          </Reveal>
        </div>
        <Reveal className="border-t border-ink/10">
          {faq.items.map((item) => (
            <FAQItem key={item.q} item={item} />
          ))}
        </Reveal>
      </div>
    </Section>
  )
}

/* 11. Final call to action ------------------------------------------------------------- */
function FinalCta() {
  const { finalCta } = data
  return (
    <section aria-labelledby="final-title" className="relative overflow-hidden bg-night text-paper">
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute -bottom-52 left-1/2 h-[36rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(240,122,69,.32),transparent)]" />
        <div className="grain absolute inset-0 opacity-[0.15] mix-blend-overlay" />
      </div>
      <div className="relative mx-auto max-w-4xl px-5 py-28 text-center sm:px-8 sm:py-36">
        <Reveal>
          <VeteranBadge />
          <h2 id="final-title" className="mt-8 text-balance font-display text-[2.6rem] font-light leading-[1.02] tracking-[-0.03em] sm:text-6xl">
            <Text>{finalCta.title}</Text>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-fog">
            <Text>{finalCta.body}</Text>
          </p>
          <div className="mt-10 flex justify-center">
            <Button href={links.booking} cta="book_call" location="final_cta" className="w-full sm:w-auto">
              {finalCta.cta}
            </Button>
          </div>
          <p className="mt-8 text-sm text-fog">
            {finalCta.contactLine}{' '}
            <a href={links.phoneHref} {...ctaProps('phone', 'final_cta')} className="font-semibold text-paper underline decoration-ember underline-offset-4">
              {links.phone}
            </a>{' '}
            or email{' '}
            <a href={`mailto:${links.email}`} {...ctaProps('email', 'final_cta')} className="break-all font-semibold text-paper underline decoration-ember underline-offset-4">
              {links.email}
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
