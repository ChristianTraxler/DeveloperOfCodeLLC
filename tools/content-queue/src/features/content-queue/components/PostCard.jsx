import { useRef, useState } from 'react'
import { ArrowUpRight, Mail, MoreHorizontal } from 'lucide-react'
import { PlatformMark } from './marks'
import { resolveImage } from '../lib/images'
import { useQueue } from '../data/QueueContext'
import { monthDay, when } from '../lib/dates'
import PostMenu from './PostMenu'

export function dateLine(p, now) {
  if (p.status === 'posted') return { text: `Posted ${p.postedAt ? monthDay(p.postedAt) : ''}`.trim(), tone: 'mute' }
  if (!p.scheduledAt) return null
  const past = new Date(p.scheduledAt) < now
  if (p.status === 'scheduled' && past) return { text: `Missed ${when(p.scheduledAt, now)}`, tone: 'danger' }
  if (p.status === 'scheduled') return { text: when(p.scheduledAt, now), tone: 'ember' }
  return { text: `Planned ${when(p.scheduledAt, now)}`, tone: 'faint' }
}

const toneClass = { mute: 'text-mute', ember: 'text-ember', danger: 'text-danger', faint: 'text-faint' }

const stop = {
  onPointerDown: (e) => e.stopPropagation(),
  onMouseDown: (e) => e.stopPropagation(),
  onTouchStart: (e) => e.stopPropagation(),
  onKeyDown: (e) => e.stopPropagation(),
}

/** Body of a card, shared by the board and the drag preview. */
export function CardBody({ post: p, now, actions, overlay }) {
  const img = resolveImage(p.imageUrl)
  const line = dateLine(p, now)
  const excerpt = (p.body || p.notes || '').replace(/\s+/g, ' ').trim()
  const account = useQueue().accountById(p.account)
  return (
    <div className="flex flex-col gap-2.5 p-3.5">
      <div className="flex items-center gap-2">
        <PlatformMark platform={p.platform} />
        <span className="min-w-0 flex-1 truncate text-[12px] text-mute">{p.account !== 'doc' ? account?.name : ''}</span>
        {actions}
      </div>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={`cq-clamp-2 text-[15px] font-semibold leading-[1.3] ${p.status === 'skipped' ? 'text-mute' : 'text-bone'}`}>{p.title || 'Untitled post'}</h3>
          {excerpt && <p className="cq-clamp-2 mt-1 text-[13px] leading-[1.45] text-mute">{excerpt}</p>}
        </div>
        {img && <ImageThumb src={img} />}
      </div>
      {(line || p.tags?.length || p.promo || (p.liveUrl && p.status === 'posted')) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {line && <span className={`font-mono text-[11.5px] tabular-nums ${toneClass[line.tone]}`}>{line.text}</span>}
          {p.status === 'posted' && p.liveUrl && !overlay && (
            <a href={p.liveUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[28px] items-center gap-1 text-[12.5px] text-bone underline decoration-line2 underline-offset-4 hover:decoration-ember" {...stop}>
              View live <ArrowUpRight size={13} />
            </a>
          )}
          {p.promo && (
            <span className="inline-flex items-center gap-1 text-[12px] text-mute" title="Saved for an email promotion">
              <Mail size={13} /> Promo saved
            </span>
          )}
          {p.tags?.length > 0 && (
            <span className="min-w-0 truncate text-[12px] text-faint">{p.tags.map((t) => `#${t}`).join('  ')}</span>
          )}
        </div>
      )}
    </div>
  )
}

function ImageThumb({ src }) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return <img src={src} alt="" onError={() => setOk(false)} className="h-14 w-14 shrink-0 rounded-[8px] border border-line object-cover" draggable={false} loading="lazy" />
}

export function CardMenuButton({ post, onAction }) {
  const btn = useRef(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="cq-icon-btn -my-2 -mr-2 h-9 w-9"
        aria-label={`Actions for ${post.title || 'post'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        {...stop}
      >
        <MoreHorizontal size={18} />
      </button>
      <PostMenu
        anchor={btn.current}
        open={open}
        post={post}
        onClose={(reason) => {
          setOpen(false)
          if (reason !== 'outside') btn.current?.focus({ preventScroll: true })
        }}
        onAction={onAction}
      />
    </>
  )
}
