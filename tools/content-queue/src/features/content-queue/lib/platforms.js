// Platform rules used by the composer counters and the live preview.
// Limits are the published caption or post limits. `fold` is roughly where the
// feed cuts the text off behind a "more" link; it varies by device, so the UI calls it approximate.

export const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', short: 'FB', limit: 63206, fold: 240, kind: 'feed' },
  { id: 'instagram', label: 'Instagram', short: 'IG', limit: 2200, fold: 125, hashtagMax: 30, kind: 'feed', needsImage: true },
  { id: 'linkedin', label: 'LinkedIn', short: 'IN', limit: 3000, fold: 210, kind: 'feed' },
  { id: 'x', label: 'X', short: 'X', limit: 280, kind: 'feed', urlWeight: 23 },
  { id: 'gbp', label: 'Google Business Profile', shortLabel: 'Business Profile', short: 'GBP', limit: 1500, kind: 'local' },
  { id: 'blog', label: 'Blog', short: 'BLOG', kind: 'long' },
  { id: 'email', label: 'Email', short: 'MAIL', kind: 'long', subjectLimit: 60 },
]

export const PLATFORM_BY_ID = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]))

export const STATUSES = [
  { id: 'idea', label: 'Idea' },
  { id: 'drafting', label: 'Drafting' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'posted', label: 'Posted' },
  { id: 'skipped', label: 'Skipped' },
]

export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]))

const URL_RE = /\bhttps?:\/\/[^\s]+/gi

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null

/** Counts user-perceived characters, so an accented letter or a flag counts once. */
export function graphemes(text = '') {
  if (!text) return 0
  if (segmenter) {
    let n = 0
    for (const _ of segmenter.segment(text)) n++
    return n
  }
  return Array.from(text).length
}

export function words(text = '') {
  const m = text.trim().match(/\S+/g)
  return m ? m.length : 0
}

export function hashtags(text = '') {
  return (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length
}

/**
 * Returns what the counter under the composer should say for a platform.
 * { used, limit, ratio, over, fold, extra[] }
 */
export function measure(platformId, body = '', title = '') {
  const p = PLATFORM_BY_ID[platformId]
  if (!p) return { used: graphemes(body), limit: null, ratio: 0, over: false, extra: [] }

  if (p.kind === 'long') {
    const w = words(body)
    const extra = [`${w.toLocaleString()} ${w === 1 ? 'word' : 'words'}`, `${Math.max(1, Math.round(w / 238))} min read`]
    if (p.id === 'email') {
      const s = graphemes(title)
      return { used: s, limit: p.subjectLimit, ratio: s / p.subjectLimit, over: s > p.subjectLimit, label: 'Subject', soft: true, extra }
    }
    return { used: w, limit: null, ratio: 0, over: false, label: 'Words', extra: [`${Math.max(1, Math.round(w / 238))} min read`] }
  }

  let used = graphemes(body)
  if (p.urlWeight) {
    const urls = body.match(URL_RE) || []
    for (const u of urls) used += p.urlWeight - graphemes(u)
  }
  const extra = []
  if (p.hashtagMax) {
    const h = hashtags(body)
    extra.push(`${h} of ${p.hashtagMax} hashtags`)
  }
  if (p.fold) extra.push(`About ${p.fold} show before "more"`)
  return { used, limit: p.limit, ratio: used / p.limit, over: used > p.limit || (p.hashtagMax && hashtags(body) > p.hashtagMax), fold: p.fold, extra }
}

/** Cuts text near `n` characters without breaking a word. */
export function truncateAt(text, n) {
  const chars = Array.from(text)
  if (chars.length <= n) return { head: text, cut: false }
  let head = chars.slice(0, n).join('')
  const lastSpace = head.lastIndexOf(' ')
  if (lastSpace > n * 0.6) head = head.slice(0, lastSpace)
  return { head: head.replace(/[\s.,;:]+$/, ''), cut: true }
}
