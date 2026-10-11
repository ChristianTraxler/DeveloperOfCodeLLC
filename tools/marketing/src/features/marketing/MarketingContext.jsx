// Feature state: emails, people and sender settings, with saving and the preview's send simulation.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import * as api from './marketingApi.js'
import { fromTemplate } from './data/templates.js'
import { copyCampaign } from './data/blocks.js'
import { canEmail, resolveAudience } from './data/segments.js'
import { simulateResults, resultsView, liveProgress } from './data/demo.js'
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
    case 'tick': {
      let changed = false
      const campaigns = state.campaigns.map((c) => {
        // A scheduled email waits until the mailing address is in place, like the real send would
        if (c.status === 'scheduled' && c.scheduledFor && new Date(c.scheduledFor) <= action.now && state.settings.mailingAddress?.trim()) {
          changed = true
          const sentAt = c.scheduledFor
          return { ...c, status: 'sent', sentAt, scheduledFor: null, updatedAt: sentAt, stats: { ...simulateResults(c, state.contacts, sentAt), live: stamp() } }
        }
        if (c.stats?.live && liveProgress(c.stats, action.now.getTime()) >= 1) {
          changed = true
          return { ...c, stats: { ...c.stats, live: null } }
        }
        return c
      })
      return changed ? { ...state, campaigns } : state
    }
    default:
      return state
  }
}

export function MarketingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => api.loadState(new Date()))
  const [now, setNow] = useState(() => new Date())
  const [saved, setSaved] = useState(true)
  const first = useRef(true)

  // Save shortly after each change
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => setSaved(api.saveState(state)), 300)
    return () => clearTimeout(t)
  }, [state])

  const anyLive = state.campaigns.some((c) => c.stats?.live)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), anyLive ? 900 : 30000)
    return () => clearInterval(id)
  }, [anyLive])

  useEffect(() => {
    dispatch({ type: 'tick', now })
  }, [now])

  const stateRef = useRef(state)
  stateRef.current = state

  const actions = useMemo(() => {
    const get = () => stateRef.current
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
      schedule(id, when) {
        const s = get()
        const c = s.campaigns.find((x) => x.id === id)
        if (!c) return
        api.sendCampaign(c, resolveAudience(s.contacts, c.audience).recipients, when)
        dispatch({ type: 'campaign/update', id, patch: { status: 'scheduled', scheduledFor: new Date(when).toISOString() } })
      },
      unschedule(id) {
        const c = get().campaigns.find((x) => x.id === id)
        if (c) api.cancelScheduled(c)
        dispatch({ type: 'campaign/update', id, patch: { status: 'draft', scheduledFor: null } })
      },
      sendNow(id) {
        const s = get()
        const c = s.campaigns.find((x) => x.id === id)
        if (!c) return
        const sentAt = stamp()
        api.sendCampaign(c, resolveAudience(s.contacts, c.audience).recipients)
        dispatch({ type: 'campaign/update', id, patch: { status: 'sent', sentAt, scheduledFor: null, stats: { ...simulateResults(c, s.contacts, sentAt), live: sentAt } } })
      },
      markTest(id, to) {
        api.sendTest(get().campaigns.find((x) => x.id === id), to)
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
      resetExamples() {
        dispatch({ type: 'replace', state: api.resetState(new Date()) })
      },
    }
  }, [])

  const derived = useMemo(() => {
    const reachable = state.contacts.filter(canEmail).length
    const sent = state.campaigns.filter((c) => c.status === 'sent' && c.stats)
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
    const scheduled = state.campaigns.filter((c) => c.status === 'scheduled').sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    const drafts = state.campaigns.filter((c) => c.status === 'draft')
    const lastSent = bySent[0] || null
    return {
      reachable,
      total: state.contacts.length,
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
  }, [state.contacts, state.campaigns, now])

  const value = useMemo(() => ({ ...state, now, saved, actions, derived }), [state, now, saved, actions, derived])
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
