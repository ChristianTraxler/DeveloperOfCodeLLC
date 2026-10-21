import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/* ---------- Toasts ---------- */

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t.slice(-2), { id, message, ...opts }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration ?? 4800)
  }, [])
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id))
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div
          className="cq-toasts pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
          role="status"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex min-h-[48px] w-full max-w-[440px] animate-rise items-center gap-3 rounded-[12px] border border-line2 bg-raised py-1.5 pl-4 pr-1.5 text-[14px] text-bone shadow-[0_12px_32px_-12px_rgba(0,0,0,.7)]"
            >
              <span className="min-w-0 flex-1">{t.message}</span>
              {t.action && (
                <button
                  className="cq-btn min-h-[36px] px-3 text-ember hover:bg-ember-soft"
                  onClick={() => {
                    t.action.run()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button className="cq-icon-btn h-9 w-9" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

/* ---------- Body scroll lock shared by dialogs and the composer ---------- */

let locks = 0
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return
    locks++
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      locks--
      if (locks === 0) html.style.overflow = prev
    }
  }, [active])
}

function useEscape(onClose, active = true) {
  useEffect(() => {
    if (!active) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, active])
}

/* ---------- Dialog: centered on large screens, bottom sheet on phones ---------- */

export function Dialog({ open, onClose, title, description, children, footer, width = 480, labelledBy }) {
  useScrollLock(open)
  useEscape(onClose, open)
  const panel = useRef(null)
  useEffect(() => {
    if (!open) return
    const el = panel.current?.querySelector('[data-autofocus]') || panel.current
    el?.focus({ preventScroll: true })
  }, [open])
  if (!open) return null
  const titleId = labelledBy || 'cq-dialog-title'
  return createPortal(
    <div className="cq-root fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full animate-sheet flex-col overflow-hidden rounded-t-[18px] border border-line2 bg-panel outline-none sm:rounded-[16px]"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-[22px] font-[450] leading-tight tracking-[-0.01em] text-bone">
              {title}
            </h2>
            {description && <p className="mt-1.5 text-[14px] leading-relaxed text-mute">{description}</p>}
          </div>
          <button className="cq-icon-btn -mr-2 -mt-1" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div
            className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* ---------- Menu: a small popover anchored to a button ---------- */

export function Menu({ anchor, open, onClose, children, align = 'end', width = 232 }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  useEscape(onClose, open)

  useLayoutEffect(() => {
    if (!open || !anchor) return
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const h = ref.current?.offsetHeight || 280
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = align === 'end' ? r.right - width : r.left
      left = Math.max(12, Math.min(left, vw - width - 12))
      let top = r.bottom + 6
      if (top + h > vh - 12) top = Math.max(12, r.top - h - 6)
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, align, width])

  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return
      onClose('outside')
    }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [open, onClose, anchor])

  const focused = useRef(false)
  useEffect(() => {
    if (!open) {
      focused.current = false
      return
    }
    if (pos && !focused.current) {
      focused.current = true
      ref.current?.querySelector('button')?.focus({ preventScroll: true })
    }
  }, [open, pos])

  if (!open) return null
  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="cq-root fixed z-[75] animate-fade overflow-hidden rounded-[12px] border border-line2 bg-raised py-1.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,.8)]"
      style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
        e.preventDefault()
        const items = [...ref.current.querySelectorAll('button:not([disabled])')]
        const i = items.indexOf(document.activeElement)
        const next = e.key === 'ArrowDown' ? items[(i + 1) % items.length] : items[(i - 1 + items.length) % items.length]
        next?.focus()
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({ icon: Icon, children, onSelect, danger, disabled, hint }) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-h-[40px] w-full items-center gap-3 px-3.5 text-left text-[14px] transition-colors hover:bg-line focus:bg-line focus:outline-none disabled:opacity-40 ${danger ? 'text-danger' : 'text-bone'}`}
    >
      {Icon && <Icon size={16} className={danger ? '' : 'text-mute'} />}
      <span className="flex-1">{children}</span>
      {hint && <span className="font-mono text-[11px] text-faint">{hint}</span>}
    </button>
  )
}

export const MenuRule = () => <div className="my-1.5 h-px bg-line" />
export const MenuHeading = ({ children }) => <div className="cq-label px-3.5 pb-1 pt-2">{children}</div>
