import { useInView, useReducedMotion } from '../../lib/hooks'
import { splitPlaceholders } from '../../lib/format'
import { ctaProps } from '../../lib/track'

// Renders copy from the config. While running `npm run dev`, any [PLACEHOLDER]
// gets a dashed outline so it is easy to spot. On the built site it prints as plain text.
export function Text({ children }) {
  if (typeof children !== 'string') return children
  if (!import.meta.env.DEV) return children
  return splitPlaceholders(children).map((part, i) =>
    /^\[[A-Z]/.test(part) ? (
      <mark key={i} className="placeholder-mark">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

export function Eyebrow({ children, tone = 'dark' }) {
  return (
    <p
      className={`flex items-center gap-3 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] [font-stretch:115%] ${
        tone === 'dark' ? 'text-ember-soft' : 'text-ember-deep'
      }`}
    >
      <span aria-hidden="true" className="h-px w-8 bg-current opacity-70" />
      {children}
    </p>
  )
}

export function SectionHead({ eyebrow, title, body, tone = 'light', align = 'left', id }) {
  const center = align === 'center'
  return (
    <Reveal className={`max-w-2xl ${center ? 'mx-auto text-center [&_p:first-child]:justify-center' : ''}`}>
      {eyebrow && <Eyebrow tone={tone === 'dark' ? 'dark' : 'light'}>{eyebrow}</Eyebrow>}
      <h2
        id={id}
        className={`mt-5 text-balance font-display text-[2.15rem] font-light leading-[1.05] tracking-[-0.02em] sm:text-5xl ${
          tone === 'dark' ? 'text-paper' : 'text-ink'
        }`}
      >
        <Text>{title}</Text>
      </h2>
      {body && (
        <p className={`mt-5 text-pretty text-lg leading-relaxed ${tone === 'dark' ? 'text-fog' : 'text-mute'}`}>
          <Text>{body}</Text>
        </p>
      )}
    </Reveal>
  )
}

const variants = {
  primary:
    'bg-ember text-night hover:bg-ember-soft shadow-[0_10px_30px_-12px_rgba(240,122,69,.8)] focus-visible:outline-ember',
  light: 'bg-paper text-ink hover:bg-white focus-visible:outline-paper',
  ghostDark: 'text-paper ring-1 ring-inset ring-white/25 hover:ring-white/60 hover:bg-white/5 focus-visible:outline-paper',
  ghostLight: 'text-ink ring-1 ring-inset ring-ink/20 hover:ring-ink/50 hover:bg-ink/[0.03] focus-visible:outline-ink',
  navy: 'bg-navy text-paper hover:bg-navy-500 focus-visible:outline-navy',
}

// Every CTA on the page goes through this, so every click is tracked.
export function Button({ href, cta, location, variant = 'primary', className = '', children, arrow = true, ...rest }) {
  const external = /^https?:/.test(href)
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener' } : {})}
      {...ctaProps(cta, location)}
      className={`group inline-flex min-h-[3rem] items-center justify-center gap-2.5 rounded-full px-6 py-3 text-center text-[0.95rem] font-semibold leading-tight transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${variants[variant]} ${className}`}
      {...rest}
    >
      <span>{children}</span>
      {arrow && (
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1">
          <path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </a>
  )
}

// Fades content up the first time it scrolls into view. Off for reduced motion.
export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const reduced = useReducedMotion()
  const [ref, inView] = useInView()
  const show = reduced || inView
  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: show && !reduced ? `${delay}ms` : undefined }}
      className={`transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function Section({ id, tone = 'light', className = '', children, labelledBy }) {
  const tones = {
    light: 'bg-paper text-ink',
    bone: 'bg-bone text-ink',
    dark: 'bg-night text-paper',
    navy: 'bg-navy text-paper',
  }
  return (
    <section id={id} aria-labelledby={labelledBy} className={`relative overflow-hidden ${tones[tone]} ${className}`}>
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">{children}</div>
    </section>
  )
}
