import { PLATFORM_BY_ID, STATUS_BY_ID } from '../lib/platforms'

/**
 * Status is drawn as a shape so it reads without color:
 * idea is an empty ring, drafting is half full, scheduled is a ring with a center (orange),
 * posted is a solid disc with a check, skipped is a ring with a slash.
 */
export function StatusGlyph({ status, size = 14, className = '' }) {
  const s = size
  const common = { width: s, height: s, viewBox: '0 0 16 16', className: `shrink-0 ${className}`, 'aria-hidden': true }
  switch (status) {
    case 'drafting':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="#a8a197" strokeWidth="1.5" />
          <path d="M8 1.75a6.25 6.25 0 0 0 0 12.5z" fill="#a8a197" />
        </svg>
      )
    case 'scheduled':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="#f07a3a" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.6" fill="#f07a3a" />
        </svg>
      )
    case 'posted':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="#ede8e0" />
          <path d="M5 8.2l2 2 4-4.3" fill="none" stroke="#131211" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'skipped':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="#716b63" strokeWidth="1.5" />
          <path d="M4 12L12 4" stroke="#716b63" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="#716b63" strokeWidth="1.5" strokeDasharray="2.2 2.2" />
        </svg>
      )
  }
}

export function StatusLabel({ status, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <StatusGlyph status={status} />
      <span>{STATUS_BY_ID[status]?.label}</span>
    </span>
  )
}

export function PlatformMark({ platform, className = '', title }) {
  const p = PLATFORM_BY_ID[platform]
  if (!p) return <span className={`cq-pmark border-dashed text-faint ${className}`} title="No platform yet">?</span>
  return (
    <span className={`cq-pmark ${className}`} title={title ?? p.label} aria-label={p.label}>
      {p.short}
    </span>
  )
}
