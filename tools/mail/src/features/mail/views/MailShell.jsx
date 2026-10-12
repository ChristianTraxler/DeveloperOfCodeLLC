// The Mail tool's layout and routes. Phones: a list, with conversations opening over it.
// Tablets: list and conversation side by side. Desktop: folders, list and conversation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FolderOpen, PenLine, Search } from 'lucide-react'
import { useMail } from '../state/MailContext.jsx'
import { buildRoute, parseRoute, queryFor, viewKey } from '../state/views.js'
import { useSettings } from '../state/settings.js'
import { useDesktop, useFinePointer, useTablet, isTyping, useNow } from '../ui/hooks.js'
import { useToast } from '../ui/Toast.jsx'
import { Button, Kbd, Monogram, Spinner, cx } from '../ui/core.jsx'
import { Sheet } from '../ui/Sheet.jsx'
import { draftFor } from '../lib/compose.js'
import { nameOf, stamp } from '../lib/format.js'
import { uniqueAddresses } from '../lib/address.js'
import { Rail } from './Rail.jsx'
import { ListPane } from './ListPane.jsx'
import { Reader } from './Reader.jsx'
import { Composer } from './Composer.jsx'
import { ConnectScreen } from './ConnectScreen.jsx'
import { Lightbox, SettingsSheet, ShortcutsSheet } from './Sheets.jsx'

const LINK_ERRORS = {
  denied: 'Linking was cancelled on the Google screen.',
  scope: 'Gmail access was not granted. Link again and leave the Gmail box checked.',
  refresh: "Google didn't send a long-term key. Remove the app's access in your Google account, then link again.",
  taken: 'That Gmail is already linked to another admin login.',
  expired: 'The sign-in took too long. Link again.',
}

const personal = (t) => t.labels.includes('CATEGORY_PERSONAL') || !t.labels.some((l) => l.startsWith('CATEGORY_'))

