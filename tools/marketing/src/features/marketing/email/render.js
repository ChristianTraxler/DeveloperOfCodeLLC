// Turns a campaign into email-safe HTML: table layout, 600px wide, inline styles, web-safe fonts.
import { THEMES, HEADINGS, BUTTONS, BODY_STACK, MONO_STACK } from './themes.js'
import { BUSINESS, imageById, workById, serviceById } from '../data/library.js'
import { escapeHtml, fillHtmlText, fillPlain, richToEmail, safeUrl, plainText, linksIn } from '../lib/rich.js'

export const UNSUBSCRIBE_TOKEN = '{{{RESEND_UNSUBSCRIBE_URL}}}'

const HEADING_SIZES = { xl: [40, 46], l: [32, 39], m: [24, 31] }

const ghost = (ctx, text) => (ctx.preview ? `<span style="opacity:0.4;">${escapeHtml(text)}</span>` : '')

function logo(ctx, onBand = false, small = false) {
  const { t } = ctx
  const color = onBand ? t.bandLogo : t.logo
  const word = onBand ? t.bandInk : t.ink
  const rule = onBand ? 'rgba(255,255,255,0.22)' : t.line
  const mark = `<span style="font-family:${MONO_STACK};font-weight:800;font-size:${small ? 16 : 19}px;line-height:24px;letter-spacing:-0.6px;color:${color};">&lt;/DOC&gt;</span>`
  if (small) return mark
  return `${mark}<span style="font-family:${BODY_STACK};font-size:13px;line-height:24px;font-weight:600;color:${word};padding-left:10px;margin-left:10px;border-left:1px solid ${rule};">${escapeHtml(BUSINESS.name)}</span>`
}

function header(block, ctx) {
  const { t } = ctx
  const tagline = block.showTagline && block.tagline ? escapeHtml(block.tagline) : ''
  if (block.layout === 'band') {
    return `<td class="px" style="background:${t.band};padding:30px 40px 28px;text-align:center;">${logo(ctx, true)}${
      tagline ? `<div style="font-family:${BODY_STACK};font-size:12px;line-height:18px;letter-spacing:1.6px;text-transform:uppercase;color:${t.bandMuted};margin-top:10px;">${tagline}</div>` : ''
    }</td>`
  }
  if (block.layout === 'center') {
    return `<td class="px" style="padding:30px 40px 24px;text-align:center;border-bottom:1px solid ${t.line};">${logo(ctx)}${
      tagline ? `<div style="font-family:${BODY_STACK};font-size:12px;line-height:18px;letter-spacing:1.6px;text-transform:uppercase;color:${t.muted};margin-top:8px;">${tagline}</div>` : ''
    }</td>`
  }
  if (block.layout === 'minimal') {
    return `<td class="px" style="padding:30px 40px 4px;text-align:left;">${logo(ctx, false, true)}</td>`
  }
  return `<td class="px" style="padding:26px 40px 22px;border-bottom:1px solid ${t.line};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="text-align:left;vertical-align:middle;">${logo(ctx)}</td>${
    tagline ? `<td style="text-align:right;vertical-align:middle;font-family:${BODY_STACK};font-size:12px;line-height:18px;color:${t.muted};">${tagline}</td>` : ''
  }</tr></table></td>`
}

function heading(block, ctx, pad) {
  const { t, h } = ctx
  const [fs, lh] = HEADING_SIZES[block.size] || HEADING_SIZES.l
  const scale = ctx.style?.headings === 'code' ? 0.86 : 1
  const text = block.text ? fillHtmlText(block.text, ctx.contact, ctx.style) : ghost(ctx, 'Your headline goes here')
  const eyebrow = block.eyebrow
    ? `<div style="font-family:${BODY_STACK};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${t.eyebrow};margin:0 0 12px;">${fillHtmlText(block.eyebrow, ctx.contact, ctx.style)}</div>`
    : ''
  return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;text-align:${block.align === 'center' ? 'center' : 'left'};">${eyebrow}<h1 class="h-${block.size || 'l'}" style="margin:0;font-family:${h.stack};font-weight:${h.weight};font-size:${Math.round(fs * scale)}px;line-height:${Math.round(lh * scale)}px;letter-spacing:${h.spacing};color:${t.ink};">${text}</h1></td>`
}

