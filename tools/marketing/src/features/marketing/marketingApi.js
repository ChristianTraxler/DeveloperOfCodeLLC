// The ONLY file that talks to storage or a backend.
//
// Phase 1 (now): example data, saved in this browser with localStorage. Nothing is emailed.
// Phase 2 (later): swap the bodies of these functions for Supabase reads and writes and a
// "marketing-send" Edge Function that calls Resend. Nothing else in the feature needs to change.

import { makeExampleState } from './data/demo.js'

const KEY = 'doc-marketing-preview'
const VERSION = 1

export const IS_PREVIEW = true

export function loadState(now = new Date()) {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved && saved.v === VERSION && Array.isArray(saved.campaigns) && Array.isArray(saved.contacts)) {
        return { settings: saved.settings, contacts: saved.contacts, campaigns: saved.campaigns }
      }
    }
  } catch {
    // Private windows and blocked storage land here. The examples still load.
  }
  return makeExampleState(now)
}

export function saveState(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, settings: state.settings, contacts: state.contacts, campaigns: state.campaigns }))
    return true
  } catch {
    return false
  }
}

export function resetState(now = new Date()) {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  return makeExampleState(now)
}

// Phase 2: POST to the marketing-send Edge Function with { campaignId, to, test: true }.
export async function sendTest(campaign, to) {
  return { ok: true, preview: true, to }
}

// Phase 2: create a Resend Broadcast for the campaign's audience and send it now,
// or schedule it for `when`. Return the Broadcast id to store on the campaign.
export async function sendCampaign(campaign, recipients, when = null) {
  return { ok: true, preview: true, scheduled: !!when, count: recipients.length }
}

// Phase 2: cancel the scheduled Broadcast in Resend.
export async function cancelScheduled(campaign) {
  return { ok: true, preview: true }
}
