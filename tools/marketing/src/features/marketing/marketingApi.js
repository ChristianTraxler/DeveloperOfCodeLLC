// The ONLY file that talks to the backend (api/marketing.mjs on the same site).
// Everything is saved in Supabase and sent through Resend by the server.

import { getToken } from '../../app/session.js'
import { DEFAULT_SETTINGS } from './data/demo.js'
import { renderEmail, campaignLinks, inboxLine } from './email/render.js'

const ENDPOINT = '/api/marketing'
const SETTINGS_ID = 'main'

async function call(action, body) {
  const token = await getToken()
  let res
  try {
    res = await fetch(`${ENDPOINT}?action=${action}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status}).`)
  return data
}

// Clicks come back as the URL that was clicked. Reports speak in link names.
function withLabels(campaign) {
  const stats = campaign.stats
  if (!stats) return campaign
  const links = campaignLinks(campaign)
  const labelFor = (url) => links.find((l) => l.url === url)?.label || 'Link'
  const people = stats.people.map((p) => {
    const clickedContact = p.clicks.some((u) => /^(mailto|tel):/i.test(u))
    return { ...p, clicks: p.clicks.map(labelFor), inquired: clickedContact }
  })
  return { ...campaign, stats: { ...stats, links: links.map(({ label, url }) => ({ label, url })), people, live: null } }
}

export async function loadState() {
  const data = await call('load')
  return {
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    hasSettings: !!data.settings,
    contacts: data.contacts,
    campaigns: data.campaigns.map(withLabels),
  }
}

// Fields the server owns. The browser never writes them, so they stay out of change detection.
const SERVER_CAMPAIGN = new Set(['stats', 'status', 'sentAt', 'scheduledFor', 'updatedAt'])
const SERVER_CONTACT = new Set(['unsubscribed', 'unsubscribedAt'])
const fingerprint = (obj, skip) => JSON.stringify(obj, (k, v) => (skip.has(k) ? undefined : v))

export function snapshot(state) {
  const map = new Map()
  map.set(`settings:${SETTINGS_ID}`, fingerprint(state.settings, new Set()))
  state.contacts.forEach((c) => map.set(`contact:${c.id}`, fingerprint(c, SERVER_CONTACT)))
  state.campaigns.forEach((c) => map.set(`campaign:${c.id}`, fingerprint(c, SERVER_CAMPAIGN)))
  return map
}

// Sends what changed since `before` (a snapshot). Returns the new snapshot on success.
export async function saveChanges(before, state) {
  const after = snapshot(state)
  const upsert = []
  const remove = []
  const byKey = new Map([[`settings:${SETTINGS_ID}`, { kind: 'settings', id: SETTINGS_ID, data: state.settings }]])
  state.contacts.forEach((c) => byKey.set(`contact:${c.id}`, { kind: 'contact', id: c.id, data: c }))
  state.campaigns.forEach((c) => byKey.set(`campaign:${c.id}`, { kind: 'campaign', id: c.id, data: stripStats(c) }))
  for (const [key, fp] of after) if (before.get(key) !== fp) upsert.push(byKey.get(key))
  for (const key of before.keys()) {
    if (!after.has(key)) {
      const [kind, ...rest] = key.split(':')
      remove.push({ kind, id: rest.join(':') })
    }
  }
  if (upsert.length || remove.length) await call('save', { upsert, remove })
  return after
}

const stripStats = ({ stats, ...rest }) => rest // eslint-disable-line no-unused-vars

const messagesFor = (campaign, settings, recipients) =>
  recipients.map((contact) => ({
    contactId: contact.id,
    subject: inboxLine(campaign, contact).subject,
    html: renderEmail(campaign, { settings, contact, preview: false }),
  }))

export async function sendTest(campaign, settings, contact, to) {
  await call('test', { to, subject: inboxLine(campaign, contact).subject, html: renderEmail(campaign, { settings, contact, preview: false }) })
}

// when = null sends now; a Date schedules it. Returns the campaign as the server now has it.
export async function sendCampaign(campaign, settings, recipients, when = null) {
  const out = await call('send', { campaignId: campaign.id, messages: messagesFor(campaign, settings, recipients), scheduledAt: when ? new Date(when).toISOString() : null })
  return out
}

export async function cancelScheduled(campaign) {
  return (await call('cancel', { campaignId: campaign.id })).campaign
}
