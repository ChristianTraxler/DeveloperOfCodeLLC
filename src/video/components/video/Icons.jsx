// Small line icons, drawn on a 24 grid with a 1.5 stroke.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const paths = {
  plan: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4M8 14h3M8 17h6" />
    </>
  ),
  capture: (
    <>
      <rect x="3" y="7" width="13" height="11" rx="2" />
      <path d="m16 11 5-3v9l-5-3" />
      <circle cx="9.5" cy="12.5" r="2.2" />
    </>
  ),
  edit: (
    <>
      <path d="M6 4v16M18 4v16M6 9h12M6 15h12" />
      <path d="M10 12h4" />
    </>
  ),
  post: (
    <>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
  shuffle: <path d="M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3M18 4l2 3-2 3M18 14l2 3-2 3" />,
  frame: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M10 6h4M9.5 13l2-2 3 3" />
    </>
  ),
  star: <path d="m12 4 2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.6 5.2-.6z" />,
  handshake: (
    <>
      <path d="m3 11 4-4 4 2 3-2 4 1 3 3" />
      <path d="m7 13 3 3a1.5 1.5 0 0 0 2-2l-1-1M12 15l1.5 1.5a1.5 1.5 0 0 0 2-2L13 12" />
    </>
  ),
  bolt: <path d="M13 3 5 13h6l-1 8 8-10h-6z" />,
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
}

export function Icon({ name, className = 'h-6 w-6' }) {
  return (
    <svg {...base} className={className}>
      {paths[name]}
    </svg>
  )
}

// Veteran-owned badge: a five-point star in a ring.
export function VeteranBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-paper/95 py-1.5 pl-1.5 pr-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-navy [font-stretch:112%] ${className}`}
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-navy text-paper">
        <Icon name="star" className="h-3.5 w-3.5" />
      </span>
      Veteran-owned
    </span>
  )
}
