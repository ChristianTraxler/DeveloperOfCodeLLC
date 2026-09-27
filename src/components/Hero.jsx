import { images, links } from '../content.js'
import ExtLink from './ExtLink.jsx'

export default function Hero() {
  return (
    <section id="top" className="hero theme-dusk" aria-labelledby="hero-title">
      <div className="hero-media" aria-hidden="true">
        <div className="hero-frame hero-frame--desk">
          <img src={images.heroDesk} alt="" width="2000" height="1040" fetchpriority="high" decoding="async" />
          <span className="lamp-off" style={{ '--l': '64%', '--t': '65%', '--w': '31%', '--h': '44%' }} />
        </div>
        <div className="hero-frame hero-frame--mob">
          <img src={images.heroMob} alt="" width="1000" height="1768" decoding="async" />
          <span className="lamp-off" style={{ '--l': '4%', '--t': '64%', '--w': '56%', '--h': '42%' }} />
        </div>
        <div className="hero-scrim" />
        <div className="grain" />
      </div>

      <div className="hero-inner">
        <div className="wrap">
          <h1 id="hero-title" className="t-hero hero-title" tabIndex={-1}>
            <span className="ln">
              <span>Built for</span>
            </span>{' '}
            <span className="ln">
              <span>Main Street.</span>
            </span>
          </h1>
          <div className="hero-row">
            <p className="hero-lede t-lede">
              Custom websites for North Carolina’s small businesses, churches, and trades, designed and built by one
              veteran from the first call to launch day, and long after.
            </p>
            <div className="hero-actions">
              <ExtLink href={links.intake} className="btn btn-solid">
                <span className="status-dot" aria-hidden="true" />
                Start your project
              </ExtLink>
              <ExtLink href={links.booking} className="btn btn-line">
                Book a free consultation
              </ExtLink>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-foot">
        <div className="wrap t-label flex flex-wrap items-center gap-x-8 gap-y-2 text-fg/75">
          <p className="status">
            <span className="status-dot" aria-hidden="true" />
            Taking on new projects
          </p>
          <p>Veteran-owned web studio in North Carolina since 2019</p>
        </div>
      </div>
    </section>
  )
}
