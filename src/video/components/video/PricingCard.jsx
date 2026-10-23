import { money } from '../../lib/format'
import { Icon } from './Icons'
import { Button, Reveal, Text } from './ui'

export default function PricingCard({ tier, delay }) {
  const featured = tier.featured
  const pilot = tier.id === 'pilot'
  return (
    <Reveal
      as="article"
      delay={delay}
      aria-labelledby={`tier-${tier.id}`}
      className={`relative flex flex-col rounded-[1.75rem] p-7 transition duration-500 hover:-translate-y-1 ${
        featured
          ? 'bg-navy text-paper shadow-[0_40px_80px_-40px_rgba(240,122,69,.55)] ring-1 ring-ember/60 xl:-my-4 xl:py-11'
          : 'bg-paper text-ink shadow-card ring-1 ring-ink/[0.06]'
      }`}
    >
      {tier.badge && (
        <span
          className={`absolute -top-3 left-7 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] [font-stretch:110%] ${
            featured ? 'bg-ember text-night' : 'bg-ink text-paper'
          }`}
        >
          {pilot && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember motion-reduce:animate-none" />}
          {tier.badge}
        </span>
      )}

      <h3 id={`tier-${tier.id}`} className="font-display text-[1.7rem] font-light leading-tight">
        {tier.name}
      </h3>
      <p className={`mt-2 min-h-[3rem] text-sm leading-relaxed ${featured ? 'text-fog' : 'text-mute'}`}>
        <Text>{tier.summary}</Text>
      </p>

      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="font-display text-[3.25rem] font-light leading-none tracking-[-0.03em] tabular-nums">{money(tier.price)}</span>
        <span className={`text-sm ${featured ? 'text-fog' : 'text-mute'}`}>{tier.period ? `/ ${tier.period}` : 'one time'}</span>
      </p>
      <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.14em] [font-stretch:110%] ${featured ? 'text-ember-soft' : 'text-ember-deep'}`}>
        {tier.videosLabel || `${tier.videos} videos a month`} · {tier.terms}
      </p>
      {tier.extra && <p className={`mt-1 text-xs ${featured ? 'text-fog' : 'text-mute'}`}>{tier.extra}</p>}
      {tier.spotsNote && <p className={`mt-1 text-xs ${featured ? 'text-fog' : 'text-mute'}`}>{tier.spotsNote}</p>}

      <ul className={`mt-6 space-y-3 border-t pt-6 text-[0.92rem] leading-snug ${featured ? 'border-white/15' : 'border-ink/10'}`}>
        {tier.features.map((f) => (
          <li key={f} className="flex gap-3">
            <Icon name="check" className={`mt-0.5 h-4 w-4 shrink-0 ${featured ? 'text-signal' : 'text-ember-deep'}`} />
            <span>
              <Text>{f}</Text>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Button
          href={tier.ctaHref}
          cta={`package_${tier.id}`}
          location="packages"
          variant={featured ? 'primary' : 'navy'}
          className="w-full"
        >
          {tier.cta}
        </Button>
      </div>
    </Reveal>
  )
}
