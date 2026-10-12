// The list of conversations: header, search, quick filters, day groups and bulk actions.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, ArrowUp, BookmarkCheck, BookmarkPlus, Clock3, Mail, MailOpen, Menu as MenuIcon, RefreshCw, Search, Star, Trash2, X } from 'lucide-react'
import { useMail } from '../state/MailContext.jsx'
import { FILTERS, folderName, viewKey } from '../state/views.js'
import { rememberSearch, useSettings } from '../state/settings.js'
import { dayGroup, plural } from '../lib/format.js'
import { useNow } from '../ui/hooks.js'
import { Button, ExampleTag, IconButton, Spinner, cx } from '../ui/core.jsx'
import { ThreadRow } from './ThreadRow.jsx'
import { LiveChip } from './LiveChip.jsx'

const HINTS = ['from:', 'has:attachment', 'is:unread', 'label:', 'subject:']

function SearchBox({ value, onSearch, autoFocusKey }) {
  const [text, setText] = useState(value || '')
  const [focus, setFocus] = useState(false)
  const [settings] = useSettings()
  const input = useRef(null)
  useEffect(() => setText(value || ''), [value])
  useEffect(() => {
    const on = (e) => {
      if (e.detail === 'focus-search') input.current?.focus()
    }
    window.addEventListener('doc-mail', on)
    return () => window.removeEventListener('doc-mail', on)
  }, [])
  useEffect(() => {
    if (autoFocusKey) input.current?.focus()
  }, [autoFocusKey])

  const submit = (q) => {
    const clean = q.trim()
    if (clean) rememberSearch(clean)
    onSearch(clean)
    input.current?.blur()
  }
  const recent = settings.recent || []
  return (
    <div className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
        className="relative"
      >
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <label htmlFor="ml-search" className="sr-only">
          Search mail
        </label>
        <input
          ref={input}
          id="ml-search"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          placeholder="Search mail"
          autoComplete="off"
          enterKeyHint="search"
          className="h-11 w-full rounded-full border border-line2 bg-black/30 pl-11 pr-11 text-[15.5px] text-bone placeholder:text-faint focus:border-ember/70 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-ember/10 [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setText('')
              if (value) onSearch('')
              input.current?.focus()
            }}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-mute hover:bg-white/[0.08] hover:text-bone"
          >
            <X size={16} />
          </button>
        )}
      </form>
      <AnimatePresence>
        {focus && !text && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute inset-x-0 top-[calc(100%+8px)] z-30 rounded-[18px] border border-line2 bg-raised/[0.98] p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            {recent.length > 0 && (
              <ul className="mb-1">
                {recent.map((r) => (
                  <li key={r}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(r)} className="flex h-10 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[14px] text-bone hover:bg-white/[0.06]">
                      <Clock3 size={15} className="text-faint" />
                      <span className="truncate">{r}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5 px-2 pb-1.5 pt-1">
              {HINTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setText(h)
                    input.current?.focus()
                  }}
                  className="h-7 rounded-full border border-line px-2.5 text-[12.5px] font-medium text-mute hover:border-ember/40 hover:text-bone"
                >
                  {h}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Skeleton() {
  return (
    <ul className="space-y-1 px-1" aria-label="Loading mail">
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="flex gap-3.5 px-3 py-4" style={{ opacity: 1 - i * 0.11 }}>
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
          <span className="flex-1 space-y-2.5 pt-1">
            <span className="block h-3 w-1/3 animate-pulse rounded-full bg-white/[0.08]" />
            <span className="block h-3 w-3/4 animate-pulse rounded-full bg-white/[0.06]" />
            <span className="block h-3 w-1/2 animate-pulse rounded-full bg-white/[0.045]" />
          </span>
        </li>
      ))}
    </ul>
  )
}

function EmptyState({ view, q }) {
  const title = q ? 'Nothing matches that search.' : view.labelId === 'INBOX' ? 'Nothing waiting.' : 'No mail here.'
  const text = q
    ? 'Try fewer words, or search all mail with in:anywhere.'
    : view.labelId === 'INBOX'
      ? 'New mail shows up here the moment it lands in Gmail.'
      : view.labelId === 'DRAFT'
        ? 'Drafts you start here or in Gmail show up in this folder.'
        : 'Conversations land here as you file them.'
  return (
    <div className="px-6 py-20 text-center">
      <p className="display text-[30px] italic leading-tight text-bone/90">{title}</p>
      <p className="mx-auto mt-3 max-w-[34ch] text-[14.5px] leading-relaxed text-mute">{text}</p>
    </div>
  )
}

export function ListPane({ view, filter, setFilter, q, selectedId, onOpen, onSearch, onOpenFolders, paned, railVisible, touch, scrollRef, onReconnect }) {
  const desktop = paned
  const { lists, threads, labels, fresh, phase, actions, api } = useMail()
  const [settings, update] = useSettings()
  const now = useNow(60_000)
  const key = viewKey({ labelId: view.labelId, q })
  const list = lists[key]
  const ids = list?.ids || []
  const [checked, setChecked] = useState(() => new Set())
  const [scrolled, setScrolled] = useState(false)
  const sentinel = useRef(null)
  const ownScroll = useRef(null)
  const scroller = scrollRef || ownScroll

  const labelsById = useMemo(() => Object.fromEntries((labels.user || []).map((l) => [l.id, l])), [labels.user])
  const inbox = labels.system?.find((l) => l.id === 'INBOX')
  const title = view.q ? 'Search' : folderName(view.labelId, labels)
  const unreadHere = view.q ? 0 : view.labelId === 'INBOX' ? inbox?.unread || 0 : labels.user?.find((l) => l.id === view.labelId)?.unread || 0

  useEffect(() => setChecked(new Set()), [key])

  // A different folder or search starts at the top, the way a new page would
  const shownKey = useRef(key)
  useEffect(() => {
    if (shownKey.current === key) return
    shownKey.current = key
    if (desktop) scroller.current?.scrollTo({ top: 0 })
    else window.scrollTo({ top: 0 })
  }, [key, desktop, scroller])

  // Load more when the end of the list comes into view
  useEffect(() => {
    const el = sentinel.current
    if (!el || !list?.next) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) actions.loadMore(view, q)
      },
      { root: desktop ? scroller.current : null, rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [list?.next, actions, view, q, desktop, scroller])

  // Track scrolling, to offer a jump back up when new mail arrives
  useEffect(() => {
    const el = desktop ? scroller.current : window
    if (!el) return
    const on = () => setScrolled((desktop ? scroller.current.scrollTop : window.scrollY) > 220)
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [desktop, scroller])

  const groups = useMemo(() => {
    const out = []
    for (const id of ids) {
      const t = threads[id]
      if (!t) continue
      const g = dayGroup(t.date, now)
      if (!out.length || out[out.length - 1].key !== g.key) out.push({ ...g, items: [] })
      out[out.length - 1].items.push(t)
    }
    return out
  }, [ids, threads, now])

  const freshHere = ids.filter((id) => fresh[id]).length
  const selecting = checked.size > 0
  const toggleCheck = (id, force) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (force === true) next.add(id)
      else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const bulk = (fn) => {
    const sel = [...checked]
    setChecked(new Set())
    fn(sel)
  }
  const toTop = () => (desktop ? scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }) : window.scrollTo({ top: 0, behavior: 'smooth' }))

  const isSaved = view.q && (settings.saved || []).some((s) => s.q === view.q)
  const anyUnreadChecked = [...checked].some((id) => threads[id]?.unread)

  return (
    <section aria-label={`${title} list`} className={cx('relative flex min-w-0 flex-col', desktop && 'h-full')}>
      <header className={cx('shrink-0 px-4 sm:px-5', desktop ? 'pb-3 pt-5' : 'pb-3 pt-6')}>
        {desktop ? (
          <div className="flex items-center gap-3">
            {!railVisible && (
              <IconButton label="Folders and labels" onClick={onOpenFolders} variant="ghost" size={38}>
                <MenuIcon size={17} />
              </IconButton>
            )}
            <h1 className="display min-w-0 truncate text-[34px] leading-[1.05]">{title}</h1>
            {unreadHere > 0 && <span className="shrink-0 pt-2 text-[13.5px] font-medium tabular-nums text-[#ff9a6e]">{unreadHere} unread</span>}
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <LiveChip />
              <IconButton label="Check for new mail" onClick={() => actions.syncNow()} size={34}>
                <RefreshCw size={15} />
              </IconButton>
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <IconButton label="Folders and labels" onClick={onOpenFolders} variant="ghost" size={40}>
                <MenuIcon size={18} />
              </IconButton>
              <span className="flex items-center gap-1.5">
                {api.mode === 'demo' && <ExampleTag />}
                <LiveChip />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <h1 className="display min-w-0 truncate text-[46px] leading-[0.95]">{title}</h1>
              {unreadHere > 0 && <span className="shrink-0 text-[14px] font-medium tabular-nums text-[#ff9a6e]">{unreadHere} unread</span>}
            </div>
          </>
        )}
        {view.q && (
          <div className="mt-1.5 flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-[14px] text-mute">Results for “{view.q}”</p>
            {isSaved ? (
              <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-faint">
                <BookmarkCheck size={15} /> Saved
              </span>
            ) : (
              <button
                type="button"
                onClick={() => update((s) => ({ saved: [...(s.saved || []), { id: `s${Date.now().toString(36)}`, name: view.q.length > 26 ? `${view.q.slice(0, 26)}…` : view.q, q: view.q }] }))}
                className="-my-1 -mr-2 flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-[#ff9a6e] hover:bg-ember/10"
              >
                <BookmarkPlus size={15} /> Save search
              </button>
            )}
          </div>
        )}

        <div className="mt-4">
          <SearchBox value={view.q} onSearch={onSearch} />
        </div>

        <div className="ml-noscrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          {FILTERS.map((f) => {
            const on = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(on ? null : f.id)}
                className={cx(
                  'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
                  on ? 'border-bone bg-bone text-ink' : 'border-line2 text-mute hover:border-white/30 hover:text-bone',
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </header>

      {phase === 'reauth' && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-[16px] border border-ember/35 bg-ember/[0.08] p-3.5 sm:mx-5">
          <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-bone">Google asked you to link Gmail again before new mail can load.</p>
          <Button variant="ember" size="xs" onClick={onReconnect}>
            Link again
          </Button>
        </div>
      )}

      <AnimatePresence>
        {selecting && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cx('z-20 mx-3 mb-2 flex items-center gap-1 rounded-full border border-ember/35 bg-raised/95 p-1 pl-4 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:mx-4', !desktop && 'sticky')}
            style={!desktop ? { top: 'calc(env(safe-area-inset-top, 0px) + var(--ml-top, 64px) + 8px)' } : undefined}
          >
            <span className="mr-auto text-[14px] font-semibold tabular-nums">{checked.size} selected</span>
            {view.labelId === 'TRASH' ? (
              <IconButton label="Restore" size={36} onClick={() => bulk((s) => actions.untrash(s))}>
                <ArrowUp size={17} />
              </IconButton>
            ) : (
              <>
                <IconButton label="Archive" size={36} onClick={() => bulk((s) => actions.archive(s))}>
                  <Archive size={17} />
                </IconButton>
                <IconButton label="Move to Trash" size={36} onClick={() => bulk((s) => actions.trash(s))}>
                  <Trash2 size={17} />
                </IconButton>
              </>
            )}
            <IconButton label={anyUnreadChecked ? 'Mark as read' : 'Mark as unread'} size={36} onClick={() => bulk((s) => actions.markRead(s, anyUnreadChecked))}>
              {anyUnreadChecked ? <MailOpen size={17} /> : <Mail size={17} />}
            </IconButton>
            <IconButton label="Star" size={36} onClick={() => bulk((s) => actions.star(s, true))}>
              <Star size={17} />
            </IconButton>
            <IconButton label="Clear selection" size={36} onClick={() => setChecked(new Set())}>
              <X size={17} />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={desktop ? scroller : ownScroll} className={cx(desktop && 'ml-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain', 'relative px-2 pb-6 sm:px-3')}>
        <AnimatePresence>
          {freshHere > 0 && scrolled && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={toTop}
              className={cx('left-1/2 z-30 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full bg-ember px-4 text-[13.5px] font-semibold text-[#1c0a02] shadow-[0_12px_30px_-10px_rgba(255,90,31,0.6)]', desktop ? 'sticky top-3' : 'fixed')}
              style={!desktop ? { top: 'calc(env(safe-area-inset-top, 0px) + var(--ml-top, 64px) + 12px)' } : undefined}
            >
              <ArrowUp size={15} strokeWidth={2.6} /> {plural(freshHere, 'new message', 'new messages')}
            </motion.button>
          )}
        </AnimatePresence>

        {!list?.loaded && list?.error ? (
          <div className="px-5 py-16 text-center">
            <p className="text-[15px] text-bone">{list.error}</p>
            <Button className="mt-4" onClick={() => actions.loadList(view, q)}>
              Try again
            </Button>
          </div>
        ) : !list?.loaded ? (
          <Skeleton />
        ) : !ids.length ? (
          <EmptyState view={view} q={q} />
        ) : (
          <div aria-label="Conversations">
            {groups.map((g) => (
              <section key={g.key} aria-label={g.label}>
                <h3
                  className={cx(
                    'z-10 flex items-center gap-3 px-3.5 pb-1.5 pt-4 sm:px-4',
                    desktop ? 'sticky top-0 bg-[linear-gradient(to_bottom,#0a0f1a_calc(100%-7px),rgba(10,15,26,0))]' : '',
                  )}
                >
                  <span className="font-display text-[16px] font-normal italic text-bone/85">{g.label}</span>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </h3>
                <ul>
                <AnimatePresence initial={false}>
                  {g.items.map((t) => (
                    <motion.li
                      key={t.id}
                      layout="position"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}
                      transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
                      className="list-none overflow-hidden"
                    >
                      <ThreadRow
                        thread={t}
                        labelId={view.q ? '' : view.labelId}
                        selected={selectedId === t.id}
                        checked={checked.has(t.id)}
                        selecting={selecting}
                        fresh={!!fresh[t.id]}
                        touch={touch}
                        now={now}
                        labelsById={labelsById}
                        onOpen={onOpen}
                        onCheck={toggleCheck}
                        onArchive={(id) => actions.archive([id])}
                        onTrash={(id) => actions.trash([id])}
                        onRestore={(id) => (view.labelId === 'TRASH' ? actions.untrash([id]) : actions.toInbox([id]))}
                        onToggleRead={(id, unread) => actions.markRead([id], unread)}
                        onToggleStar={(id, on) => actions.star([id], on)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
                </ul>
              </section>
            ))}
          </div>
        )}

        {list?.loaded && list?.next && (
          <div ref={sentinel} className="flex justify-center py-6 text-faint">
            {list.more ? <Spinner /> : <span className="text-[13px]">Loading more</span>}
          </div>
        )}
        {list?.loaded && !list?.next && ids.length > 8 && <p className="py-8 text-center text-[13px] text-faint">That's everything in {title.toLowerCase()}.</p>}
      </div>
      {desktop && !railVisible && api.mode === 'demo' && (
        <div className="flex shrink-0 items-center gap-2.5 border-t border-line px-4 py-2.5 sm:px-5">
          <ExampleTag />
          <span className="min-w-0 truncate text-[12.5px] text-faint">Every email here is made up.</span>
        </div>
      )}
    </section>
  )
}
