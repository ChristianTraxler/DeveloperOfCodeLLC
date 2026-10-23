import { Icon } from './Icons'
import { Reveal, Text } from './ui'

export default function StepCard({ step, index, delay }) {
  const owner = index === 0 || index === 3 ? 'You + me' : 'Me'
  return (
    <Reveal as="li" delay={delay} className="relative flex flex-col border-t border-ink/15 pt-6">
      <div className="flex items-center justify-between">
        <span className="font-display text-6xl font-extralight leading-none text-ink/25 tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-navy text-paper">
          <Icon name={step.icon} className="h-5 w-5" />
        </span>
      </div>
      <h3 className="mt-6 font-display text-[1.65rem] font-light leading-tight text-ink">
        <Text>{step.title}</Text>
      </h3>
      <p className="mt-2 leading-relaxed text-mute">
        <Text>{step.body}</Text>
      </p>
      <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ember-deep [font-stretch:112%]">{owner}</p>
    </Reveal>
  )
}
