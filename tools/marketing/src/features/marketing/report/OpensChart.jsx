// Cumulative opens over the first 48 hours. One series, so no legend: the title names it.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { addMinutes, time, weekdayShort } from '../lib/format.js'

const H = 230
const PAD = { top: 18, right: 18, bottom: 34, left: 40 }

function niceMax(n) {
  if (n <= 4) return 4
  const step = Math.pow(10, Math.floor(Math.log10(n)))
  for (const m of [1, 2, 2.5, 5, 10]) {
    const v = Math.ceil(n / (step * m)) * step * m
    if (v >= n) return v
  }
  return n
}

function hourLabel(sentAt, h) {
  const d = addMinutes(sentAt, h * 60)
  const sameDay = new Date(sentAt).toDateString() === d.toDateString()
  return sameDay ? time(d).replace(':00', '') : `${weekdayShort(d)} ${time(d).replace(':00', '')}`
}

export function OpensChart({ curve, total, sentAt, live }) {
  const box = useRef(null)
  const [w, setW] = useState(320)
  const [hover, setHover] = useState(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setW(Math.max(280, el.clientWidth))
    measure()
    let ro
    try {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    } catch {
      // keep first width
    }
    return () => ro && ro.disconnect()
  }, [])

  const max = niceMax(Math.max(total, curve.length ? curve[curve.length - 1].opens : 0, 1))
  const innerW = w - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (h) => PAD.left + (h / 48) * innerW
  const y = (v) => PAD.top + innerH - (v / max) * innerH
  const ticksX = w < 480 ? [0, 12, 24, 48] : [0, 6, 12, 24, 36, 48]
  const ticksY = [0, max / 2, max]

  const line = useMemo(() => curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.hour).toFixed(1)} ${y(p.opens).toFixed(1)}`).join(' '), [curve, w, max]) // eslint-disable-line react-hooks/exhaustive-deps
  const area = curve.length ? `${line} L${x(curve[curve.length - 1].hour).toFixed(1)} ${y(0)} L${x(0)} ${y(0)} Z` : ''
  const end = curve[curve.length - 1]
  const active = hover != null ? curve[Math.min(hover, curve.length - 1)] : null

  const pointTo = (clientX) => {
    const r = box.current.getBoundingClientRect()
    const h = Math.round(((clientX - r.left - PAD.left) / innerW) * 48)
    setHover(Math.max(0, Math.min(curve.length - 1, h)))
  }

  return (
    <div ref={box} className="relative w-full min-w-0">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        aria-label={`Opens over the first 48 hours. ${end ? `${end.opens} opens by hour ${end.hour}.` : 'No opens yet.'}`}
        tabIndex={0}
        className="block max-w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
        onPointerMove={(e) => pointTo(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setHover((h) => Math.min(curve.length - 1, (h ?? -1) + 1))
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? curve.length) - 1))
          if (e.key === 'Escape') setHover(null)
        }}
        onBlur={() => setHover(null)}
      >
        {ticksY.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke="rgba(236,232,223,0.08)" strokeWidth="1" />
            <text x={PAD.left - 10} y={y(v) + 4} textAnchor="end" fontSize="11.5" fill="rgb(98,107,129)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(v)}
            </text>
          </g>
        ))}
        {ticksX.map((h) => (
          <text key={h} x={x(h)} y={H - 10} textAnchor={h === 0 ? 'start' : h === 48 ? 'end' : 'middle'} fontSize="11.5" fill="rgb(98,107,129)">
            {h === 0 ? 'Sent' : `${h}h`}
          </text>
        ))}
        {curve.length > 1 && (
          <>
            <path d={area} fill="rgba(255,90,31,0.1)" />
            <path d={line} fill="none" stroke="#FF5A1F" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {end && (
          <g>
            <circle cx={x(end.hour)} cy={y(end.opens)} r="6" fill="rgb(13,19,34)" />
            <circle cx={x(end.hour)} cy={y(end.opens)} r="4" fill="#FF5A1F" className={live ? 'mk-pulse' : ''} />
          </g>
        )}
        {active && (
          <g pointerEvents="none">
            <line x1={x(active.hour)} x2={x(active.hour)} y1={PAD.top} y2={PAD.top + innerH} stroke="rgba(236,232,223,0.35)" strokeWidth="1" />
            <circle cx={x(active.hour)} cy={y(active.opens)} r="6" fill="rgb(13,19,34)" />
            <circle cx={x(active.hour)} cy={y(active.opens)} r="4" fill="#FF5A1F" />
          </g>
        )}
      </svg>
      {end && !active && (
        <div className="pointer-events-none absolute text-[12.5px] font-semibold tabular-nums text-bone" style={{ left: Math.min(x(end.hour) + 10, w - 86), top: Math.max(y(end.opens) - 26, 0) }}>
          {end.opens} {end.opens === 1 ? 'open' : 'opens'}
        </div>
      )}
      {active && (
        <div
          className="pointer-events-none absolute z-10 min-w-[150px] rounded-[12px] border border-line2 bg-raised/95 px-3 py-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur"
          style={{ left: Math.max(4, Math.min(x(active.hour) - 75, w - 158)), top: 0 }}
        >
          <p className="text-[16px] font-semibold tabular-nums">{active.opens} {active.opens === 1 ? 'open' : 'opens'}</p>
          <p className="flex items-center gap-2 text-[12px] text-mute">
            <span className="h-0.5 w-3 rounded-full bg-ember" aria-hidden="true" />
            by {hourLabel(sentAt, active.hour)} ({active.hour}h)
          </p>
        </div>
      )}
    </div>
  )
}

const WINDOWS = [
  [0, 1, 'First hour'],
  [1, 3, '1 to 3 hours'],
  [3, 12, '3 to 12 hours'],
  [12, 24, '12 to 24 hours'],
  [24, 48, '24 to 48 hours'],
]

export function OpensTable({ people, delivered }) {
  let running = 0
  return (
    <table className="w-full text-left text-[14px]">
      <thead>
        <tr className="border-b border-line text-[12px] uppercase tracking-[0.1em] text-faint">
          <th className="py-2 font-semibold">When</th>
          <th className="py-2 text-right font-semibold">Opens</th>
          <th className="py-2 text-right font-semibold">So far</th>
        </tr>
      </thead>
      <tbody>
        {WINDOWS.map(([a, b, label]) => {
          const n = people.filter((p) => p.at >= a * 60 && p.at < b * 60).length
          running += n
          return (
            <tr key={label} className="border-b border-line last:border-0">
              <td className="py-2.5">{label}</td>
              <td className="py-2.5 text-right tabular-nums">{n}</td>
              <td className="py-2.5 text-right tabular-nums text-mute">{delivered ? Math.round((running / delivered) * 100) : 0}%</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
