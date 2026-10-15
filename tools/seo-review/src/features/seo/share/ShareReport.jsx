// The client report at /seo/<share_token>: what a business owner sees. Two views:
//   full     score, what is working, Next Steps, Google Business Profile, competitors, packages
//   summary  one page: score, a one-line verdict, the top 3 fixes and one call to action
// Copy rule from the brief: never promise rankings or revenue.
import { useEffect, useState } from 'react'
import { ArrowRight, Download, Mail, Phone, Wrench } from 'lucide-react'
import { Dial, marksFor } from '../Dial.jsx'
import { StatusMark } from '../Checks.jsx'
import { cx } from '../lib.js'
import { getShare, tokenFromLocation } from './shareApi.js'
import { RequestForm } from './RequestForm.jsx'

const fDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const tone = (n) => (n == null ? 'text-faint' : n >= 90 ? 'text-live' : n >= 50 ? 'text-amber' : 'text-danger')
const bar = (n) => (n >= 90 ? 'bg-live' : n >= 50 ? 'bg-amber' : 'bg-danger')
const EFFORT = { small: 'Quick fix', medium: 'Some work', large: 'Bigger job' }

export function verdict(score) {
  if (score == null) return 'We could not score this site yet. The notes below show what we found.'
  if (score >= 90) return 'Your site is in good shape for local search. A few small changes would keep it that way.'
  if (score >= 70) return 'Your site has a solid base. Fixing a few things could improve your chances of showing up for nearby searches.'
  if (score >= 50) return 'Your site is missing some of what Google looks for. Fixing it could help more nearby customers find you.'
  return 'Google may be passing over your site for nearby searches. The fixes below are the place to start.'
}

function viewFromUrl() {
  return new URLSearchParams(window.location.search).get('v') === 'summary' ? 'summary' : 'full'
}

function Toolbar({ view, setView }) {
  const tab = (key, label) => (
    <button
      type="button"
      aria-pressed={view === key}
      onClick={() => setView(key)}
      className={cx('h-11 rounded-full px-4 text-[14px] font-medium transition-colors', view === key ? 'bg-bone text-ink' : 'text-mute hover:text-bone')}
    >
      {label}
    </button>
  )
  return (
    <header className="no-print mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-8 sm:pt-7">
      <a href="/" className="display text-[20px] text-bone">
        Developer of Code
      </a>
      <div className="flex items-center gap-2">
        <div className="flex rounded-full border border-line2 p-1" role="group" aria-label="Report view">
          {tab('summary', 'Summary')}
          {tab('full', 'Full report')}
        </div>
        <button type="button" onClick={() => window.print()} aria-label="Save as PDF" className="grid h-[54px] w-[54px] place-items-center rounded-full border border-line2 text-mute transition-colors hover:text-bone sm:w-auto sm:px-5">
          <span className="flex items-center gap-2 text-[14px] font-medium">
            <Download size={16} aria-hidden="true" />
            <span className="max-sm:hidden">Save as PDF</span>
          </span>
        </button>
      </div>
    </header>
  )
}

function ScoreBand({ data, compact }) {
  const { report, checks, meta } = data
  const working = checks.filter((c) => c.status === 'pass').length
  return (
    <section className="band keep mt-6 sm:mx-4 sm:rounded-[32px] lg:mx-auto lg:max-w-[1180px]">
      <div className="mx-auto grid max-w-[1080px] items-center gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ember">Local SEO review</p>
          <h1 className="display mt-4 text-balance text-[clamp(40px,9vw,76px)] leading-[0.95]">{report.business}</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-mute">
            {report.site} · checked for &ldquo;{report.service} in {report.city}&rdquo; · {fDate.format(new Date(report.ranAt))}
          </p>
          <p className="mt-8 max-w-[44ch] font-display text-[clamp(20px,3.4vw,26px)] italic leading-snug">{verdict(report.overall)}</p>
        </div>
        <Dial marks={marksFor(meta, checks)} size={compact ? 260 : 300} labels reveal className="mx-auto max-w-full" title={`Score ${report.overall ?? 'not set'} out of 100. One mark per check.`}>
          <div>
            <span className={cx('display block text-[76px] leading-none tabular-nums', tone(report.overall))}>{report.overall ?? '–'}</span>
            <span className="mt-1.5 block text-[13px] leading-tight text-mute">
              out of 100
              <br />
              {working} of {checks.length} working
            </span>
          </div>
        </Dial>
      </div>
    </section>
  )
}

