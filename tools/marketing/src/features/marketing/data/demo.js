// Example people, emails and results so the preview opens in a realistic state.
// Every business and person here is made up. Phase 2 replaces this file with real data.
import { seeded, pick, between, chance, weighted, shuffle, hashString } from '../lib/rng.js'
import { addDays, atTime, nextWeekday, asDate } from '../lib/format.js'
import { makeBlock as b } from './blocks.js'
import { fromTemplate } from './templates.js'
import { resolveAudience } from './segments.js'
import { campaignLinks } from '../email/render.js'
import { mailto } from './library.js'

export const DEFAULT_SETTINGS = {
  fromName: 'Christian at Developer of Code',
  fromEmail: 'hello@developerofcode.com',
  replyTo: 'DeveloperOfCodeLLC@Gmail.com',
  testEmail: 'DeveloperOfCodeLLC@Gmail.com',
  legalName: 'Developer of Code, LLC',
  mailingAddress: '',
  phone: '(828) 781-4674',
}

const FIRST = ['Dana', 'Marcus', 'Tasha', 'Brent', 'Whitney', 'Caleb', 'Renee', 'Jamal', 'Heather', 'Travis', 'Amber', 'Dwayne', 'Lindsey', 'Cody', 'Monique', 'Bryce', 'Erin', 'Hector', 'Jada', 'Luis', 'Megan', 'Tyler', 'Sierra', 'Andre', 'Becca', 'Colton', 'Destiny', 'Ethan', 'Faith', 'Grant', 'Hannah', 'Isaac', 'Jenna', 'Kendrick', 'Leah', 'Mason', 'Nicole', 'Owen', 'Paige', 'Rachel', 'Shane', 'Tori', 'Vanessa', 'Wesley', 'Yolanda', 'Zach', 'Priya', 'Minh', 'Rosa', 'Darnell', 'Kayla', 'Garrett', 'April', 'Logan', 'Bianca', 'Raymond', 'Carla', 'Desmond', 'Ivy', 'Reggie']
const LAST = ['Carswell', 'Hensley', 'Pruitt', 'Abernathy', 'Yount', 'Sigmon', 'Huffman', 'Bolick', 'Setzer', 'Teague', 'Isenhour', 'Moretz', 'Whisnant', 'Lail', 'Bumgarner', 'Starnes', 'Reep', 'Mull', 'Propst', 'Barringer', 'Hefner', 'Kiser', 'Fox', 'Rhyne', 'Shook', 'Deal', 'Keller', 'Coffey', 'Pope', 'Townsend', 'Ingle', 'Rudisill', 'Hoyle', 'Fortner', 'Mathis', 'Cline', 'Bost', 'Abee', 'Cloninger', 'Lutz']
const PLACES = ['Brushy Mountain', 'Catawba Valley', "Fiddler's Run", 'Bakers Mountain', 'Lake Hickory', 'Pine Hollow', 'Three Forks', 'Redbud', 'High Shoals', 'Sawmill Creek', 'Stonecrest', 'Depot Street', 'Union Square', 'Wildflower', 'Blackberry Lane', 'Foothills', 'Cedar Lane', 'Mill Pond', 'South Fork', 'Rocky Ridge', 'Silver Creek', 'Henry River', 'Jacob Fork', 'Lyle Creek', 'Bunker Hill', 'Mountain View', 'Oxford Ford', 'Big Ivy', 'Long Shoals', 'Clover Hill', 'Ironside', 'Old Dutch', 'Sweetgum', 'Linville']
const TRADES = [
  ['Roofing', 'Trades'], ['Landscaping', 'Trades'], ['Pressure Washing', 'Trades'], ['Electric', 'Trades'], ['Plumbing', 'Trades'], ['Heating and Air', 'Trades'], ['Painting', 'Trades'], ['Cabinetry', 'Trades'], ['Tree Service', 'Trades'], ['Grading', 'Trades'],
  ['Coffee Co.', 'Food and drink'], ['Bakery', 'Food and drink'], ['Barbecue', 'Food and drink'], ['Catering', 'Food and drink'], ['Brewing', 'Food and drink'], ['Farm Market', 'Food and drink'], ['Food Truck', 'Food and drink'],
  ['Family Dental', 'Health and wellness'], ['Chiropractic', 'Health and wellness'], ['Fitness', 'Health and wellness'], ['Yoga Studio', 'Health and wellness'], ['Massage', 'Health and wellness'], ['Animal Clinic', 'Health and wellness'],
  ['Boutique', 'Retail'], ['Outfitters', 'Retail'], ['Hardware', 'Retail'], ['Florist', 'Retail'], ['Books', 'Retail'], ['Antiques', 'Retail'],
  ['Salon', 'Beauty'], ['Barber Co.', 'Beauty'], ['Nail Studio', 'Beauty'],
  ['Law Office', 'Professional services'], ['Realty', 'Professional services'], ['Insurance', 'Professional services'], ['Bookkeeping', 'Professional services'], ['Photography', 'Professional services'],
  ['Auto Works', 'Auto'], ['Tire and Lube', 'Auto'], ['Detailing', 'Auto'],
  ['Community Church', 'Church and nonprofit'], ['Event Barn', 'Events'], ['Music Lessons', 'Education'], ['Martial Arts', 'Education'],
]
const CITIES = ['Hickory', 'Newton', 'Conover', 'Claremont', 'Maiden', 'Lincolnton', 'Morganton', 'Lenoir', 'Granite Falls', 'Taylorsville', 'Statesville', 'Valdese', 'Catawba', 'Sherrills Ford', 'Denver', 'Mooresville', 'Boone', 'Drexel']

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '')
const iso = (d) => asDate(d).toISOString()

