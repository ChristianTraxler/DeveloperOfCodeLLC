import { contact, images, links, pricing } from '../content.js'
import ExtLink from './ExtLink.jsx'

export default function Contact() {
  return (
    <section id="contact" className="contact theme-dusk" aria-labelledby="contact-title">
      <img className="contact-img" src={images.door} alt="" width="2000" height="1131" loading="lazy" decoding="async" />
      <div className="contact-scrim" aria-hidden="true" />
      <div className="wrap py-24 lg:py-32">
        <div className="max-w-[36rem]">
          <h2 id="contact-title" className="t-h2">
            Come on in.
            <br />
            Let’s talk.
          </h2>
          <p className="t-lede mt-6 text-fg/85">
            Tell me about your business and what you need. The quickest way to a proposal is the project intake form.
            Rather talk it through first? Book a free consultation.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ExtLink href={links.intake} className="btn btn-solid">
              <span className="status-dot" aria-hidden="true" />
              Start your project
            </ExtLink>
            <ExtLink href={links.booking} className="btn btn-line">
              Book a free consultation
            </ExtLink>
          </div>
          <p className="t-small mt-4 text-fg/70">{pricing.note}</p>
          <dl className="mt-12 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div>
              <dt className="t-label text-muted">Email</dt>
              <dd className="t-small mt-1">
                <a className="u-link" href={links.email}>
                  {contact.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="t-label text-muted">Phone</dt>
              <dd className="t-small mt-1">
                <a className="u-link" href={links.phone}>
                  {contact.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="t-label text-muted">Based in</dt>
              <dd className="t-small mt-1">{contact.location}</dd>
            </div>
            <div>
              <dt className="t-label text-muted">Already a client?</dt>
              <dd className="t-small mt-1">
                <ExtLink className="u-link" href={links.support}>
                  Visit client support
                </ExtLink>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