// What shows on the right before you open anything: today's date and who is waiting on you
function Desk({ onOpen }) {
  const { threads, lists } = useMail()
  const now = useNow(60_000)
  const inbox = lists[viewKey({ labelId: 'INBOX', q: '' })]
  const unread = (inbox?.ids || []).map((id) => threads[id]).filter((t) => t?.unread)
  const waiting = unread.filter(personal)
  const d = new Date(now)
  return (
    <div className="ml-desk flex h-full flex-col items-center justify-center overflow-y-auto px-8 py-12">
      <div className="w-full max-w-[460px]">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-[#ff9a6e]">{d.toLocaleDateString('en-US', { weekday: 'long' })}</p>
        <h2 className="display mt-2 text-[60px] leading-[0.95]">{d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</h2>
        <p className="mt-4 text-[15px] text-mute">
          {!inbox?.loaded ? 'Opening your inbox.' : unread.length ? `${unread.length} unread in your inbox${waiting.length ? `, ${waiting.length} from people` : ''}.` : "You're all caught up."}
        </p>
        {waiting.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">Waiting on you</p>
            <ul className="space-y-2.5">
              {waiting.slice(0, 3).map((t, i) => (
                <motion.li key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i, duration: 0.45 }}>
                  <button type="button" onClick={() => onOpen(t.id)} className="ml-fold flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left transition-transform duration-200 hover:-translate-y-px">
                    <Monogram address={t.from} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink2">{nameOf(t.from)}</span>
                      <span className="block truncate text-[13px] text-slate">{t.subject}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-slate">{stamp(t.date, now)}</span>
                  </button>
                </motion.li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-10 text-[13px] text-faint">
          Pick a conversation to read it. Press <Kbd>?</Kbd> for keyboard shortcuts.
        </p>
      </div>
    </div>
  )
}

export function MailShell({ path = '', navigate }) {
  const mail = useMail()
  const { phase, error, lists, threads, details, labels, account, actions, api } = mail
  const [settings] = useSettings()
  const toast = useToast()
  const desktop = useDesktop()
  const paned = useTablet()
  const fine = useFinePointer()
  const touch = !fine

  const { view, threadId, params } = useMemo(() => parseRoute(path), [path])
  const [filter, setFilter] = useState(null)
  const [compose, setCompose] = useState(null)
  const [inlineReply, setInlineReply] = useState(null)
  const [folders, setFolders] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const listScroll = useRef(null)
  const gPressed = useRef(0)

  const q = queryFor(view, filter)
  const key = viewKey({ labelId: view.labelId, q })
  const list = lists[key]
  const ids = list?.ids || []

  const go = useCallback((v, t = null) => navigate(buildRoute(v, t)), [navigate])
  const openThread = useCallback((id) => go(view, id), [go, view])
  const closeThread = useCallback(() => go(view, null), [go, view])

  // Tell the store what is on screen, and let toasts open conversations
  useEffect(() => actions.setActive(view, filter ? queryFor({ q: '' }, filter) : null, threadId), [actions, view, filter, threadId])
  useEffect(() => actions.setOpener((id) => navigate(buildRoute({ labelId: 'INBOX', q: '' }, id))), [actions, navigate])

  // Toasts live outside the mail layout, so they learn how much room the phone's bottom bar takes from the root
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--ml-toast-offset', paned ? '20px' : '92px')
    return () => root.style.removeProperty('--ml-toast-offset')
  }, [paned])

  // Clear the quick filter when the folder changes
  const viewId = `${view.labelId}|${view.q}`
  useEffect(() => setFilter(null), [viewId])
  useEffect(() => setInlineReply(null), [threadId])

  // Load the list for this view (again if it went stale)
  useEffect(() => {
    if (phase !== 'ready') return
    if (!list || list.stale || (!list.loaded && !list.loading && !list.error)) actions.loadList(view, q)
  }, [phase, key, list?.stale]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the inbox loaded for the desk summary and the tile
  useEffect(() => {
    if (phase === 'ready' && !lists[viewKey({ labelId: 'INBOX', q: '' })]) actions.loadList({ labelId: 'INBOX', q: '' }, '')
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Result of linking Gmail, passed back in the address after Google's screen
  useEffect(() => {
    const result = params.get('mail')
    if (!result) return
    if (result === 'linked') {
      toast(params.get('push') === 'failed' ? 'Gmail linked. Live updates need a look in the setup guide.' : 'Gmail linked')
      actions.retry()
    } else if (result === 'error') {
      toast(LINK_ERRORS[params.get('reason')] || 'Linking Gmail did not finish. Try again.', { tone: 'warn' })
    }
    navigate(buildRoute(view, threadId))
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  // When the open conversation leaves this list (archived, trashed), open the next one
  const prevIds = useRef(ids)
  useEffect(() => {
    const before = prevIds.current
    prevIds.current = ids
    if (!paned || !threadId || ids.includes(threadId) || !before.includes(threadId)) return
    const at = before.indexOf(threadId)
    const next = before.slice(at + 1).find((id) => ids.includes(id)) || before.slice(0, at).reverse().find((id) => ids.includes(id))
    if (next) openThread(next)
    else closeThread()
  }, [ids, threadId, paned, openThread, closeThread])

  // Unread count in the browser tab
  const inboxUnread = labels.system?.find((l) => l.id === 'INBOX')?.unread || 0
  useEffect(() => {
    const before = document.title
    document.title = inboxUnread ? `(${inboxUnread}) Mail` : 'Mail'
    return () => {
      document.title = before
    }
  }, [inboxUnread])

  // People you've written with, for the To field
  const contacts = useMemo(() => {
    const self = [account?.email, ...(account?.sendAs || []).map((s) => s.email)].filter(Boolean)
    const all = []
    for (const t of Object.values(threads)) {
      if (t.from) all.push(t.from)
      for (const a of t.to || []) all.push(a)
      for (const p of t.people || []) all.push(p)
    }
    for (const d of Object.values(details)) for (const m of d.data?.messages || []) all.push(m.from, ...(m.to || []), ...(m.cc || []))
    return uniqueAddresses(all.filter(Boolean).filter((a) => !/no-?reply|notify|alerts|reports|forms|backups|news@/i.test(a.email)), self)
  }, [threads, details, account])

  const openCompose = useCallback((init) => setCompose({ key: Date.now(), init: { mode: 'new', to: [], cc: [], bcc: [], subject: '', html: '', ...init } }), [])

  const onMailto = useCallback(
    ({ to, subject, body }) => openCompose({ to, subject, html: (body || '').replace(/[<>&]/g, '').replace(/\n/g, '<br>') }),
    [openCompose],
  )

  // ---------- Keyboard ----------
  const at = ids.indexOf(threadId)
  const prevId = at > 0 ? ids[at - 1] : null
  const nextId = at >= 0 && at < ids.length - 1 ? ids[at + 1] : null

  useEffect(() => {
    if (!settings.shortcuts || phase !== 'ready') return
    const on = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      const k = e.key
      const gWindow = Date.now() - gPressed.current < 900
      if (gWindow) {
        const target = { i: 'INBOX', s: 'STARRED', t: 'SENT', d: 'DRAFT', a: 'ALL' }[k.toLowerCase()]
        gPressed.current = 0
        if (target) {
          e.preventDefault()
          go({ labelId: target, q: '' })
          return
        }
      }
      const current = threadId && threads[threadId]
      const lastOf = () => details[threadId]?.data?.messages?.filter((m) => !m.draft).pop()
      const replyWith = (mode) => {
        const m = lastOf()
        if (!m) return
        const init = { ...draftFor(mode, m, { id: threadId, subject: details[threadId]?.data?.subject }, [account?.email, ...(account?.sendAs || []).map((s) => s.email)]), html: '' }
        if (paned) setInlineReply({ key: `${mode}-${Date.now()}`, init })
        else openCompose(init)
      }
      switch (k) {
        case 'g':
          gPressed.current = Date.now()
          return
        case 'c':
          e.preventDefault()
          openCompose({})
          return
        case '/':
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('doc-mail', { detail: 'focus-search' }))
          return
        case '?':
          e.preventDefault()
          setKeysOpen(true)
          return
        case 'j':
          e.preventDefault()
          if (!threadId && ids[0]) openThread(ids[0])
          else if (nextId) openThread(nextId)
          return
        case 'k':
          e.preventDefault()
          if (prevId) openThread(prevId)
          return
        case 'Escape':
          if (threadId) {
            e.preventDefault()
            closeThread()
          }
          return
        default:
      }
      if (!current) return
      switch (k) {
        case 'e':
          e.preventDefault()
          if (view.labelId === 'TRASH') actions.untrash([threadId])
          else if (!current.labels.includes('INBOX')) actions.toInbox([threadId])
          else actions.archive([threadId])
          break
        case '#':
          e.preventDefault()
          actions.trash([threadId])
          break
        case 's':
          e.preventDefault()
          actions.star([threadId], !current.starred)
          break
        case 'I':
          e.preventDefault()
          actions.markRead([threadId], true)
          break
        case 'U':
          e.preventDefault()
          actions.markRead([threadId], false)
          break
        case 'r':
          e.preventDefault()
          replyWith('reply')
          break
        case 'a':
          e.preventDefault()
          replyWith('replyAll')
          break
        case 'f':
          e.preventDefault()
          replyWith('forward')
          break
        default:
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [settings.shortcuts, phase, threadId, threads, details, ids, prevId, nextId, view, paned, account, go, openThread, closeThread, openCompose, actions])

  // ---------- States before the inbox ----------

  if (phase === 'loading') {
    return (
      <div className="grid min-h-[60vh] place-items-center text-mute">
        <span className="flex items-center gap-3 text-[15px]">
          <Spinner /> Opening Mail
        </span>
      </div>
    )
  }
  if (phase === 'unlinked' || phase === 'reauth') return <ConnectScreen />
  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-[520px] px-6 py-24 text-center">
        <p className="display text-[34px] leading-tight">Mail couldn't open.</p>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">{error}</p>
        <Button className="mt-6" onClick={() => actions.retry()}>
          Try again
        </Button>
      </div>
    )
  }

  // ---------- The inbox ----------

  const rail = (
    <Rail
      view={view}
      onPick={(v) => {
        setFolders(false)
        go(v)
      }}
      onCompose={() => {
        setFolders(false)
        openCompose({})
      }}
      onSettings={() => {
        setFolders(false)
        setSettingsOpen(true)
      }}
      onShortcuts={fine ? () => setKeysOpen(true) : null}
      className="h-full"
    />
  )

  const listPane = (
    <ListPane
      view={view}
      filter={filter}
      setFilter={setFilter}
      q={q}
      selectedId={paned ? threadId : null}
      onOpen={openThread}
      onSearch={(text) => (text ? go({ labelId: '', q: text }) : go({ labelId: 'INBOX', q: '' }))}
      onOpenFolders={() => setFolders(true)}
      paned={paned}
      railVisible={desktop}
      touch={touch}
      scrollRef={listScroll}
      onReconnect={() => actions.link()}
    />
  )

  const reader = threadId ? (
    <Reader
      key={threadId}
      threadId={threadId}
      view={view}
      desktop={paned}
      onClose={closeThread}
      onPrev={prevId ? () => openThread(prevId) : null}
      onNext={nextId ? () => openThread(nextId) : null}
      onCompose={openCompose}
      onMailto={onMailto}
      onOpenImage={(message, att, files) => setLightbox({ message, att, files })}
      contacts={contacts}
      inlineReply={inlineReply}
      setInlineReply={setInlineReply}
    />
  ) : null

  return (
    <div className="ml-root">
      {paned ? (
        <div className="grid border-t border-line" style={{ height: 'calc(100dvh - var(--ml-top, 64px) - env(safe-area-inset-top, 0px))', gridTemplateColumns: desktop ? '244px minmax(330px, 400px) minmax(0, 1fr)' : 'minmax(300px, 380px) minmax(0, 1fr)' }}>
          {desktop && <aside className="min-h-0 border-r border-line px-3 py-5">{rail}</aside>}
          <div className="min-h-0 border-r border-line bg-[#0a0f1a]">{listPane}</div>
          <div className="min-h-0 bg-[#0a0f1c]">{reader || <Desk onOpen={openThread} />}</div>
        </div>
      ) : (
        <>
          <div className="pb-28">{listPane}</div>
          <AnimatePresence>
            {threadId && (
              <motion.div
                key="reader"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.34, ease: [0.2, 0.7, 0.2, 1] }}
                className="ml-desk fixed inset-0 z-40 overflow-y-auto overscroll-contain"
              >
                {reader}
              </motion.div>
            )}
          </AnimatePresence>
          {!threadId && (
            <nav aria-label="Mail actions" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[#070a12]/[0.97] px-4 pt-2.5 backdrop-blur-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
              <div className="mx-auto flex max-w-[560px] items-center gap-2">
                <button type="button" onClick={() => setFolders(true)} className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11.5px] font-medium text-mute active:bg-white/[0.06]">
                  <FolderOpen size={19} /> Folders
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                    window.dispatchEvent(new CustomEvent('doc-mail', { detail: 'focus-search' }))
                  }}
                  className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11.5px] font-medium text-mute active:bg-white/[0.06]"
                >
                  <Search size={19} /> Search
                </button>
                <button type="button" onClick={() => openCompose({})} className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full bg-ember text-[15px] font-semibold text-[#1c0a02] shadow-[0_12px_30px_-12px_rgba(255,90,31,0.7)] active:scale-[0.98]">
                  <PenLine size={18} strokeWidth={2.2} /> Write
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      {!desktop && (
        <Sheet open={folders} onClose={() => setFolders(false)} kicker={api.mode === 'demo' ? 'Example inbox' : account?.email} title="Folders">
          {rail}
        </Sheet>
      )}

      <AnimatePresence>
        {compose && (
          <Composer
            key={compose.key}
            init={compose.init}
            layout={paned ? 'dock' : 'sheet'}
            contacts={contacts}
            onClose={() => setCompose(null)}
            onReopen={(init) => setCompose({ key: Date.now(), init })}
          />
        )}
      </AnimatePresence>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ShortcutsSheet open={keysOpen} onClose={() => setKeysOpen(false)} />
      <Lightbox open={!!lightbox} message={lightbox?.message} files={lightbox?.files} start={lightbox?.att} onClose={() => setLightbox(null)} />
    </div>
  )
}
