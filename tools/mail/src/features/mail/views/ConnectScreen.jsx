// Shown until Gmail is linked: what Mail does, and one button to link it.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, KeyRound, RefreshCcw, Zap } from 'lucide-react'
import { useMail } from '../state/MailContext.jsx'
import { Button, Spinner } from '../ui/core.jsx'

const EASE = [0.2, 0.7, 0.2, 1]

const POINTS = [
  { icon: Zap, title: 'Live, not refreshed', text: 'Gmail tells the admin the moment something changes, so new mail lands here within seconds.' },
  { icon: RefreshCcw, title: 'One inbox, both ways', text: 'Read, reply, archive, star and label here. Gmail shows the same thing a second later.' },
  { icon: KeyRound, title: 'Your password stays with Google', text: 'Google handles the sign-in. The admin keeps an encrypted key, and you can unlink anytime.' },
]

function Stack() {
  const rows = [
    { name: 'Carla Hefner', line: 'Homepage photos and the booking calendar', fresh: true },
    { name: 'Dana Teague', line: 'Estimate form emails going to spam?' },
    { name: 'BusinessLaunchList', line: 'New sign-up: Ava Bolick' },
  ]
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[460px]" aria-hidden="true">
      <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(70%_70%_at_50%_100%,rgba(255,90,31,0.18),transparent_70%)]" />
      {[2, 1, 0].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 24, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: [-5, 3, -1][i] }}
          transition={{ duration: 0.8, delay: 0.25 + (2 - i) * 0.12, ease: EASE }}
          className="ml-paper absolute left-[9%] right-[9%] rounded-[18px] p-5"
          style={{ top: `${10 + i * 7}%`, bottom: `${18 - i * 7}%`, zIndex: 3 - i }}
        >
          {i === 0 && (
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f3e2d9] font-display text-[17px] italic text-[#9c4320]">C</span>
                <div>
                  <p className="text-[14px] font-semibold text-ink2">Carla Hefner</p>
                  <p className="text-[12px] text-slate">to me, 38 min ago</p>
                </div>
              </div>
              <div className="mt-5 space-y-2.5">
                {[94, 88, 97, 62].map((w, j) => (
                  <span key={j} className="block h-2.5 rounded-full bg-black/[0.07]" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.75, ease: EASE }}
        className="absolute -right-1 bottom-[4%] z-10 w-[64%] rounded-[18px] border border-line2 bg-raised/95 p-2 shadow-[0_24px_50px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md sm:-right-4"
      >
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2.5 rounded-[12px] px-2.5 py-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.fresh ? 'bg-ember' : 'bg-transparent'}`} />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold text-bone">{r.name}</span>
              <span className="block truncate text-[11.5px] text-faint">{r.line}</span>
            </span>
          </div>
        ))}
      </motion.div>
      <motion.span
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.9 }}
        className="absolute left-[2%] top-[2%] z-10 inline-flex h-8 items-center gap-2 rounded-full border border-live/30 bg-ink/85 px-3 text-[12.5px] font-semibold text-live backdrop-blur-md"
      >
        <span className="ml-live-dot h-[7px] w-[7px] rounded-full bg-live" /> Live
      </motion.span>
    </div>
  )
}

export function ConnectScreen() {
  const { actions, api, pushConfigured, account, phase } = useMail()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const relink = phase === 'reauth'

  const link = async () => {
    setBusy(true)
    setError(null)
    try {
      await actions.link()
    } catch (err) {
      setError(err?.message || 'Linking did not start. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-[1120px] items-center gap-12 px-4 pb-24 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-10 lg:pt-24">
      <div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#ff9a6e]">
          Mail
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="display mt-4 text-balance text-[clamp(44px,8vw,76px)] leading-[0.94]"
        >
          {relink ? 'Link Gmail again' : 'Your inbox, inside the hub.'}
        </motion.h1>
        <p className="mt-6 max-w-[46ch] text-[16.5px] leading-relaxed text-mute">
          {relink
            ? `Google asked for a fresh sign-in for ${account?.email || 'your Gmail'}. Nothing was lost. Link it again and Mail picks up where it left off.`
            : 'Link your business Gmail once. New mail shows up here the moment it lands, and everything you do here happens in Gmail too.'}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button variant="ember" size="lg" onClick={link} disabled={busy} className="pl-6 pr-5">
            {busy ? <Spinner /> : null}
            {busy ? (api.mode === 'demo' ? 'Linking the example' : 'Opening Google') : relink ? 'Link Gmail again' : 'Link Gmail'}
            {!busy && <ArrowRight size={18} />}
          </Button>
          <p className="text-[13.5px] text-faint">{api.mode === 'demo' ? 'Example only. No real sign-in happens in this preview.' : "Google's sign-in screen opens next."}</p>
        </div>
        {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}
        {!pushConfigured && api.mode !== 'demo' && (
          <p className="mt-5 max-w-[52ch] rounded-[14px] border border-[#f2b544]/30 bg-[#f2b544]/[0.06] px-4 py-3 text-[13.5px] leading-relaxed text-[#f2c66e]">
            Live updates aren't set up on the server yet, so Mail will check every 20 seconds until MAIL_PUBSUB_TOPIC is added. The setup guide covers it.
          </p>
        )}
        <ul className="mt-12 grid gap-6 sm:grid-cols-3 lg:grid-cols-1 lg:gap-5">
          {POINTS.map((p, i) => (
            <motion.li
              key={p.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 + i * 0.08, ease: EASE }}
              className="lg:flex lg:items-start lg:gap-4"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ember/25 bg-ember/10 text-ember">
                <p.icon size={18} />
              </span>
              <span className="block min-w-0">
                <span className="wide mt-3.5 block text-[15.5px] font-semibold lg:mt-0">{p.title}</span>
                <span className="mt-1.5 block max-w-[52ch] text-[14px] leading-relaxed text-mute lg:mt-1">{p.text}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
      <Stack />
    </main>
  )
}
