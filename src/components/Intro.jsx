import { principles } from '../content.js'

export default function Intro() {
  return (
    <section className="theme-light section" aria-labelledby="intro-title">
      <div className="wrap grid grid-cols-12 gap-x-6">
        <h2 id="intro-title" className="sr-only">
          What you can count on
        </h2>
        <p className="t-statement col-span-12 lg:col-span-9 lg:col-start-4">
          Every small business deserves a powerful online presence. I build custom websites at prices that make sense,
          and I stick around after launch as your partner in growth.
        </p>
        <ul className="col-span-12 mt-14 grid gap-9 md:grid-cols-3 md:gap-8 lg:col-span-9 lg:col-start-4 lg:mt-20">
          {principles.map((item) => (
            <li key={item.title} className="rule-t pt-5">
              <h3 className="t-subhead">{item.title}</h3>
              <p className="t-small mt-2.5 text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