// Clients that match the sites in your work library, so the examples line up
const NAMED = [
  { first: 'Dana', last: 'Teague', business: 'Ironwood Roofing', industry: 'Trades', city: 'Hickory', type: 'client', plan: 'care', launchedDays: 34 },
  { first: 'Priya', last: 'Moretz', business: 'Lookout Ridge Outfitters', industry: 'Retail', city: 'Boone', type: 'client', plan: 'care', launchedDays: 41 },
  { first: 'Marcus', last: 'Yount', business: 'Twin Oaks Bakery', industry: 'Food and drink', city: 'Newton', type: 'client', plan: 'care', launchedDays: 104 },
  { first: 'Leah', last: 'Whisnant', business: 'Riverbend Family Dental', industry: 'Health and wellness', city: 'Morganton', type: 'past', launchedDays: 640 },
  { first: 'Hector', last: 'Propst', business: 'Copperline Auto Works', industry: 'Auto', city: 'Lenoir', type: 'past', launchedDays: 950 },
  { first: 'Carla', last: 'Hefner', business: 'Old Mill Event Barn', industry: 'Events', city: 'Claremont', type: 'client', plan: 'build', sinceDays: 38 },
  { first: 'Desmond', last: 'Rhyne', business: 'Sugar Creek Pressure Washing', industry: 'Trades', city: 'Maiden', type: 'client', plan: 'build', sinceDays: 21 },
  { first: 'Ivy', last: 'Coffey', business: 'Laurel Gap Coffee Co.', industry: 'Food and drink', city: 'Lenoir', type: 'client', plan: 'build', sinceDays: 64 },
  { first: 'Reggie', last: 'Lutz', business: 'Front Porch Florist', industry: 'Retail', city: 'Conover', type: 'client', plan: 'build', sinceDays: 12 },
]

