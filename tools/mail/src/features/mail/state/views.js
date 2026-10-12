// Folders, quick filters, and how a thread is matched to the folder you're looking at.
import { Archive, FileText, Inbox, Send, ShieldAlert, Star, Trash2 } from 'lucide-react'

export const FOLDERS = [
  { id: 'INBOX', name: 'Inbox', icon: Inbox, count: 'unread' },
  { id: 'STARRED', name: 'Starred', icon: Star },
  { id: 'SENT', name: 'Sent', icon: Send },
  { id: 'DRAFT', name: 'Drafts', icon: FileText, count: 'total' },
  { id: 'ALL', name: 'All mail', icon: Archive },
  { id: 'SPAM', name: 'Spam', icon: ShieldAlert, count: 'unread' },
  { id: 'TRASH', name: 'Trash', icon: Trash2 },
]

export const FILTERS = [
  { id: 'unread', label: 'Unread', q: 'is:unread' },
  { id: 'starred', label: 'Starred', q: 'is:starred' },
  { id: 'files', label: 'Attachments', q: 'has:attachment' },
]

export const CATEGORY_TAGS = {
  CATEGORY_UPDATES: 'Updates',
  CATEGORY_PROMOTIONS: 'Promotions',
  CATEGORY_SOCIAL: 'Social',
  CATEGORY_FORUMS: 'Forums',
}

export const HIDDEN_LABELS = new Set(['INBOX', 'UNREAD', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'CHAT', 'CATEGORY_PERSONAL', ...Object.keys(CATEGORY_TAGS)])

// A view is a folder or label (labelId) plus optional search text (q).
// Searches from the search box run across all mail, like Gmail.
export const viewKey = (view) => `${view.labelId || '*'}|${view.q || ''}`

export function folderName(labelId, labels) {
  const folder = FOLDERS.find((f) => f.id === labelId)
  if (folder) return folder.name
  const label = labels?.user?.find((l) => l.id === labelId)
  return label ? label.name.split('/').pop() : 'Mail'
}

// Whether a thread summary belongs in a folder or label view. Only used for views without
// search text; searches are always asked of the server again.
export function belongs(summary, labelId) {
  const l = new Set(summary.labels)
  const trashOnly = l.has('TRASH') && !l.has('INBOX') && !l.has('SENT') && !l.has('DRAFT')
  switch (labelId) {
    case 'TRASH':
      return l.has('TRASH')
    case 'SPAM':
      return l.has('SPAM')
    case 'ALL':
      return !l.has('SPAM') && !trashOnly
    default:
      return l.has(labelId) && !l.has('SPAM') && !trashOnly
  }
}

export function sortByDate(ids, threads) {
  return [...ids].sort((a, b) => (threads[b]?.date || 0) - (threads[a]?.date || 0))
}

// Combined query text for a folder plus a quick filter
export function queryFor(view, filterId) {
  const filter = FILTERS.find((f) => f.id === filterId)
  return [view.q, filter?.q].filter(Boolean).join(' ').trim()
}

// ---------- Routes inside the tool: f/<label>, s/<query>, plus /t/<thread> ----------

export function parseRoute(path = '') {
  const [clean, query = ''] = String(path).split('?')
  const parts = clean.split('/').filter(Boolean)
  let view = { labelId: 'INBOX', q: '' }
  let threadId = null
  let i = 0
  if (parts[i] === 'f') {
    view = { labelId: decodeURIComponent(parts[i + 1] || 'INBOX'), q: '' }
    i += 2
  } else if (parts[i] === 's') {
    view = { labelId: '', q: decodeURIComponent(parts[i + 1] || '') }
    i += 2
  }
  if (parts[i] === 't' && parts[i + 1]) threadId = decodeURIComponent(parts[i + 1])
  return { view, threadId, params: new URLSearchParams(query) }
}

export function buildRoute(view, threadId) {
  const base = view.q ? `s/${encodeURIComponent(view.q)}` : view.labelId && view.labelId !== 'INBOX' ? `f/${encodeURIComponent(view.labelId)}` : ''
  if (!threadId) return base
  return `${base || 'f/INBOX'}/t/${encodeURIComponent(threadId)}`
}
