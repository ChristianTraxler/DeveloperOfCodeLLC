import { images } from '../content.js'

// Inner-page opener: the title sits in the same blue hour sky as the home page, above the Main Street rooflines.
export default function PageHero({ title, lede, aside }) {
  return (
    <section className="page-hero theme-dusk" aria-labelledby="page-title">
      <div className="wrap grid grid-cols-12 gap-x-6 gap-y-8">
        <h1 id="page-title" tabIndex={-1} className="t-page col-span-12 lg:col-span-11">
          {title}
        </h1>
        {lede && <p className="t-lede col-span-12 max-w-[36rem] text-fg/85 lg:col-span-6">{lede}</p>}
        {aside && <div className="col-span-12 lg:col-span-4 lg:col-start-9 lg:self-end">{aside}</div>}
      </div>
      <div className="roofline" aria-hidden="true" style={{ backgroundImage: `url(${images.heroDesk})` }} />
    </section>
  )
}
