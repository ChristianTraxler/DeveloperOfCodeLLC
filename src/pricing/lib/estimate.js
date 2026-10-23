import { setupSizes, carePlans, allAddOns, careTerm } from '../pricing.js'
import { site } from '../site.config.js'

// state: { size: 'small'|'standard'|'large', plan: 'basic'|'standard'|'plus', addOns: { [id]: qty } }
export function estimate(state) {
  const size = setupSizes.find((s) => s.id === state.size) ?? setupSizes[0]
  const plan = carePlans.find((p) => p.id === state.plan) ?? carePlans[1]
  const lines = [{ label: `${size.name} setup, ${size.pages}`, min: size.price, max: size.price }]
  let quoteOnly = []
  let count = 0

  if (size.id === 'large') {
    for (const a of allAddOns) {
      const qty = state.addOns?.[a.id] ?? 0
      if (!qty) continue
      count += 1
      if (a.kind === 'quote') { quoteOnly.push(a.name); continue }
      const unit = a.unit ? ` (${qty} ${a.unit}${qty > 1 ? 's' : ''})` : ''
      if (a.kind === 'range') lines.push({ label: a.name, min: a.min, max: a.max })
      if (a.kind === 'perRange') lines.push({ label: a.name + unit, min: a.min * qty, max: a.max * qty })
      if (a.kind === 'per') lines.push({ label: a.name + unit, min: a.price * qty, max: a.price * qty })
    }
  }

  const min = lines.reduce((t, l) => t + l.min, 0)
  const max = lines.reduce((t, l) => t + l.max, 0)
  const needsQuote =
    quoteOnly.length > 0 || max > site.customQuote.aboveSetup || count >= site.customQuote.addOnCount

  return {
    size, plan, lines, min, max, quoteOnly, addOnCount: count, needsQuote,
    monthly: plan.price,
    firstYearCare: plan.price * careTerm.months,
  }
}
