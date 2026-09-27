import { links, services } from '../content.js'
import ExtLink from './ExtLink.jsx'

export default function Services() {
  return (
    <section id="services" className="theme-light section" aria-labelledby="services-title">
      <div className="wrap">
        <div className="grid grid-cols-12 gap-x-6 gap-y-5">
          <h2 id="services-title" className="t-h2 col-span-12 lg:col-span-6">
            What I build
          </h2>
          <p className="t-lede col-span-12 text-muted lg:col-span-5 lg:col-start-8 lg:self-end">
            From a one-page site to a full online store. Every project is designed from scratch and built to load fast
            on the phone in your customer’s pocket.
          </p>
        </div>
        <ul className="rule-b mt-14 lg:mt-20">
          {services.map((service) => (
            <li key={service.name} className="rule-t grid grid-cols-12 gap-x-6 gap-y-3 py-8 lg:py-11">
              <h3 className="t-h3 col-span-12 lg:col-span-4">{service.name}</h3>
              <p className="t-lede col-span-12 md:col-span-8 lg:col-span-5">{service.body}</p>
              <p className="t-label col-span-12 text-muted md:col-span-4 lg:col-span-3 lg:pt-1.5">{service.includes}</p>
            </li>
          ))}
        </ul>
        <p className="t-small mt-9 max-w-[44rem] text-muted">
          Need photos, a logo, or help with the words? Logo design, copywriting, and video production are available
          too, and photography comes from my sister studio,{' '}
          <ExtLink href={links.photoscapes} className="u-link text-fg">
            Photoscapes Photography
          </ExtLink>
          .
        </p>
      </div>
    </section>
  )
}
