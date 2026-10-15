// While a review runs: the dial sweeps through its marks and the current step is named.
// The server answers once at the end, so the steps follow typical timings.
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Dial, marksFor } from './Dial.jsx'
import { Button } from './ui/core.jsx'
import { cx, domainOf } from './lib.js'

const STEPS = [
  { at: 0, text: 'Reading robots.txt' },
  { at: 1.5, text: 'Reading the home page' },
  { at: 5, text: 'Checking titles, headings and keywords' },
  { at: 8, text: 'Testing every link on the page' },
  { at: 12, text: 'Looking for the sitemap and business details' },
  { at: 16, text: 'Waiting on Google PageSpeed, the slowest step' },
]
const EXPECTED = 32 // seconds, for the sweep

// Fallback marks before the first list load returns the config.
const FALLBACK = {
  categories: { onpage: 1, technical: 1, local: 1, visibility: 1 },
  checks: Object.fromEntries(
    [['onpage', 6, 1], ['technical', 6, 1], ['local', 1, 1], ['local', 3, 3], ['visibility', 2, 3]].flatMap(([category, n, phase], g) =>
      Array.from({ length: n }, (_, i) => [`${category}${g}${i}`, { label: 'Check', category, phase }]),
    ),
  ),
}

export function RunView({ run, meta, onEdit, onRetry }) {
  const [now, setNow] = useState(Date.now())
  const running = run.status === 'running'
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [running])

  const elapsed = Math.max(0, (now - (run.startedAt || now)) / 1000)
  const progress = Math.min(0.96, 1 - Math.exp(-elapsed / (EXPECTED / 2.2)))
  const step = STEPS.reduce((cur, s, i) => (elapsed >= s.at ? i : cur), 0)
  const marks = marksFor(meta || FALLBACK, [])

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-64px)] max-w-[1120px] items-center px-4 pb-20 pt-10 sm:px-6 lg:px-10">
      <div className="grid items-center gap-12 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-20">
        <div className="mx-auto">
          <Dial marks={marks} size={300} labels scanning={running ? progress : null} title="Review in progress">
            {running ? (
              <div aria-live="off">
                <span className="display block text-[64px] leading-none tabular-nums">{Math.floor(elapsed)}</span>
                <span className="mt-1 block text-[13px] text-mute">seconds</span>
              </div>
            ) : (
              <AlertTriangle size={34} className="text-danger" aria-hidden="true" />
            )}
          </Dial>
        </div>
        <div className="min-w-0">
          <p className="text-[15px] text-mute">{running ? 'Reviewing' : 'The review stopped'}</p>
          <h1 className="display mt-2 text-[clamp(40px,8vw,72px)] leading-[0.95]">{run.input.business}</h1>
          <p className="mt-4 text-[16px] text-mute">
            {domainOf(run.input.url.includes('://') ? run.input.url : `https://${run.input.url}`)}, for {run.input.service.toLowerCase()} in {run.input.city}
          </p>

          {running ? (
            <ol className="mt-10 space-y-3.5" aria-live="polite">
              {STEPS.map((s, i) => (
                <li key={s.text} className={cx('flex items-center gap-3.5 text-[15.5px] transition-colors duration-300', i < step ? 'text-mute' : i === step ? 'text-bone' : 'text-faint/70')}>
                  <span
                    aria-hidden="true"
                    className={cx('h-2 w-2 shrink-0 rounded-full transition-colors duration-300', i < step ? 'bg-bone/50' : i === step ? 'seo-pulse bg-ember' : 'bg-white/10')}
                  />
                  {s.text}
                  {i === step && <span className="sr-only">(in progress)</span>}
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-10 max-w-[56ch] rounded-[24px] border border-danger/30 bg-danger/[0.06] p-6">
              <p className="text-[16px] leading-relaxed text-bone">{run.error}</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Button variant="ember" onClick={onRetry}>
                  Run it again
                </Button>
                <Button variant="ghost" onClick={onEdit}>
                  Edit the details
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
