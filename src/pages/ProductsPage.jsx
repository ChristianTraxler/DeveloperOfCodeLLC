import { useState } from 'react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ScrollTop from '../components/ScrollTop.jsx'
import PageHero from '../components/PageHero.jsx'
import ExtLink from '../components/ExtLink.jsx'
import {
  CrmSpecimen,
  HabitSpecimen,
  JournalSpecimen,
  SoloSpecimen,
  WeddingSpecimen,
} from '../components/Specimens.jsx'
import { images, links, software, templates } from '../content.js'
import { notifyUrl } from '../site.js'

const SPECIMENS = { crm: CrmSpecimen, solo: SoloSpecimen, habit: HabitSpecimen, wedding: WeddingSpecimen, journal: JournalSpecimen }

const FILTERS = [
  { id: 'all', label: 'All products', count: software.length + templates.length },
  { id: 'software', label: 'Software', count: software.length },
  { id: 'templates', label: 'Notion templates', count: templates.length },
]

function Spec({ term, children }) {
  return (
    <div className="rule-t grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3.5">
      <dt className="t-label pt-0.5 text-muted">{term}</dt>
      <dd className="t-small">{children}</dd>
    </div>
  )
}

function SoftwareItem({ item, flip }) {
  const Specimen = SPECIMENS[item.specimen]
  return (
    <article className="grid grid-cols-12 gap-x-6 gap-y-9 lg:items-center" aria-labelledby={`p-${item.id}`}>
      <div className={`col-span-12 lg:col-span-7 lg:row-start-1 ${flip ? 'lg:col-start-6' : 'lg:col-start-1'}`}>
        <Specimen />
      </div>
      <div className={`col-span-12 lg:col-span-4 lg:row-start-1 ${flip ? 'lg:col-start-1' : 'lg:col-start-9'}`}>
        <p className="t-label text-accent">{item.status}</p>
        <h3 id={`p-${item.id}`} className="t-product mt-3">
          {item.name}
        </h3>
        <p className="t-small mt-5 text-fg/85">{item.body}</p>
        <dl className="rule-b mt-8">
          <Spec term="Built for">{item.audience}</Spec>
          <Spec term="Highlights">{item.features}</Spec>
          <Spec term="Pricing">{item.price}</Spec>
        </dl>
        <ExtLink href={notifyUrl(item.name)} className="btn btn-line mt-8">
          Notify me at launch<span className="sr-only">: {item.name}</span>
        </ExtLink>
      </div>
    </article>
  )
}

function TemplateItem({ item }) {
  const Specimen = SPECIMENS[item.specimen]
  return (
    <article className="flex flex-col" aria-labelledby={`p-${item.id}`}>
      <Specimen />
      <div className="mt-7 flex items-baseline justify-between gap-4">
        <h3 id={`p-${item.id}`} className="t-h3">
          {item.name}
        </h3>
        <p className="price">{item.price}</p>
      </div>
      <p className="t-small mt-3 text-fg/80">{item.long}</p>
      <ul className="includes mt-6" aria-label={`What’s inside ${item.name}`}>
        {item.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <ExtLink href={item.url} className="btn btn-solid w-full">
          Buy on Gumroad<span className="sr-only">: {item.name}</span>
        </ExtLink>
      </div>
    </article>
  )
}

function GroupHead({ id, title, note }) {
  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-4">
      <h2 id={id} className="t-h2 col-span-12 lg:col-span-6">
        {title}
      </h2>
      <p className="t-lede col-span-12 max-w-[30rem] text-muted lg:col-span-5 lg:col-start-8 lg:self-end">{note}</p>
    </div>
  )
}

export default function ProductsPage() {
  const [filter, setFilter] = useState('all')

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header current="products" />
      <main id="main" tabIndex={-1}>
        <PageHero
          title="Software and templates, made to ship."
          lede="A growing collection of tools and templates I’ve built to solve real problems, from a CRM that runs your client pipeline to Notion templates that bring order to your day. Every product is designed, built, and supported by me."
        />

        <section className="theme-light section" aria-label="Products">
          <div className="wrap">
            <div className="filter" role="group" aria-label="Show products">
              {FILTERS.map((item) => (
                <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
                  {item.label}
                  <span className="count">{item.count}</span>
                </button>
              ))}
            </div>

            {filter !== 'templates' && (
              <div className="mt-16 lg:mt-24" aria-labelledby="software-title">
                <GroupHead
                  id="software-title"
                  title="Software"
                  note="Relay is in development. Ask to be notified and you’ll hear when each one launches."
                />
                <div className="mt-14 space-y-24 lg:mt-20 lg:space-y-32">
                  {software.map((item, index) => (
                    <SoftwareItem key={item.id} item={item} flip={index % 2 === 1} />
                  ))}
                </div>
              </div>
            )}

            {filter !== 'software' && (
              <div className={filter === 'templates' ? 'mt-16 lg:mt-24' : 'mt-32 lg:mt-44'} aria-labelledby="templates-title">
                <GroupHead id="templates-title" title="Notion templates" note="Available now on Gumroad." />
                <div className="mt-14 grid gap-x-6 gap-y-20 md:grid-cols-2 lg:mt-20 lg:grid-cols-3">
                  {templates.map((item) => (
                    <TemplateItem key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="theme-dusk section" aria-labelledby="custom-title">
          <div className="wrap grid grid-cols-12 gap-x-6 gap-y-14 lg:items-center">
            <div className="col-span-12 lg:col-span-6">
              <h2 id="custom-title" className="t-h2">
                Need something custom? Let’s build it together.
              </h2>
              <p className="t-lede mt-6 max-w-[34rem] text-fg/85">
                Every product here started as a custom build for a real client. If you have an idea that doesn’t fit a
                template, I’d love to hear about it.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ExtLink href={links.intake} className="btn btn-solid">
                  <span className="status-dot" aria-hidden="true" />
                  Start a project
                </ExtLink>
                <ExtLink href={links.booking} className="btn btn-line">
                  Book a free consultation
                </ExtLink>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-5 lg:col-start-8">
              <div className="photo-frame">
                <img src={images.door} alt="" loading="lazy" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer current="products" />
      <ScrollTop />
    </>
  )
}
