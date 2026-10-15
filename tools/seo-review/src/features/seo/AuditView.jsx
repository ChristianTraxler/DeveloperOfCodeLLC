// One review: the dial and tally up top, page speed, then every check grouped by category.
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, RotateCw, Trash2 } from 'lucide-react'
import { api, isDemo } from './api.js'
import { Dial, marksFor } from './Dial.jsx'
import { CheckRow, StatusMark } from './Checks.jsx'
import { Button } from './ui/core.jsx'
import { Sheet } from './ui/Sheet.jsx'
import { STATUS, bySeverity, cx, domainOf, longWhen, seconds, tally } from './lib.js'

function scoreTone(n) {
  if (n == null) return 'text-faint'
  return n >= 90 ? 'text-live' : n >= 50 ? 'text-amber' : 'text-danger'
}
function scoreColor(n) {
  return n >= 90 ? STATUS.pass.color : n >= 50 ? STATUS.warn.color : STATUS.fail.color
}

function Gauge({ label, run }) {
  const n = run?.score
  const r = 44
  const len = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[104px] w-[104px] shrink-0">
        <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="52" cy="52" r={r} fill="none" stroke="rgba(236,232,223,0.08)" strokeWidth="7" />
          {n != null && <circle cx="52" cy="52" r={r} fill="none" stroke={scoreColor(n)} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(n / 100) * len} ${len}`} />}
        </svg>
        <span className={cx('display absolute inset-0 grid place-items-center text-[38px] tabular-nums', scoreTone(n))}>{n ?? '–'}</span>
      </div>
      <div>
        <p className="text-[16px] font-semibold">{label}</p>
        <p className="mt-0.5 text-[13.5px] text-mute">{n == null ? 'Not measured' : n >= 90 ? 'Fast' : n >= 50 ? 'Could be faster' : 'Slow'}</p>
      </div>
    </div>
  )
}

function SpeedPanel({ check }) {
  const { mobile, desktop, cached, source } = check.details || {}
  if (!mobile && !desktop) return null
  const metrics = (mobile || desktop).metrics || []
  return (
    <section aria-labelledby="seo-speed" className="mt-16 grid gap-10 rounded-[30px] border border-line bg-panel/70 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-14">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="seo-speed" className="display text-[30px] leading-none sm:text-[34px]">
            Page speed
          </h2>
          <p className="text-[13px] text-faint">
            {source === 'lighthouse' ? 'Measured with Lighthouse for this preview' : cached ? 'From a Google PageSpeed run in the last 24 hours' : 'Measured by Google PageSpeed'}
          </p>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Gauge label="On a phone" run={mobile} />
          <Gauge label="On a computer" run={desktop} />
        </div>
        {metrics.length > 0 && (
          <dl className="mt-9 grid gap-x-10 sm:grid-cols-2">
            {metrics.map((m) => (
              <div key={m.id} className="flex items-baseline justify-between gap-4 border-t border-line py-3">
                <dt className="text-[14px] text-mute">{m.label}</dt>
                <dd className={cx('text-[15px] font-semibold tabular-nums', m.score == null ? 'text-faint' : m.score >= 0.9 ? 'text-live' : m.score >= 0.5 ? 'text-amber' : 'text-danger')}>{m.value || 'n/a'}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-4 text-[13px] text-faint">Times are for the phone test, on a mid-range phone over a slow mobile connection.</p>
      </div>
      {mobile?.screenshot && (
        <figure className="mx-auto w-[200px] lg:w-full">
          <div className="seo-phone overflow-hidden rounded-[30px] border border-line2 bg-black p-[7px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
            <img src={mobile.screenshot} alt="The home page as it loaded on a phone during the test" className="block w-full rounded-[23px]" />
          </div>
          <figcaption className="mt-3 text-center text-[12.5px] text-faint">How the page looked on the phone test</figcaption>
        </figure>
      )}
    </section>
  )
}

function Tally({ checks, laterCount }) {
  const t = tally(checks)
  const items = [
    ['fail', t.fail],
    ['warn', t.warn],
    ['pass', t.pass],
    ['skipped', t.skipped],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
      {items.map(([k, n]) => (
        <div key={k} className={cx(k === 'skipped' && n === 0 && 'opacity-50')}>
          <dt className="sr-only">{STATUS[k].long}</dt>
          <dd>
            <span className={cx('display block text-[52px] leading-none tabular-nums sm:text-[60px]', n ? STATUS[k].tone : 'text-faint')}>{n}</span>
            <span className="mt-2 block text-[14px] text-mute">{STATUS[k].long}</span>
          </dd>
        </div>
      ))}
      <p className="col-span-2 text-[13.5px] leading-relaxed text-faint sm:col-span-4">
        {checks.length} of {checks.length + laterCount} checks ran. The overall score and the Next Steps list come in Phase 2.
      </p>
    </dl>
  )
}

function Category({ catKey, cat, checks, laterChecks }) {
  if (!checks.length && !laterChecks.length) return null
  return (
    <section aria-labelledby={`seo-cat-${catKey}`} className="mt-16 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
      <div>
        <h2 id={`seo-cat-${catKey}`} className="display text-[30px] leading-[1.05] sm:text-[34px]">
          {cat.label}
        </h2>
        <p className="mt-3 max-w-[32ch] text-[14.5px] leading-relaxed text-mute">{cat.blurb}</p>
      </div>
      <ul className="border-t border-line">
        {checks.map((c) => (
          <CheckRow key={c.key} check={c} />
        ))}
        {laterChecks.map(([key, m]) => (
          <li key={key} className="flex items-center gap-4 border-b border-line py-5 last:border-b-0 sm:gap-5">
            <StatusMark status="later" />
            <span className="min-w-0 flex-1">
              <span className="text-[16.5px] font-semibold text-mute">{m.label}</span>
              <span className="mt-1 block text-[14.5px] text-faint">Comes with the local layer in Phase 3.</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AuditView({ id, cache, onBack, onRerun, onDelete }) {
  const [state, setState] = useState(() => (cache.current.get(id) ? { status: 'ready', ...cache.current.get(id) } : { status: 'loading' }))
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let live = true
    if (cache.current.get(id)) return
    api
      .getReview(id)
      .then((data) => {
        cache.current.set(id, data)
        if (live) setState({ status: 'ready', ...data })
      })
      .catch((e) => live && setState({ status: 'error', error: e.message }))
    return () => {
      live = false
    }
  }, [id, cache])

  if (state.status === 'loading') {
    return (
      <main className="mx-auto max-w-[1120px] px-4 pt-14 sm:px-6 lg:px-10" aria-busy="true">
        <div className="grid items-center gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
          <span className="seo-shimmer mx-auto block h-[260px] w-[260px] rounded-full" />
          <div className="space-y-4">
            <span className="seo-shimmer block h-14 w-2/3 rounded-full" />
            <span className="seo-shimmer block h-4 w-1/3 rounded-full" />
          </div>
        </div>
      </main>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="mx-auto max-w-[1120px] px-4 pt-14 sm:px-6 lg:px-10">
        <h1 className="display text-[44px] leading-none">This review did not open</h1>
        <p className="mt-4 text-[16px] text-mute">{state.error}</p>
        <Button variant="ghost" className="mt-6" onClick={onBack}>
          <ArrowLeft size={16} /> All reviews
        </Button>
      </main>
    )
  }

  const { audit, checks, meta } = state
  const notes = audit.notes?.notes || []
  const later = Object.entries(meta.checks).filter(([, m]) => m.phase > 1)
  const speed = checks.find((c) => c.key === 'page_speed')
  const url = audit.final_url || audit.site_url

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-10">
      <div className="flex items-center justify-between gap-3">
        <Button variant="quiet" onClick={onBack} className="-ml-3">
          <ArrowLeft size={16} /> All reviews
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onRerun(audit)}>
            <RotateCw size={15} />
            <span className="max-sm:hidden">Run again</span>
            <span className="sm:hidden">Rerun</span>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete this review" onClick={() => setConfirm(true)}>
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <header className="mt-10 grid items-center gap-10 lg:mt-14 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16">
        <Dial marks={marksFor(meta, checks)} size={300} labels reveal className="mx-auto" title={`Dial for ${audit.business_name}: one mark per check`}>
          <div>
            <span className="display block text-[64px] leading-none tabular-nums">{checks.length - tally(checks).fail - tally(checks).warn - tally(checks).skipped}</span>
            <span className="mt-1.5 block text-[13px] leading-tight text-mute">
              of {checks.length} checks
              <br />
              working
            </span>
          </div>
        </Dial>
        <div className="min-w-0">
          <h1 className="display text-balance text-[clamp(42px,8vw,80px)] leading-[0.92]">{audit.business_name}</h1>
          <a href={url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-[16px] text-bone/85 underline decoration-line2 underline-offset-4 transition-colors hover:text-white hover:decoration-ember">
            {domainOf(url)} <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <dl className="mt-7 grid gap-x-10 gap-y-4 text-[14.5px] sm:grid-cols-3">
            <div>
              <dt className="text-faint">Search it was checked for</dt>
              <dd className="mt-1 text-bone">
                {audit.service} in {audit.city}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Ran</dt>
              <dd className="mt-1 text-bone">{longWhen(audit.created_at)}</dd>
            </div>
            <div>
              <dt className="text-faint">Took</dt>
              <dd className="mt-1 text-bone">{seconds(audit.duration_ms)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="mt-14 border-t border-line pt-10" aria-label="Results at a glance">
        <Tally checks={checks} laterCount={later.length} />
        {(notes.length > 0 || audit.error) && (
          <ul className="mt-8 space-y-2">
            {audit.error && <li className="text-[14px] leading-relaxed text-danger">The home page could not be read: {audit.error}.</li>}
            {notes.map((n) => (
              <li key={n} className="text-[14px] leading-relaxed text-mute">
                {n}
              </li>
            ))}
          </ul>
        )}
      </section>

      {speed && <SpeedPanel check={speed} />}

      {Object.entries(meta.categories).map(([key, cat]) => (
        <Category
          key={key}
          catKey={key}
          cat={cat}
          checks={checks.filter((c) => c.category === key).sort(bySeverity)}
          laterChecks={later.filter(([, m]) => m.category === key)}
        />
      ))}

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        variant="dialog"
        title={`Delete the review of ${audit.business_name}?`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              className="ml-auto"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true)
                try {
                  await onDelete(audit)
                } finally {
                  setDeleting(false)
                  setConfirm(false)
                }
              }}
            >
              {deleting ? 'Deleting' : 'Delete review'}
            </Button>
          </>
        }
      >
        <p className="text-[15px] leading-relaxed text-mute">The review and all of its checks are removed from Supabase. {isDemo ? 'In this preview it comes back when you reload.' : 'This cannot be undone.'}</p>
      </Sheet>
    </main>
  )
}
