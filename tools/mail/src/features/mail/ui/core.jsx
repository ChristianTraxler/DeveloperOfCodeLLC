// Buttons, pills and small pieces in the Admin Hub's look.
import { forwardRef } from 'react'
import { hueOf, initialOf } from '../lib/format.js'
import { domainOf } from '../lib/address.js'

export const cx = (...parts) => parts.filter(Boolean).join(' ')

const BASE =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background,border-color,color,transform,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45'
const VARIANTS = {
  solid: 'bg-bone text-ink hover:bg-white',
  ember: 'bg-ember text-[#1c0a02] hover:bg-[#ff6f3a] font-semibold',
  ghost: 'border border-line2 bg-white/[0.02] text-bone hover:border-white/30 hover:bg-white/[0.06]',
  quiet: 'text-mute hover:text-bone hover:bg-white/[0.06]',
  danger: 'bg-danger text-[#2a0602] hover:bg-[#ff8176] font-semibold',
  dangerGhost: 'border border-danger/35 text-danger hover:bg-danger/10',
  paper: 'border border-black/10 bg-white text-ink2 hover:border-black/25 hover:bg-[#f6f4ef]',
  paperQuiet: 'text-slate hover:bg-black/[0.05] hover:text-ink2',
  inkOnPaper: 'bg-ink2 text-white hover:bg-[#1b2740] font-semibold',
}
const SIZES = {
  xs: 'h-8 px-3 text-[13px]',
  sm: 'h-10 px-4 text-[14px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-[15px]',
}

export const Button = forwardRef(function Button({ variant = 'ghost', size = 'sm', className = '', type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx(BASE, VARIANTS[variant], SIZES[size], className)} {...rest} />
})

// Square-ish icon button with a required label for screen readers and a tooltip
export const IconButton = forwardRef(function IconButton({ label, variant = 'quiet', size = 40, className = '', children, active, shortcut, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cx(
        'grid shrink-0 place-items-center rounded-full transition-colors duration-150 active:scale-[0.95] disabled:pointer-events-none disabled:opacity-40',
        variant === 'quiet' && (active ? 'bg-white/[0.1] text-bone' : 'text-mute hover:bg-white/[0.07] hover:text-bone'),
        variant === 'paper' && (active ? 'bg-black/[0.07] text-ink2' : 'text-slate hover:bg-black/[0.06] hover:text-ink2'),
        variant === 'ghost' && 'border border-line2 text-bone hover:border-white/30 hover:bg-white/[0.06]',
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      {children}
    </button>
  )
})

export function Kbd({ children, className = '' }) {
  return (
    <kbd className={cx('inline-grid h-6 min-w-6 place-items-center rounded-md border border-line2 bg-white/[0.04] px-1.5 font-sans text-[12px] font-semibold text-mute', className)}>
      {children}
    </kbd>
  )
}

const OWN_DOMAINS = ['developerofcode.com']

// The sender's initial in a serif italic, tinted per person. Mail from your own systems
// (developerofcode.com) carries the </> mark instead.
export function Monogram({ address, size = 40, me = false, className = '' }) {
  const own = OWN_DOMAINS.includes(domainOf(address?.email))
  if (own || me) {
    return (
      <span
        aria-hidden="true"
        className={cx('grid shrink-0 place-items-center rounded-full font-extrabold ring-1 ring-inset', me ? 'bg-ember/15 text-[#ff9a6e] ring-ember/30' : 'bg-[#0b1224] text-ember ring-ember/35', className)}
        style={{ width: size, height: size, fontSize: Math.round(size * (me ? 0.32 : 0.3)), letterSpacing: '-0.06em', fontStretch: '112%' }}
      >
        {me ? 'me' : '</>'}
      </span>
    )
  }
  const hue = hueOf((address?.email || address?.name || '').toLowerCase())
  return (
    <span
      aria-hidden="true"
      className={cx('grid shrink-0 place-items-center rounded-full ring-1 ring-inset ring-white/10', className)}
      style={{
        width: size,
        height: size,
        background: `hsl(${hue} 30% 21%)`,
        color: `hsl(${hue} 72% 84%)`,
      }}
    >
      <span className="font-display italic" style={{ fontSize: Math.round(size * 0.46), fontWeight: 400, lineHeight: 1, transform: 'translateY(-0.04em)' }}>
        {initialOf(address)}
      </span>
    </span>
  )
}

// Gmail label chip in the label's own color, softened for the dark desk
export function LabelChip({ label, onPaper = false, className = '' }) {
  const color = label.color || '#98a1b5'
  return (
    <span
      className={cx('inline-flex h-[22px] max-w-[160px] shrink-0 items-center gap-1.5 truncate rounded-full px-2 text-[11.5px] font-semibold', className)}
      style={
        onPaper
          ? { background: `${color}24`, color: '#3a4152', boxShadow: `inset 0 0 0 1px ${color}55` }
          : { background: `${color}1f`, color: `color-mix(in srgb, ${color} 55%, #ece8df)`, boxShadow: `inset 0 0 0 1px ${color}40` }
      }
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
      <span className="truncate">{label.name.split('/').pop()}</span>
    </span>
  )
}

export function Spinner({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cx('animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function ExampleTag({ className = '', children = 'Example inbox' }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border border-dashed border-line2 px-2.5 py-1 text-[12px] font-medium text-mute', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-ember/80" aria-hidden="true" />
      {children}
    </span>
  )
}
