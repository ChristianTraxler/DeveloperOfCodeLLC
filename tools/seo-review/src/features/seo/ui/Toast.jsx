import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, AlertTriangle } from 'lucide-react'

const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

// toast('Saved') or toast('Email deleted', { action: { label: 'Undo', onClick } })
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
      const item = { id, message, tone: opts.tone || 'ok', action: opts.action || null }
      setItems((list) => [...list.slice(-2), item])
      timers.current.set(id, setTimeout(() => dismiss(id), opts.action ? 6000 : 3200))
      return id
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        aria-live="polite"
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex max-w-[min(92vw,560px)] items-center gap-2.5 rounded-full border border-line2 bg-raised/95 py-2 pl-3 pr-2 text-[14px] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl"
            >
              <span className={'grid h-5 w-5 shrink-0 place-items-center rounded-full ' + (t.tone === 'warn' ? 'bg-danger/20 text-danger' : 'bg-live/20 text-live')}>
                {t.tone === 'warn' ? <AlertTriangle size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
              </span>
              <span className={'min-w-0 py-0.5 leading-snug ' + (t.action ? '' : 'pr-3')}>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="ml-1 h-8 shrink-0 rounded-full bg-white/[0.08] px-3.5 text-[13.5px] font-semibold text-bone transition-colors hover:bg-white/[0.14]"
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
