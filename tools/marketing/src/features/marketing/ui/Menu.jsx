// A small actions menu that opens from a "more" button.
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MoreHorizontal } from 'lucide-react'
import { useEscape, useOutside } from './hooks.js'
import { cx } from './core.jsx'

export function Menu({ items, label = 'More actions', className = '', buttonClassName = '', icon }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const panel = useRef(null)
  const wrap = useRef(null)
  useEscape(() => setOpen(false), open)
  useOutside(panel, (e) => {
    if (btn.current && btn.current.contains(e.target)) return
    setOpen(false)
  }, open)

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const place = () => {
      const r = btn.current.getBoundingClientRect()
      const width = 248
      const left = Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12))
      const estimate = items.length * 46 + 16
      const below = window.innerHeight - r.bottom
      const top = below > estimate + 12 || r.top < estimate ? r.bottom + 6 : r.top - estimate - 6
      setPos({ left, top, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, items.length])

  useLayoutEffect(() => {
    if (open && pos) panel.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [open, pos])

  const onKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const list = [...panel.current.querySelectorAll('button:not(:disabled)')]
    const i = list.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? list[(i + 1) % list.length] : list[(i - 1 + list.length) % list.length]
    next?.focus()
  }

  return (
    <div ref={wrap} className={cx('relative', className)}>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cx('grid h-10 w-10 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.07] hover:text-bone', open && 'bg-white/[0.07] text-bone', buttonClassName)}
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
              className="fixed z-[80] rounded-[18px] border border-line2 bg-raised/98 p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
              style={{ left: pos.left, top: pos.top, width: pos.width }}
            >
              {items.filter(Boolean).map((item) =>
                item.divider ? (
                  <div key={item.key} className="my-1 h-px bg-line" />
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(false)
                      item.onClick()
                    }}
                    className={cx(
                      'flex h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[14.5px] transition-colors focus:outline-none disabled:opacity-40',
                      item.danger ? 'text-danger hover:bg-danger/10 focus-visible:bg-danger/10' : 'text-bone hover:bg-white/[0.07] focus-visible:bg-white/[0.07]',
                    )}
                  >
                    <span className={cx('grid w-5 place-items-center', item.danger ? 'text-danger' : 'text-mute')}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ),
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
