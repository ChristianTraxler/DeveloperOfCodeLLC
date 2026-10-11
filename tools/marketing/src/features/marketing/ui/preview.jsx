// Shared preview pieces: the inbox line, the device switch and "preview as".
import { Monitor, Smartphone, ChevronDown } from 'lucide-react'
import { inboxLine } from '../email/render.js'
import { cx } from './core.jsx'

export function InboxMock({ campaign, contact, time = '9:00 AM', className = '' }) {
  const line = inboxLine(campaign, contact)
  return (
    <div className={cx('rounded-[18px] bg-[#f6f5f2] p-1.5 text-[#14161a] shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)]', className)}>
      <div className="flex gap-3 rounded-[13px] bg-white px-3.5 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#070a12] font-mono text-[11px] font-extrabold tracking-[-0.06em] text-[#ff5a1f]" aria-hidden="true">
          {'</>'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[14.5px] font-semibold">{line.from || 'From name'}</p>
            <span className="shrink-0 text-[12px] text-[#6b7280]">{time}</span>
          </div>
          <p className={cx('truncate text-[14px] font-semibold', !line.subject && 'text-[#9aa0a8]')}>{line.subject || 'Your subject line'}</p>
          <p className={cx('line-clamp-2 text-[13.5px] leading-snug', line.preheader ? 'text-[#5f6670]' : 'text-[#9aa0a8]')}>{line.preheader || 'Your preview text shows here, after the subject.'}</p>
        </div>
      </div>
    </div>
  )
}

export function DeviceSwitch({ value, onChange, className = '' }) {
  const opts = [
    { value: 'phone', label: 'Phone', icon: <Smartphone size={15} /> },
    { value: 'desktop', label: 'Desktop', icon: <Monitor size={15} /> },
  ]
  return (
    <div role="radiogroup" aria-label="Preview size" className={cx('inline-flex rounded-full border border-line bg-black/30 p-1', className)}>
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors', value === o.value ? 'bg-bone text-ink' : 'text-mute hover:text-bone')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const NO_NAME = { id: '__noname', first: '', last: '', business: '', email: 'someone@example.com', type: 'lead' }

export function PreviewAs({ people, value, onChange, className = '' }) {
  const options = [...people.slice(0, 30), NO_NAME]
  return (
    <label className={cx('relative inline-flex min-w-0 items-center', className)}>
      <span className="sr-only">Preview as</span>
      <span className="pointer-events-none absolute left-3.5 text-[12.5px] text-faint">As</span>
      <select
        value={value?.id || options[0]?.id || ''}
        onChange={(e) => onChange(options.find((p) => p.id === e.target.value) || null)}
        className="h-10 w-full min-w-0 appearance-none truncate rounded-full border border-line bg-black/30 pl-9 pr-9 text-[13.5px] font-medium text-bone focus:border-ember/70 focus:outline-none"
      >
        {options.map((p) => (
          <option key={p.id} value={p.id} className="bg-panel">
            {p.id === NO_NAME.id ? 'Someone with no name on file' : `${p.first} ${p.last}${p.business ? `, ${p.business}` : ''}`}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 text-mute" />
    </label>
  )
}

// A phone-shaped frame around a preview
export function PhoneFrame({ children, className = '' }) {
  return (
    <div className={cx('relative mx-auto h-full w-full max-w-[400px] rounded-[44px] border border-white/15 bg-[#05070c] p-[10px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]', className)}>
      <div className="absolute left-1/2 top-[18px] z-10 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-[#05070c]" aria-hidden="true" />
      <div className="flex h-full flex-col overflow-hidden rounded-[34px] bg-white">
        <div className="h-10 shrink-0" aria-hidden="true" />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
