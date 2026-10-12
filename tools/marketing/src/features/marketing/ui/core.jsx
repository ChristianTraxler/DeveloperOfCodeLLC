// Buttons, pills and small pieces that match the Admin Hub's look.
import { forwardRef } from 'react'
import { initials } from '../lib/format.js'

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
}
const SIZES = {
  xs: 'h-8 px-3 text-[13px]',
  sm: 'h-10 px-4 text-[14px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-[15px]',
  icon: 'h-10 w-10',
  iconSm: 'h-9 w-9',
}

export const Button = forwardRef(function Button({ variant = 'ghost', size = 'sm', className = '', type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx(BASE, VARIANTS[variant], SIZES[size], className)} {...rest} />
})

const PILL = {
  draft: 'border-line2 text-mute',
  scheduled: 'border-ember/40 bg-ember/10 text-[#ff9a6e]',
  sent: 'border-live/30 bg-live/10 text-live',
  sending: 'border-ember/40 bg-ember/10 text-[#ff9a6e]',
  neutral: 'border-line2 text-mute',
  warn: 'border-danger/35 bg-danger/10 text-danger',
}
export function Pill({ tone = 'neutral', children, className = '', dot = false }) {
  return (
    <span className={cx('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold tracking-[0.01em]', PILL[tone], className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', tone === 'sent' ? 'bg-live' : tone === 'draft' ? 'bg-faint' : 'bg-ember', tone === 'sending' && 'animate-pulse')} />}
      {children}
    </span>
  )
}

export const STATUS = {
  draft: { label: 'Draft', tone: 'draft' },
  scheduled: { label: 'Scheduled', tone: 'scheduled' },
  sent: { label: 'Sent', tone: 'sent' },
}

// Same identity colors as the people mix bar (validated for color-blind separation)
const AVATAR = {
  client: 'bg-[#d95926]/20 text-[#ff9a6e] ring-[#d95926]/35',
  past: 'bg-[#199e70]/20 text-[#5fd3a6] ring-[#199e70]/35',
  lead: 'bg-[#3987e5]/20 text-[#9cc2f5] ring-[#3987e5]/40',
}
export function Avatar({ person, size = 40 }) {
  return (
    <span
      aria-hidden="true"
      className={cx('grid shrink-0 place-items-center rounded-full font-semibold ring-1 ring-inset', AVATAR[person?.type] || AVATAR.past)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(person?.first || person?.business || '', person?.last || '')}
    </span>
  )
}

export function SectionHead({ title, count, hint, action, className = '' }) {
  return (
    <div className={cx('mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2', className)}>
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="display text-[28px] leading-none sm:text-[32px]">{title}</h2>
        {count != null && <span className="text-[15px] tabular-nums text-faint">{count}</span>}
      </div>
      {hint && <p className="max-w-[46ch] text-[14px] leading-snug text-mute sm:text-right">{hint}</p>}
      {action}
    </div>
  )
}

export function Empty({ children, action }) {
  return (
    <div className="rounded-[24px] border border-dashed border-line2 px-6 py-10 text-center">
      <p className="mx-auto max-w-[40ch] text-[15px] leading-relaxed text-mute">{children}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

