import { forwardRef, useId } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cx } from './core.jsx'

export const inputClass =
  'w-full rounded-[14px] border border-line2 bg-black/30 px-4 text-[16px] text-bone placeholder:text-faint transition-colors focus:border-ember/70 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-ember/10'

export function Field({ label, hint, error, htmlFor, children, aside, className = '' }) {
  return (
    <div className={cx('block', className)}>
      {(label || aside) && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-[13.5px] font-medium text-bone/85">
              {label}
            </label>
          )}
          {aside && <span className="shrink-0 text-[12.5px] tabular-nums text-faint">{aside}</span>}
        </div>
      )}
      {children}
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : hint ? <p className="mt-2 text-[12.5px] leading-snug text-faint">{hint}</p> : null}
    </div>
  )
}

export const Input = forwardRef(function Input({ className = '', size = 'md', invalid, ...rest }, ref) {
  return <input ref={ref} className={cx(inputClass, size === 'sm' ? 'h-11 text-[15px]' : 'h-[50px]', invalid && 'border-danger/70', className)} {...rest} />
})

export const Textarea = forwardRef(function Textarea({ className = '', rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx(inputClass, 'resize-y py-3 leading-relaxed', className)} {...rest} />
})

export function Select({ value, onChange, options, id, className = '', ...rest }) {
  return (
    <div className={cx('relative', className)}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, 'h-[50px] appearance-none pr-11')} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-panel text-bone">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mute" aria-hidden="true" />
    </div>
  )
}

export function Segmented({ value, onChange, options, label, size = 'md', className = '' }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex w-full rounded-[14px] border border-line bg-black/25 p-1', className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 font-medium transition-colors',
              size === 'sm' ? 'h-9 text-[13px]' : 'h-10 text-[14px]',
              on ? 'bg-white/[0.1] text-bone shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]' : 'text-mute hover:text-bone',
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, hint, disabled, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('group flex w-full items-start gap-4 rounded-2xl border border-line bg-white/[0.02] p-4 text-left transition-colors hover:border-line2 disabled:opacity-50', className)}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-snug text-mute">{hint}</span>}
      </span>
      <span className={cx('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-ember' : 'bg-white/[0.12]')}>
        <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </span>
    </button>
  )
}

export function Check2({ checked, onChange, children, className = '' }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cx('flex cursor-pointer items-start gap-3', className)}>
      <span className="relative mt-0.5 grid h-5 w-5 shrink-0 place-items-center">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 h-5 w-5 cursor-pointer appearance-none rounded-[6px] border border-line2 bg-black/30 checked:border-ember checked:bg-ember" />
        <Check size={14} strokeWidth={3} className="pointer-events-none relative text-[#1c0a02] opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="text-[14.5px] leading-snug">{children}</span>
    </label>
  )
}

export function Tabs({ value, onChange, tabs, className = '' }) {
  return (
    <div role="tablist" className={cx('inline-flex rounded-full border border-line bg-black/25 p-1', className)}>
      {tabs.map((t) => {
        const on = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cx('flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors', on ? 'bg-bone text-ink' : 'text-mute hover:text-bone')}
          >
            {t.label}
            {t.count != null && <span className={cx('tabular-nums text-[12.5px]', on ? 'text-ink/60' : 'text-faint')}>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
