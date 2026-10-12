// Feature state: emails, people and sender settings, saved to the server, with real sending and results.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import * as api from './marketingApi.js'
import { fromTemplate } from './data/templates.js'
import { copyCampaign } from './data/blocks.js'
import { canEmail, resolveAudience } from './data/segments.js'
import { resultsView } from './data/demo.js'
import { daysSince, pct } from './lib/format.js'
import { uid } from './lib/rng.js'

const Ctx = createContext(null)
export const useMarketing = () => useContext(Ctx)

const stamp = () => new Date().toISOString()

function reducer(state, action) {
  switch (action.type) {
    case 'replace':
      return action.state
    case 'campaign/add':
      return { ...state, campaigns: [action.campaign, ...state.campaigns] }
    case 'campaign/insert': {
      const list = state.campaigns.slice()
      list.splice(Math.min(action.index, list.length), 0, action.campaign)
      return { ...state, campaigns: list }
    }
    case 'campaign/set':
      return { ...state, campaigns: state.campaigns.map((c) => (c.id === action.campaign.id ? action.campaign : c)) }
    case 'campaign/update':
      return {
        ...state,
        campaigns: state.campaigns.map((c) => {
          if (c.id !== action.id) return c
          const patch = typeof action.patch === 'function' ? action.patch(c) : action.patch
          return { ...c, ...patch, updatedAt: action.touch === false ? c.updatedAt : stamp() }
        }),
      }
    case 'campaign/remove':
      return { ...state, campaigns: state.campaigns.filter((c) => c.id !== action.id) }
    case 'contact/add':
      return { ...state, contacts: [action.contact, ...state.contacts] }
    case 'contact/insert': {
      const list = state.contacts.slice()
      list.splice(Math.min(action.index, list.length), 0, action.contact)
      return { ...state, contacts: list }
    }
    case 'contact/update':
      return { ...state, contacts: state.contacts.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) }
    case 'contact/remove':
      return { ...state, contacts: state.contacts.filter((c) => c.id !== action.id) }
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'merge': {
      // Server-owned fields only (status, results, unsubscribes), so edits in progress are never overwritten
      const known = new Map(state.campaigns.map((c) => [c.id, c]))
      const campaigns = state.campaigns.map((c) => {
        const n = action.campaigns.find((x) => x.id === c.id)
        if (!n) return c
        const same = n.status === c.status && n.sentAt === c.sentAt && n.scheduledFor === c.scheduledFor && JSON.stringify(n.stats) === JSON.stringify(c.stats)
        return same ? c : { ...c, status: n.status, sentAt: n.sentAt, scheduledFor: n.scheduledFor, stats: n.stats, updatedAt: c.updatedAt }
      })
      const added = action.campaigns.filter((n) => !known.has(n.id))
      const people = new Map(action.contacts.map((c) => [c.id, c]))
      const contacts = state.contacts.map((c) => {
        const n = people.get(c.id)
        return n && (n.unsubscribed !== c.unsubscribed || n.unsubscribedAt !== c.unsubscribedAt) ? { ...c, unsubscribed: n.unsubscribed, unsubscribedAt: n.unsubscribedAt } : c
      })
      const have = new Set(state.contacts.map((c) => c.id))
      const addedPeople = action.contacts.filter((c) => !have.has(c.id))
      return { ...state, campaigns: added.length ? [...added, ...campaigns] : campaigns, contacts: addedPeople.length ? [...addedPeople, ...contacts] : contacts }
    }
    default:
      return state
  }
}

const POLL_MS = 30000