function text(block, ctx, pad) {
  const { t } = ctx
  const fine = block.tone === 'fine'
  const html = plainText(block.html)
    ? richToEmail(block.html, {
        contact: ctx.contact,
        style: ctx.style,
        color: fine ? t.muted : t.body,
        strongColor: t.ink,
        linkColor: t.link,
        size: fine ? 14 : 16,
        lineHeight: fine ? 22 : 26,
        align: block.align === 'center' ? 'center' : 'left',
      })
    : ctx.preview
      ? `<p style="margin:0;font-family:${BODY_STACK};font-size:16px;line-height:26px;color:${t.body};">${ghost(ctx, 'Write a few lines here. Keep it short and friendly.')}</p>`
      : ''
  return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;font-family:${BODY_STACK};">${html}</td>`
}

function imageSrc(block, ctx) {
  if (block.upload) return block.upload
  const img = imageById(block.image)
  return img ? img.src : ''
}

function image(block, ctx, pad) {
  const src = imageSrc(block, ctx)
  const inset = block.width === 'inset'
  const alt = escapeHtml(block.alt || '')
  if (!src) return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${ghost(ctx, 'Choose an image')}</td>`
  const img = `<img src="${escapeHtml(src)}" alt="${alt}" width="${inset ? 520 : 600}" style="display:block;width:100%;max-width:${inset ? 520 : 600}px;height:auto;border:0;outline:none;${inset ? 'border-radius:10px;' : ''}" />`
  const linked = block.url ? `<a href="${escapeHtml(safeUrl(block.url))}" target="_blank" style="text-decoration:none;">${img}</a>` : img
  return inset
    ? `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${linked}</td>`
    : `<td style="padding:${pad.top ? 8 : 0}px 0 ${pad.bottom ? 8 : 0}px;">${linked}</td>`
}

function buttonHtml(block, ctx) {
  const { t, btn } = ctx
  const url = escapeHtml(safeUrl(block.url))
  const label = block.label ? fillHtmlText(block.label, ctx.contact, ctx.style) : ghost(ctx, 'Button label')
  const align = block.align === 'center' ? 'center' : 'left'
  if (block.style === 'link') {
    return `<a href="${url}" target="_blank" style="font-family:${BODY_STACK};font-size:16px;line-height:24px;font-weight:700;color:${t.link};text-decoration:underline;">${label} &rarr;</a>`
  }
  const outline = block.style === 'outline'
  const bg = outline ? 'transparent' : t.accent
  const fg = outline ? t.ink : t.onAccent
  const border = outline ? `border:2px solid ${t.ink};` : `border:2px solid ${t.accent};`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="${align === 'center' ? 'margin:0 auto;' : ''}"><tr><td style="border-radius:${btn.radius}px;background:${bg};${border}"><a href="${url}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${BODY_STACK};font-size:16px;line-height:20px;font-weight:700;color:${fg};text-decoration:none;border-radius:${btn.radius}px;">${label}</a></td></tr></table>`
}

const button = (block, ctx, pad) =>
  `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;text-align:${block.align === 'center' ? 'center' : 'left'};">${buttonHtml(block, ctx)}</td>`

