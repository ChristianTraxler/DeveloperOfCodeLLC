// Fails if an em dash or en dash appears in the source, docs or config.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
const bad = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']')
const roots = ['src/pricing', 'pricing.html', 'scripts/pricing-check-dashes.mjs', 'scripts/pricing-check-prices.mjs']
let hits = 0
const walk = (p) => {
  const st = statSync(p, { throwIfNoEntry: false })
  if (!st) return
  if (st.isDirectory()) return readdirSync(p).forEach((f) => walk(join(p, f)))
  if (!/\.(jsx?|mjs|css|html|md|json)$/.test(p)) return
  readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    if (bad.test(line)) { hits++; console.log(`${p}:${i + 1}: ${line.trim()}`) }
  })
}
roots.forEach(walk)
if (hits) { console.error(`\n${hits} line(s) with an em or en dash.`); process.exit(1) }
console.log('No em or en dashes.')
