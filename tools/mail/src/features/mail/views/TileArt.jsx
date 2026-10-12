// The Mail tile for the Admin Hub: live artwork drawn from the inbox, and a one-line summary.
import '../mail.css'
import { useEffect, useState } from 'react'
import { ago, nameOf } from '../lib/format.js'
import { Monogram } from '../ui/core.jsx'

export function useMailSummary(api) {
  const [summary, setSummary] = useState({ ready: false, linked: false, unread: 0, latest: [], live: false })
  useEffect(() => {
    let alive = true
    let timer = null
    const load = async () => {
      try {
        const status = await api.status()
        if (!status.linked || status.needsReauth) {
          if (alive) setSummary({ ready: true, linked: false, needsReauth: !!status.needsReauth, unread: 0, latest: [], live: false })
          return
        }
        const [labels, list] = await Promise.all([api.labels(), api.list({ labelId: 'INBOX', max: 3 })])
        if (!alive) return
        setSummary({
          ready: true,
          linked: true,
          unread: labels.system?.find((l) => l.id === 'INBOX')?.unread || 0,
          latest: (list.threads || []).slice(0, 3),
          live: !!status.live?.pushConfigured,
        })
      } catch {
        if (alive) setSummary((s) => ({ ...s, ready: true }))
      }
    }
    load()
    const off = api.subscribe(
      () => {
        clearTimeout(timer)
        timer = setTimeout(load, 500)
      },
      () => {},
    )
    return () => {
      alive = false
      clearTimeout(timer)
      off?.()
    }
  }, [api])
  return summary
}

export function mailTileMeta(summary, now = Date.now()) {
  if (!summary.ready) return 'Opening your inbox'
  if (!summary.linked) return summary.needsReauth ? 'Google asked you to link Gmail again' : 'Link your Gmail to start'
  const newest = summary.latest[0]
  const parts = [summary.unread ? `${summary.unread} unread` : 'All caught up']
  if (newest) parts.push(`newest from ${nameOf(newest.from)} ${ago(newest.date, now)}`)
  return parts.join(', ')
}

export function MailTileArt({ summary }) {
  const letters = summary.latest.length ? summary.latest : [null, null, null]
  const top = letters[0]
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(70%_80%_at_50%_100%,rgba(255,90,31,0.16),transparent_70%),linear-gradient(#111a30,#0a1020)]">
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(236,232,223,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(236,232,223,0.05)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(90%_90%_at_50%_40%,#000,transparent_85%)]" />
      <div className="absolute left-1/2 top-[15%] h-[78%] w-[56%] min-w-[200px] max-w-[330px] -translate-x-1/2">
        {[2, 1].map((i) => (
          <div
            key={i}
            className="ml-fold absolute inset-x-0 rounded-[12px]"
            style={{ top: `${i * 7}%`, height: '86%', transform: `rotate(${i === 2 ? -6 : 3.5}deg) translateX(${i === 2 ? -10 : 8}%)`, zIndex: 3 - i }}
          >
            {letters[i] && (
              <div className="flex items-center gap-2 px-3 pt-3">
                <Monogram address={letters[i].from} size={18} />
                <span className="h-2 w-16 rounded-full bg-black/10" />
              </div>
            )}
          </div>
        ))}
        <div className="ml-paper absolute inset-x-0 top-[12%] z-10 h-[84%] rounded-[12px] px-4 pt-4">
          <div className="flex items-center gap-2.5">
            {top ? <Monogram address={top.from} size={28} /> : <span className="h-7 w-7 rounded-full bg-black/[0.07]" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-ink2">{top ? nameOf(top.from) : 'Your inbox'}</p>
              <p className="truncate text-[10.5px] text-slate">{top ? top.subject : 'New mail lands here'}</p>
            </div>
            {top?.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-ember" />}
          </div>
          <div className="mt-3.5 space-y-2">
            {[94, 86, 91, 58].map((w, i) => (
              <span key={i} className="block h-[5px] rounded-full bg-black/[0.08]" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="absolute left-[6%] top-[10%] z-20 flex items-center gap-2 rounded-full border border-live/35 bg-ink/80 py-1.5 pl-2.5 pr-3 text-[12px] font-semibold text-live shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md">
        <span className="ml-live-dot h-[7px] w-[7px] rounded-full bg-live" />
        {summary.linked ? 'Live' : 'Not linked'}
      </div>
      {summary.linked && (
        <div className="absolute bottom-[10%] right-[6%] z-20 flex items-center gap-2.5 rounded-[16px] border border-white/15 bg-ink/80 py-2 pl-2 pr-3.5 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <span className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-[15px] font-bold tabular-nums ${summary.unread ? 'bg-ember text-[#1c0a02]' : 'bg-white/[0.08] text-bone'}`}>{summary.unread}</span>
          <span className="text-[11.5px] leading-tight text-mute">
            unread
            <span className="block text-bone">in Inbox</span>
          </span>
        </div>
      )}
    </div>
  )
}