function offer(block, ctx, pad) {
  const { t, h } = ctx
  const f = (v) => fillHtmlText(v, ctx.contact, ctx.style)
  const parts = []
  if (block.label) parts.push(`<div style="font-family:${BODY_STACK};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${t.eyebrow};">${f(block.label)}</div>`)
  parts.push(`<div style="font-family:${h.stack};font-weight:${h.weight};font-size:32px;line-height:38px;letter-spacing:${h.spacing};color:${t.ink};margin-top:8px;">${block.headline ? f(block.headline) : ghost(ctx, 'Your offer')}</div>`)
  if (block.details) parts.push(`<div style="font-family:${BODY_STACK};font-size:15px;line-height:23px;color:${t.body};margin-top:8px;">${f(block.details)}</div>`)
  if (block.code) parts.push(`<div style="margin-top:16px;"><span style="display:inline-block;font-family:${MONO_STACK};font-size:16px;font-weight:700;letter-spacing:1px;color:${t.ink};background:${t.card};border:1px solid ${t.softBorder};border-radius:8px;padding:8px 14px;">${escapeHtml(block.code)}</span></div>`)
  if (block.ends) {
    const d = new Date(`${block.ends}T12:00:00`)
    if (!Number.isNaN(d.getTime())) parts.push(`<div style="font-family:${BODY_STACK};font-size:13px;line-height:20px;font-weight:600;color:${t.ink};margin-top:14px;">Good through ${escapeHtml(d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }))}</div>`)
  }
  if (block.note) parts.push(`<div style="font-family:${BODY_STACK};font-size:13px;line-height:20px;color:${t.muted};margin-top:8px;">${f(block.note)}</div>`)
  return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.soft};border:2px dashed ${t.softBorder};border-radius:14px;"><tr><td style="padding:26px 24px;text-align:center;">${parts.join('')}</td></tr></table></td>`
}

function sectionTitle(title, ctx) {
  if (!title) return ''
  const { t } = ctx
  return `<div style="font-family:${BODY_STACK};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${t.eyebrow};margin:0 0 16px;">${fillHtmlText(title, ctx.contact, ctx.style)}</div>`
}

