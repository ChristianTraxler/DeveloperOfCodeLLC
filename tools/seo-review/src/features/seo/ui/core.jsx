// Buttons and small pieces that match the Admin Hub's look (same classes as Marketing).
import { forwardRef } from 'react'

export const cx = (...parts) => parts.filter(Boolean).join(' ')

const BASE =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background,border-color,color,transform,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45'
const VARIANTS = {
  solid: 'bg-bone text-ink hover:bg-white',
  ember: 'bg-ember text-[#1c0a02] hover:bg-[#ff6f3a] font-semibold',
  ghost: 'border border-line2 bg-white/[0.02] text-bone hover:border-white/30 hover:bg-white/[0.06]',
  quiet: 'text-mute hover:text-bone hover:bg-white/[0.06]',
  danger: 'bg-danger text-[#2a0602] hover:bg-[#ff8176] font-semibold',
}
const SIZES = {
  xs: 'h-8 px-3 text-[13px]',
  sm: 'h-10 px-4 text-[14px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-[52px] px-7 text-[16px]',
  icon: 'h-10 w-10',
}

export const Button = forwardRef(function Button({ variant = 'ghost', size = 'sm', className = '', type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cx(BASE, VARIANTS[variant], SIZES[size], className)} {...rest} />
})

export const inputClass =
  'w-full rounded-[14px] border border-line2 bg-black/30 px-4 text-[16px] text-bone placeholder:text-faint transition-colors focus:border-ember/70 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-ember/10'

export function Field({ label, hint, error, htmlFor, children, className = '' }) {
  return (
    <div className={cx('block', className)}>
      <label htmlFor={htmlFor} className="mb-2 block text-[13.5px] font-medium text-bone/85">
        {label}
      </label>
      {children}
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : hint ? <p className="mt-2 text-[12.5px] leading-snug text-faint">{hint}</p> : null}
    </div>
  )
}

export const Input = forwardRef(function Input({ className = '', invalid, ...rest }, ref) {
  return <input ref={ref} className={cx(inputClass, 'h-[52px]', invalid && 'border-danger/70', className)} {...rest} />
})
