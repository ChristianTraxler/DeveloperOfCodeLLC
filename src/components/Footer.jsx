import { contact, links } from '../content.js'
import ExtLink from './ExtLink.jsx'
import { Brand, navFor } from './Header.jsx'
import StatusBadge from './StatusBadge.jsx'

function Column({ title, items, className }) {
  return (
    <div className={className}>
      <p className="t-label text-muted">{title}</p>
      <ul className="t-small mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item.label}>
            <ExtLink href={item.href} className="u-link">
              {item.label}
            </ExtLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Footer({ current = 'home' }) {
  const year = new Date().getFullYear()
  const items = navFor(current)
  return (
    <footer className="theme-night">
      <div className="wrap pb-24 pt-20 lg:pt-24">
        <div className="grid grid-cols-12 gap-x-6 gap-y-12">
          <div className="col-span-12 lg:col-span-5">
            <Brand onHome={current === 'home'} />
            <p className="t-small mt-5 max-w-[22rem] text-muted">
              Veteran-owned web development company based in North Carolina.
            </p>
          </div>
          <Column title="Studio" items={items} className="col-span-6 sm:col-span-4 lg:col-span-2" />
          <Column
            title="Get started"
            className="col-span-6 sm:col-span-4 lg:col-span-3"
            items={[
              { label: 'Start your project', href: links.intake },
              { label: 'Book a free consultation', href: links.booking },
              { label: 'Client support', href: links.support },
            ]}
          />
          <Column
            title="Elsewhere"
            className="col-span-12 sm:col-span-4 lg:col-span-2"
            items={[
              { label: 'Facebook', href: links.facebook },
              { label: 'Instagram', href: links.instagram },
              { label: 'X (Twitter)', href: links.x },
            ]}
          />
        </div>
        <div className="rule-t t-label mt-16 flex flex-col gap-3 pt-6 text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p>© {year} Developer of Code, LLC. All rights reserved.</p>
            <StatusBadge />
          </div>
          <p className="flex flex-wrap gap-x-6 gap-y-1">
            <a className="u-link" href={links.email}>
              {contact.email}
            </a>
            <a className="u-link" href={links.phone}>
              {contact.phone}
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
