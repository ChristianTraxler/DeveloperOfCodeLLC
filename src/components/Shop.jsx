import { links, software, templates } from '../content.js'
import ExtLink from './ExtLink.jsx'
import { notifyUrl } from '../site.js'

export default function Shop() {
  return (
    <section id="shop" className="theme-light section" aria-labelledby="shop-title">
      <div className="wrap">
        <div className="grid grid-cols-12 gap-x-6 gap-y-5">
          <h2 id="shop-title" className="t-h2 col-span-12 lg:col-span-6">
            Software and templates
          </h2>
          <p className="t-lede col-span-12 text-muted lg:col-span-5 lg:col-start-8 lg:self-end">
            Tools and templates I’ve built to solve real problems, from a CRM that runs your client pipeline to Notion
            templates that bring order to your day.
          </p>
        </div>

        <div className="mt-14 grid gap-x-6 gap-y-12 md:grid-cols-2 lg:mt-20">
          {software.map((item) => (
            <article key={item.name} className="rule-t pt-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="t-h3">{item.name}</h3>
                <p className="t-label text-accent">{item.status}</p>
              </div>
              <p className="t-label mt-2 text-muted">Software</p>
              <p className="t-small mt-4 max-w-[36rem] text-fg/80">{item.body}</p>
              <ExtLink href={notifyUrl(item.name)} className="u-link t-small mt-4 inline-block font-semibold">
                Get notified at launch<span className="sr-only">: {item.name}</span>
              </ExtLink>
            </article>
          ))}
        </div>

        <div className="mt-14 grid gap-x-6 gap-y-10 md:grid-cols-3">
          {templates.map((item) => (
            <article key={item.name} className="rule-t pt-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="t-subhead text-[1.125rem]">{item.name}</h3>
                <p className="price">{item.price}</p>
              </div>
              <p className="t-label mt-1.5 text-muted">Notion template</p>
              <p className="t-small mt-4 text-fg/80">{item.body}</p>
              <ExtLink href={item.url} className="u-link t-small mt-4 inline-block font-semibold">
                Buy on Gumroad<span className="sr-only">: {item.name}</span>
              </ExtLink>
            </article>
          ))}
        </div>

        <ExtLink href={links.shop} className="btn btn-line mt-14">
          See the full shop
        </ExtLink>
      </div>
    </section>
  )
}
