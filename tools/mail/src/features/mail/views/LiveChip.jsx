// Shows whether new mail arrives on its own (Live), is being checked on a timer, or is paused.
import { useMail } from '../state/MailContext.jsx'
import { useNow } from '../ui/hooks.js'
import { ago } from '../lib/format.js'
import { cx } from '../ui/core.jsx'

const STATES = {
  live: { label: 'Live', dot: 'bg-live ml-live-dot', box: 'border-live/30 bg-live/[0.08] text-live', hint: 'New mail shows up here within seconds of reaching Gmail.' },
  polling: { label: 'Checking', dot: 'bg-[#f2b544]', box: 'border-[#f2b544]/30 bg-[#f2b544]/[0.08] text-[#f2c66e]', hint: 'Live updates are not connected, so Mail checks Gmail every 20 seconds.' },
  connecting: { label: 'Connecting', dot: 'bg-faint animate-pulse', box: 'border-line2 text-mute', hint: 'Connecting to live updates.' },
  offline: { label: 'Offline', dot: 'bg-danger', box: 'border-danger/35 bg-danger/[0.08] text-danger', hint: "You're offline. Mail catches up as soon as you reconnect." },
}

export function LiveChip({ className = '', withTime = false }) {
  const { realtime, lastSyncAt } = useMail()
  const now = useNow(15_000)
  const s = STATES[realtime] || STATES.connecting
  const synced = lastSyncAt ? `Last checked ${ago(lastSyncAt, now)}.` : ''
  return (
    <span
      role="status"
      title={`${s.hint} ${synced}`.trim()}
      className={cx('inline-flex h-7 shrink-0 items-center gap-2 rounded-full border px-2.5 text-[12.5px] font-semibold tracking-[0.01em]', s.box, className)}
    >
      <span className={cx('h-[7px] w-[7px] rounded-full', s.dot)} aria-hidden="true" />
      {s.label}
      {withTime && lastSyncAt && <span className="font-medium opacity-70">· {ago(lastSyncAt, now)}</span>}
    </span>
  )
}

export const liveHint = (realtime) => (STATES[realtime] || STATES.connecting).hint
