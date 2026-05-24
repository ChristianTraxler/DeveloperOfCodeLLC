const STATUS_STYLES = {
  planning:  { dot: 'bg-purple-400',   text: 'text-purple-300',  border: 'border-purple-400/30',  bg: 'bg-purple-400/10' },
  active:    { dot: 'bg-accent',       text: 'text-accent',      border: 'border-accent/30',      bg: 'bg-accent/10' },
  paused:    { dot: 'bg-amber-400',    text: 'text-amber-300',   border: 'border-amber-400/30',   bg: 'bg-amber-400/10' },
  completed: { dot: 'bg-emerald-400',  text: 'text-emerald-300', border: 'border-emerald-400/30', bg: 'bg-emerald-400/10' },
  archived:  { dot: 'bg-ink-500',      text: 'text-muted',       border: 'border-ink-600',        bg: 'bg-ink-700/40' },
}

export default function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.planning
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono uppercase tracking-wider border ${s.border} ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  )
}

export function CategoryBadge({ category }) {
  const isClient = category === 'client'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${
      isClient
        ? 'border-accent/40 text-accent bg-accent/5'
        : 'border-ink-600 text-muted bg-ink-800/40'
    }`}>
      {category}
    </span>
  )
}