function work(block, ctx, pad) {
  const { t, h } = ctx
  const items = block.items.map(workById).filter(Boolean).slice(0, 3)
  if (!items.length) return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${ghost(ctx, 'Pick up to three projects')}</td>`
  const cta = block.cta ? escapeHtml(block.cta) : 'See the site'
  const card = (w, width) => {
    const img = imageById(w.image)
    return `${img ? `<a href="${escapeHtml(safeUrl(w.url))}" target="_blank" style="text-decoration:none;"><img class="fluid" src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:10px;" /></a>` : ''}<div style="font-family:${h.stack};font-weight:${h.weight};font-size:${items.length === 1 ? 22 : 18}px;line-height:${items.length === 1 ? 28 : 24}px;letter-spacing:${h.spacing};color:${t.ink};margin-top:14px;">${escapeHtml(w.name)}</div><div style="font-family:${BODY_STACK};font-size:13px;line-height:19px;color:${t.muted};margin-top:2px;">${escapeHtml(w.kind)}</div><div style="font-family:${BODY_STACK};font-size:15px;line-height:22px;color:${t.body};margin-top:8px;">${escapeHtml(w.what)}</div><div style="margin-top:10px;"><a href="${escapeHtml(safeUrl(w.url))}" target="_blank" style="font-family:${BODY_STACK};font-size:14px;line-height:20px;font-weight:700;color:${t.link};text-decoration:underline;">${cta} &rarr;</a></div>`
  }
  let body
  if (items.length === 1) body = card(items[0], 520)
  else {
    const width = items.length === 2 ? 252 : 162
    const pct = items.length === 2 ? '50%' : '33.33%'
    body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${items
      .map((w, i) => `<td class="stack" width="${pct}" valign="top" style="padding:0 ${i === items.length - 1 ? 0 : 8}px 0 ${i === 0 ? 0 : 8}px;">${card(w, width)}</td>`)
      .join('')}</tr></table>`
  }
  return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${sectionTitle(block.title, ctx)}${body}</td>`
}

function services(block, ctx, pad) {
  const { t } = ctx
  const items = block.items.map(serviceById).filter(Boolean)
  if (!items.length) return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${ghost(ctx, 'Pick the services to show')}</td>`
  const rows = items
    .map(
      (s, i) =>
        `<tr><td width="26" valign="top" style="padding:${i ? 14 : 0}px 0 0;"><div style="width:10px;height:10px;border-radius:3px;background:${t.accent};margin-top:7px;font-size:1px;line-height:1px;">&nbsp;</div></td><td valign="top" style="padding:${i ? 14 : 0}px 0 0;font-family:${BODY_STACK};"><div style="font-size:16px;line-height:24px;font-weight:700;color:${t.ink};">${escapeHtml(s.name)}</div><div style="font-size:15px;line-height:22px;color:${t.body};">${escapeHtml(s.line)}</div></td></tr>`,
    )
    .join('')
  return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${sectionTitle(block.title, ctx)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td>`
}

function steps(block, ctx, pad) {
  const { t } = ctx
  const items = block.items.filter((s) => s.title || s.text)
  if (!items.length) return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${ghost(ctx, 'Add your steps')}</td>`
  const rows = items
    .map(
      (s, i) =>
        `<tr><td width="46" valign="top" style="padding:${i ? 16 : 0}px 0 0;"><div style="width:30px;height:30px;border-radius:15px;background:${t.soft};border:1px solid ${t.softBorder};color:${t.eyebrow};font-family:${BODY_STACK};font-size:14px;line-height:30px;font-weight:700;text-align:center;">${i + 1}</div></td><td valign="top" style="padding:${i ? 16 : 0}px 0 0;font-family:${BODY_STACK};"><div style="font-size:16px;line-height:24px;font-weight:700;color:${t.ink};padding-top:3px;">${fillHtmlText(s.title, ctx.contact, ctx.style)}</div><div style="font-size:15px;line-height:23px;color:${t.body};margin-top:2px;">${fillHtmlText(s.text, ctx.contact, ctx.style)}</div></td></tr>`,
    )
    .join('')
  return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${sectionTitle(block.title, ctx)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td>`
}

function quote(block, ctx, pad) {
  const { t } = ctx
  if (!block.text) {
    return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${ctx.preview ? `<div style="border:2px dashed ${t.line};border-radius:12px;padding:18px;font-family:${BODY_STACK};font-size:15px;color:${t.muted};">${ghost(ctx, "Add a few words from a client. Ask them first, and use their real name.")}</div>` : ''}</td>`
  }
  const who = [block.name, block.business].filter(Boolean).map(escapeHtml).join(', ')
  return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:3px solid ${t.accent};padding:4px 0 4px 20px;"><div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:20px;line-height:30px;color:${t.ink};">&ldquo;${escapeHtml(block.text)}&rdquo;</div>${
    who ? `<div style="font-family:${BODY_STACK};font-size:13px;line-height:20px;font-weight:600;color:${t.muted};margin-top:10px;">${who}</div>` : ''
  }</td></tr></table></td>`
}

function contactBlock(block, ctx, pad) {
  const { t } = ctx
  const s = ctx.settings || {}
  const cells = []
  const cell = (label, value, href) =>
    `<td class="stack" valign="top" style="padding:14px 10px 14px 0;font-family:${BODY_STACK};"><div style="font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${t.muted};">${label}</div><a href="${escapeHtml(href)}" target="_blank" style="font-size:15px;line-height:22px;font-weight:600;color:${t.ink};text-decoration:none;">${escapeHtml(value)}</a></td>`
  if (block.phone) cells.push(cell('Call or text', s.phone || BUSINESS.phone, `tel:${(s.phone || BUSINESS.phone).replace(/[^\d+]/g, '')}`))
  if (block.email) cells.push(cell('Email', s.replyTo || BUSINESS.email, `mailto:${s.replyTo || BUSINESS.email}`))
  if (block.website) cells.push(cell('Website', BUSINESS.websiteLabel, BUSINESS.website))
  if (!cells.length) return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;">${ghost(ctx, 'Turn on at least one contact detail')}</td>`
  return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${t.line};border-bottom:1px solid ${t.line};"><tr>${cells.join('')}</tr></table></td>`
}

