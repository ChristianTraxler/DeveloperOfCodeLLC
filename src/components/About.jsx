import { facts, images } from '../content.js'
import ExtLink from './ExtLink.jsx'

export default function About() {
  return (
    <section id="about" className="theme-light section" aria-labelledby="about-title">
      <div className="wrap grid grid-cols-12 gap-x-6 gap-y-14">
        <div className="col-span-12 lg:col-span-5">
          <h2 id="about-title" className="t-h2">
            Hi, I’m Christian.
          </h2>
          <dl className="rule-b mt-10 lg:mt-14">
            {facts.map((fact) => (
              <div key={fact.k} className="rule-t grid grid-cols-[7.5rem_1fr] gap-4 py-4">
                <dt className="t-label pt-0.5 text-muted">{fact.k}</dt>
                <dd className="t-small">
                  {fact.href ? (
                    <ExtLink href={fact.href} className="u-link">
                      {fact.v}
                    </ExtLink>
                  ) : (
                    fact.v
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="col-span-12 lg:col-span-6 lg:col-start-7 lg:pt-2">
          <p className="t-statement">I’m a veteran, a web developer, and the only person behind Developer of Code.</p>
          <div className="t-lede mt-8 space-y-5 text-fg/85">
            <p>
              It started with two things: a web design class, and my fiancée, a big advocate of clean living who wanted
              a blog to get her voice out there. I built it as a course project, and I’ve been building ever since.
            </p>
            <p>
              Today I make websites for local businesses, churches, and ministries. I keep things plain-spoken: clear
              plans, honest prices, and a site you’re proud to send people to.
            </p>
            <p>
              When I’m not building, I’m usually hiking, spending time with friends and family, or behind a camera. Life is too short not to
              enjoy it, so I spend it with the people I love and see as much of the world as I can.
            </p>
          </div>
          <span
            className="signature mt-10"
            role="img"
            aria-label="Signed, Christian Traxler"
            style={{ '--sig': `url(${images.signature})` }}
          />
        </div>
      </div>
    </section>
  )
}
