// A small actions menu that opens from a button. Items can be checkable (for labels).
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, MoreHorizontal } from 'lucide-react'
import { useEscape, useOutside } from './hooks.js'
import { cx } from './core.jsx'

export function Menu({ items, label = 'More actions', icon, buttonClassName = '', onPaper = false, width = 252, heading }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const panel = useRef(null)
  useEscape(() => setOpen(false), open)
  useOutside(
    panel,
    (e) => {
      if (btn.current && btn.current.contains(e.target)) return
      setOpen(false)
    },
    open,
  )

  const list = items.filter(Boolean)

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const place = () => {
      const r = btn.current.getBoundingClientRect()
      const left = Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12))
      const estimate = Math.min(list.length * 44 + (heading ? 40 : 0) + 16, window.innerHeight * 0.7)
      const below = window.innerHeight - r.bottom
      const top = below > estimate + 12 || r.top < estimate ? r.bottom + 6 : r.top - estimate - 6
      setPos({ left, top, maxHeight: Math.max(160, Math.min(estimate, (below > estimate + 12 ? below : r.top) - 18)) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, list.length, width, heading])

  useLayoutEffect(() => {
    if (open && pos) panel.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [open, pos])

  const onKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')]
    const i = buttons.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? buttons[(i + 1) % buttons.length] : buttons[(i - 1 + buttons.length) % buttons.length]
    next?.focus()
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cx(
          'grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors',
          onPaper ? 'text-slate hover:bg-black/[0.06] hover:text-ink2' : 'text-mute hover:bg-white/[0.07] hover:text-bone',
          open && (onPaper ? 'bg-black/[0.06] text-ink2' : 'bg-white/[0.08] text-bone'),
          buttonClassName,
        )}
      >
        {icon || <MoreHorizontal size={19} />}
      </button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={panel}
              role="menu"
              onKeyDown={onKey}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              className="ml-scroll fixed z-[90] overflow-y-auto rounded-[18px] border border-line2 bg-raised/[0.98] p-1.5 text-bone shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
              style={{ left: pos.left, top: pos.top, width, maxHeight: pos.maxHeight }}
            >
              {heading && <p className="px-3 pb-1.5 pt-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-faint">{heading}</p>}
              {list.map((item, i) =>
                item.divider ? (
                  <div key={`d${i}`} className="my-1 h-px bg-line" />
                ) : (
                  <button
                    key={item.key || item.label}
                    type="button"
                    role={item.checked != null ? 'menuitemcheckbox' : 'menuitem'}
                    aria-checked={item.checked != null ? !!item.checked : undefined}
                    disabled={item.disabled}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!item.keepOpen) setOpen(false)
                      item.onClick()
                    }}
                    className={cx(
                      'flex h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[14.5px] transition-colors focus:outline-none disabled:opacity-40',
                      item.danger ? 'text-danger hover:bg-danger/10 focus-visible:bg-danger/10' : 'hover:bg-white/[0.07] focus-visible:bg-white/[0.07]',
                    )}
                  >
                    {item.icon && <span className={cx('grid w-5 shrink-0 place-items-center', item.danger ? 'text-danger' : 'text-mute')}>{item.icon}</span>}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 text-[12px] text-faint">{item.hint}</span>}
                    {item.checked != null && (
                      <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border', item.checked ? 'border-ember bg-ember text-[#1c0a02]' : 'border-line2')}>
                        {item.checked && <Check size={13} strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                ),
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
