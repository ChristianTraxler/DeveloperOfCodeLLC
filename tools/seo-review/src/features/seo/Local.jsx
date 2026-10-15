// Phase 3 pieces of the internal report: the Google Business Profile match, the manual rank
// entry, and the client next to its competitors on the same checks.
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Loader2, MapPin, Plus, Star, X } from 'lucide-react'
import { api } from './api.js'
import { StatusMark } from './Checks.jsx'
import { Button, Field, Input, inputClass } from './ui/core.jsx'
import { scoreTone } from './Report.jsx'
import { cx, domainOf, plural } from './lib.js'

const Heading = ({ id, children, blurb }) => (
  <div>
    <h2 id={id} className="display text-[30px] leading-[1.05] sm:text-[34px]">
      {children}
    </h2>
    {blurb && <p className="mt-3 max-w-[32ch] text-[14.5px] leading-relaxed text-mute">{blurb}</p>}
  </div>
)

function Rating({ rating, reviews }) {
  if (rating == null && !reviews) return <span className="text-faint">No reviews</span>
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <Star size={14} className="fill-amber text-amber" aria-hidden="true" />
      {rating != null ? rating.toFixed(1) : 'n/a'}
      <span className="text-faint">({plural(reviews || 0, 'review')})</span>
    </span>
  )
}

// ── Google Business Profile ─────────────────────────────────────────────────

function Profile({ audit, checks, busy, onPick }) {
  const local = audit.notes?.local
  const gbp = checks.find((c) => c.key === 'gbp')
  const d = gbp?.details || {}
  const [choice, setChoice] = useState('')
  const candidates = local?.candidates || []

  let body
  if (!local?.configured) {
    body = (
      <p className="text-[15px] leading-relaxed text-mute">
        Google Places is not set up, so the profile, reviews and competitors were not looked up. Add <code className="text-bone">GOOGLE_PLACES_API_KEY</code> in Vercel and run the review again. You can still add competitors by hand below.
      </p>
    )
  } else if (local.error) {
    body = <p className="text-[15px] leading-relaxed text-danger">Google Places did not answer: {local.error}. Run the review again.</p>
  } else if (!d.found) {
    body = <p className="text-[15px] leading-relaxed text-mute">No listing matched {audit.business_name} for &ldquo;{local.query}&rdquo;. If the business has one under another name, pick it below.</p>
  } else {
    body = (
      <dl className="grid gap-x-10 gap-y-4 text-[14.5px] sm:grid-cols-2">
        <div>
          <dt className="text-faint">Listing</dt>
          <dd className="mt-1 font-semibold text-bone">
            {d.mapsUrl ? (
              <a href={d.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-line2 underline-offset-4 hover:decoration-ember">
                {d.name} <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ) : (
              d.name
            )}
          </dd>
          {d.address && <dd className="mt-0.5 text-mute">{d.address}</dd>}
        </div>
        <div>
          <dt className="text-faint">On the map for &ldquo;{local.query}&rdquo;</dt>
          <dd className="mt-1 inline-flex items-center gap-1.5 text-bone">
            <MapPin size={14} className="text-ember" aria-hidden="true" />
            {d.position ? `Number ${d.position}` : 'Not in the first 10'}
          </dd>
        </div>
        <div>
          <dt className="text-faint">Reviews</dt>
          <dd className="mt-1 text-bone">
            <Rating rating={d.rating} reviews={d.reviews} />
          </dd>
        </div>
        <div>
          <dt className="text-faint">Category and photos</dt>
          <dd className="mt-1 text-bone">
            {d.category || 'No category'}, {plural(d.photos || 0, 'photo')}
          </dd>
        </div>
      </dl>
    )
  }

  return (
    <section aria-labelledby="seo-gbp" className="mt-16 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
      <Heading id="seo-gbp" blurb="The listing Google matched to this business, from Google Places.">
        Google profile
      </Heading>
      <div className="rounded-[22px] border border-line bg-panel/60 p-5 sm:p-6">
        {body}
        {local?.configured && !local.error && candidates.length > 0 && (
          <form
            className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              if (choice) onPick(choice)
            }}
          >
            <Field label={d.found ? 'Wrong listing?' : 'Pick the listing'} htmlFor="seo-place" className="min-w-0 flex-1">
              <select id="seo-place" value={choice} onChange={(e) => setChoice(e.target.value)} className={cx(inputClass, 'h-[52px] appearance-none')}>
                <option value="">Choose a listing</option>
                {candidates.map((c) => (
                  <option key={c.placeId} value={c.placeId} disabled={c.placeId === local.placeId}>
                    {c.name}
                    {c.website ? ` (${domainOf(c.website)})` : ''}
                  </option>
                ))}
                <option value="none">This business has no Google profile</option>
              </select>
            </Field>
            <Button type="submit" variant="ghost" size="md" disabled={!choice || busy}>
              {busy ? 'Saving' : 'Use this listing'}
            </Button>
          </form>
        )}
      </div>
    </section>
  )
}

