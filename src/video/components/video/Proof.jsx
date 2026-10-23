import { Reveal, Text } from './ui'

export function TestimonialCard({ t, delay }) {
  return (
    <Reveal as="figure" delay={delay} className="flex flex-col rounded-[1.5rem] bg-white p-8 shadow-card ring-1 ring-ink/[0.05]">
      <span aria-hidden="true" className="font-display text-6xl leading-none text-ember">“</span>
      <blockquote className="mt-2 font-display text-2xl font-light leading-snug text-ink">
        <Text>{t.quote}</Text>
      </blockquote>
      <figcaption className="mt-6 text-sm text-mute">
        <span className="font-semibold text-ink">
          <Text>{t.name}</Text>
        </span>
        , <Text>{t.business}</Text>
      </figcaption>
    </Reveal>
  )
}

export function ResultCard({ r, delay }) {
  return (
    <Reveal delay={delay} className="rounded-[1.5rem] bg-navy p-8 text-paper">
      <p className="font-display text-5xl font-light leading-none">
        <Text>{r.metric}</Text>
      </p>
      <p className="mt-4 text-fog">
        <Text>{r.label}</Text>
      </p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-ember-soft">
        <Text>{r.business}</Text>
      </p>
    </Reveal>
  )
}
