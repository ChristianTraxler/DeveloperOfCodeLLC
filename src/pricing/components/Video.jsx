import { video, money } from '../pricing.js'
import { site, url } from '../site.config.js'
import { Reveal, SectionHead, Check, Arrow } from './ui.jsx'

export default function Video() {
  return (
    <section id="video" aria-labelledby="video-title" className="bg-deep py-24 sm:py-32">
      <div className="wrap">
        <SectionHead
          id="video-title"
          eyebrow="Social video"
          title="Short videos, done for you."
          lede="Reels, TikToks and Shorts for your business. I shoot the footage, write the script and deliver videos you can post that day."
        />

        <div className="mt-14 grid gap-px overflow-hidden rounded-[22px] border border-snow/10 bg-snow/10 md:grid-cols-3">
          {video.packages.map((p, i) => (
            <Reveal key={p.id} delay={i * 90} className={`flex flex-col p-7 sm:p-9 ${p.recommended ? 'bg-dusk' : 'bg-deep'}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[20px] font-semibold tracking-tight">{p.name}</h3>
                {p.recommended && <span className="rounded-full bg-lamp px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-night">Recommended</span>}
              </div>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="display num text-[3.8rem] sm:text-[4.2rem]">{money(p.price)}</span>
                <span className="text-[15px] font-medium text-snow-muted">/ month</span>
              </p>
              <p className="mt-2 text-[15px] font-semibold">{p.videos} videos a month</p>
              <p className="text-[14px] text-snow-muted">About {money(p.each)} a video</p>
              {p.extra && <p className="mt-4 flex gap-2 text-[14.5px] text-snow/85"><Check className="mt-1 text-live" />{p.extra}</p>}
            </Reveal>
          ))}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-7">
            <h3 className="eyebrow text-snow-muted">Every video includes</h3>
            <ul className="mt-5 grid gap-3 text-[15px] text-snow/85 sm:grid-cols-2">
              {video.includes.map((t) => (
                <li key={t} className="flex gap-3"><Check className="mt-1 text-live" />{t}</li>
              ))}
            </ul>
            <p className="mt-6 text-[14px] text-snow-muted">{video.terms.join(' · ')}.</p>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-5">
            <div className="rounded-[18px] bg-snow p-6 text-ink sm:p-7">
              <p className="eyebrow text-lamp-ink">Bundle and save</p>
              <p className="display mt-3 text-[1.9rem] leading-tight">{video.bundle}</p>
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-ink/15 pt-5 text-[14px]">
                <p><span className="display num block text-[1.7rem] leading-none">{money(video.pilot.price)}</span><span className="text-ink-muted">Pilot, {video.pilot.videos} videos for new clients</span></p>
                <p><span className="display num block text-[1.7rem] leading-none">{money(video.single)}</span><span className="text-ink-muted">A single video, no package</span></p>
              </div>
              <a href={url(video.page)} className="btn-ink mt-6 w-full">See video packages <Arrow /></a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