function CategoryScores({ report }) {
  const cats = Object.entries(report.categories)
  return (
    <section aria-labelledby="c-cats" className="mt-16">
      <h2 id="c-cats" className="display text-[clamp(30px,5vw,40px)] leading-none">
        Your score by area
      </h2>
      <ul className="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2">
        {cats.map(([key, c]) => (
          <li key={key} className="keep">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[17px] font-semibold">{c.label}</span>
              <span className={cx('display text-[32px] leading-none tabular-nums', tone(c.score))}>{c.score ?? '–'}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-bone/10" aria-hidden="true">
              {c.score != null && <div className={cx('h-full rounded-full', bar(c.score))} style={{ width: `${Math.max(c.score, 2)}%` }} />}
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-mute">{c.score == null ? (key === 'visibility' ? 'Rank not checked. This is part of the Full SEO Review.' : 'Not checked this time.') : c.blurb}</p>
          </li>
        ))}
      </ul>
      {report.dropped.length > 0 && <p className="mt-8 text-[14px] text-faint">Areas that were not checked are left out, and the others are scaled up to make 100.</p>}
    </section>
  )
}

function Working({ checks }) {
  const ok = checks.filter((c) => c.status === 'pass')
  if (!ok.length) return null
  return (
    <section aria-labelledby="c-ok" className="mt-20 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14">
      <div>
        <h2 id="c-ok" className="display text-[clamp(30px,5vw,40px)] leading-[1.05]">
          What is working
        </h2>
        <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-mute">These are already doing their job. Keep them as they are.</p>
      </div>
      <ul className="border-t border-line">
        {ok.map((c) => (
          <li key={c.key} className="flex items-start gap-4 border-b border-line py-4 last:border-b-0">
            <StatusMark status="pass" size={26} />
            <span className="min-w-0">
              <span className="block text-[16.5px] font-semibold">{c.label}</span>
              <span className="mt-0.5 block text-[15px] leading-relaxed text-mute">{c.summary}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Fix({ task, n }) {
  return (
    <li className="keep grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 border-b border-line py-6 last:border-b-0 sm:gap-x-6">
      <span className="display w-9 text-[34px] leading-none tabular-nums text-ember">{n}</span>
      <div className="min-w-0">
        <h3 className="text-[18px] font-semibold leading-snug">{task.title}</h3>
        {task.why && <p className="mt-2 max-w-[64ch] text-[15.5px] leading-relaxed text-mute">{task.why}</p>}
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--lamp-rgb))] px-3 py-1 font-semibold text-[rgb(17_36_72)]">
            <Wrench size={13} aria-hidden="true" /> I can fix this
          </span>
          {task.service && <span className="text-bone/80">{task.service}</span>}
          <span className="text-faint">{EFFORT[task.effort]}</span>
          <span className={task.status === 'fail' ? 'text-danger' : 'text-amber'}>{task.status === 'fail' ? 'Fix' : 'Tighten'}</span>
        </p>
      </div>
    </li>
  )
}

function NextSteps({ tasks, checks }) {
  const skipped = checks.filter((c) => c.status === 'skipped')
  return (
    <section aria-labelledby="c-next" className="mt-20 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14">
      <div>
        <h2 id="c-next" className="display text-[clamp(30px,5vw,40px)] leading-[1.05]">
          Next Steps
        </h2>
        <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-mute">In the order I would do them, biggest wins first.</p>
      </div>
      <div>
        {tasks.length ? <ol className="border-t border-line">{tasks.map((t, i) => <Fix key={i} task={t} n={i + 1} />)}</ol> : <p className="border-t border-line pt-6 text-[16px] text-mute">Nothing to fix on the checks that ran.</p>}
        {skipped.length > 0 && <p className="mt-6 text-[14px] leading-relaxed text-faint">Not checked this time: {skipped.map((c) => c.label).join(', ')}.</p>}
      </div>
    </section>
  )
}

const GBP_ITEMS = ['Business hours are listed and correct', 'Recent photos of your work', 'A link to your website', 'The right main category', 'At least 10 reviews, rated 4.0 or higher']

const GBP_HAS = [
  ['hours', 'Business hours are listed'],
  ['photos', 'Photos of your work'],
  ['website', 'A link to your website'],
  ['category', 'A main category'],
]

function Card({ id, title, children, later }) {
  return (
    <section aria-labelledby={id} className="keep rounded-[26px] border border-line bg-panel p-6 sm:p-8">
      <h2 id={id} className="display text-[clamp(26px,4vw,32px)] leading-[1.05]">
        {title}
      </h2>
      {children}
      {later && <p className="mt-5 text-[13.5px] font-medium text-ember">Part of the Full SEO Review</p>}
    </section>
  )
}

function Profile({ report, local }) {
  const { gbp, reviews } = local
  if (!gbp) {
    return (
      <Card id="c-gbp" title="Google Business Profile" later>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">It is often the first thing people see when they search for a local business. The full review checks each of these.</p>
        <ul className="mt-5 space-y-2.5">
          {GBP_ITEMS.map((t) => (
            <li key={t} className="flex items-start gap-3 text-[15px]">
              <StatusMark status="later" size={22} />
              {t}
            </li>
          ))}
        </ul>
      </Card>
    )
  }
  if (!gbp.found) {
    return (
      <Card id="c-gbp" title="Google Business Profile">
        <p className="mt-3 text-[15px] leading-relaxed text-mute">
          We could not find a Google Business Profile for {report.business} in {report.city}. The profile is what puts a business on the map, so setting one up is usually the first fix. If you already have one under another name, it should match the name on your website.
        </p>
      </Card>
    )
  }
  return (
    <Card id="c-gbp" title="Google Business Profile">
      <p className="mt-3 text-[15px] leading-relaxed text-mute">
        Your listing{gbp.category ? ` as a ${gbp.category.toLowerCase()}` : ''}. Complete profiles get more calls, and Google uses these details to pick who to show.
      </p>
      <ul className="mt-5 space-y-2.5">
        {GBP_HAS.map(([k, t]) => (
          <li key={k} className="flex items-start gap-3 text-[15px]">
            <StatusMark status={gbp.has?.[k] ? 'pass' : 'fail'} size={22} />
            {t}
          </li>
        ))}
        {reviews && (
          <li className="flex items-start gap-3 text-[15px]">
            <StatusMark status={reviews.status} size={22} />
            <span>
              {reviews.count ?? 0} {reviews.count === 1 ? 'review' : 'reviews'}
              {reviews.rating != null ? `, rated ${reviews.rating.toFixed(1)}` : ''}
              {reviews.competitorAverage != null && <span className="block text-[13.5px] text-mute">Nearby competitors average {reviews.competitorAverage}.</span>}
            </span>
          </li>
        )}
      </ul>
    </Card>
  )
}

function Rivals({ data }) {
  const { report, local, checks } = data
  const comps = local.competitors
  const rank = local.rank
  if (!comps.length) {
    return (
      <Card id="c-comp" title="Next to your competitors" later>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">
          The full review runs these same checks on the top 3 {report.service.toLowerCase()} businesses in {report.city}, so you can see where you are ahead and where they are.
        </p>
        <div className="mt-6 space-y-3" aria-hidden="true">
          {[report.business, 'Competitor 1', 'Competitor 2', 'Competitor 3'].map((name, i) => (
            <div key={name} className="flex items-center gap-3">
              <span className={cx('w-32 truncate text-[13.5px]', i ? 'text-faint' : 'font-semibold')}>{name}</span>
              <span className="h-2 flex-1 rounded-full bg-bone/10">{i === 0 && report.overall != null && <span className={cx('block h-full rounded-full', bar(report.overall))} style={{ width: `${report.overall}%` }} />}</span>
            </div>
          ))}
        </div>
      </Card>
    )
  }
  const rows = [{ name: report.business, overall: report.overall, me: true }, ...comps]
  const summary = checks.find((c) => c.key === 'competitors' && c.status !== 'skipped')
  return (
    <Card id="c-comp" title="Next to your competitors">
      <p className="mt-3 text-[15px] leading-relaxed text-mute">
        The same checks, run on the {comps.length === 1 ? 'business' : `${comps.length} businesses`} that show up first for {report.service.toLowerCase()} in {report.city}.
      </p>
      <ul className="mt-6 space-y-3.5">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_2.5rem] items-center gap-3">
            <span className={cx('truncate text-[14px]', r.me ? 'font-semibold' : 'text-bone/85')}>{r.me ? 'You' : r.name}</span>
            <span className="h-2 rounded-full bg-bone/10">{r.overall != null && <span className={cx('block h-full rounded-full', bar(r.overall))} style={{ width: `${Math.max(r.overall, 2)}%` }} />}</span>
            <span className={cx('text-right text-[15px] font-semibold tabular-nums', tone(r.overall))}>{r.overall ?? '–'}</span>
            {!r.me && r.overall == null && <span className="col-span-3 -mt-2 text-[13px] text-faint">No website to check</span>}
          </li>
        ))}
      </ul>
      {summary && <p className="mt-5 text-[15px] leading-relaxed">{summary.summary}</p>}
      {rank && (
        <p className="mt-3 text-[15px] leading-relaxed text-mute">
          {rank.position ? `You show up number ${rank.position}` : 'You are not on the first page'} when people search &ldquo;{rank.keyword}&rdquo;.
        </p>
      )}
    </Card>
  )
}