export function MarketingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null)
  const [phase, setPhase] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [saved, setSaved] = useState(true)
  const stateRef = useRef(state)
  stateRef.current = state
  const savedSnap = useRef(new Map())
  const saving = useRef(null)

  const load = useCallback(async () => {
    setPhase('loading')
    setLoadError('')
    try {
      const data = await api.loadState()
      // First time here: nothing is saved yet, so the settings count as a change and get saved
      savedSnap.current = api.snapshot({ settings: data.hasSettings ? data.settings : {}, contacts: data.contacts, campaigns: data.campaigns })
      dispatch({ type: 'replace', state: { settings: data.settings, contacts: data.contacts, campaigns: data.campaigns } })
      setPhase('ready')
    } catch (err) {
      setLoadError(err.message || 'Could not load.')
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Writes whatever changed since the last successful save. One at a time; a change made mid-save follows right after.
  const flush = useCallback(async () => {
    while (saving.current) await saving.current.catch(() => {})
    const run = (async () => {
      const current = stateRef.current
      if (!current) return true
      try {
        savedSnap.current = await api.saveChanges(savedSnap.current, current)
        setSaved(true)
        return true
      } catch {
        setSaved(false)
        return false
      }
    })()
    saving.current = run
    try {
      return await run
    } finally {
      saving.current = null
    }
  }, [])

  const first = useRef(true)
  useEffect(() => {
    if (!state || phase !== 'ready') return
    if (first.current) {
      first.current = false
      // Settings that were never saved still need their first save
      if (api.snapshot(state).get('settings:main') === savedSnap.current.get('settings:main')) return
    }
    setSaved(false)
    const t = setTimeout(flush, 600)
    return () => clearTimeout(t)
  }, [state, phase, flush])

  // Keep results, scheduled sends and unsubscribes fresh
  const refresh = useCallback(async () => {
    try {
      const data = await api.loadState()
      dispatch({ type: 'merge', campaigns: data.campaigns, contacts: data.contacts })
    } catch {
      // A missed refresh is fine; the next one tries again
    }
  }, [])
  useEffect(() => {
    if (phase !== 'ready') return
    const id = setInterval(() => {
      setNow(new Date())
      if (!document.hidden) refresh()
    }, POLL_MS)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [phase, refresh])

  // A scheduled email is queued with its content as it was, so edits to it are queued again
  const requeueTimer = useRef(null)
  const lastScheduled = useRef(new Map())
  useEffect(() => {
    if (!state) return
    const next = new Map()
    let changed = null
    for (const c of state.campaigns) {
      if (c.status !== 'scheduled') continue
      const fp = JSON.stringify([c.blocks, c.subject, c.preheader, c.style, c.audience, c.fromName, state.settings, c.scheduledFor])
      next.set(c.id, fp)
      if (lastScheduled.current.has(c.id) && lastScheduled.current.get(c.id) !== fp) changed = c.id
    }
    lastScheduled.current = next
    if (!changed) return
    clearTimeout(requeueTimer.current)
    requeueTimer.current = setTimeout(async () => {
      const s = stateRef.current
      const c = s.campaigns.find((x) => x.id === changed)
      if (!c || c.status !== 'scheduled') return
      await flush()
      try {
        await api.sendCampaign(c, s.settings, resolveAudience(s.contacts, c.audience).recipients, c.scheduledFor)
      } catch {
        // The old queued version stays; the next change tries again
      }
    }, 1500)
  }, [state, flush])

  const actions = useMemo(() => {
    const get = () => stateRef.current
    const apply = (campaign) => campaign && dispatch({ type: 'campaign/update', id: campaign.id, patch: { status: campaign.status, sentAt: campaign.sentAt ?? null, scheduledFor: campaign.scheduledFor ?? null }, touch: false })
    const recipientsOf = (c) => resolveAudience(get().contacts, c.audience).recipients
    const ensureSaved = async () => {
      if (!(await flush())) throw new Error('Your latest changes could not be saved, so nothing was sent. Check your connection and try again.')
    }
    return {
      createFromTemplate(templateId) {
        const s = get()
        const campaign = fromTemplate(templateId, s.settings, new Date())
        dispatch({ type: 'campaign/add', campaign })
        return campaign.id
      },
      duplicate(id, name) {
        const c = get().campaigns.find((x) => x.id === id)
        if (!c) return null
        const copy = copyCampaign(c, name)
        dispatch({ type: 'campaign/add', campaign: copy })
        return copy.id
      },
      update(id, patch, touch = true) {
        dispatch({ type: 'campaign/update', id, patch, touch })
      },
      set(campaign) {
        dispatch({ type: 'campaign/set', campaign: { ...campaign, updatedAt: stamp() } })
      },
      remove(id) {
        const list = get().campaigns
        const index = list.findIndex((c) => c.id === id)
        const campaign = list[index]
        dispatch({ type: 'campaign/remove', id })
        return () => dispatch({ type: 'campaign/insert', campaign, index })
      },
      // These three talk to the server and throw an Error with a plain message if it refuses.
      async schedule(id, when) {
        await ensureSaved()
        const c = get().campaigns.find((x) => x.id === id)
        if (!c) return
        const out = await api.sendCampaign(c, get().settings, recipientsOf(c), when)
        apply(out.campaign)
      },
      async unschedule(id) {
        const c = get().campaigns.find((x) => x.id === id)
        if (!c) return
        apply(await api.cancelScheduled(c))
      },
      async sendNow(id) {
        await ensureSaved()
        const c = get().campaigns.find((x) => x.id === id)
        if (!c) return
        const out = await api.sendCampaign(c, get().settings, recipientsOf(c))
        apply(out.campaign)
        refresh()
        return out
      },
      async sendTest(id, to) {
        const s = get()
        const c = s.campaigns.find((x) => x.id === id)
        if (!c) return
        const contact = resolveAudience(s.contacts, c.audience).recipients[0] || s.contacts[0] || null
        await api.sendTest(c, s.settings, contact, to)
        dispatch({ type: 'campaign/update', id, patch: { testSentTo: to }, touch: false })
      },
      addContact(fields) {
        const contact = { id: uid('p'), since: stamp(), lastReply: null, launched: null, plan: null, unsubscribed: false, unsubscribedAt: null, notes: '', phone: '', city: '', industry: '', source: 'Added by hand', ...fields }
        dispatch({ type: 'contact/add', contact })
        return contact.id
      },
      updateContact(id, patch) {
        dispatch({ type: 'contact/update', id, patch })
      },
      removeContact(id) {
        const list = get().contacts
        const index = list.findIndex((c) => c.id === id)
        const contact = list[index]
        dispatch({ type: 'contact/remove', id })
        return () => dispatch({ type: 'contact/insert', contact, index })
      },
      updateSettings(patch) {
        dispatch({ type: 'settings/update', patch })
      },
    }
  }, [flush, refresh])

  const contactsNow = state?.contacts
  const campaignsNow = state?.campaigns
  const derived = useMemo(() => {
    if (!contactsNow || !campaignsNow) return null
    const reachable = contactsNow.filter(canEmail).length
    const sent = campaignsNow.filter((c) => c.status === 'sent' && c.stats)
    const views = new Map(sent.map((c) => [c.id, resultsView(c.stats, now.getTime())]))
    const rates = sent.map((c) => views.get(c.id)).filter((v) => v.delivered).map((v) => v.opened / v.delivered)
    const recent = sent.filter((c) => daysSince(c.sentAt, now) <= 90)
    const clicks90 = recent.reduce((n, c) => n + views.get(c.id).totalClicks, 0)
    const inquiries90 = recent.reduce((n, c) => n + views.get(c.id).inquiries, 0)
    const avgOpen = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : 0

    // Latest thing each person did, for the People list
    const activity = new Map()
    const bySent = sent.slice().sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    for (const c of bySent) {
      for (const p of views.get(c.id).people) {
        if (activity.has(p.id)) continue
        activity.set(p.id, { campaignId: c.id, name: c.name, kind: p.inquired ? 'inquired' : p.clicks.length ? 'clicked' : 'opened', at: new Date(new Date(c.sentAt).getTime() + p.at * 60000).toISOString() })
      }
    }
    const scheduled = campaignsNow.filter((c) => c.status === 'scheduled').sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    const drafts = campaignsNow.filter((c) => c.status === 'draft')
    const lastSent = bySent[0] || null
    return {
      reachable,
      total: contactsNow.length,
      avgOpen,
      clicks90,
      inquiries90,
      views,
      activity,
      scheduled,
      drafts,
      lastSent,
      lastSentRate: lastSent ? pct(views.get(lastSent.id).opened, views.get(lastSent.id).delivered) : null,
    }
  }, [contactsNow, campaignsNow, now])

  const value = useMemo(() => (state ? { ...state, now, saved, actions, derived } : null), [state, now, saved, actions, derived])
  if (phase !== 'ready' || !value) {
    return (
      <main className="mx-auto max-w-[1120px] px-4 pb-24 pt-20 sm:px-6 lg:px-10">
        {phase === 'error' ? (
          <div role="alert">
            <h1 className="display text-[clamp(36px,9vw,64px)] leading-[0.95]">Marketing did not load</h1>
            <p className="mt-5 max-w-[52ch] text-[16px] text-mute">{loadError}</p>
            <button type="button" onClick={load} className="mt-8 inline-flex h-11 items-center rounded-full bg-ember px-5 text-[15px] font-semibold text-[#1c0a02] hover:bg-[#ff6f3a]">
              Try again
            </button>
          </div>
        ) : (
          <p className="text-[16px] text-mute" role="status">Loading your emails and people.</p>
        )}
      </main>
    )
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// A short line for the Admin Hub tile, for example "1 scheduled for Tue, 2 drafts"
export function useMarketingSummary() {
  const m = useMarketing()
  if (!m) return ''
  const { scheduled, drafts, lastSentRate } = m.derived
  const parts = []
  if (scheduled.length) {
    const d = new Date(scheduled[0].scheduledFor)
    parts.push(`${scheduled.length} scheduled for ${d.toLocaleDateString('en-US', { weekday: 'short' })}`)
  }
  if (drafts.length) parts.push(`${drafts.length} ${drafts.length === 1 ? 'draft' : 'drafts'}`)
  if (lastSentRate != null) parts.push(`last email ${lastSentRate}% opened`)
  return parts.join(', ')
}
