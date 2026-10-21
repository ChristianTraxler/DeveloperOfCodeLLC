import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Columns3, List, Search, X } from 'lucide-react'
import { QueueProvider, blankPost, newId, useQueue } from './data/QueueContext'
import { PLATFORMS, PLATFORM_BY_ID, STATUSES, STATUS_BY_ID } from './lib/platforms'
import { addDays, at, longDate, relative, when } from './lib/dates'
import { ToastProvider, useToast, Dialog } from './components/overlay'
import { PlatformMark, StatusGlyph } from './components/marks'
import QuickAdd from './components/QuickAdd'
import Runway from './components/Runway'
import Board from './components/Board'
import ListView from './components/ListView'
import Composer from './components/Composer'
import ScrollTop from './components/ScrollTop'
import { MarkPostedDialog, PromoteDialog } from './components/ActionDialogs'
import { BusinessesDialog } from './components/Businesses'

/**
 * Content Queue for the DOC Admin Hub.
 * Drop it on a route: <ContentQueue />. It brings its own data provider and toasts.
 */
export default function ContentQueue() {
  return (
    <QueueProvider>
      <ToastProvider>
        <Queue />
      </ToastProvider>
    </QueueProvider>
  )
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

function Queue() {
  const { posts, accounts, accountById, prefs, setPrefs, add, update, remove, restore, resetToSamples, clearAll, allTags } = useQueue()
  const toast = useToast()
  const now = useNow()

  const [composer, setComposer] = useState(null) // { initial, isNew, focus, notice }
  const [postedFor, setPostedFor] = useState(null)
  const [promoteFor, setPromoteFor] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'reset' | 'clear'
  const [businessesOpen, setBusinessesOpen] = useState(false)

  const { view, filters, sort } = prefs
  const setFilter = (k, v) => setPrefs({ filters: { ...filters, [k]: v } })
  const clearFilters = () => setPrefs({ filters: { platform: '', status: '', tag: '', account: '', q: '' } })

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return posts.filter((p) => {
      if (filters.platform && p.platform !== filters.platform) return false
      if (filters.account && p.account !== filters.account) return false
      if (filters.tag && !(p.tags || []).includes(filters.tag)) return false
      if (view === 'list' && filters.status && p.status !== filters.status) return false
      if (q && !`${p.title} ${p.body} ${p.notes} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [posts, filters, view])

  const activeFilters = ['account', 'platform', 'tag', ...(view === 'list' ? ['status'] : []), 'q'].filter((k) => filters[k])

  /* ----- actions ----- */

  const openPost = useCallback(
    (id, extra = {}) => {
      const post = posts.find((p) => p.id === id)
      if (post) setComposer({ initial: post, isNew: false, ...extra })
    },
    [posts],
  )

  const newPost = (overrides = {}, extra = {}) => setComposer({ initial: blankPost(overrides), isNew: true, ...extra })

  const exists = (id) => posts.some((p) => p.id === id)

  const moveTo = (post, status) => {
    if (status === post.status) return
    if (status === 'posted') return setPostedFor(post)
    if (status === 'scheduled') {
      const missing = !post.platform ? 'platform' : !post.scheduledAt || new Date(post.scheduledAt) < now ? 'schedule' : null
      if (missing) {
        return setComposer({
          initial: { ...post, status: 'scheduled' },
          isNew: false,
          focus: missing,
          notice: missing === 'platform' ? 'Pick a platform and a time, then save to schedule this post.' : 'Pick a time in the future, then save to schedule this post.',
        })
      }
    }
    const prev = post.status
    update(post.id, { status })
    toast(`Moved to ${STATUS_BY_ID[status].label}`, { action: { label: 'Undo', run: () => update(post.id, { status: prev }) } })
  }

  const deletePost = (post) => {
    remove(post.id)
    toast(`Deleted "${post.title || 'Untitled post'}"`, { action: { label: 'Undo', run: () => restore(post) }, duration: 6500 })
  }

  const onAction = (type, post, extra) => {
    if (type === 'edit') openPost(post.id)
    else if (type === 'posted') setPostedFor(post)
    else if (type === 'promote') setPromoteFor(post)
    else if (type === 'move') moveTo(post, extra)
    else if (type === 'delete') deletePost(post)
    else if (type === 'duplicate') {
      const stamp = new Date().toISOString()
      const copy = { ...post, id: newId(), title: `${post.title || 'Untitled post'} (copy)`, status: 'drafting', scheduledAt: null, liveUrl: '', postedAt: null, promo: null, sample: false, createdAt: stamp, updatedAt: stamp }
      add(copy)
      toast('Copied as a new draft', { action: { label: 'Open', run: () => setComposer({ initial: copy, isNew: false }) } })
    }
  }

  // Saving from the composer never overwrites a promotion saved meanwhile.
  const saveFromComposer = (clean, { close = true, quiet = false } = {}) => {
    const { promo, ...rest } = clean
    if (exists(clean.id)) update(clean.id, rest)
    else add({ ...clean, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    if (close) setComposer(null)
    if (!quiet) toast(composer?.isNew ? (clean.status === 'idea' ? 'Idea added to the queue' : 'Added to the queue') : 'Changes saved')
  }

  const confirmPosted = (post, fields) => {
    const patch = { ...fields, status: 'posted' }
    const fromComposer = composer && composer.initial.id === post.id
    if (fromComposer) {
      saveFromComposer({ ...post, ...patch }, { quiet: true })
    } else {
      const prev = { status: post.status, liveUrl: post.liveUrl, postedAt: post.postedAt }
      update(post.id, patch)
      setPostedFor(null)
      return toast('Marked as posted', { action: { label: 'Undo', run: () => update(post.id, prev) } })
    }
    setPostedFor(null)
    toast('Marked as posted')
  }

  const startPromote = (post) => {
    if (!exists(post.id)) {
      saveFromComposer(post, { close: false, quiet: true })
      setComposer((c) => c && { ...c, initial: post, isNew: false })
    }
    setPromoteFor(post)
  }

  /* ----- summary numbers ----- */
  const summary = useMemo(() => {
    const horizon = addDays(now, 14)
    const upcoming = posts
      .filter((p) => p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt) >= now)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    return {
      next14: upcoming.filter((p) => new Date(p.scheduledAt) < horizon).length,
      next: upcoming[0],
      drafts: posts.filter((p) => p.status === 'drafting').length,
      ideas: posts.filter((p) => p.status === 'idea').length,
      missed: posts.filter((p) => p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt) < now),
    }
  }, [posts, now])

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

  return (
    <div className="cq-root text-bone">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 pb-28 pt-8 sm:gap-12 sm:pt-10 lg:pt-14">
        {/* Header */}
        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(380px,452px)] lg:gap-14">
          <div className="flex min-w-0 animate-rise flex-col gap-6">
            <div className="flex flex-col gap-3">
              <p className="cq-label">{longDate(now)}</p>
              <h1 className="font-display text-[44px] font-[380] leading-[0.98] tracking-[-0.025em] text-bone [font-variation-settings:'opsz'_72] sm:text-[60px] lg:text-[72px]">
                Content Queue
              </h1>
            </div>
            <p className="max-w-[54ch] text-pretty text-[16.5px] leading-[1.6] text-mute sm:text-[17.5px]">
              <span className="text-bone">{plural(summary.next14, 'post', 'posts')}</span> going out in the next two weeks,{' '}
              <span className="text-bone">{plural(summary.drafts, 'draft', 'drafts')}</span> in progress and{' '}
              <span className="text-bone">{plural(summary.ideas, 'idea', 'ideas')}</span> waiting for a turn.
            </p>

            <div className="flex flex-col gap-2">
              {summary.next && (
                <button
                  type="button"
                  onClick={() => openPost(summary.next.id)}
                  className="group flex w-full max-w-[620px] items-center gap-3.5 rounded-[14px] border border-line bg-panel px-4 py-3.5 text-left transition-colors hover:border-line2"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="cq-label text-ember">Next up</span>
                    <span className="truncate text-[15.5px] font-semibold text-bone">{summary.next.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-mute">
                      <PlatformMark platform={summary.next.platform} />
                      <span>{accountById(summary.next.account).name}</span>
                      <span aria-hidden="true" className="text-faint">/</span>
                      <span className="font-mono text-[12.5px] tabular-nums">{when(summary.next.scheduledAt, now)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[13px] tabular-nums text-faint transition-colors group-hover:text-bone">{relative(summary.next.scheduledAt, now)}</span>
                </button>
              )}
              {summary.missed.length > 0 && (
                <button
                  type="button"
                  onClick={() => openPost(summary.missed[0].id)}
                  className="flex w-full max-w-[620px] items-center gap-3 rounded-[14px] border border-danger/35 px-4 py-3 text-left text-[14px] transition-colors hover:border-danger/60"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-bone">
                    {summary.missed.length === 1 ? `"${summary.missed[0].title}" missed its time.` : `${summary.missed.length} posts missed their time.`}{' '}
                    <span className="text-mute">Mark it posted or pick a new time.</span>
                  </span>
                </button>
              )}
            </div>
          </div>
          <div className="animate-rise [animation-delay:60ms]">
            <QuickAdd onOpen={(id) => setTimeout(() => openPost(id), 0)} />
          </div>
        </section>

        <Runway posts={posts} now={now} onOpen={openPost} onNewOn={(d) => newPost({ status: 'scheduled', scheduledAt: slotOn(d, now) }, { focus: 'title' })} />

        {/* Views */}
        <section aria-labelledby="cq-views-title" className="flex flex-col gap-5">
          <h2 id="cq-views-title" className="sr-only">
            All posts
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex rounded-[12px] border border-line p-1" role="tablist" aria-label="View">
                {[
                  { id: 'board', label: 'Board', Icon: Columns3 },
                  { id: 'list', label: 'List', Icon: List },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={view === id}
                    onClick={() => setPrefs({ view: id })}
                    className={`inline-flex h-9 items-center gap-2 rounded-[8px] px-3.5 text-[14px] transition-colors ${view === id ? 'bg-raised text-bone' : 'text-mute hover:text-bone'}`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
              <label className="relative order-3 flex h-[46px] w-full min-w-0 items-center sm:order-2 sm:w-auto sm:max-w-[320px] sm:flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 text-faint" />
                <span className="sr-only">Search posts</span>
                <input
                  id="cq-search"
                  type="search"
                  value={filters.q}
                  onChange={(e) => setFilter('q', e.target.value)}
                  placeholder="Search titles, text, notes"
                  className="cq-input h-full pl-10"
                />
              </label>
              <button
                type="button"
                className="cq-btn-primary order-2 ml-auto h-[46px] sm:order-3"
                onClick={() => newPost({ status: 'drafting' })}
              >
                New post
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FilterPill id="cq-f-account" label="For" value={filters.account} onChange={(v) => setFilter('account', v)} options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
              <FilterPill id="cq-f-platform" label="Platform" value={filters.platform} onChange={(v) => setFilter('platform', v)} options={PLATFORMS.map((p) => ({ value: p.id, label: p.label }))} />
              {view === 'list' && (
                <FilterPill id="cq-f-status" label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
              )}
              <FilterPill id="cq-f-tag" label="Tag" value={filters.tag} onChange={(v) => setFilter('tag', v)} options={allTags.map((t) => ({ value: t, label: `#${t}` }))} />
              {view === 'list' && (
                <FilterPill
                  id="cq-f-sort"
                  label="Sort"
                  value={sort}
                  always
                  onChange={(v) => setPrefs({ sort: v })}
                  options={[
                    { value: 'date', label: 'Upcoming first' },
                    { value: 'edited', label: 'Recently edited' },
                    { value: 'title', label: 'Title A to Z' },
                  ]}
                />
              )}
              {activeFilters.length > 0 && (
                <button type="button" onClick={clearFilters} className="cq-btn-ghost h-10 min-h-0 px-3 text-[13.5px]">
                  <X size={15} /> Clear filters
                </button>
              )}
              <span className="ml-auto font-mono text-[12px] tabular-nums text-faint" aria-live="polite">
                {filtered.length === posts.length ? plural(posts.length, 'post', 'posts') : `${filtered.length} of ${posts.length}`}
              </span>
            </div>
          </div>

          {posts.length === 0 ? (
            <EmptyQueue onNew={() => newPost({ status: 'drafting' })} onSamples={resetToSamples} />
          ) : view === 'board' ? (
            <Board posts={filtered} now={now} onOpen={openPost} onMove={moveTo} onAction={onAction} onNew={(status) => newPost(status === 'scheduled' ? { status, scheduledAt: at(1, 9) } : { status })} />
          ) : filtered.length ? (
            <ListView posts={filtered} sort={sort} now={now} onOpen={openPost} onAction={onAction} />
          ) : (
            <div className="grid place-items-center gap-3 rounded-[14px] border border-dashed border-line2 px-6 py-14 text-center">
              <p className="text-[15px] text-mute">Nothing matches these filters.</p>
              <button className="cq-btn-quiet" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </section>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 text-[13px] text-faint">
          <span>Saved in this browser only.</span>
          <button type="button" className="underline decoration-line2 underline-offset-4 hover:text-bone" onClick={() => setBusinessesOpen(true)}>
            Businesses
          </button>
          <button type="button" className="underline decoration-line2 underline-offset-4 hover:text-bone" onClick={() => setConfirm('reset')}>
            Reset to sample data
          </button>
          <button type="button" className="underline decoration-line2 underline-offset-4 hover:text-bone" onClick={() => setConfirm('clear')}>
            Start empty
          </button>
        </footer>
      </div>

      <ScrollTop hidden={!!composer} />

      {composer && (
        <Composer
          key={composer.initial.id}
          initial={composer.initial}
          isNew={composer.isNew}
          focus={composer.focus}
          notice={composer.notice}
          paused={!!postedFor || !!promoteFor}
          onClose={() => setComposer(null)}
          onSave={(clean) => saveFromComposer(clean)}
          onDelete={(post) => {
            setComposer(null)
            if (exists(post.id)) deletePost(post)
          }}
          onMarkPosted={(draft) => setPostedFor(draft)}
          onPromote={startPromote}
        />
      )}

      <BusinessesDialog
        open={businessesOpen}
        onClose={() => setBusinessesOpen(false)}
        onRemoved={(a) => {
          if (filters.account === a.id) setFilter('account', '')
          toast(`${a.name} removed`)
        }}
      />
      <MarkPostedDialog post={postedFor} onCancel={() => setPostedFor(null)} onConfirm={confirmPosted} />
      <PromoteDialog
        post={promoteFor}
        onCancel={() => setPromoteFor(null)}
        onSave={(post, audiences) => {
          update(post.id, { promo: { queuedAt: new Date().toISOString(), audiences } })
          setPromoteFor(null)
          toast('Saved for the Marketing tool')
        }}
        onRemove={(post) => {
          update(post.id, { promo: null })
          setPromoteFor(null)
          toast('Promotion removed')
        }}
      />
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        width={440}
        labelledBy="cq-confirm-title"
        title={confirm === 'reset' ? 'Reset to sample data?' : 'Start with an empty queue?'}
        description={
          confirm === 'reset'
            ? 'This replaces everything in the queue with the example posts. Your own posts in this browser are removed.'
            : 'This removes every post from the queue in this browser. Use it when you are ready to put in your real content.'
        }
        footer={
          <>
            <button className="cq-btn-quiet" data-autofocus onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="cq-btn cq-btn-quiet border-danger/50 text-danger hover:bg-danger/10"
              onClick={() => {
                if (confirm === 'reset') resetToSamples()
                else clearAll()
                setConfirm(null)
                toast(confirm === 'reset' ? 'Sample data restored' : 'Queue cleared')
              }}
            >
              {confirm === 'reset' ? 'Reset queue' : 'Remove all posts'}
            </button>
          </>
        }
      />
    </div>
  )
}

// 9 AM on the chosen day, or the next whole hour if that time has already passed today.
function slotOn(day, now) {
  const nine = new Date(at(0, 9, 0, day))
  if (nine > now) return nine.toISOString()
  const next = new Date(now)
  next.setHours(next.getHours() + 1, 0, 0, 0)
  return next.toISOString()
}

function FilterPill({ id, label, value, onChange, options, always }) {
  const current = options.find((o) => o.value === value)
  const on = !!value && !always
  return (
    <label
      htmlFor={id}
      className={`relative inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border pl-3.5 pr-2.5 text-[13.5px] transition-colors focus-within:ring-2 focus-within:ring-ember/70 ${
        on ? 'border-bone/80 text-bone' : 'border-line text-mute hover:border-line2 hover:text-bone'
      }`}
    >
      <span className={on ? 'text-mute' : ''}>{label}</span>
      {current && <span className="max-w-[160px] truncate text-bone">{current.label}</span>}
      <ChevronDown size={15} className="text-faint" />
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={label}>
        {!always && <option value="">All</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function EmptyQueue({ onNew, onSamples }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[16px] border border-dashed border-line2 px-6 py-12 sm:px-10">
      <StatusGlyph status="idea" size={22} />
      <h3 className="font-display text-[26px] font-[420] tracking-[-0.01em] text-bone">The queue is empty.</h3>
      <p className="max-w-[46ch] text-[15px] leading-relaxed text-mute">
        Capture an idea in the box above, or start a post with a platform and a date. Everything you add is saved in this browser.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="cq-btn-primary" onClick={onNew}>
          New post
        </button>
        <button className="cq-btn-quiet" onClick={onSamples}>
          Load sample posts
        </button>
      </div>
    </div>
  )
}
