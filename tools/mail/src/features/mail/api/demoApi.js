// The example adapter for the preview. Same methods and response shapes as gmailApi.js,
// backed by an in-memory mailbox (kept in this browser) and a script of emails that keep
// arriving while the page is open, so the live behavior can be seen without a real Gmail.
import { AUTO_REPLIES, LABELS, LIVE, ME, SEND_AS, resolveRemote, seedThreads, when } from '../demo/mailbox.js'
import { ART } from '../demo/art.js'
import { matches, wantsSpamOrTrash } from '../demo/query.js'
import { MailError } from './errors.js'

const KEY = 'doc-mail-preview'
const VERSION = 4
const PAGE = 30
const STALE_AFTER = 2 * 86_400_000

const wait = (min = 120, max = 380) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)))
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

const store = {
  read() {
    try {
      const raw = window.localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  write(value) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(value))
    } catch {
      // storage full or blocked: the example keeps working for this visit
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY)
    } catch {
      // ignore
    }
  },
}

// ---------- Text helpers ----------

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
function snippetOf(m) {
  let html = m.html || ''
  const cut = html.indexOf('class="gmail_quote"')
  if (cut !== -1) html = html.slice(0, html.lastIndexOf('<', cut))
  const text = html
    ? html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<(br|\/div|\/p|\/tr|\/h\d)[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&([a-z]+|#\d+);/gi, (w, c) => ENT[c.toLowerCase()] ?? w)
    : (m.text || '').split(/\n(On .+wrote:|>)/)[0]
  return text.replace(/\s+/g, ' ').trim().slice(0, 200)
}

const has = (m, l) => m.labels.includes(l)
const own = (email) => [ME.email, ...SEND_AS.map((s) => s.email)].some((e) => e.toLowerCase() === String(email || '').toLowerCase())

// ---------- The mailbox ----------

function seed(now = Date.now()) {
  const db = {
    v: VERSION,
    seededAt: now,
    linked: true,
    historyId: 4_182_000 + Math.floor(Math.random() * 1000),
    threads: {},
    messages: {},
    drafts: {},
    feed: 0,
    replied: {},
    lastPushAt: now - 38 * 60_000,
  }
  for (const t of seedThreads(now)) {
    db.threads[t.id] = { id: t.id, messageIds: [] }
    t.messages.forEach((spec, i) => {
      const id = `${t.id}-${i}`
      addMessage(db, t.id, id, { ...spec, date: when(spec.at, now) })
      if (spec.draft) db.drafts[`d-${id}`] = { id: `d-${id}`, messageId: id, threadId: t.id }
    })
  }
  for (const t of Object.values(db.threads)) t.historyId = db.historyId
  return db
}

function addMessage(db, threadId, id, spec) {
  if (!db.threads[threadId]) db.threads[threadId] = { id: threadId, messageIds: [] }
  const domain = (spec.from?.email || 'mail.example').split('@')[1]
  db.messages[id] = {
    id,
    threadId,
    date: spec.date,
    from: spec.from,
    to: spec.to || [],
    cc: spec.cc || [],
    bcc: spec.bcc || [],
    replyTo: spec.replyTo || [],
    subject: spec.subject || '',
    html: spec.html || '',
    text: spec.text || '',
    labels: [...(spec.labels || [])],
    attachments: (spec.attachments || []).map((a, j) => ({
      id: a.id || `a-${id}-${j}`,
      partId: String(j + 1),
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size || 0,
      inline: false,
      contentId: null,
      art: a.art || null,
      data: a.data || null,
      from: a.from || null,
    })),
    messageId: spec.messageId || `<${id}.${spec.date}@${domain}>`,
    references: spec.references || null,
    inReplyTo: spec.inReplyTo || null,
    unsubscribe: spec.from?.email?.includes('foothillsalliance') ? '<https://foothillsalliance.example/unsubscribe>' : null,
  }
  const t = db.threads[threadId]
  t.messageIds.push(id)
  t.messageIds.sort((a, b) => db.messages[a].date - db.messages[b].date)
  return db.messages[id]
}

function threadMessages(db, t) {
  return t.messageIds.map((id) => db.messages[id]).filter(Boolean)
}

function summarize(db, t) {
  const all = threadMessages(db, t)
  const visible = all.filter((m) => !has(m, 'TRASH'))
  const pool = visible.length ? visible : all
  const sent = pool.filter((m) => !has(m, 'DRAFT'))
  const shown = sent.length ? sent : pool
  const first = shown[0]
  const last = shown[shown.length - 1]
  const labels = new Set()
  for (const m of all) for (const l of m.labels) labels.add(l)
  const latestDraft = pool.filter((m) => has(m, 'DRAFT')).pop()
  const people = []
  for (const m of shown) {
    if (!m.from) continue
    if (people.some((p) => p.email.toLowerCase() === m.from.email.toLowerCase())) continue
    people.push({ name: m.from.name || '', email: m.from.email, me: own(m.from.email) })
  }
  return {
    id: t.id,
    historyId: String(t.historyId || 0),
    subject: first?.subject || '',
    snippet: last ? snippetOf(last) : '',
    from: last?.from || null,
    to: last?.to || [],
    draftTo: latestDraft?.to || [],
    people: people.length > 4 ? [people[0], ...people.slice(-3)] : people,
    date: last?.date || 0,
    count: sent.length,
    unread: pool.some((m) => has(m, 'UNREAD')),
    starred: all.some((m) => has(m, 'STARRED')),
    important: all.some((m) => has(m, 'IMPORTANT')),
    draft: all.some((m) => has(m, 'DRAFT')),
    attachments: pool.some((m) => m.attachments.some((a) => !a.inline)),
    labels: [...labels],
    lastFromMe: own(last?.from?.email),
  }
}

function inView(db, t, labelId, q) {
  const all = threadMessages(db, t)
  if (!all.length) return false
  const labels = new Set(all.flatMap((m) => m.labels))
  if (labelId === 'TRASH') return labels.has('TRASH') && (!q || matches({ messages: all }, q, labelName))
  if (labelId === 'SPAM') return labels.has('SPAM') && (!q || matches({ messages: all }, q, labelName))
  const searchAll = !labelId && q && wantsSpamOrTrash(q)
  if (labels.has('SPAM') && !searchAll) return false
  const live = searchAll ? all : all.filter((m) => !has(m, 'TRASH'))
  if (!live.length) return false
  if (labelId && labelId !== 'ALL' && !live.some((m) => has(m, labelId))) return false
  return q ? matches({ messages: live }, q, labelName) : true
}

function labelName(id) {
  return LABELS.find((l) => l.id === id)?.name || id
}

function parsed(m) {
  return {
    id: m.id,
    threadId: m.threadId,
    labels: [...m.labels],
    snippet: snippetOf(m),
    date: m.date,
    from: m.from,
    to: m.to,
    cc: m.cc,
    bcc: m.bcc,
    replyTo: m.replyTo,
    subject: m.subject,
    messageId: m.messageId,
    references: m.references,
    inReplyTo: m.inReplyTo,
    html: m.html,
    text: m.text,
    attachments: m.attachments.map(({ art: _a, data: _d, from: _f, ...rest }) => rest),
    unread: has(m, 'UNREAD'),
    draft: has(m, 'DRAFT'),
    fromMe: own(m.from?.email),
    unsubscribe: m.unsubscribe,
  }
}

// ---------- The adapter ----------

export function createDemoApi() {
  let db = store.read()
  if (!db || db.v !== VERSION || Date.now() - (db.seededAt || 0) > STALE_AFTER) {
    db = seed()
    store.write(db)
  }
  const listeners = new Set()
  const log = []
  let logStart = db.historyId
  let feedTimer = null
  let saveTimer = null

  const persist = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      // Files you attach in the preview stay in memory only
      const slim = JSON.parse(JSON.stringify(db, (k, v) => (k === 'data' && typeof v === 'string' && v.length > 2000 ? null : v)))
      store.write(slim)
    }, 250)
  }

  function change(threadIds, newMail = []) {
    db.historyId += 1 + Math.floor(Math.random() * 6)
    for (const id of threadIds) if (db.threads[id]) db.threads[id].historyId = db.historyId
    const entry = { historyId: db.historyId, threadIds: [...new Set(threadIds)], newMail }
    log.push(entry)
    if (log.length > 300) log.shift()
    persist()
    // Gmail's push arrives a moment after the change, even for changes made here
    setTimeout(() => {
      for (const l of listeners) l.onEvent({ kind: 'changes', threadIds: entry.threadIds, newMail, historyId: String(entry.historyId) })
    }, newMail.length ? 350 : 650)
  }

  const linked = () => {
    if (!db.linked) throw new MailError('not_linked')
  }

  function summaries(ids) {
    const threads = []
    const missing = []
    for (const id of ids) {
      const t = db.threads[id]
      if (t && threadMessages(db, t).length) threads.push(summarize(db, t))
      else missing.push(id)
    }
    return { threads, missing }
  }

  // ---------- Live delivery ----------

  function deliver(item, now = Date.now()) {
    const threadId = item.thread && db.threads[item.thread] ? item.thread : item.thread || uid('t-')
    const prev = db.threads[threadId] ? threadMessages(db, db.threads[threadId]).filter((m) => !has(m, 'DRAFT')).pop() : null
    const id = uid('m-')
    const m = addMessage(db, threadId, id, {
      ...item.message,
      date: now,
      inReplyTo: prev?.messageId || null,
      references: prev ? [prev.references, prev.messageId].filter(Boolean).join(' ') : null,
    })
    db.lastPushAt = now
    change([threadId], [{ messageId: m.id, threadId }])
    return m
  }

  function scheduleFeed() {
    clearTimeout(feedTimer)
    if (!listeners.size || db.feed >= LIVE.length) return
    feedTimer = setTimeout(() => {
      const item = LIVE[db.feed]
      db.feed += 1
      deliver(item)
      scheduleFeed()
    }, LIVE[db.feed].delay * 1000)
  }

  function queueAutoReply(threadId, recipients, subject) {
    if (db.replied[threadId]) return
    const person = recipients.find((r) => AUTO_REPLIES[r.email.toLowerCase()])
    if (!person) return
    db.replied[threadId] = true
    const thread = db.threads[threadId]
    const hadClients = thread && threadMessages(db, thread).some((m) => has(m, 'Label_clients'))
    setTimeout(() => {
      if (!db.threads[threadId]) return
      deliver({
        thread: threadId,
        message: {
          from: { name: person.name || person.email, email: person.email },
          to: [ME],
          subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
          labels: ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL', ...(hadClients ? ['Label_clients'] : [])],
          html: `<div dir="ltr"><div>${AUTO_REPLIES[person.email.toLowerCase()]}</div><div><br></div><div>${(person.name || '').split(' ')[0]}</div></div>`,
        },
      })
    }, 16000 + Math.random() * 9000)
  }

  // ---------- Compose ----------

  function writeMessage(msg, labels, existingId) {
    const now = Date.now()
    const sendAs = SEND_AS.find((s) => s.email === (msg.fromEmail || '').toLowerCase()) || SEND_AS[0]
    const threadId = msg.threadId && db.threads[msg.threadId] ? msg.threadId : existingId ? db.messages[existingId]?.threadId : uid('t-')
    const attachments = [
      ...(msg.attachments || []).map((a) => ({ filename: a.filename, mimeType: a.mimeType, size: Math.floor(((a.data || '').length * 3) / 4), data: a.data })),
      ...(msg.forwardAttachments || []).map((a) => {
        const source = db.messages[a.messageId]?.attachments.find((x) => x.id === a.attachmentId)
        return { filename: a.filename, mimeType: a.mimeType, size: source?.size || a.size || 0, art: source?.art || null, data: source?.data || null }
      }),
    ]
    const spec = {
      date: now,
      from: { name: msg.fromName || sendAs.name, email: sendAs.email },
      to: msg.to || [],
      cc: msg.cc || [],
      bcc: msg.bcc || [],
      subject: msg.subject || '',
      html: msg.html || '',
      text: msg.text || '',
      labels,
      attachments,
      inReplyTo: msg.inReplyTo || null,
      references: msg.references || null,
    }
    if (existingId && db.messages[existingId]) {
      const old = db.messages[existingId]
      const t = db.threads[old.threadId]
      t.messageIds = t.messageIds.filter((id) => id !== existingId)
      delete db.messages[existingId]
      if (!t.messageIds.length && t.id !== threadId) delete db.threads[t.id]
    }
    return addMessage(db, threadId, existingId || uid('m-'), spec)
  }

  function removeDraft(draftId) {
    const d = db.drafts[draftId]
    if (!d) return null
    delete db.drafts[draftId]
    const m = db.messages[d.messageId]
    if (!m) return null
    const t = db.threads[m.threadId]
    delete db.messages[m.id]
    if (t) {
      t.messageIds = t.messageIds.filter((id) => id !== m.id)
      if (!t.messageIds.length) delete db.threads[t.id]
    }
    return m.threadId
  }

  return {
    mode: 'demo',
    rewriteRemote: resolveRemote,

    async status() {
      await wait(200, 450)
      if (!db.linked) return { linked: false, pushConfigured: true }
      return {
        linked: true,
        email: ME.email,
        historyId: String(db.historyId),
        totals: { messages: Object.keys(db.messages).length, threads: Object.keys(db.threads).length },
        sendAs: SEND_AS,
        live: { pushConfigured: true, watchExpiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(), lastPushAt: new Date(db.lastPushAt).toISOString() },
      }
    },

    async labels() {
      await wait(80, 200)
      linked()
      const threads = Object.values(db.threads)
      const count = (labelId, fn) => threads.filter((t) => inView(db, t, labelId, '') && fn(summarize(db, t))).length
      const sys = (id) => ({
        id,
        name: id,
        type: 'system',
        unread: count(id, (s) => s.unread),
        total: id === 'DRAFT' ? Object.keys(db.drafts).length : count(id, () => true),
        messages: 0,
        color: null,
        textColor: null,
      })
      return {
        system: ['INBOX', 'DRAFT', 'SPAM', 'STARRED'].map(sys),
        user: LABELS.map((l) => ({ ...sys(l.id), name: l.name, type: 'user', color: l.color, textColor: l.textColor })),
      }
    },

    async list({ labelId = 'INBOX', q = '', pageToken = null, max = PAGE } = {}) {
      await wait(180, 520)
      linked()
      const all = Object.values(db.threads)
        .filter((t) => inView(db, t, labelId || '', q || ''))
        .map((t) => summarize(db, t))
        .sort((a, b) => b.date - a.date)
      const start = Number(pageToken) || 0
      const slice = all.slice(start, start + max)
      return { threads: slice, nextPageToken: start + max < all.length ? String(start + max) : null, estimate: all.length }
    },

    async threads(ids) {
      await wait(90, 220)
      linked()
      return summaries(ids)
    },

    async thread(id) {
      await wait(160, 420)
      linked()
      const t = db.threads[id]
      if (!t) throw new MailError('not_found')
      const msgs = threadMessages(db, t)
      return {
        id,
        historyId: String(t.historyId || 0),
        subject: msgs.find((m) => !has(m, 'DRAFT'))?.subject || msgs[0]?.subject || '',
        labels: [...new Set(msgs.flatMap((m) => m.labels))],
        messages: msgs.map(parsed),
        drafts: Object.values(db.drafts).filter((d) => d.threadId === id).map((d) => ({ draftId: d.id, messageId: d.messageId })),
        summary: summarize(db, t),
      }
    },

    async attachment(messageId, attachmentId) {
      await wait(150, 380)
      const a = db.messages[messageId]?.attachments.find((x) => x.id === attachmentId)
      if (!a) throw new MailError('not_found')
      if (a.art && ART[a.art]) {
        const art = ART[a.art]()
        return { data: art.data, size: a.size, mimeType: art.mimeType }
      }
      if (a.data) return { data: a.data, size: a.size, mimeType: a.mimeType }
      throw new MailError('not_found', 'This example file is no longer available. Reload the preview to see the example attachments.')
    },

    async modify(ids, add = [], remove = []) {
      await wait(140, 320)
      linked()
      for (const id of ids) {
        const t = db.threads[id]
        if (!t) continue
        for (const m of threadMessages(db, t)) {
          if (has(m, 'DRAFT') && (add.includes('INBOX') || remove.includes('INBOX'))) continue
          m.labels = [...new Set([...m.labels.filter((l) => !remove.includes(l)), ...add])]
          if (add.includes('SPAM')) m.labels = m.labels.filter((l) => l !== 'INBOX')
        }
      }
      change(ids)
      return summaries(ids)
    },

    async trash(ids) {
      await wait(140, 320)
      linked()
      for (const id of ids) {
        const t = db.threads[id]
        if (!t) continue
        for (const m of threadMessages(db, t)) {
          if (has(m, 'TRASH') || has(m, 'DRAFT')) continue
          m.trashedFrom = has(m, 'INBOX')
          m.labels = [...m.labels.filter((l) => l !== 'INBOX'), 'TRASH']
        }
      }
      change(ids)
      return summaries(ids)
    },

    async untrash(ids) {
      await wait(140, 320)
      linked()
      for (const id of ids) {
        const t = db.threads[id]
        if (!t) continue
        for (const m of threadMessages(db, t)) {
          if (!has(m, 'TRASH')) continue
          m.labels = m.labels.filter((l) => l !== 'TRASH')
          if (m.trashedFrom) m.labels.push('INBOX')
          delete m.trashedFrom
        }
      }
      change(ids)
      return summaries(ids)
    },

    async send(msg) {
      await wait(500, 900)
      linked()
      const recipients = [...(msg.to || []), ...(msg.cc || []), ...(msg.bcc || [])]
      if (!recipients.length) throw new MailError('no_recipients')
      let replacing = null
      if (msg.draftId && db.drafts[msg.draftId]) {
        replacing = db.drafts[msg.draftId].messageId
        delete db.drafts[msg.draftId]
      }
      const m = writeMessage(msg, ['SENT'], replacing)
      change([m.threadId])
      queueAutoReply(m.threadId, recipients, m.subject)
      return { id: m.id, threadId: m.threadId, thread: summarize(db, db.threads[m.threadId]) }
    },

    async saveDraft(msg) {
      await wait(160, 360)
      linked()
      const existing = msg.draftId && db.drafts[msg.draftId]
      const m = writeMessage(msg, ['DRAFT'], existing ? existing.messageId : null)
      const draftId = existing ? msg.draftId : uid('d-')
      db.drafts[draftId] = { id: draftId, messageId: m.id, threadId: m.threadId }
      change([m.threadId])
      return { draftId, messageId: m.id, threadId: m.threadId }
    },

    async deleteDraft(draftId) {
      await wait(120, 260)
      const threadId = removeDraft(draftId)
      if (threadId) change([threadId])
      return { deleted: true }
    },

    async sync(historyId) {
      await wait(120, 300)
      linked()
      const since = Number(historyId)
      if (!since || since < logStart) return { resync: true, historyId: String(db.historyId), threadIds: [], newMail: [] }
      const entries = log.filter((e) => e.historyId > since)
      return {
        historyId: String(db.historyId),
        threadIds: [...new Set(entries.flatMap((e) => e.threadIds))],
        newMail: entries.flatMap((e) => e.newMail),
      }
    },

    async renewWatch() {
      await wait()
      return { watchExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }
    },

    async link() {
      await wait(1100, 1500)
      db.linked = true
      persist()
      return { linked: true }
    },

    async unlink() {
      await wait(400, 700)
      db.linked = false
      clearTimeout(feedTimer)
      persist()
      return { linked: false }
    },

    subscribe(onEvent, onStatus) {
      const entry = { onEvent, onStatus }
      listeners.add(entry)
      const t = setTimeout(() => onStatus('SUBSCRIBED'), 650)
      scheduleFeed()
      return () => {
        clearTimeout(t)
        listeners.delete(entry)
        if (!listeners.size) clearTimeout(feedTimer)
      }
    },

    // Preview only: deliver the next example email right away
    deliverNext() {
      if (db.feed >= LIVE.length) return false
      clearTimeout(feedTimer)
      const item = LIVE[db.feed]
      db.feed += 1
      deliver(item)
      scheduleFeed()
      return true
    },
    examplesLeft: () => LIVE.length - db.feed,

    // Preview only: put the example inbox back the way it started
    reset() {
      clearTimeout(feedTimer)
      store.clear()
      db = seed()
      store.write(db)
      log.length = 0
      logStart = db.historyId
      for (const l of listeners) l.onEvent({ kind: 'resync', threadIds: [], newMail: [], historyId: String(db.historyId) })
      scheduleFeed()
    },
  }
}