function divider(block, ctx, pad) {
  const { t } = ctx
  if (block.style === 'dots') {
    return `<td class="px" style="padding:${pad.top}px 40px ${pad.bottom}px;text-align:center;font-family:${BODY_STACK};font-size:14px;line-height:14px;letter-spacing:10px;color:${t.softBorder};">&#9679;&#9679;&#9679;</td>`
  }
  return `<td class="px" style="padding:${pad.top + 6}px 40px ${pad.bottom + 6}px;"><div style="height:1px;line-height:1px;font-size:1px;background:${t.line};">&nbsp;</div></td>`
}

const SPACE = { s: 12, m: 28, l: 52 }
const spacer = (block) => {
  const n = SPACE[block.size] || 28
  return `<td style="height:${n}px;line-height:${n}px;font-size:1px;">&nbsp;</td>`
}

function footer(block, ctx) {
  const { t } = ctx
  const s = ctx.settings || {}
  const address = (s.mailingAddress || '').trim()
  const addressHtml = address
    ? escapeHtml(address).replace(/\n/g, '<br>')
    : ctx.preview
      ? `<span style="display:inline-block;border:1px dashed ${t.softBorder};border-radius:6px;padding:2px 8px;color:${t.link};">Add your mailing address in Settings</span>`
      : ''
  const unsub = ctx.preview ? '#' : UNSUBSCRIBE_TOKEN
  const reason = block.reason ? escapeHtml(fillPlain(block.reason, ctx.contact, ctx.style)) : ''
  return `<td class="px" style="background:${t.footer};padding:30px 40px 34px;border-top:1px solid ${t.line};text-align:center;font-family:${BODY_STACK};">
<div style="margin-bottom:12px;">${logo(ctx, false, true)}</div>
<div style="font-size:12.5px;line-height:19px;color:${t.muted};">${escapeHtml(s.legalName || BUSINESS.legalName)}${addressHtml ? `<br>${addressHtml}` : ''}</div>
${reason ? `<div style="font-size:12.5px;line-height:19px;color:${t.muted};margin-top:12px;">${reason}</div>` : ''}
<div style="font-size:12.5px;line-height:19px;color:${t.muted};margin-top:12px;"><a href="${unsub}" target="_blank" style="color:${t.muted};text-decoration:underline;">Unsubscribe</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="${escapeHtml(BUSINESS.website)}" target="_blank" style="color:${t.muted};text-decoration:underline;">${escapeHtml(BUSINESS.websiteLabel)}</a></div>
</td>`
}

const RENDER = { header, heading, text, image, button, offer, work, services, steps, quote, contact: contactBlock, divider, spacer, footer }

function padFor(block, prev, next) {
  let top = 12
  let bottom = 12
  if (block.type === 'heading') top = prev && prev.type !== 'header' && prev.type !== 'image' ? 28 : 34
  if (block.type === 'work' || block.type === 'services' || block.type === 'steps' || block.type === 'offer') top = 20
  if (prev?.type === 'header' && block.type !== 'heading') top = block.type === 'image' ? 0 : 30
  if (block.type === 'image' && prev?.type !== 'header') top = 8
  if (next?.type === 'footer') bottom = 40
  if (block.type === 'image' && next?.type !== 'footer') bottom = 8
  return { top, bottom }
}

function rowFor(block, ctx, i, blocks) {
  const fn = RENDER[block.type]
  if (!fn) return ''
  const pad = padFor(block, blocks[i - 1], blocks[i + 1])
  const sel = ctx.preview && ctx.selected === block.id ? ' class="mk-sel"' : ''
  const attr = ctx.preview ? ` data-block="${block.id}"${sel}` : ''
  return `<tr${attr}>${fn(block, ctx, pad)}</tr>`
}

