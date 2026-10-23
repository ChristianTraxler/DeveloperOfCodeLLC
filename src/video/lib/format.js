export const money = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// True for text still holding a [PLACEHOLDER].
export const isPlaceholder = (v) => typeof v === 'string' && /\[[A-Z][^\]]*\]/.test(v)

// Splits "Turnaround: [TURNAROUND]" so placeholders can be highlighted in dev.
export function splitPlaceholders(text) {
  return String(text).split(/(\[[A-Z][^\]]*\])/g).filter(Boolean)
}
