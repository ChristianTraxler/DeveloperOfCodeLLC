// Settings, keyboard shortcuts and the image viewer.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { useMail } from '../state/MailContext.jsx'
import { useSettings } from '../state/settings.js'
import { Sheet } from '../ui/Sheet.jsx'
import { Button, Kbd, Monogram, Spinner, cx } from '../ui/core.jsx'
import { useEscape, useLockBody } from '../ui/hooks.js'
import { ago, fileSize } from '../lib/format.js'
import { LiveChip, liveHint } from './LiveChip.jsx'

function Choice({ label, hint, value, options, onChange, id }) {
  return (
    <div className="py-4">
      <p id={id} className="text-[15px] font-medium">
        {label}
      </p>
      {hint && <p className="mt-0.5 text-[13px] leading-snug text-mute">{hint}</p>}
      <div role="radiogroup" aria-labelledby={id} className="mt-3 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cx('h-9 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors', value === o.value ? 'border-bone bg-bone text-ink' : 'border-line2 text-mute hover:border-white/30 hover:text-bone')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-4 py-4 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-snug text-mute">{hint}</span>}
      </span>
      <span className={cx('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-ember' : 'bg-white/[0.12]')}>
        <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </span>
    </button>
  )
}

function Section({ title, children }) {
  return (
    <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">{title}</h3>
      <div className="divide-y divide-line">{children}</div>
    </section>
  )
}

