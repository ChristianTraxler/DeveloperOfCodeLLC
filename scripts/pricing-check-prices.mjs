// Checks every published price against the handoff (October 16, 2026).
import { carePlans, setupSizes, addOnGroups, extraHourRate, largeBase, video } from '../src/pricing/pricing.js'
const want = {
  care: { basic: 49, standard: 99, plus: 179 },
  setup: { small: 300, standard: 500, large: 750 },
  addOns: { booking: [200, 400], store: [300, 600], login: [400, 800], integration: [150, 300], 'cms-simple': [450, 900], 'cms-full': [1000, 1500], pages: [50, 50], content: [50, 75], crm: 'quote' },
}
const errs = []
const vWant = { starter: [349, 4], growth: [649, 8], authority: [949, 12] }
for (const p of video.packages) if (!vWant[p.id] || vWant[p.id][0] !== p.price || vWant[p.id][1] !== p.videos) errs.push(`video ${p.id}`)
if (video.pilot.price !== 199 || video.pilot.videos !== 3 || video.single !== 99) errs.push('video pilot or single')
for (const p of carePlans) if (want.care[p.id] !== p.price) errs.push(`care ${p.id}: ${p.price}`)
for (const s of setupSizes) if (want.setup[s.id] !== s.price) errs.push(`setup ${s.id}: ${s.price}`)
if (extraHourRate !== 75) errs.push('extra hour rate')
if (largeBase.price !== 750) errs.push('large base')
for (const a of addOnGroups.flatMap((g) => g.items)) {
  const w = want.addOns[a.id]
  if (w === 'quote') { if (a.kind !== 'quote') errs.push(`${a.id} should be quoted`); continue }
  const got = a.kind === 'per' ? [a.price, a.price] : [a.min, a.max]
  if (!w || got[0] !== w[0] || got[1] !== w[1]) errs.push(`${a.id}: ${got}`)
}
const plain = JSON.stringify({ carePlans, setupSizes, addOnGroups })
for (const word of ['2,000', '2000', '1,500 custom', 'waive', 'cancellation fee']) if (plain.includes(word)) errs.push(`unconfirmed item published: ${word}`)
if (errs.length) { console.error('Price check failed:\n' + errs.join('\n')); process.exit(1) }
console.log('All prices match the handoff.')
