import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { addDays, sameDay, startOfDay, time } from '../lib/dates'
import { PLATFORM_BY_ID } from '../lib/platforms'
import { useQueue } from '../data/QueueContext'

const DAYS = 14

/**
 * The next two weeks at a glance. Each day shows what is going out; an empty day
 * is a gap in the schedule, and tapping it starts a post on that day.
 */
export default function Runway({ posts, now, onOpen, onNewOn }) {
  const { accountById } = useQueue()
  const days = useMemo(() => {
    const start = startOfDay(now)
    return Array.from({ length: DAYS }, (_, i) => {
      const d = addDays(start, i)
      const items = posts
        .filter((p) => p.status === 'scheduled' && p.scheduledAt && sameDay(p.scheduledAt, d))
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      return { d, items }
    })
  }, [posts, now])

  const filled = days.filter((x) => x.items.length).length

  return (
    <section aria-labelledby="cq-runway-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="cq-runway-title" className="text-[14px] font-semibold text-bone [font-stretch:108%]">
          Next 14 days{' '}
          <span className="ml-1 font-mono text-[12px] font-normal text-faint">
            {days[0].d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to {days[DAYS - 1].d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </h2>
        <p className="text-[13px] text-mute">
          <span className="font-mono text-bone">{filled}</span> of 14 days have something going out
        </p>
      </div>
      <div className="cq-scroll-x -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ol className="grid min-w-[880px] overflow-hidden rounded-[14px] border border-line" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` }}>
          {days.map(({ d, items }, i) => {
            const isToday = i === 0
            const weekend = d.getDay() === 0 || d.getDay() === 6
            const monthStart = d.getDate() === 1
            return (
              <li
                key={d.toISOString()}
                className={`group relative flex min-h-[132px] flex-col border-line ${i ? 'border-l' : ''} ${weekend ? 'bg-well/60' : 'bg-panel'}`}
              >
                <button
                  type="button"
                  onClick={() => onNewOn(d)}
                  className="flex items-baseline gap-1.5 px-2.5 pb-2 pt-2.5 text-left"
                  aria-label={`New post on ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
                >
                  <span className={`font-mono text-[10.5px] uppercase tracking-[0.08em] ${isToday ? 'text-ember' : 'text-faint'}`}>
                    {isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className={`ml-auto font-mono text-[13px] tabular-nums ${isToday ? 'text-bone' : 'text-mute'}`}>
                    {monthStart ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d.getDate()}
                  </span>
                </button>
                {isToday && <span className="absolute inset-x-0 top-0 h-[2px] bg-ember" aria-hidden="true" />}
                <div className="flex flex-1 flex-col gap-1 px-1.5 pb-2">
                  {items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onOpen(p.id)}
                      title={`${p.title} (${PLATFORM_BY_ID[p.platform]?.label}, ${time(p.scheduledAt)})`}
                      className="flex w-full flex-col gap-0.5 rounded-[7px] border border-line2 bg-raised px-1.5 py-1.5 text-left transition-colors hover:border-ember/60"
                    >
                      <span className="flex items-center gap-1">
                        <span className="font-mono text-[9.5px] font-medium tracking-[0.06em] text-ember">{PLATFORM_BY_ID[p.platform]?.short}</span>
                        <span className="font-mono text-[9.5px] text-faint">{time(p.scheduledAt).replace(':00', '').replace(' ', '').toLowerCase()}</span>
                      </span>
                      <span className="cq-clamp-2 text-[11.5px] leading-[1.3] text-bone">{p.title || 'Untitled'}</span>
                      {p.account !== 'doc' && <span className="truncate text-[10.5px] text-faint">{accountById(p.account).name}</span>}
                    </button>
                  ))}
                  {!items.length && (
                    <button
                      type="button"
                      onClick={() => onNewOn(d)}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="grid flex-1 place-items-center rounded-[7px] text-faint opacity-0 transition-opacity hover:bg-raised group-hover:opacity-100"
                    >
                      <Plus size={15} />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