// ── Rank, entered by hand ───────────────────────────────────────────────────

function Rank({ audit, ranks, busy, onSave }) {
  const fallback = `${audit.service} ${audit.city.split(',')[0]}`.toLowerCase()
  const [keyword, setKeyword] = useState(ranks[0]?.keyword || fallback)
  const [position, setPosition] = useState('')
  const last = ranks[0]
  const valid = /^\d+$/.test(position) && +position >= 1 && +position <= 100

  return (
    <section aria-labelledby="seo-rank" className="mt-16 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
      <Heading id="seo-rank" blurb="Search Google from a private window near the business and count the results, map pack first.">
        Rank
      </Heading>
      <div className="rounded-[22px] border border-line bg-panel/60 p-5 sm:p-6">
        {last && (
          <p className="mb-5 text-[15px] text-mute">
            Last entered{last.checked_on ? ` ${last.checked_on}` : ''}:{' '}
            <span className="font-semibold text-bone">{last.rank_position ? `number ${last.rank_position}` : 'not in the top 10'}</span> for &ldquo;{last.keyword}&rdquo;.
          </p>
        )}
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) onSave(+position, keyword)
          }}
        >
          <Field label="Search" htmlFor="seo-rank-kw">
            <Input id="seo-rank-kw" value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Position" htmlFor="seo-rank-pos">
            <Input id="seo-rank-pos" inputMode="numeric" placeholder="1 to 100" value={position} onChange={(e) => setPosition(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" variant="ember" size="md" disabled={!valid || busy}>
              {busy ? 'Saving' : 'Save rank'}
            </Button>
            <Button variant="ghost" size="md" disabled={busy} onClick={() => onSave(null, keyword)}>
              Not in the top 10
            </Button>
          </div>
        </form>
      </div>
    </section>
  )
}

// ── Competitors ─────────────────────────────────────────────────────────────

function AddCompetitor({ busy, onAdd }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  return (
    <form
      className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault()
        if (url.trim() && (await onAdd(name.trim(), url.trim()))) {
          setName('')
          setUrl('')
        }
      }}
    >
      <Field label="Competitor name" htmlFor="seo-comp-name">
        <Input id="seo-comp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" maxLength={120} />
      </Field>
      <Field label="Website" htmlFor="seo-comp-url">
        <Input id="seo-comp-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com" inputMode="url" autoCapitalize="none" autoCorrect="off" />
      </Field>
      <Button type="submit" variant="ghost" size="lg" disabled={!url.trim() || busy}>
        <Plus size={16} /> Add
      </Button>
    </form>
  )
}

