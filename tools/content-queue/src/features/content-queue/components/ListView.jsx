import { useMemo } from 'react'
import { ArrowUpRight, Mail } from 'lucide-react'
import { PlatformMark, StatusGlyph } from './marks'
import { CardMenuButton, dateLine } from './PostCard'
import { useQueue } from '../data/QueueContext'
import { PLATFORM_BY_ID, STATUS_BY_ID } from '../lib/platforms'

const toneClass = { mute: 'text-mute', ember: 'text-ember', danger: 'text-danger', faint: 'text-faint' }

export function sortPosts(list, sort, now) {
  const t = (d) => (d ? new Date(d).getTime() : null)
  const copy = [...list]
  if (sort === 'edited') return copy.sort((a, b) => t(b.updatedAt) - t(a.updatedAt))
  if (sort === 'title') return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  // Upcoming first: future dates soonest first, then undated by last edit, then past dates newest first.
  const nowT = now.getTime()
  const key = (p) => {
    const d = t(p.status === 'posted' ? p.postedAt || p.scheduledAt : p.scheduledAt)
    if (d == null) return [1, -t(p.updatedAt)]
    if (d >= nowT || (p.status === 'scheduled' && d < nowT)) return [0, p.status === 'scheduled' && d < nowT ? -Infinity : d]
    return [2, -d]
  }
  return copy.sort((a, b) => {
    const [ga, va] = key(a)
    const [gb, vb] = key(b)
    return ga - gb || va - vb
  })
}

export default function ListView({ posts, sort, now, onOpen, onAction }) {
  const { accountById } = useQueue()
  const rows = useMemo(() => sortPosts(posts, sort, now), [posts, sort, now])

  return (
    <div className="overflow-hidden rounded-[14px] border border-line">
      {/* Column labels, large screens only */}
      <div className="hidden grid-cols-[minmax(0,1fr)_170px_150px_200px_44px] items-center gap-4 border-b border-line bg-well px-4 py-2.5 lg:grid" aria-hidden="true">
        <span className="cq-label">Post</span>
        <span className="cq-label">For</span>
        <span className="cq-label">Platform</span>
        <span className="cq-label">When</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {rows.map((p) => {
          const line = dateLine(p, now)
          const account = accountById(p.account)
          const excerpt = (p.body || p.notes || '').replace(/\s+/g, ' ').trim()
          return (
            <li key={p.id} className="group relative bg-panel transition-colors hover:bg-raised">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3.5 lg:grid-cols-[minmax(0,1fr)_170px_150px_200px_44px] lg:items-center lg:gap-4">
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="flex min-w-0 items-start gap-3 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  <span className="mt-[3px]" title={STATUS_BY_ID[p.status].label}>
                    <StatusGlyph status={p.status} />
                    <span className="sr-only">{STATUS_BY_ID[p.status].label}:</span>
                  </span>
                  <span className="min-w-0">
                    <span className={`cq-clamp-1 text-[15px] font-semibold leading-snug ${p.status === 'skipped' ? 'text-mute' : 'text-bone'}`}>{p.title || 'Untitled post'}</span>
                    {excerpt && <span className="cq-clamp-1 mt-0.5 text-[13px] text-mute">{excerpt}</span>}
                    {p.tags?.length > 0 && <span className="mt-1 block truncate text-[12px] text-faint">{p.tags.map((t) => `#${t}`).join('  ')}</span>}
                  </span>
                </button>

                <div className="relative z-[1] row-span-1 lg:hidden">
                  <CardMenuButton post={p} onAction={onAction} />
                </div>

                {/* Meta: one line on phones, separate columns on large screens */}
                <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[26px] text-[12.5px] lg:contents lg:pl-0">
                  <span className="text-mute lg:truncate lg:text-[13px]">{account?.name}</span>
                  <span className="inline-flex items-center gap-2 text-mute lg:text-[13px]">
                    <PlatformMark platform={p.platform} />
                    <span className="hidden lg:inline">{PLATFORM_BY_ID[p.platform]?.shortLabel || PLATFORM_BY_ID[p.platform]?.label || 'None yet'}</span>
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                    {line ? <span className={`font-mono text-[12px] tabular-nums ${toneClass[line.tone]}`}>{line.text}</span> : <span className="font-mono text-[12px] text-faint">No date</span>}
                    {p.status === 'posted' && p.liveUrl && (
                      <a href={p.liveUrl} target="_blank" rel="noreferrer" className="relative z-[1] inline-flex items-center gap-0.5 text-[12.5px] text-bone underline decoration-line2 underline-offset-4 hover:decoration-ember">
                        Live <ArrowUpRight size={12} />
                      </a>
                    )}
                    {p.promo && <Mail size={13} className="text-mute" aria-label="Promo saved" />}
                  </span>
                </div>
                <div className="relative z-[1] hidden justify-end lg:flex">
                  <CardMenuButton post={p} onAction={onAction} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
