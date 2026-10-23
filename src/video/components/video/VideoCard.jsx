import { PhoneFrame, MockReel, SampleVideo } from './Phone'
import { Text } from './ui'

// One sample format. Plays the real video if `sample.src` is set,
// otherwise shows the designed "Sample reel coming soon" card.
export default function VideoCard({ sample }) {
  const real = Boolean(sample.src)
  return (
    <article className="group flex w-full flex-col">
      <PhoneFrame className="transition-transform duration-500 group-hover:-translate-y-1.5">
        {real ? (
          <SampleVideo sample={sample} mode="hover" />
        ) : (
          <MockReel caption={sample.mock} tag={sample.style} tone={sample.tone} comingSoon compact />
        )}
      </PhoneFrame>
      <div className="mt-5 px-1">
        <p className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ember-soft [font-stretch:112%]">
          {sample.style}
          {real && (
            <span className="rounded-full bg-signal/15 px-2 py-0.5 text-[0.6rem] tracking-[0.12em] text-signal">Real sample</span>
          )}
        </p>
        <h3 className="mt-2 font-display text-2xl font-light text-paper">
          <Text>{sample.title}</Text>
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-fog">
          <Text>{sample.blurb}</Text>
        </p>
        {real && sample.transcript && (
          <details className="mt-3 text-sm text-fog">
            <summary className="cursor-pointer select-none rounded font-semibold text-paper underline decoration-white/30 underline-offset-4 hover:decoration-ember focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
              {sample.silent ? 'Silent video. Read the on-screen text' : 'Read the transcript'}
            </summary>
            <ol className="mt-3 space-y-2 border-l border-white/15 pl-4">
              {sample.transcript.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </article>
  )
}