function Matrix({ audit, checks, competitors, meta }) {
  const done = competitors.filter((c) => c.status === 'complete')
  const mine = Object.fromEntries(checks.map((c) => [c.key, c.status]))
  const keys = Object.keys(meta.checks).filter((k) => k !== 'rank' && k !== 'competitors' && (mine[k] || done.some((c) => c.statuses[k])))
  const cols = [{ name: audit.business_name, overall: audit.overall_score, statuses: mine, me: true }, ...done]
  return (
    <div className="relative mt-6 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6" tabIndex={0} aria-label="Checks side by side">
      <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
        <thead>
          <tr>
            <th scope="col" className="pb-3 pr-4 font-medium text-faint">
              Check
            </th>
            {cols.map((c) => (
              <th key={c.id || 'me'} scope="col" className={cx('w-[110px] px-2 pb-3 text-center align-bottom font-semibold leading-tight', c.me ? 'text-ember' : 'text-bone')}>
                <span className="line-clamp-2">{c.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-line">
            <th scope="row" className="py-3 pr-4 font-medium text-mute">
              Score
            </th>
            {cols.map((c) => (
              <td key={c.id || 'me'} className={cx('display px-2 py-3 text-center text-[24px] tabular-nums', scoreTone(c.overall))}>
                {c.overall ?? '–'}
              </td>
            ))}
          </tr>
          {keys.map((k) => (
            <tr key={k} className="border-t border-line">
              <th scope="row" className="py-2.5 pr-4 font-normal text-bone/90">
                {meta.checks[k].label}
              </th>
              {cols.map((c) => {
                const s = c.statuses[k]
                return (
                  <td key={c.id || 'me'} className="px-2 py-2.5">
                    <span className="flex justify-center" title={s || 'not checked'}>
                      {s ? <StatusMark status={s} size={22} /> : <span className="text-faint">–</span>}
                    </span>
                    <span className="sr-only">{s || 'not checked'}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Competitors({ audit, checks, competitors, meta, busy, running, onAdd, onRemove, onRetry }) {
  const max = meta.maxCompetitors || 3
  return (
    <section aria-labelledby="seo-comp" className="mt-16 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
      <Heading id="seo-comp" blurb="The same checks, run on the businesses that show up first on the map.">
        Competitors
      </Heading>
      <div className="min-w-0 rounded-[22px] border border-line bg-panel/60 p-5 sm:p-6">
        {competitors.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-mute">{audit.notes?.local?.configured ? 'Google did not return any other businesses for this search. Add up to 3 by hand.' : 'Add up to 3 competitor sites to run the same checks on them.'}</p>
        ) : (
          <ul className="border-t border-line">
            {competitors.map((c) => (
              <li key={c.id} className="flex items-start gap-3 border-b border-line py-4 last:border-b-0">
                <span className="display w-8 shrink-0 pt-0.5 text-[22px] leading-none tabular-nums text-faint">{c.position ?? '·'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-mute">
                    {c.site ? (
                      <a href={c.site} target="_blank" rel="noreferrer" className="underline decoration-line2 underline-offset-4 hover:text-bone">
                        {domainOf(c.site)}
                      </a>
                    ) : (
                      <span>No website on Google</span>
                    )}
                    {c.place && <Rating rating={c.place.rating} reviews={c.place.reviews} />}
                    {c.status === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 text-amber">
                        {running && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} {running ? 'Checking' : 'Waiting'}
                      </span>
                    )}
                    {c.status === 'failed' && <span className="text-danger">Could not be checked</span>}
                    {c.error && c.status === 'complete' && <span className="text-faint">{c.error}</span>}
                  </span>
                </span>
                {c.status === 'complete' && <span className={cx('display text-[28px] leading-none tabular-nums', scoreTone(c.overall))}>{c.overall ?? '–'}</span>}
                <Button variant="quiet" size="icon" aria-label={`Remove ${c.name}`} disabled={busy || running} onClick={() => onRemove(c)}>
                  <X size={16} />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {competitors.some((c) => c.status === 'complete') && <Matrix audit={audit} checks={checks} competitors={competitors} meta={meta} />}
        {competitors.some((c) => c.status === 'failed') && !running && (
          <Button variant="ghost" className="mt-5" onClick={onRetry}>
            Try the failed ones again
          </Button>
        )}
        {competitors.length < max && <AddCompetitor busy={busy || running} onAdd={onAdd} />}
      </div>
    </section>
  )
}

// ── The panel, and the competitor runs ─────────────────────────────────────

// data: the full review from getReview. onData replaces it after any change.
export function LocalLayer({ data, onData, toast }) {
  const { audit, checks, meta, competitors = [], ranks = [] } = data
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState(false)
  const started = useRef(new Set())

  // Each competitor runs in its own request (each fits in the 60 second limit), then compare.
  const runPending = async (list) => {
    const todo = list.filter((c) => !started.current.has(c.id))
    if (!todo.length) return
    todo.forEach((c) => started.current.add(c.id))
    setRunning(true)
    try {
      await Promise.allSettled(todo.map((c) => api.runCompetitor(audit.id, c.id)))
      onData(await api.compareCompetitors(audit.id))
    } catch (e) {
      toast(e.message)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    const pending = competitors.filter((c) => c.status === 'pending')
    if (pending.length && !running) runPending(pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitors])

  const act = async (fn, done) => {
    setBusy(true)
    try {
      const out = await fn()
      if (out?.audit) onData(out)
      if (done) toast(done)
      return true
    } catch (e) {
      toast(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Profile audit={audit} checks={checks} busy={busy} onPick={(placeId) => act(() => api.pickPlace(audit.id, placeId), 'Listing updated. Competitors are being checked again.')} />
      <Rank audit={audit} ranks={ranks} busy={busy} onSave={(position, keyword) => act(() => api.setRank(audit.id, position, keyword), 'Rank saved.')} />
      <Competitors
        audit={audit}
        checks={checks}
        competitors={competitors}
        meta={meta}
        busy={busy}
        running={running}
        onAdd={(name, url) =>
          act(async () => {
            const { competitor } = await api.addCompetitor(audit.id, name, url)
            onData({ ...data, competitors: [...competitors, competitor] })
          })
        }
        onRemove={(c) => act(() => api.removeCompetitor(audit.id, c.id))}
        onRetry={() => {
          const failed = competitors.filter((c) => c.status === 'failed')
          failed.forEach((c) => started.current.delete(c.id))
          runPending(failed)
        }}
      />
    </>
  )
}
