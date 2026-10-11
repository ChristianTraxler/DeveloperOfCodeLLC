// The sections an email is built from: names, defaults and one-line summaries.
import { BUSINESS, DEFAULT_STEPS, imageById, workById, serviceById, mailto } from './library.js'
import { plainText } from '../lib/rich.js'
import { uid } from '../lib/rng.js'

export const DEFAULT_REASON =
  "You're getting this email because you've worked with Developer of Code or asked to hear from me."

export const BLOCK_INFO = {
  header: { label: 'Logo header', hint: 'Your logo and tagline across the top' },
  heading: { label: 'Headline', hint: 'A big line that grabs attention' },
  text: { label: 'Text', hint: 'Paragraphs, bold words, links and lists' },
  image: { label: 'Image', hint: 'A screenshot, a graphic or your own photo' },
  button: { label: 'Button', hint: 'One clear next step: reply, call or visit' },
  offer: { label: 'Special offer', hint: 'A coupon-style box for a deal' },
  work: { label: 'Recent work', hint: 'Up to three sites you built' },
  services: { label: 'Services', hint: 'What you offer, one line each' },
  steps: { label: 'How it works', hint: 'Your process, step by step' },
  quote: { label: 'Client quote', hint: 'A few words from someone you built for' },
  contact: { label: 'Contact details', hint: 'Phone, email and website' },
  divider: { label: 'Divider', hint: 'A thin line between sections' },
  spacer: { label: 'Space', hint: 'A little extra breathing room' },
  footer: { label: 'Footer', hint: 'Mailing address and unsubscribe link, always included' },
}

export const ADDABLE = ['heading', 'text', 'image', 'button', 'offer', 'work', 'services', 'steps', 'quote', 'contact', 'divider', 'spacer']

export function blockDefaults(type) {
  switch (type) {
    case 'header':
      return { layout: 'left', tagline: BUSINESS.tagline, showTagline: true }
    case 'heading':
      return { eyebrow: '', text: '', size: 'l', align: 'left' }
    case 'text':
      return { html: '', align: 'left', tone: 'normal' }
    case 'image':
      return { image: 'mainstreet', upload: null, uploadName: '', alt: '', url: '', width: 'full' }
    case 'button':
      return { label: 'Start a project', url: BUSINESS.website, align: 'left', style: 'filled' }
    case 'offer':
      return { label: 'This month only', headline: 'Free site checkup', details: 'A 20-minute review of speed, phones and search, with a list of fixes.', code: '', ends: '', note: 'Reply to this email to grab a spot.' }
    case 'work':
      return { title: 'Recent work', items: ['ironwood', 'twinoaks'], cta: 'See the site' }
    case 'services':
      return { title: 'What I can help with', items: ['custom', 'refresh', 'care'] }
    case 'steps':
      return { title: 'How it works', items: DEFAULT_STEPS.map((s) => ({ ...s })) }
    case 'quote':
      return { text: '', name: '', business: '' }
    case 'contact':
      return { phone: true, email: true, website: true }
    case 'divider':
      return { style: 'line' }
    case 'spacer':
      return { size: 'm' }
    case 'footer':
      return { reason: DEFAULT_REASON }
    default:
      return {}
  }
}

export const makeBlock = (type, overrides = {}) => ({ id: uid('b'), type, ...blockDefaults(type), ...overrides })

export const DEFAULT_STYLE = { theme: 'studio', headings: 'serif', buttons: 'rounded', fallback: 'there', bizFallback: 'your business' }

export function makeCampaign(overrides = {}, settings = {}) {
  const now = new Date().toISOString()
  return {
    id: uid('c'),
    name: 'Untitled email',
    status: 'draft',
    template: 'blank',
    createdAt: now,
    updatedAt: now,
    scheduledFor: null,
    sentAt: null,
    fromName: settings.fromName || 'Christian at Developer of Code',
    subject: '',
    preheader: '',
    style: { ...DEFAULT_STYLE },
    blocks: [makeBlock('header'), makeBlock('footer')],
    audience: { segments: ['all'], siteMonths: 18, quietDays: 60, people: [] },
    testSentTo: null,
    stats: null,
    ...overrides,
  }
}

export function copyCampaign(campaign, name) {
  const now = new Date().toISOString()
  const clone = JSON.parse(JSON.stringify(campaign))
  return {
    ...clone,
    id: uid('c'),
    name: name || `${campaign.name} (copy)`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    scheduledFor: null,
    sentAt: null,
    testSentTo: null,
    stats: null,
    blocks: clone.blocks.map((b) => ({ ...b, id: uid('b') })),
  }
}

const LAYOUT_NAMES = { left: 'Logo on the left', center: 'Centered logo', band: 'Dark band', minimal: 'Small logo only' }
const SIZE_NAMES = { s: 'Small space', m: 'Medium space', l: 'Large space' }

export function linkName(url) {
  if (!url) return 'no link yet'
  if (url.startsWith('mailto:')) {
    const subject = decodeURIComponent((url.split('subject=')[1] || '').replace(/\+/g, ' '))
    return subject ? `reply: ${subject}` : 'reply by email'
  }
  if (url.startsWith('tel:')) return 'a phone call'
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function blockSummary(block) {
  switch (block.type) {
    case 'header':
      return LAYOUT_NAMES[block.layout] || 'Logo header'
    case 'heading':
      return block.text || block.eyebrow || 'Empty headline'
    case 'text':
      return plainText(block.html) || 'Empty text'
    case 'image':
      return block.upload ? block.uploadName || 'Your photo' : imageById(block.image)?.name || 'Choose an image'
    case 'button':
      return `${block.label || 'Button'}, goes to ${linkName(block.url)}`
    case 'offer':
      return [block.headline, block.details].filter(Boolean).join(', ') || 'Empty offer'
    case 'work':
      return block.items.map((id) => workById(id)?.name).filter(Boolean).join(', ') || 'No projects picked'
    case 'services':
      return block.items.map((id) => serviceById(id)?.name).filter(Boolean).join(', ') || 'No services picked'
    case 'steps':
      return block.items.map((s) => s.title).filter(Boolean).join(', ') || 'No steps yet'
    case 'quote':
      return block.text ? `"${block.text}"` : 'Empty quote'
    case 'contact':
      return [block.phone && 'Phone', block.email && 'Email', block.website && 'Website'].filter(Boolean).join(', ') || 'Nothing shown'
    case 'divider':
      return block.style === 'dots' ? 'Dots' : 'Line'
    case 'spacer':
      return SIZE_NAMES[block.size] || 'Space'
    case 'footer':
      return 'Mailing address and unsubscribe link'
    default:
      return ''
  }
}

export const isEmptyBlock = (b) =>
  (b.type === 'heading' && !b.text.trim()) ||
  (b.type === 'text' && !plainText(b.html)) ||
  (b.type === 'quote' && !b.text.trim()) ||
  (b.type === 'offer' && !b.headline.trim()) ||
  (b.type === 'work' && !b.items.length) ||
  (b.type === 'services' && !b.items.length) ||
  (b.type === 'button' && !b.label.trim())

export { mailto }
