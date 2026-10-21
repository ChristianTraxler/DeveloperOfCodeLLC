import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { STATUSES } from '../lib/platforms'
import { StatusGlyph } from './marks'
import { CardBody, CardMenuButton } from './PostCard'

const EMPTY = {
  idea: 'Capture an idea above and it lands here.',
  drafting: 'Drag an idea here when you start writing it.',
  scheduled: 'Nothing scheduled. Give a draft a platform and a time.',
  posted: 'Mark a post as posted and it lands here with its live link.',
  skipped: 'Ideas you decided against, kept in case they come back around.',
}

const LIMIT = { posted: 5, skipped: 4 }

// Prefer the drop dock (it floats above the columns on small screens), then whatever is under the finger.
function collision(args) {
  const hits = pointerWithin(args)
  const dock = hits.filter((h) => String(h.id).startsWith('dock:'))
  if (dock.length) return dock
  if (hits.length) return hits
  return rectIntersection(args)
}

export function sortForStatus(status, list) {
  const t = (d) => (d ? new Date(d).getTime() : 0)
  const copy = [...list]
  if (status === 'scheduled') return copy.sort((a, b) => t(a.scheduledAt) - t(b.scheduledAt))
  if (status === 'posted') return copy.sort((a, b) => t(b.postedAt) - t(a.postedAt))
  return copy.sort((a, b) => t(b.updatedAt) - t(a.updatedAt))
}

export default function Board({ posts, now, onOpen, onMove, onAction, onNew }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )
  const [activeId, setActiveId] = useState(null)
  const lastDrag = useRef(0)
  const scroller = useRef(null)
  const [visible, setVisible] = useState('idea')

  const columns = useMemo(
    () => STATUSES.map((s) => ({ ...s, items: sortForStatus(s.id, posts.filter((p) => p.status === s.id)) })),
    [posts],
  )
  const active = activeId ? posts.find((p) => p.id === activeId) : null

  // Track which column is in view on narrow screens, for the column tabs.
  useEffect(() => {
    const root = scroller.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const best = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (best) setVisible(best.target.dataset.status)
      },
      { root, threshold: [0.55, 0.8] },
    )
    root.querySelectorAll('[data-status]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const jumpTo = (status) => {
    const el = scroller.current?.querySelector(`[data-status="${status}"]`)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.current.scrollTo({ left: el.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' })
  }

  const open = (id) => {
    if (Date.now() - lastDrag.current < 250) return
    onOpen(id)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      autoScroll={{ threshold: { x: 0.18, y: 0.12 }, acceleration: 12 }}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active: a, over }) => {
        setActiveId(null)
        lastDrag.current = Date.now()
        if (!over) return
        const status = String(over.id).split(':')[1]
        const post = posts.find((p) => p.id === a.id)
        if (post && status && status !== post.status) onMove(post, status)
      }}
    >
      {/* Column tabs for phones and iPads, where only one or two columns fit. */}
      <div className="cq-no-bar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 lg:hidden" role="tablist" aria-label="Jump to column">
        {columns.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={visible === c.id}
            onClick={() => jumpTo(c.id)}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors ${visible === c.id ? 'border-line2 bg-raised text-bone' : 'border-transparent text-mute'}`}
          >
            <StatusGlyph status={c.id} size={13} />
            {c.label}
            <span className="font-mono text-[11px] text-faint">{c.items.length}</span>
          </button>
        ))}
      </div>

      <div
        ref={scroller}
        className="cq-scroll-x relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:snap-none lg:px-0"
      >
        {columns.map((c) => (
          <Column key={c.id} column={c} now={now} onOpen={open} onAction={onAction} onNew={onNew} activeId={activeId} />
        ))}
      </div>

      {activeId && <DropDock current={active?.status} />}

      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="cq-card w-[min(64vw,260px)] rotate-[0.8deg] opacity-95 cursor-grabbing border-line2 bg-raised shadow-[0_18px_36px_-18px_rgba(0,0,0,.9)] lg:w-[260px]">
            <CardBody post={active} now={now} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({ column: c, now, onOpen, onAction, onNew, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${c.id}` })
  const [expanded, setExpanded] = useState(false)
  const limit = LIMIT[c.id]
  const shown = limit && !expanded ? c.items.slice(0, limit) : c.items
  const canAdd = c.id === 'idea' || c.id === 'drafting' || c.id === 'scheduled'

  return (
    <section
      data-status={c.id}
      aria-labelledby={`cq-col-${c.id}`}
      className="flex w-[84vw] max-w-[340px] shrink-0 snap-start flex-col sm:w-[300px] lg:w-auto lg:min-w-[204px] lg:max-w-none lg:flex-1 lg:shrink"
    >
      <header className="flex h-11 items-center gap-2 px-1">
        <StatusGlyph status={c.id} />
        <h2 id={`cq-col-${c.id}`} className="text-[13.5px] font-medium text-bone">
          {c.label}
        </h2>
        <span className="font-mono text-[12px] tabular-nums text-faint">{c.items.length}</span>
        {canAdd && (
          <button
            type="button"
            className="cq-icon-btn ml-auto h-9 w-9"
            onClick={() => onNew(c.id)}
            aria-label={`New ${c.label.toLowerCase()} post`}
          >
            <Plus size={17} />
          </button>
        )}
      </header>
      <div
        ref={setNodeRef}
        className={`flex min-h-[160px] flex-1 flex-col gap-2 rounded-[14px] border border-line bg-well/70 p-2 transition-colors ${isOver ? 'cq-drop-over' : ''}`}
      >
        {shown.map((p) => (
          <DraggableCard key={p.id} post={p} now={now} onOpen={onOpen} onAction={onAction} dragging={activeId === p.id} />
        ))}
        {!c.items.length && <p className="m-auto max-w-[220px] px-3 py-6 text-center text-[13px] leading-relaxed text-faint">{EMPTY[c.id]}</p>}
        {limit && c.items.length > limit && (
          <button type="button" onClick={() => setExpanded((x) => !x)} className="cq-btn-ghost min-h-[38px] text-[13px]">
            {expanded ? 'Show fewer' : `Show all ${c.items.length}`}
          </button>
        )}
      </div>
    </section>
  )
}

function DraggableCard({ post, now, onOpen, onAction, dragging }) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: post.id })
  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="post card. Long press or drag to move."
      aria-label={post.title || 'Untitled post'}
      onClick={() => onOpen(post.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(post.id)
        }
      }}
      className={`cq-card cursor-grab animate-rise active:cursor-grabbing ${dragging ? 'opacity-35' : ''} ${post.status === 'skipped' ? 'bg-panel/60' : ''}`}
    >
      <CardBody post={post} now={now} actions={<CardMenuButton post={post} onAction={onAction} />} />
    </article>
  )
}

function DropDock({ current }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] animate-sheet border-t border-line2 bg-ink/95 lg:hidden"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
      }}
    >
      <p className="cq-label pb-2 pt-2.5 text-center">Drop on a status</p>
      <div className="grid grid-cols-5 gap-1.5">
        {STATUSES.map((s) => (
          <DockTarget key={s.id} status={s} disabled={s.id === current} />
        ))}
      </div>
    </div>
  )
}

function DockTarget({ status, disabled }) {
  const { setNodeRef, isOver } = useDroppable({ id: `dock:${status.id}`, disabled })
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-[10px] border text-[12px] transition-colors ${
        disabled ? 'border-transparent text-faint opacity-50' : isOver ? 'border-ember bg-ember-soft text-bone' : 'border-line2 text-mute'
      }`}
    >
      <StatusGlyph status={status.id} size={16} />
      {status.label}
    </div>
  )
}
