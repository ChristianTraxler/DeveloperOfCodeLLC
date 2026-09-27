import { images } from '../content.js'

export default function Band() {
  return (
    <section className="band" aria-labelledby="band-title">
      <img
        src={images.lake}
        alt="Morning mist over a lake in the North Carolina foothills"
        width="2000"
        height="1131"
        loading="lazy"
        decoding="async"
      />
      <div className="wrap band-inner">
        <h2 id="band-title" className="t-h2 band-title">
          Made in North Carolina.
        </h2>
        <p className="t-lede mt-3 max-w-[26rem] text-fg">Building websites for local businesses since 2019.</p>
      </div>
    </section>
  )
}
