import { testimonials } from '../content.js'
import ExtLink from './ExtLink.jsx'

function Quote({ item, className, size }) {
  const last = item.quote.length - 1
  return (
    <figure className={className}>
      <blockquote className={`${size} space-y-5`}>
        {item.quote.map((para, index) => (
          <p key={index} className={index === 0 ? 'hang' : undefined}>
            {index === 0 && '“'}
            {para}
            {index === last && '”'}
          </p>
        ))}
      </blockquote>
      <figcaption className="mt-8 flex items-center gap-4">
        <img src={item.photo} alt="" width="56" height="56" loading="lazy" className="h-14 w-14 rounded-full object-cover" />
        <div>
          <p className="t-subhead">{item.name}</p>
          <ExtLink href={item.url} className="u-link t-small text-muted">
            {item.org}
          </ExtLink>
        </div>
      </figcaption>
    </figure>
  )
}

export default function Voices() {
  const [first, second] = testimonials
  return (
    <section className="theme-dusk section" aria-labelledby="voices-title">
      <div className="wrap">
        <h2 id="voices-title" className="t-h2">
          In their words
        </h2>
        <div className="mt-14 grid grid-cols-12 gap-x-6 gap-y-16 lg:mt-20">
          <Quote item={first} size="t-quote" className="col-span-12 lg:col-span-7" />
          <Quote item={second} size="t-quote-lg" className="col-span-12 lg:col-span-4 lg:col-start-9 lg:mt-32" />
        </div>
      </div>
    </section>
  )
}