function Local({ data }) {
  const local = data.local || { competitors: [] }
  return (
    <div className="mt-20 grid gap-6 md:grid-cols-2">
      <Profile report={data.report} local={local} />
      <Rivals data={{ ...data, local }} />
    </div>
  )
}

function Packages({ data }) {
  const { offers, recommended } = data
  return (
    <section aria-labelledby="c-help" className="mt-20">
      <h2 id="c-help" className="display text-[clamp(30px,5vw,40px)] leading-none">
        How I can help
      </h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {offers.map((o) => {
          const rec = o.key === recommended
          return (
            <li key={o.key} className={cx('keep flex flex-col rounded-[26px] border p-6', rec ? 'border-ember bg-panel shadow-[0_24px_60px_-34px_rgba(176,66,22,0.55)]' : 'border-line')}>
              {rec && <span className="mb-3 self-start rounded-full bg-[rgb(var(--lamp-rgb))] px-3 py-1 text-[12.5px] font-semibold text-[rgb(17_36_72)]">Recommended for you</span>}
              <h3 className="text-[18px] font-semibold">{o.name}</h3>
              <p className="display mt-2 text-[26px] leading-none">{o.price}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-mute">{o.blurb}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function CallToAction({ data, summary }) {
  const { brand, tasks } = data
  return (
    <section className="band keep mt-20 sm:mx-4 sm:rounded-[32px] lg:mx-auto lg:max-w-[1180px]">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-8 px-4 py-12 sm:px-8 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-[40ch]">
          <h2 className="display text-[clamp(30px,5vw,42px)] leading-[1.02]">Want to go through it together?</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-mute">I will walk you through the report in 15 minutes and tell you what I would fix first. No cost and no pressure.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href={brand.bookUrl} className="inline-flex h-[54px] items-center justify-center gap-2 rounded-full bg-[rgb(var(--lamp-rgb))] px-7 text-[16px] font-semibold text-[rgb(17_36_72)] transition-transform active:scale-[0.98]">
            Book a 15-minute walkthrough <ArrowRight size={17} aria-hidden="true" />
          </a>
          {!summary && tasks.length > 0 && (
            <a href="#c-request" className="no-print inline-flex h-[54px] items-center justify-center rounded-full border border-line2 px-6 text-[15px] font-medium transition-colors hover:border-bone/50">
              Request these fixes
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

function Footer({ brand }) {
  return (
    <footer className="mx-auto mt-16 max-w-[1080px] px-4 pb-16 sm:px-8">
      <div className="border-t border-line pt-8 text-[14px] leading-relaxed text-mute">
        <p className="text-bone">
          Prepared by {brand.person}, {brand.company}.
        </p>
        <p className="mt-1">{brand.line}</p>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <a className="inline-flex min-h-[44px] items-center gap-2 underline decoration-line2 underline-offset-4 hover:text-bone" href={`mailto:${brand.email}`}>
            <Mail size={15} aria-hidden="true" />
            {brand.email}
          </a>
          <a className="inline-flex min-h-[44px] items-center gap-2 underline decoration-line2 underline-offset-4 hover:text-bone" href={`tel:${brand.phone.replace(/[^\d]/g, '')}`}>
            <Phone size={15} aria-hidden="true" />
            {brand.phone}
          </a>
        </p>
        <p className="mt-6 max-w-[70ch] text-[13px] text-faint">This review looks at what Google can see on your home page today. Fixing these things can improve your chances in local search, but no one can promise a ranking.</p>
      </div>
    </footer>
  )
}

function Summary({ data }) {
  const top = data.tasks.slice(0, 3)
  return (
    <>
      <ScoreBand data={data} compact />
      <main className="mx-auto max-w-[1080px] px-4 sm:px-8">
        <section aria-labelledby="c-top" className="mt-16">
          <h2 id="c-top" className="display text-[clamp(30px,5vw,40px)] leading-none">
            {top.length ? `The top ${top.length === 1 ? 'thing' : `${top.length} things`} to fix` : 'Nothing urgent to fix'}
          </h2>
          {top.length > 0 && <ol className="mt-6 border-t border-line">{top.map((t, i) => <Fix key={i} task={t} n={i + 1} />)}</ol>}
        </section>
      </main>
      <CallToAction data={data} summary />
      <Footer brand={data.brand} />
    </>
  )
}

function Full({ data }) {
  return (
    <>
      <ScoreBand data={data} />
      <main className="mx-auto max-w-[1080px] px-4 sm:px-8">
        <CategoryScores report={data.report} />
        <Working checks={data.checks} />
        <NextSteps tasks={data.tasks} checks={data.checks} />
        <Local data={data} />
        <Packages data={data} />
        <RequestForm data={data} />
      </main>
      <CallToAction data={data} />
      <Footer brand={data.brand} />
    </>
  )
}

export function ShareReport() {
  const [state, setState] = useState({ status: 'loading' })
  const [view, setViewState] = useState(viewFromUrl)

  useEffect(() => {
    getShare(tokenFromLocation())
      .then((data) => {
        setState({ status: 'ready', data })
        document.title = `${data.report.business}: local SEO review | Developer of Code`
      })
      .catch((e) => setState({ status: 'error', error: e.message }))
  }, [])

  const setView = (v) => {
    setViewState(v)
    const u = new URL(window.location.href)
    if (v === 'summary') u.searchParams.set('v', 'summary')
    else u.searchParams.delete('v')
    window.history.replaceState(null, '', u)
    window.scrollTo({ top: 0 })
  }

  if (state.status === 'loading') {
    return (
      <div className="grid min-h-[70vh] place-items-center" aria-busy="true">
        <p className="text-[15px] text-mute">Loading your report</p>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-[560px] content-center px-4">
        <h1 className="display text-[40px] leading-tight">This report is not available</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-mute">{state.error}</p>
        <p className="mt-6 text-[15px]">
          <a className="underline underline-offset-4" href="mailto:DeveloperOfCodeLLC@Gmail.com">
            Email Christian
          </a>{' '}
          for a new link.
        </p>
      </main>
    )
  }
  return (
    <div className="pb-2">
      <Toolbar view={view} setView={setView} />
      {view === 'summary' ? <Summary data={state.data} /> : <Full data={state.data} />}
    </div>
  )
}