export function SettingsSheet({ open, onClose }) {
  const { account, realtime, api, actions } = useMail()
  const [settings, update] = useSettings()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setConfirm(false)
    actions.refreshAccount()
  }, [open, actions])

  const notifications = typeof Notification !== 'undefined'
  const askNotify = async (on) => {
    if (!on) return update({ notify: false })
    if (!notifications) return update({ notify: false })
    try {
      const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      update({ notify: result === 'granted' })
    } catch {
      update({ notify: false })
    }
  }
  const watch = account?.live?.watchExpiresAt

  return (
    <Sheet open={open} onClose={onClose} kicker="Mail" title="Settings">
      <div className="space-y-6">
        <Section title="Account">
          <div className="flex items-center gap-3 py-4">
            <Monogram me size={42} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{account?.email}</p>
              <p className="text-[13px] text-mute">{api.mode === 'demo' ? 'Example inbox for the preview' : 'Linked with Google sign-in'}</p>
            </div>
            <LiveChip />
          </div>
          <div className="py-4 text-[13.5px] leading-relaxed text-mute">
            <p>{liveHint(realtime)}</p>
            {watch && <p className="mt-1">Gmail's live feed renews on its own. Next renewal is due by {new Date(watch).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.</p>}
            {account?.live?.lastPushAt && <p className="mt-1">Last update from Gmail: {ago(Date.parse(account.live.lastPushAt))}.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="xs" onClick={() => actions.syncNow()}>
                Check now
              </Button>
              {account?.live?.pushConfigured && (
                <Button size="xs" onClick={() => actions.renewWatch()}>
                  Renew live updates
                </Button>
              )}
            </div>
          </div>
          <div className="py-4">
            {confirm ? (
              <div className="rounded-[16px] border border-danger/30 bg-danger/[0.06] p-4">
                <p className="text-[14.5px] font-medium text-bone">Unlink {account?.email}?</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-mute">Mail stops showing this inbox and Google revokes the admin's access. Nothing in Gmail is deleted.</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="danger"
                    size="xs"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      await actions.unlink()
                      setBusy(false)
                      onClose()
                    }}
                  >
                    {busy ? <Spinner size={14} /> : null} Unlink Gmail
                  </Button>
                  <Button variant="quiet" size="xs" onClick={() => setConfirm(false)}>
                    Keep it linked
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="dangerGhost" size="xs" onClick={() => setConfirm(true)}>
                Unlink Gmail
              </Button>
            )}
          </div>
        </Section>

        <Section title="Reading">
          <Choice
            id="ml-set-images"
            label="Pictures in emails"
            hint="Remote pictures can tell a sender when you opened their email. Tracking pixels are removed either way."
            value={settings.images}
            onChange={(v) => update({ images: v })}
            options={[
              { value: 'ask', label: 'Ask first' },
              { value: 'always', label: 'Always show' },
            ]}
          />
          {settings.trusted?.length > 0 && (
            <div className="py-4">
              <p className="text-[15px] font-medium">Always show pictures from</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {settings.trusted.map((s) => (
                  <li key={s} className="inline-flex h-8 items-center gap-1 rounded-full border border-line2 pl-3 pr-1 text-[13px] text-mute">
                    {s}
                    <button type="button" aria-label={`Stop showing pictures from ${s}`} onClick={() => update((cur) => ({ trusted: cur.trusted.filter((x) => x !== s) }))} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/[0.08] hover:text-bone">
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Choice
            id="ml-set-read"
            label="Mark as read"
            value={settings.markRead}
            onChange={(v) => update({ markRead: v })}
            options={[
              { value: 'open', label: 'When I open it' },
              { value: 'manual', label: 'Only when I say so' },
            ]}
          />
        </Section>

        <Section title="Sending">
          <Choice
            id="ml-set-undo"
            label="Undo send"
            hint="How long you have to take an email back after pressing Send."
            value={Number(settings.undoSeconds)}
            onChange={(v) => update({ undoSeconds: v })}
            options={[
              { value: 0, label: 'Off' },
              { value: 5, label: '5 seconds' },
              { value: 10, label: '10 seconds' },
              { value: 20, label: '20 seconds' },
            ]}
          />
          <Toggle label="Add my Gmail signature" hint="Uses the signature saved in Gmail for the address you send from." checked={!!settings.signature} onChange={(v) => update({ signature: v })} />
        </Section>

        <Section title="Alerts">
          <Toggle label="New mail pop-ups" hint="A short note at the bottom of the screen when something new arrives." checked={!!settings.toasts} onChange={(v) => update({ toasts: v })} />
          <Toggle
            label="Desktop notifications"
            hint={notifications ? 'A system notification when new mail arrives while this tab is in the background.' : "This browser doesn't support notifications here."}
            checked={!!settings.notify}
            onChange={askNotify}
          />
          <Toggle label="Keyboard shortcuts" hint="Single keys like E to archive and R to reply. Press ? to see them all." checked={!!settings.shortcuts} onChange={(v) => update({ shortcuts: v })} />
        </Section>

        {api.mode === 'demo' && (
          <Section title="Preview">
            <div className="py-4">
              <p className="text-[13.5px] leading-relaxed text-mute">Every email here is an example. New ones keep arriving while the page is open, to show how live updates feel.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="xs"
                  disabled={!api.examplesLeft()}
                  onClick={() => {
                    api.deliverNext()
                    onClose()
                  }}
                >
                  {api.examplesLeft() ? 'Send an example email now' : 'All example emails delivered'}
                </Button>
                <Button
                  size="xs"
                  variant="quiet"
                  onClick={() => {
                    api.reset()
                    onClose()
                  }}
                >
                  Reset the example inbox
                </Button>
              </div>
            </div>
          </Section>
        )}
      </div>
    </Sheet>
  )
}

const KEYS = [
  ['C', 'Write a new email'],
  ['/', 'Search'],
  ['J or K', 'Older or newer conversation'],
  ['E', 'Archive'],
  ['#', 'Move to Trash'],
  ['S', 'Star or unstar'],
  ['R', 'Reply'],
  ['A', 'Reply all'],
  ['F', 'Forward'],
  ['Shift + I', 'Mark as read'],
  ['Shift + U', 'Mark as unread'],
  ['G then I', 'Go to Inbox'],
  ['G then S', 'Go to Starred'],
  ['G then T', 'Go to Sent'],
  ['G then D', 'Go to Drafts'],
  ['Esc', 'Close the conversation'],
  ['Ctrl or Cmd + Enter', 'Send, while writing'],
]

export function ShortcutsSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} kicker="Mail" title="Keyboard shortcuts" variant="dialog" width={520}>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2.5 text-[14.5px]">
        {KEYS.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="flex flex-wrap items-center gap-1">
              {k.split(/ (then|or|\+) /).map((part, i) =>
                part === 'then' || part === 'or' || part === '+' ? (
                  <span key={i} className="text-[12px] text-faint">
                    {part}
                  </span>
                ) : (
                  <Kbd key={i}>{part}</Kbd>
                ),
              )}
            </dt>
            <dd className="text-mute">{v}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  )
}

// Full-screen viewer for image attachments, with arrows between them
export function Lightbox({ open, message, files, start, onClose }) {
  const { actions } = useMail()
  const images = (files || []).filter((f) => f.mimeType.startsWith('image/'))
  const [index, setIndex] = useState(0)
  const [url, setUrl] = useState(null)
  useLockBody(open)
  useEscape(onClose, open)
  useEffect(() => {
    if (open) setIndex(Math.max(0, images.findIndex((f) => f === start || f.id === start?.id)))
  }, [open, start]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = images[index]
  useEffect(() => {
    if (!open || !current) return
    let live = true
    setUrl(null)
    actions.attachmentUrl(message.id, current).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [open, current, message, actions])
  useEffect(() => {
    if (!open) return
    const on = (e) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(images.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [open, images.length])

  return createPortal(
    <AnimatePresence>
      {open && current && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[96] flex flex-col bg-[#03050a]/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={current.filename}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium text-bone">{current.filename}</p>
              <p className="text-[12.5px] text-faint">
                {fileSize(current.size)}
                {images.length > 1 ? ` · ${index + 1} of ${images.length}` : ''}
              </p>
            </div>
            <Button size="xs" onClick={() => actions.download(message.id, current)}>
              <Download size={15} /> Download
            </Button>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-mute hover:bg-white/[0.08] hover:text-bone">
              <X size={20} />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6" onClick={onClose}>
            {url ? (
              <motion.img key={url} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} src={url} alt={current.filename} className="max-h-full max-w-full rounded-[10px] object-contain shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]" onClick={(e) => e.stopPropagation()} />
            ) : (
              <Spinner size={22} className="text-mute" />
            )}
            {images.length > 1 && (
              <>
                <button type="button" aria-label="Previous image" disabled={index === 0} onClick={(e) => (e.stopPropagation(), setIndex((i) => i - 1))} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/[0.08] text-bone disabled:opacity-30">
                  <ChevronLeft size={20} />
                </button>
                <button type="button" aria-label="Next image" disabled={index === images.length - 1} onClick={(e) => (e.stopPropagation(), setIndex((i) => i + 1))} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/[0.08] text-bone disabled:opacity-30">
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
