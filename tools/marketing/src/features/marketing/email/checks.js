// The review checklist. Errors block sending; warnings are worth a look.
import { hasLink } from './render.js'
import { isEmptyBlock, BLOCK_INFO } from '../data/blocks.js'
import { hasTag, plainText } from '../lib/rich.js'

const SPAMMY = /\b(free money|act now|100% free|risk[- ]free|guarantee[d]?|winner|cash bonus|click here)\b/i

export function reviewChecks(campaign, { settings = {}, audience = { recipients: [] } } = {}) {
  const checks = []
  const add = (level, id, title, detail, fix) => checks.push({ level, id, title, detail, fix })
  const subject = (campaign.subject || '').trim()

  if (!subject) add('error', 'subject', 'Add a subject line', 'It is the first thing people read in their inbox.', { kind: 'field', target: 'subject', label: 'Write one' })
  else if (subject.length > 60) add('warn', 'subject-long', 'Your subject line is long', `${subject.length} characters. Phones show about 40, so put the point first.`, { kind: 'field', target: 'subject', label: 'Shorten it' })
  else add('ok', 'subject', 'Subject line looks good', `${subject.length} characters.`)

  const words = subject.split(/\s+/).filter((w) => w.length > 3 && /[A-Z]/.test(w))
  const shouting = words.filter((w) => w === w.toUpperCase()).length
  if (subject && (shouting >= 2 || /!!|\$\$/.test(subject) || SPAMMY.test(subject))) {
    add('warn', 'spammy', 'Your subject might trip spam filters', 'Skip all-caps words, stacked punctuation and phrases like "act now".', { kind: 'field', target: 'subject', label: 'Edit subject' })
  }

  if (!(campaign.preheader || '').trim()) add('warn', 'preheader', 'Add preview text', 'It is the gray line people see after the subject. Without it, inboxes show your first sentence.', { kind: 'field', target: 'preheader', label: 'Add it' })

  if (!audience.recipients.length) add('error', 'audience', 'Pick who gets it', 'No one is on the list for this email yet.', { kind: 'step', target: 'audience', label: 'Choose people' })
  else add('ok', 'audience', `${audience.recipients.length} ${audience.recipients.length === 1 ? 'person' : 'people'} will get it`, 'Only people who said yes to emails are included.')

  if (!(settings.mailingAddress || '').trim()) add('error', 'address', 'Add your mailing address', 'Marketing emails need a postal address in the footer. A P.O. box works.', { kind: 'settings', label: 'Add address' })

  if (!(settings.replyTo || '').trim()) add('error', 'reply', 'Add a reply-to email', 'Replies go here, so use an inbox you check.', { kind: 'settings', label: 'Add email' })

  if (!hasLink(campaign)) add('warn', 'cta', 'Give people a next step', 'Add a button or a link so it is easy to reply, call or visit.', { kind: 'add', target: 'button', label: 'Add a button' })

  const noAlt = (campaign.blocks || []).find((b) => b.type === 'image' && !(b.alt || '').trim())
  if (noAlt) add('warn', 'alt', 'Describe your image', 'Some inboxes hide images until they are allowed. A short description fills the gap.', { kind: 'block', target: noAlt.id, label: 'Describe it' })

  const empty = (campaign.blocks || []).find(isEmptyBlock)
  if (empty) add('warn', 'empty', `Fill in or remove the empty ${BLOCK_INFO[empty.type].label.toLowerCase()}`, 'Empty sections show up as blank space.', { kind: 'block', target: empty.id, label: 'Fix it' })

  const usesFirst = [campaign.subject, campaign.preheader, ...(campaign.blocks || []).map((b) => b.text || b.html || b.label || '')].some((v) => /\{First name\}/.test(v || ''))
  if (usesFirst) {
    const missing = audience.recipients.filter((c) => !(c.first || '').trim()).length
    if (missing) add('warn', 'fallback', `${missing} ${missing === 1 ? 'person has' : 'people have'} no first name`, `They will see "${campaign.style?.fallback || 'there'}" instead.`, { kind: 'style', label: 'Change it' })
  }
  const usesBiz = [campaign.subject, campaign.preheader, ...(campaign.blocks || []).map((b) => b.text || b.html || b.label || '')].some((v) => /\{Business\}/.test(v || ''))
  if (usesBiz) {
    const missing = audience.recipients.filter((c) => !(c.business || '').trim()).length
    if (missing) add('warn', 'bizfallback', `${missing} ${missing === 1 ? 'person has' : 'people have'} no business name`, `They will see "${campaign.style?.bizFallback || 'your business'}" instead.`, { kind: 'style', label: 'Change it' })
  }

  if (!campaign.testSentTo) add('warn', 'test', 'Send yourself a test', 'Open it on your phone to check images, links and spelling.', { kind: 'test', label: 'Send a test' })
  else add('ok', 'test', 'Test sent', `Last test went to ${campaign.testSentTo}.`)

  const order = { error: 0, warn: 1, ok: 2 }
  return checks.sort((a, b) => order[a.level] - order[b.level])
}

export const blockingCount = (checks) => checks.filter((c) => c.level === 'error').length

export const wordCount = (campaign) =>
  (campaign.blocks || []).reduce((n, b) => n + plainText(b.html || b.text || '').split(/\s+/).filter(Boolean).length, 0)

export { hasTag }
