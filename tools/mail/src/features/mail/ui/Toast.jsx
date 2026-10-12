// Small confirmations at the bottom of the screen, with an optional action (Undo, Open) and
// an optional countdown ring for undo windows.
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Mail } from 'lucide-react'

const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

function Countdown({ seconds }) {
  const r = 9
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid h-6 w-6 shrink-0 place-items-center">
      <svg width="24" height="24" viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(236,232,223,.16)" strokeWidth="2.5" />
        <circle cx="12" cy="12" r={r} fill="none" stroke="#ff5a1f" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} style={{ animation: `ml-countdown ${seconds}s linear forwards`, '--ml-c': c }} />
      </svg>
      <span className="text-[10.5px] font-semibold tabular-nums text-bone">{seconds}</span>
    </span>
  )
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setItems((list) => list.filter((t) => t.id !== id))
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const toast = useCallback(
    (message, opts = {}) => {
      const id = Math.random().toString(36).slice(2)
      const item = { id, message, tone: opts.tone || 'ok', kind: opts.kind || null, action: opts.action || null, countdown: opts.countdown || 0 }
      setItems((list) => [...list.slice(-2), item])
      const ms = opts.countdown ? opts.countdown * 1000 + 250 : opts.action ? 6500 : 3400
      timers.current.set(id, setTimeout(() => dismiss(id), ms))
      return id
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[95] flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--ml-toast-offset, 20px))' }}
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex max-w-[min(94vw,560px)] items-center gap-2.5 rounded-full border border-line2 bg-raised/95 py-2 pl-2.5 pr-2 text-[14px] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)] backdrop-blur-xl"
            >
              {t.countdown ? (
                <Countdown seconds={t.countdown} />
              ) : (
                <span
                  className={
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full ' +
                    (t.tone === 'warn' ? 'bg-danger/20 text-danger' : t.kind === 'mail' ? 'bg-ember/20 text-[#ff9a6e]' : 'bg-live/20 text-live')
                  }
                >
                  {t.tone === 'warn' ? <AlertTriangle size={13} strokeWidth={2.6} /> : t.kind === 'mail' ? <Mail size={13} strokeWidth={2.4} /> : <Check size={13} strokeWidth={3} />}
                </span>
              )}
              <span className={'min-w-0 truncate py-0.5 leading-snug ' + (t.action ? '' : 'pr-3')}>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="ml-1 h-8 shrink-0 rounded-full bg-white/[0.09] px-3.5 text-[13.5px] font-semibold text-bone transition-colors hover:bg-white/[0.16]"
                  onClick={() => {
                    t.action.onClick()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
