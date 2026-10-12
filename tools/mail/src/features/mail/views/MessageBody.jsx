// Shows one email's content safely: a sandboxed frame that can't run scripts, sized to fit its
// content, with remote images held back until you allow them.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ImageOff, MoreHorizontal, ShieldCheck } from 'lucide-react'
import { prepareEmail } from '../lib/html.js'
import { useSettings } from '../state/settings.js'
import { nameOf, plural } from '../lib/format.js'
import { cx } from '../ui/core.jsx'

function parseMailto(href) {
  try {
    const url = new URL(href)
    const to = decodeURIComponent(url.pathname || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .map((email) => ({ name: '', email }))
    return { to, subject: url.searchParams.get('subject') || '', body: url.searchParams.get('body') || '' }
  } catch {
    return null
  }
}

export function MessageBody({ message, rewrite, onMailto }) {
  const [settings, update] = useSettings()
  const sender = (message.from?.email || '').toLowerCase()
  const trusted = settings.images === 'always' || (settings.trusted || []).includes(sender) || message.fromMe
  const [loadImages, setLoadImages] = useState(trusted)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [height, setHeight] = useState(140)
  const frame = useRef(null)
  const zoom = useRef(1)

  useEffect(() => setLoadImages(trusted), [trusted, message.id])

  const prepared = useMemo(() => prepareEmail(message, { loadImages, showQuote: false, rewrite }), [message, loadImages, rewrite])

  // Shrinks wide emails to fit the column (the way phone mail apps do), then sizes the frame
  const fit = (refit) => {
    const el = frame.current
    const doc = el?.contentDocument
    if (!doc?.body || !doc.documentElement) return
    if (refit) {
      doc.body.style.zoom = ''
      const avail = el.clientWidth
      const wide = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth)
      zoom.current = wide > avail + 2 ? Math.max(0.45, avail / wide) : 1
      if (zoom.current !== 1) doc.body.style.zoom = String(zoom.current)
    }
    // Measure the content itself; the page element never reports less than the frame's height
    const root = doc.querySelector('.doc-root') || doc.body
    const rect = root.getBoundingClientRect()
    const h = Math.max(24, Math.ceil(rect.bottom + (doc.defaultView?.scrollY || 0)) + 2)
    setHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev))
  }

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    let bodyObserver
    let frameObserver
    let raf = 0
    const onLoad = () => {
      const doc = el.contentDocument
      if (!doc) return
      fit(true)
      try {
        bodyObserver = new ResizeObserver(() => {
          cancelAnimationFrame(raf)
          raf = requestAnimationFrame(() => fit(false))
        })
        bodyObserver.observe(doc.body)
      } catch {
        // older browsers: the timers below cover late images
      }
      for (const ms of [120, 600, 1600]) setTimeout(() => fit(false), ms)
      doc.addEventListener(
        'click',
        (e) => {
          const a = e.target?.closest?.('a[href]')
          if (!a) return
          const href = a.getAttribute('href') || ''
          if (href.toLowerCase().startsWith('mailto:') && onMailto) {
            const parsed = parseMailto(href)
            if (parsed?.to.length) {
              e.preventDefault()
              onMailto(parsed)
            }
          }
        },
        true,
      )
    }
    el.addEventListener('load', onLoad)
    try {
      let last = el.clientWidth
      frameObserver = new ResizeObserver(() => {
        if (Math.abs(el.clientWidth - last) > 2) {
          last = el.clientWidth
          fit(true)
        }
      })
      frameObserver.observe(el)
    } catch {
      // fine without it
    }
    return () => {
      el.removeEventListener('load', onLoad)
      bodyObserver?.disconnect()
      frameObserver?.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [prepared.html]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fold or unfold the quoted earlier messages without reloading the frame
  useEffect(() => {
    const doc = frame.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll('.doc-quote').forEach((q) => q.classList.toggle('doc-quote-hidden', !quoteOpen))
    requestAnimationFrame(() => fit(false))
  }, [quoteOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const showBar = prepared.blocked > 0 && !loadImages

  return (
    <div>
      {showBar && (
        <div className="mb-3 flex items-start gap-3 rounded-[12px] bg-[#f4f2ed] px-3.5 py-1.5 text-[13px] text-slate">
          <ImageOff size={15} className="mt-[9px] shrink-0 text-slate/80" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3">
          <span className="min-w-[13rem] flex-1 py-1.5 leading-snug">Images are off, so the sender can't tell you opened this.</span>
          <span className="-ml-3 flex shrink-0 flex-wrap items-center gap-1">
            <button type="button" onClick={() => setLoadImages(true)} className="h-8 rounded-full px-3 font-semibold text-ink2 hover:bg-black/[0.06]">
              Show images
            </button>
            {sender && (
              <button
                type="button"
                onClick={() => {
                  update((s) => ({ trusted: [...new Set([...(s.trusted || []), sender])] }))
                  setLoadImages(true)
                }}
                className="h-8 rounded-full px-3 font-semibold text-[#c4410c] hover:bg-[#c4410c]/[0.08]"
              >
                Always from {nameOf(message.from).split(' ')[0]}
              </button>
            )}
          </span>
          </div>
        </div>
      )}
      <iframe
        ref={frame}
        title={`Email from ${nameOf(message.from)}`}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={prepared.html}
        scrolling="no"
        className="block w-full border-0 bg-white"
        style={{ height }}
      />
      {(prepared.hasQuote || prepared.trackers > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {prepared.hasQuote && (
            <button
              type="button"
              onClick={() => setQuoteOpen((v) => !v)}
              aria-expanded={quoteOpen}
              aria-label={quoteOpen ? 'Hide quoted text' : 'Show quoted text'}
              title={quoteOpen ? 'Hide quoted text' : 'Show quoted text'}
              className={cx('grid h-6 w-10 place-items-center rounded-full border transition-colors', quoteOpen ? 'border-black/20 bg-black/[0.06] text-ink2' : 'border-black/10 bg-[#f4f2ed] text-slate hover:border-black/25')}
            >
              <MoreHorizontal size={16} />
            </button>
          )}
          {prepared.trackers > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#1f8a52]" title="Tracking pixels report when and where you open an email. Mail removes them.">
              <ShieldCheck size={14} /> {plural(prepared.trackers, 'tracker', 'trackers')} removed
            </span>
          )}
        </div>
      )}
    </div>
  )
}