export function makeContacts(now = new Date()) {
  const r = seeded(20261011)
  const used = new Set()
  const usedBiz = new Set(NAMED.map((n) => n.business))
  const people = []
  let n = 0

  const add = (c) => {
    n += 1
    const emailName = (c.first || 'hello').toLowerCase().replace(/[^a-z]/g, '')
    const domain = c.business ? slug(c.business) : `${slug(c.last)}mail`
    people.push({
      id: `p${n}`,
      email: `${emailName}@${domain}.example`,
      phone: `(828) 555-${String(1000 + n).slice(-4)}`,
      notes: '',
      unsubscribed: false,
      unsubscribedAt: null,
      lastReply: null,
      launched: null,
      plan: null,
      ...c,
    })
  }

  for (const nmd of NAMED) {
    used.add(`${nmd.first} ${nmd.last}`)
    const launched = nmd.launchedDays ? addDays(now, -nmd.launchedDays) : null
    const since = nmd.sinceDays ? addDays(now, -nmd.sinceDays) : addDays(launched, -between(r, 60, 120))
    add({ first: nmd.first, last: nmd.last, business: nmd.business, industry: nmd.industry, city: nmd.city, type: nmd.type, plan: nmd.plan || null, launched: launched ? iso(launched) : null, since: iso(since), source: 'Referral', optedIn: true, lastReply: iso(addDays(now, -between(r, 2, 40))) })
  }

  const fresh = () => {
    for (let i = 0; i < 400; i++) {
      const first = pick(r, FIRST)
      const last = pick(r, LAST)
      const name = `${first} ${last}`
      if (!used.has(name)) {
        used.add(name)
        return { first, last }
      }
    }
    return { first: pick(r, FIRST), last: `${pick(r, LAST)}e` }
  }
  const business = () => {
    for (let i = 0; i < 400; i++) {
      const [trade, industry] = pick(r, TRADES)
      const name = `${pick(r, PLACES)} ${trade}`
      if (!usedBiz.has(name)) {
        usedBiz.add(name)
        return { business: name, industry }
      }
    }
    return { business: '', industry: 'Other' }
  }

  // More current clients on a care plan
  for (let i = 0; i < 4; i++) {
    const launched = addDays(now, -between(r, 60, 900))
    add({ ...fresh(), ...business(), city: pick(r, CITIES), type: 'client', plan: 'care', launched: iso(launched), since: iso(addDays(launched, -between(r, 50, 140))), source: pick(r, ['Referral', 'Contact form', 'Facebook']), optedIn: i !== 2, lastReply: iso(addDays(now, -between(r, 5, 80))) })
  }
  // Past clients
  for (let i = 0; i < 21; i++) {
    const launched = addDays(now, -between(r, 180, 1450))
    add({ ...fresh(), ...business(), city: pick(r, CITIES), type: 'past', launched: iso(launched), since: iso(addDays(launched, -between(r, 50, 140))), source: pick(r, ['Referral', 'Contact form', 'Facebook', 'Fiverr']), optedIn: !(i === 4 || i === 13), lastReply: iso(addDays(now, -between(r, 30, 500))) })
  }
  // Leads
  const sources = [
    ['BusinessLaunchList', 40, 2, 380],
    ['Contact form', 24, 3, 300],
    ['Quote request', 12, 5, 220],
    ['Referral', 6, 8, 160],
    ['Phone call', 4, 1, 50],
  ]
  for (const [source, count, minDays, maxDays] of sources) {
    for (let i = 0; i < count; i++) {
      const since = addDays(now, -between(r, minDays, maxDays))
      const anonymousBiz = source === 'BusinessLaunchList' && i % 13 === 5
      const bizInfo = anonymousBiz ? { business: '', industry: 'Not sure yet' } : business()
      const name = fresh()
      const replied = source !== 'BusinessLaunchList' && chance(r, 0.62)
      const replyDay = replied ? addDays(since, between(r, 1, 9)) : null
      add({
        ...name,
        first: source === 'BusinessLaunchList' && i % 17 === 9 ? '' : name.first,
        ...bizInfo,
        city: pick(r, CITIES),
        type: 'lead',
        since: iso(since),
        source,
        optedIn: source === 'Phone call' ? i % 2 === 0 : true,
        lastReply: replyDay && replyDay < now ? iso(replyDay) : null,
      })
    }
  }

  // A few unsubscribes, as real lists have
  const unsubIds = ['p17', 'p52', 'p88']
  people.forEach((c) => {
    if (unsubIds.includes(c.id)) {
      c.unsubscribed = true
      c.unsubscribedAt = iso(addDays(now, -between(r, 20, 90)))
    }
  })
  return people
}

// ---------- Results ----------

const MINUTES_48H = 48 * 60

function openMinute(r) {
  const band = weighted(r, [['soon', 50], ['day', 22], ['morning', 18], ['late', 10]])
  if (band === 'soon') return Math.min(179, Math.round(-Math.log(1 - r()) * 55))
  if (band === 'day') return between(r, 180, 720)
  if (band === 'morning') return between(r, 1340, 1620)
  return between(r, 720, MINUTES_48H - 1)
}

