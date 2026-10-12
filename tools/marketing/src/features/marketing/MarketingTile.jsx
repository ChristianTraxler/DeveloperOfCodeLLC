// Art and a status line for the Marketing tile on the Admin Hub.
// Both work with or without <MarketingProvider> above them.
import { useMemo } from 'react'
import { CalendarClock } from 'lucide-react'
import { useMarketing } from './MarketingContext.jsx'
import { DEFAULT_SETTINGS } from './data/demo.js'
import { resultsView } from './data/demo.js'
import { EmailThumb } from './ui/EmailFrame.jsx'
import { pct } from './lib/format.js'

function useSnapshot() {
  const live = useMarketing()
  const state = live || { settings: DEFAULT_SETTINGS, campaigns: [] }
  return useMemo(() => {
    const campaigns = state.campaigns
    const scheduled = campaigns.filter((c) => c.status === 'scheduled').sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    const sent = campaigns.filter((c) => c.status === 'sent' && c.stats).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    const drafts = campaigns.filter((c) => c.status === 'draft')
    const last = sent[0] || null
    const view = last ? resultsView(last.stats) : null
    return { settings: state.settings, scheduled, sent, drafts, last, rate: view ? pct(view.opened, view.delivered) : null }
  }, [state])
}

export function MarketingTileMeta() {
  const s = useSnapshot()
  const parts = []
  if (s.scheduled.length) parts.push(`${s.scheduled.length} scheduled for ${new Date(s.scheduled[0].scheduledFor).toLocaleDateString('en-US', { weekday: 'short' })}`)
  if (s.drafts.length) parts.push(`${s.drafts.length} ${s.drafts.length === 1 ? 'draft' : 'drafts'}`)
  if (s.rate != null) parts.push(`last email ${s.rate}% opened`)
  return parts.join(', ') || 'No emails yet'
}

export function MarketingTileArt() {
  const s = useSnapshot()
  const front = s.scheduled[0] || s.drafts[0] || s.last
  const back = s.last && s.last !== front ? s.last : s.sent[1] || s.drafts[1] || null
  const when = s.scheduled[0] ? new Date(s.scheduled[0].scheduledFor) : null
  const ring = s.rate ?? 0
  const R = 17
  const C = 2 * Math.PI * R
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(70%_80%_at_50%_100%,rgba(255,90,31,0.16),transparent_70%),linear-gradient(#111a30,#0a1020)]">
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(236,232,223,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(236,232,223,0.05)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(90%_90%_at_50%_40%,#000,transparent_85%)]" />
      <div className="absolute left-1/2 top-[14%] aspect-[3/4] w-[34%] min-w-[118px] max-w-[210px] -translate-x-1/2">
        {back && (
          <div className="absolute inset-0 overflow-hidden rounded-[10px] border border-white/20 shadow-[0_24px_40px_-14px_rgba(0,0,0,0.9)]" style={{ transform: 'translate(-58%, 8%) rotate(-8deg)' }}>
            <EmailThumb campaign={back} settings={s.settings} height={420} />
          </div>
        )}
        {front && (
          <div className="absolute inset-0 overflow-hidden rounded-[10px] border border-white/25 shadow-[0_30px_50px_-14px_rgba(0,0,0,0.95)]" style={{ transform: 'translate(10%, -2%) rotate(3deg)' }}>
            <EmailThumb campaign={front} settings={s.settings} height={420} />
          </div>
        )}
      </div>
      {when && (
        <div className="absolute left-[6%] top-[12%] flex items-center gap-2 rounded-full border border-ember/40 bg-ink/80 py-1.5 pl-2 pr-3 text-[12px] font-semibold text-bone shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-ember text-[#1c0a02]">
            <CalendarClock size={13} strokeWidth={2.4} />
          </span>
          {when.toLocaleDateString('en-US', { weekday: 'short' })} {when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      )}
      {s.rate != null && (
        <div className="absolute bottom-[10%] right-[6%] flex items-center gap-2.5 rounded-[16px] border border-white/15 bg-ink/80 py-2 pl-2 pr-3.5 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
            <circle cx="21" cy="21" r={R} fill="none" stroke="rgba(236,232,223,0.12)" strokeWidth="4" />
            <circle cx="21" cy="21" r={R} fill="none" stroke="#FF5A1F" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(ring / 100) * C} ${C}`} transform="rotate(-90 21 21)" />
          </svg>
          <span>
            <span className="block text-[15px] font-semibold leading-none text-bone">{ring}%</span>
            <span className="mt-1 block text-[11px] leading-none text-mute">opened</span>
          </span>
        </div>
      )}
    </div>
  )
}
