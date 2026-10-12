// A panel that slides up from the bottom on phones and in from the right on larger screens.
// variant="dialog" centers it on larger screens, for short confirmations.
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEscape, useLockBody, useTablet } from './hooks.js'
import { cx } from './core.jsx'

const EASE = [0.2, 0.7, 0.2, 1]

export function Sheet({ open, onClose, title, kicker, children, footer, variant = 'side', width = 480, className = '' }) {
  const tablet = useTablet()
  const id = useId()
  const panel = useRef(null)
  const restore = useRef(null)
  useEscape(onClose, open)
  useLockBody(open)

  useEffect(() => {
    if (!open) return
    restore.current = document.activeElement
    const t = setTimeout(() => {
      const el = panel.current?.querySelector('[data-autofocus]') || panel.current
      el?.focus({ preventScroll: true })
    }, 60)
    return () => {
      clearTimeout(t)
      if (restore.current && typeof restore.current.focus === 'function') restore.current.focus({ preventScroll: true })
    }
  }, [open])

  const dialog = variant === 'dialog' && tablet
  const side = !dialog && tablet
  const motionProps = dialog
    ? { initial: { opacity: 0, y: 16, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 10, scale: 0.98 } }
    : side
      ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
      : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cx('fixed inset-0 z-[80]', dialog && 'grid place-items-center p-6')} role="presentation">
          <motion.button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full cursor-default bg-[#02040a]/70 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            tabIndex={-1}
            {...motionProps}
            transition={{ duration: 0.38, ease: EASE }}
            className={cx(
              'flex flex-col border-line2 bg-panel text-bone shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)] outline-none focus-visible:outline-none',
              dialog ? 'relative max-h-[min(86vh,760px)] w-full rounded-[28px] border' : 'absolute',
              side && 'inset-y-0 right-0 w-full border-l',
              !dialog && !side && 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px] border-t',
              className,
            )}
            style={dialog ? { maxWidth: Math.min(width, 520) } : side ? { maxWidth: width } : undefined}
          >
            {!dialog && !side && <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/15" aria-hidden="true" />}
            <div className="flex shrink-0 items-start gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-7" style={side ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 28px)' } : undefined}>
              <div className="min-w-0 flex-1">
                {kicker && <p className="mb-1.5 truncate text-[13px] font-medium text-mute">{kicker}</p>}
                <h2 id={`${id}-title`} className="display text-balance text-[27px] leading-[1.08] sm:text-[30px]">
                  {title}
                </h2>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.07] hover:text-bone">
                <X size={20} />
              </button>
            </div>
            <div className="ml-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-7">{children}</div>
            {footer && (
              <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-line px-5 pt-4 sm:px-7" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
