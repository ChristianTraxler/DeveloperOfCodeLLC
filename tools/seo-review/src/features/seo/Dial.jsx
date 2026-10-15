// The dial: one mark per check, 18 in all, grouped by category with a gap between groups.
// It is the tool's signature. Every review, big or small, is drawn as this same instrument.
//
//   marks     [{ key, label, category, status }] in display order (status may be 'later')
//   size      pixel width
//   labels    draw category names around the ring
//   scanning  0..1 progress while a review runs (marks light up in order, results unknown)
//   reveal    animate the marks in, one after another, on first paint
import { useEffect, useState } from 'react'
import { STATUS } from './lib.js'

const GAP = 1 // empty slots between categories

function layout(marks) {
  const cats = []
  for (const m of marks) if (!cats.includes(m.category)) cats.push(m.category)
  const slots = marks.length + cats.length * GAP
  const step = 360 / slots
  let slot = GAP / 2
  let prev = null
  const out = []
  const groups = {}
  marks.forEach((m) => {
    if (prev && prev !== m.category) slot += GAP
    const angle = slot * step
    out.push({ ...m, angle })
    ;(groups[m.category] ||= []).push(angle)
    prev = m.category
    slot += 1
  })
  return { marks: out, step, groups }
}

const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}
function arc(cx, cy, r, from, to) {
  const [x1, y1] = polar(cx, cy, r, from)
  const [x2, y2] = polar(cx, cy, r, to)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

const SHORT = { onpage: 'On-page', technical: 'Technical', local: 'Local', visibility: 'Visibility' }

export function Dial({ marks, size = 240, labels = false, scanning = null, reveal = false, children, className = '', title }) {
  const [shown, setShown] = useState(!reveal)
  useEffect(() => {
    if (!reveal) return
    const t = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(t)
  }, [reveal])

  const pad = labels ? 34 : 2
  const box = 200 + pad * 2
  const c = box / 2
  const r = 88
  const weight = size < 80 ? 13 : 11
  const { marks: placed, step, groups } = layout(marks)
  const span = step * 0.62
  const scanIndex = scanning == null ? -1 : Math.floor(scanning * placed.filter((m) => m.status !== 'later').length)
  let live = -1

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${box} ${box}`} width={size} height={size} role="img" aria-label={title || 'Review dial'} className="block overflow-visible">
        <circle cx={c} cy={c} r={r + weight / 2 + 7} fill="none" stroke="rgba(236,232,223,0.06)" />
        <circle cx={c} cy={c} r={r - weight / 2 - 7} fill="none" stroke="rgba(236,232,223,0.05)" />
        {placed.map((m, i) => {
          const later = m.status === 'later'
          if (!later) live++
          let color = (STATUS[m.status] || STATUS.later).color
          let opacity = 1
          if (scanning != null && !later) {
            color = live < scanIndex ? 'rgb(var(--bone-rgb))' : live === scanIndex ? 'rgb(var(--ember-rgb))' : 'rgba(236,232,223,0.14)'
            opacity = live < scanIndex ? 0.55 : 1
          }
          const d = arc(c, c, r, m.angle - span / 2, m.angle + span / 2)
          return (
            <path
              key={m.key}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={weight}
              strokeLinecap="round"
              strokeDasharray={m.status === 'skipped' && scanning == null ? '2 5' : undefined}
              opacity={shown ? opacity : 0}
              style={{
                transition: reveal ? `opacity 420ms ease ${i * 45}ms, stroke 300ms ease` : 'stroke 300ms ease, opacity 300ms ease',
              }}
            >
              <title>{`${m.label}: ${(STATUS[m.status] || STATUS.later).label}`}</title>
            </path>
          )
        })}
        {labels &&
          Object.entries(groups).map(([cat, angles]) => {
            const mid = (angles[0] + angles[angles.length - 1]) / 2
            const [x, y] = polar(c, c, r + 27, mid)
            const anchor = mid < 20 || mid > 340 || (mid > 160 && mid < 200) ? 'middle' : mid < 180 ? 'start' : 'end'
            return (
              <text key={cat} x={x} y={y} dy="0.35em" textAnchor={anchor} className="fill-faint" style={{ font: '500 9.5px var(--font-ui)', letterSpacing: '0.02em' }}>
                {SHORT[cat] || cat}
              </text>
            )
          })}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  )
}

// Marks for a review: every check from the config, with its result where there is one.
export function marksFor(meta, checks = []) {
  const byKey = new Map(checks.map((c) => [c.key, c]))
  return Object.entries(meta.checks).map(([key, m]) => ({
    key,
    label: m.label,
    category: m.category,
    status: byKey.get(key)?.status || (m.phase > 1 ? 'later' : 'skipped'),
  }))
}

// Marks from the per-category counts saved on a review (for list rows, where checks are not loaded).
export function marksFromCounts(meta, cats = {}) {
  const out = []
  for (const cat of Object.keys(meta.categories)) {
    const keys = Object.entries(meta.checks).filter(([, m]) => m.category === cat)
    const c = cats[cat] || {}
    const pool = [...Array(c.fail || 0).fill('fail'), ...Array(c.warn || 0).fill('warn'), ...Array(c.pass || 0).fill('pass'), ...Array(c.skipped || 0).fill('skipped')]
    let j = 0
    keys.forEach(([key, m]) => out.push({ key, label: m.label, category: cat, status: m.phase > 1 ? 'later' : pool[j++] || 'skipped' }))
  }
  return out
}
