// Groups of people you can send to. Each test runs against one contact.
import { daysSince, monthsSince } from '../lib/format.js'

export const SEGMENTS = [
  { id: 'all', name: 'Everyone', note: 'Every contact on your list', test: () => true },
  { id: 'clients', name: 'Current clients', note: 'On a care plan or with a build in progress', test: (c) => c.type === 'client' },
  { id: 'care', name: 'On a care plan', note: 'Hosting, backups and updates with you', test: (c) => c.type === 'client' && c.plan === 'care' },
  { id: 'building', name: 'Building now', note: 'A site in progress with you', test: (c) => c.type === 'client' && c.plan === 'build' },
  { id: 'past', name: 'Past clients', note: 'Finished projects, not on a plan', test: (c) => c.type === 'past' },
  {
    id: 'older',
    name: 'Older sites',
    note: (o) => `Launched more than ${o.siteMonths} months ago`,
    test: (c, o, now) => (c.type === 'client' || c.type === 'past') && !!c.launched && monthsSince(c.launched, now) > o.siteMonths,
    param: { key: 'siteMonths', options: [12, 18, 24], unit: 'months' },
  },
  { id: 'leads', name: 'Leads', note: 'Reached out or signed up', test: (c) => c.type === 'lead' },
  { id: 'newleads', name: 'New leads', note: 'Joined in the last 30 days', test: (c, o, now) => c.type === 'lead' && daysSince(c.since, now) <= 30 },
  {
    id: 'quiet',
    name: 'Quiet leads',
    note: (o) => `No reply in ${o.quietDays} days`,
    test: (c, o, now) => c.type === 'lead' && daysSince(c.lastReply || c.since, now) > o.quietDays,
    param: { key: 'quietDays', options: [30, 60, 90], unit: 'days' },
  },
  { id: 'bll', name: 'BusinessLaunchList', note: 'Signed up on businesslaunchlist.com', test: (c) => c.type === 'lead' && c.source === 'BusinessLaunchList' },
]

export const segmentById = (id) => SEGMENTS.find((s) => s.id === id)

export function segmentNote(segment, audience) {
  return typeof segment.note === 'function'
    ? segment.note({ siteMonths: audience?.siteMonths || 18, quietDays: audience?.quietDays || 60 })
    : segment.note
}

export const canEmail = (c) => !!c.email && !!c.optedIn && !c.unsubscribed

const opts = (audience) => ({ siteMonths: audience?.siteMonths || 18, quietDays: audience?.quietDays || 60 })

export function inSegment(contacts, id, audience, now = new Date()) {
  const seg = segmentById(id)
  if (!seg) return []
  const o = opts(audience)
  return contacts.filter((c) => seg.test(c, o, now))
}

export const segmentCount = (contacts, id, audience, now) => inSegment(contacts, id, audience, now).filter(canEmail).length

// Everyone the audience points at, split into who gets it and who is left out (and why).
export function resolveAudience(contacts, audience = {}, now = new Date()) {
  const ids = new Set()
  ;(audience.segments || []).forEach((id) => inSegment(contacts, id, audience, now).forEach((c) => ids.add(c.id)))
  ;(audience.people || []).forEach((id) => ids.add(id))
  const matched = contacts.filter((c) => ids.has(c.id))
  return {
    matched,
    recipients: matched.filter(canEmail),
    notOptedIn: matched.filter((c) => c.email && !c.optedIn && !c.unsubscribed),
    unsubscribed: matched.filter((c) => c.unsubscribed),
    noEmail: matched.filter((c) => !c.email),
  }
}

export function audienceLabel(audience) {
  const names = (audience?.segments || []).map((id) => segmentById(id)?.name).filter(Boolean)
  const extra = (audience?.people || []).length
  if (!names.length && !extra) return 'No one yet'
  const base = names.join(', ')
  if (!extra) return base
  const more = `${extra} ${extra === 1 ? 'person' : 'people'} you added`
  return base ? `${base}, plus ${more}` : more
}

export const TYPE_LABEL = { client: 'Current client', past: 'Past client', lead: 'Lead' }