const OPEN = { client: 0.74, past: 0.6, lead: 0.47 }
const CLICK = { client: 0.2, past: 0.22, lead: 0.25 }
const INQUIRE = { client: 0.08, past: 0.24, lead: 0.32 }

export function simulateResults(campaign, contacts, sentAt, tuning = {}) {
  const r = seeded(hashString(`${campaign.name}|${campaign.subject}`))
  const pool = contacts.filter((c) => !c.since || new Date(c.since) <= new Date(sentAt))
  const { recipients } = resolveAudience(pool, campaign.audience, new Date(sentAt))
  const shuffled = shuffle(r, recipients)
  const bounced = recipients.length > 25 ? between(r, 1, 2) : 0
  const delivered = shuffled.slice(bounced)
  const links = campaignLinks(campaign)
  const people = []
  for (const c of delivered) {
    const pOpen = (OPEN[c.type] || 0.5) * (tuning.open || 1)
    if (!chance(r, Math.min(0.95, pOpen))) continue
    const clicks = []
    if (links.length && chance(r, (CLICK[c.type] || 0.2) * (tuning.click || 1))) {
      const times = chance(r, 0.25) ? 2 : 1
      for (let i = 0; i < times; i++) clicks.push(weighted(r, links.map((l) => [l.label, l.weight])))
    }
    const inquired = clicks.length ? chance(r, (INQUIRE[c.type] || 0.1) * (tuning.inquire || 1)) : chance(r, 0.012)
    const unsub = !clicks.length && chance(r, 0.009)
    people.push({ id: c.id, at: openMinute(r), clicks, inquired, unsub })
  }
  people.sort((a, b2) => a.at - b2.at)
  return {
    recipients: recipients.length,
    bounced,
    delivered: delivered.length,
    links: links.map(({ label, url }) => ({ label, url })),
    people,
    live: null,
  }
}

export const LIVE_MS = 45000

export function liveProgress(stats, now = Date.now()) {
  if (!stats?.live) return 1
  return Math.max(0, Math.min(1, (now - new Date(stats.live).getTime()) / LIVE_MS))
}

// Everything a report needs, computed from per-person results
export function resultsView(stats, now = Date.now()) {
  if (!stats) return null
  const progress = liveProgress(stats, now)
  const horizon = progress * MINUTES_48H
  const visible = progress >= 1 ? stats.people : stats.people.filter((p) => p.at <= horizon)
  const clickedPeople = visible.filter((p) => p.clicks.length)
  const linkCounts = new Map(stats.links.map((l) => [l.label, 0]))
  visible.forEach((p) => p.clicks.forEach((label) => linkCounts.set(label, (linkCounts.get(label) || 0) + 1)))
  const curve = []
  let i = 0
  const hours = Math.ceil(progress * 48)
  for (let h = 0; h <= hours; h++) {
    while (i < visible.length && visible[i].at <= h * 60) i++
    curve.push({ hour: h, opens: i })
  }
  return {
    progress,
    live: progress < 1,
    recipients: stats.recipients,
    delivered: stats.delivered,
    bounced: stats.bounced,
    opened: visible.length,
    clicked: clickedPeople.length,
    totalClicks: visible.reduce((n, p) => n + p.clicks.length, 0),
    inquiries: visible.filter((p) => p.inquired).length,
    unsubscribed: visible.filter((p) => p.unsub).length,
    links: [...linkCounts.entries()].map(([label, clicks]) => ({ label, clicks, url: stats.links.find((l) => l.label === label)?.url })),
    curve,
    people: visible,
  }
}

// ---------- Example emails ----------