const HEAD_STYLE = `body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
@media (max-width:620px){
.outer{padding:0!important;}
.card{border-radius:0!important;}
.px{padding-left:24px!important;padding-right:24px!important;}
.stack{display:block!important;width:100%!important;padding:0 0 22px 0!important;}
.fluid{max-width:100%!important;}
.h-xl{font-size:32px!important;line-height:38px!important;}
.h-l{font-size:27px!important;line-height:33px!important;}
.h-m{font-size:21px!important;line-height:28px!important;}
}`

const PREVIEW_STYLE = `[data-block]{cursor:pointer;}
[data-block]:hover>td{box-shadow:inset 0 0 0 2px rgba(255,90,31,0.4);}
[data-block].mk-sel>td{box-shadow:inset 0 0 0 2px #FF5A1F;}
a{cursor:pointer;}
html{scrollbar-width:thin;}`

export function renderParts(campaign, opts = {}) {
  const { settings = {}, contact = null, preview = false, selected = null } = opts
  const style = campaign.style || {}
  const t = THEMES[style.theme] || THEMES.studio
  const h = HEADINGS[style.headings] || HEADINGS.serif
  const btn = BUTTONS[style.buttons] || BUTTONS.rounded
  const ctx = { t, h, btn, style, contact, settings, preview, selected }
  const blocks = campaign.blocks || []
  const rows = blocks.map((block, i) => ({ id: block.id, html: rowFor(block, ctx, i, blocks) }))
  const pre = escapeHtml(fillPlain(campaign.preheader || '', contact, style))
  const title = escapeHtml(fillPlain(campaign.subject || campaign.name || 'Email', contact, style))
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${title}</title><style>${HEAD_STYLE}${preview ? PREVIEW_STYLE : ''}</style>${preview ? '<base target="_blank">' : ''}`
  const preheader = `<div id="mk-pre" style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${pre}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>`
  const open = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.bg};"><tr><td align="center" class="outer" style="padding:28px 12px;"><table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${t.card};border-radius:16px;overflow:hidden;"><tbody id="mk-rows">`
  const close = `</tbody></table></td></tr></table>`
  return { head, bodyStyle: `margin:0;padding:0;background:${t.bg};`, preheader, open, close, rows, shellKey: `${t.bg}|${t.card}|${preview}`, title }
}

export function renderEmail(campaign, opts = {}) {
  const p = renderParts(campaign, opts)
  return `<!doctype html><html lang="en"><head>${p.head}</head><body style="${p.bodyStyle}">${p.preheader}${p.open}${p.rows.map((r) => r.html).join('')}${p.close}</body></html>`
}

// What someone sees in their inbox list before opening
export function inboxLine(campaign, contact) {
  return {
    from: campaign.fromName || 'Developer of Code',
    subject: fillPlain(campaign.subject || '', contact, campaign.style),
    preheader: fillPlain(campaign.preheader || '', contact, campaign.style),
  }
}

// Every clickable thing in an email, used for click reports
export function campaignLinks(campaign) {
  const links = []
  for (const block of campaign.blocks || []) {
    if (block.type === 'button' && block.label) links.push({ label: block.label, url: block.url, weight: 1 })
    if (block.type === 'image' && block.url) links.push({ label: 'Image', url: block.url, weight: 0.35 })
    if (block.type === 'work') block.items.map(workById).filter(Boolean).forEach((w) => links.push({ label: `${w.name} site`, url: w.url, weight: 0.45 }))
    if (block.type === 'text') linksIn(block.html).forEach((l) => links.push({ label: l.label || 'Text link', url: l.url, weight: 0.3 }))
    if (block.type === 'contact') {
      if (block.phone) links.push({ label: 'Phone number', url: BUSINESS.phoneHref, weight: 0.15 })
      if (block.email) links.push({ label: 'Email address', url: `mailto:${BUSINESS.email}`, weight: 0.12 })
      if (block.website) links.push({ label: 'Website', url: BUSINESS.website, weight: 0.12 })
    }
  }
  return links
}

export function hasLink(campaign) {
  return campaignLinks(campaign).length > 0
}
