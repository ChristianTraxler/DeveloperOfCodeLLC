// Live email preview in an iframe. Only changed sections are swapped, so typing never flickers.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { renderParts, renderEmail } from '../email/render.js'
import { cx } from './core.jsx'

export function EmailFrame({ campaign, settings, contact, selected, onSelect, title = 'Email preview', className = '', interactive = true, scrollToSelected = true }) {
  const frame = useRef(null)
  const shell = useRef(null)
  const rows = useRef(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const parts = useMemo(() => renderParts(campaign, { settings, contact, preview: true, selected: interactive ? selected : null }), [campaign, settings, contact, selected, interactive])

  useLayoutEffect(() => {
    const doc = frame.current?.contentDocument
    if (!doc) return
    const body = doc.getElementById('mk-rows')
    if (!body || shell.current !== parts.shellKey) {
      const top = doc.scrollingElement ? doc.scrollingElement.scrollTop : 0
      doc.open()
      doc.write(`<!doctype html><html lang="en"><head>${parts.head}</head><body style="${parts.bodyStyle}">${parts.preheader}${parts.open}${parts.rows.map((r) => r.html).join('')}${parts.close}</body></html>`)
      doc.close()
      shell.current = parts.shellKey
      rows.current = new Map(parts.rows.map((r) => [r.id, r.html]))
      doc.addEventListener('click', (e) => {
        const link = e.target.closest && e.target.closest('a')
        if (link && interactive) e.preventDefault()
        const tr = e.target.closest && e.target.closest('[data-block]')
        if (tr && onSelectRef.current) onSelectRef.current(tr.getAttribute('data-block'))
      })
      if (doc.scrollingElement && top) doc.scrollingElement.scrollTop = top
      return
    }
    const next = new Map()
    let prevEl = null
    for (const r of parts.rows) {
      let el = body.querySelector(`:scope > tr[data-block="${r.id}"]`)
      if (!el || rows.current.get(r.id) !== r.html) {
        const tmp = doc.createElement('tbody')
        tmp.innerHTML = r.html
        const fresh = tmp.firstElementChild
        if (fresh) {
          if (el) el.replaceWith(fresh)
          el = fresh
        }
      }
      const want = prevEl ? prevEl.nextElementSibling : body.firstElementChild
      if (el && want !== el) body.insertBefore(el, want)
      prevEl = el
      next.set(r.id, r.html)
    }
    ;[...body.children].forEach((tr) => {
      if (!next.has(tr.getAttribute('data-block'))) tr.remove()
    })
    rows.current = next
    const pre = doc.getElementById('mk-pre')
    if (pre) pre.outerHTML = parts.preheader
    doc.title = parts.title
  }, [parts])

  useEffect(() => {
    if (!selected || !scrollToSelected) return
    const doc = frame.current?.contentDocument
    const el = doc?.querySelector(`[data-block="${selected}"]`)
    const scroller = doc?.scrollingElement
    if (!el || !scroller) return
    const box = el.getBoundingClientRect()
    const h = frame.current.clientHeight
    if (box.top >= 24 && box.bottom <= h - 24) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + box.top - 48), behavior: reduce ? 'auto' : 'smooth' })
  }, [selected, scrollToSelected])

  return <iframe ref={frame} title={title} className={cx('block h-full w-full border-0 bg-white', className)} />
}

// A small, scaled snapshot of an email. Not interactive.
export const EmailThumb = memo(function EmailThumb({ campaign, settings, contact = null, height = 260, base = 640, className = '' }) {
  const box = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    let ro
    try {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    } catch {
      // older browsers keep the first measurement
    }
    return () => ro && ro.disconnect()
  }, [])
  const html = useMemo(() => renderEmail(campaign, { settings, contact, preview: false }), [campaign, settings, contact])
  const scale = width ? width / base : 0.4
  return (
    <div ref={box} className={cx('relative overflow-hidden', className)} style={{ height }} aria-hidden="true">
      {width > 0 && (
        <iframe
          title=""
          tabIndex={-1}
          srcDoc={html}
          scrolling="no"
          className="pointer-events-none absolute left-0 top-0 border-0"
          style={{ width: base, height: height / scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      )}
    </div>
  )
})
