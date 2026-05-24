export default function TechTag({ name, onClick, active }) {
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${
        active
          ? 'border-accent text-accent bg-accent/10'
          : 'border-ink-600 text-muted bg-ink-800/40 hover:border-ink-500 hover:text-bone'
      }`}
    >
      {name}
    </span>
  )
}