export function makeCampaigns(now, contacts, settings = DEFAULT_SETTINGS) {
  const t = (id, at, overrides) => fromTemplate(id, settings, at, overrides)

  const tuesday = nextWeekday(now, 2, 9, 0)
  const slots = t('blank', now, {
    name: 'January build slots',
    subject: 'Two build slots left for a January launch',
    preheader: 'I keep my calendar small so every site gets my full attention.',
    status: 'scheduled',
    scheduledFor: iso(tuesday),
    createdAt: iso(addDays(now, -3)),
    updatedAt: iso(addDays(now, -1)),
    testSentTo: settings.testEmail,
    style: { theme: 'navy', headings: 'sans', buttons: 'rounded', fallback: 'there', bizFallback: 'your business' },
    audience: { segments: ['leads', 'past'], siteMonths: 18, quietDays: 60, people: [] },
    blocks: [
      b('header', { layout: 'left' }),
      b('heading', { eyebrow: 'Booking now for next year', text: 'Two build slots left for January', size: 'l', align: 'left' }),
      b('text', { html: '<p>Hi {First name},</p><p>I keep my calendar small so every site gets my full attention. Two slots are open for builds that start in January, and they usually fill by the end of November.</p><p>If a new site or a refresh for {Business} is on your list for next year, now is a good time to talk.</p>' }),
      b('button', { label: 'Claim a slot', url: mailto('January build slot'), align: 'left' }),
      b('text', { html: "<p>Not ready yet? Reply anyway and I'll send a short list of what to gather before we start.</p>", tone: 'fine' }),
      b('footer'),
    ],
  })

  const referral = t('referral', now, { createdAt: iso(addDays(now, -1)), updatedAt: new Date(now.getTime() - 3 * 3600 * 1000).toISOString() })
  const checkup = t('checkup', now, { createdAt: iso(addDays(now, -2)), updatedAt: iso(addDays(now, -1)) })

  const sent = (campaign, at, tuning) => {
    const sentAt = iso(at)
    return { ...campaign, status: 'sent', sentAt, createdAt: iso(addDays(at, -2)), updatedAt: sentAt, testSentTo: settings.testEmail, stats: simulateResults(campaign, contacts, sentAt, tuning) }
  }

  const septAt = atTime(addDays(now, -18), 9, 4)
  const notes = sent(t('notes', septAt, { audience: { segments: ['all'], siteMonths: 18, quietDays: 60, people: [] } }), septAt, { open: 1.04 })

  const careAt = atTime(addDays(now, -46), 10, 12)
  const care = sent(t('care', careAt), careAt, { open: 1.08, click: 1.3, inquire: 1.6 })

  const followAt = atTime(addDays(now, -74), 8, 41)
  const follow = sent(t('followup', followAt), followAt, { open: 0.92, inquire: 1.4 })

  const launchAt = atTime(addDays(now, -103), 9, 30)
  const launch = sent(
    t('launch', launchAt, {
      name: 'Just launched: Twin Oaks Bakery',
      subject: 'Just launched: online ordering for Twin Oaks Bakery',
      preheader: 'Weekend pickup orders, a menu they can update themselves and a site built for phones.',
      audience: { segments: ['all'], siteMonths: 18, quietDays: 60, people: [] },
      blocks: [
        b('header', { layout: 'center' }),
        b('image', { image: 'twinoaks', alt: 'The new Twin Oaks Bakery website with ordering ahead on a phone', url: 'https://twinoaksbakery.example/' }),
        b('heading', { eyebrow: 'Just launched', text: 'Twin Oaks Bakery now takes orders online', size: 'l', align: 'center' }),
        b('text', { html: '<p>The line out the door on Saturdays was a good problem. Now regulars order ahead from their phones and pick up without the wait.</p>', align: 'center' }),
        b('text', { html: '<ul><li>Order ahead for weekend pickup</li><li>A menu the owners update themselves</li><li>Holiday preorders with limits so they never oversell</li></ul>' }),
        b('button', { label: 'See the new site', url: 'https://twinoaksbakery.example/', align: 'center' }),
        b('text', { html: '<p>Want something like this for {Business}? Reply and tell me a little about it.</p>', align: 'center', tone: 'fine' }),
        b('footer'),
      ],
    }),
    launchAt,
    { open: 0.98 },
  )

  return [slots, referral, checkup, notes, care, follow, launch]
}

export function makeExampleState(now = new Date()) {
  const contacts = makeContacts(now)
  const settings = { ...DEFAULT_SETTINGS }
  return { settings, contacts, campaigns: makeCampaigns(now, contacts, settings) }
}
