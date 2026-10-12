// The example inbox for the preview. Every person, business and number here is made up,
// except Christian's own address and products. Dates are set relative to when the preview
// first opens, so it always looks current.
import { artUri } from './art.js'
import { quoteDate } from '../lib/format.js'

export const ME = { name: 'Christian at Developer of Code', email: 'developerofcodellc@gmail.com' }

export const SIGNATURE =
  '<div style="color:#5d6577">Christian<br>Developer of Code, LLC<br>(828) 781-4674 · <a href="https://developerofcode.com/">developerofcode.com</a></div>'

export const SEND_AS = [
  { email: 'developerofcodellc@gmail.com', name: 'Christian at Developer of Code', isDefault: true, signature: SIGNATURE },
  { email: 'hello@developerofcode.com', name: 'Developer of Code', isDefault: false, signature: SIGNATURE },
]

export const LABELS = [
  { id: 'Label_clients', name: 'Clients', color: '#ffad47', textColor: '#ffffff' },
  { id: 'Label_leads', name: 'Leads', color: '#4a86e8', textColor: '#ffffff' },
  { id: 'Label_products', name: 'Products', color: '#a479e2', textColor: '#ffffff' },
  { id: 'Label_hosting', name: 'Hosting', color: '#16a766', textColor: '#ffffff' },
]

const P = {
  carla: { name: 'Carla Hefner', email: 'carla@oldmilleventbarn.example' },
  dana: { name: 'Dana Teague', email: 'dana@ironwoodroofing.example' },
  marcus: { name: 'Marcus Yount', email: 'marcus@twinoaksbakery.example' },
  priya: { name: 'Priya Moretz', email: 'priya@lookoutridge.example' },
  leah: { name: 'Leah Whisnant', email: 'leah@riverbenddental.example' },
  reggie: { name: 'Reggie Lutz', email: 'reggie@frontporchflorist.example' },
  jenna: { name: 'Jenna Lutz', email: 'jenna@frontporchflorist.example' },
  ivy: { name: 'Ivy Coffey', email: 'ivy@laurelgapcoffee.example' },
  hector: { name: 'Hector Propst', email: 'hector@copperlineauto.example' },
  desmond: { name: 'Desmond Rhyne', email: 'desmond@sugarcreekwash.example' },
  nadia: { name: 'Dr. Nadia Ferreira', email: 'nadia@lakesidedentalarts.example' },
  jolene: { name: 'Jolene Abee', email: 'jolene@blueridgepaws.example' },
  bll: { name: 'BusinessLaunchList', email: 'notify@businesslaunchlist.com' },
  dispatch: { name: 'Dispatch', email: 'support@developerofcode.com' },
  relay: { name: 'Relay Solo', email: 'alerts@relay-solo.example' },
  outlay: { name: 'Outlay', email: 'reports@outlay.example' },
  forms: { name: 'Developer of Code website', email: 'forms@developerofcode.com' },
  backups: { name: 'Site backups', email: 'backups@developerofcode.com' },
  alliance: { name: 'Foothills Business Alliance', email: 'news@foothillsalliance.example' },
  rank: { name: 'Rank Booster Pro', email: 'reports@rankbooster-pro.example' },
  billing: { name: 'Accounts Department', email: 'billing@secure-invoices.example' },
  summit: { name: 'Agency Growth Summit', email: 'events@agencygrowthsummit.example' },
}
export const PEOPLE = P

// ---------- Time ----------

// { min } minutes ago, or { d, h, m } = d days ago at h:m local time
export function when(spec, now) {
  if (spec.min != null) return now - spec.min * 60_000
  const d = new Date(now)
  d.setDate(d.getDate() - spec.d)
  d.setHours(spec.h ?? 9, spec.m ?? 0, 0, 0)
  return Math.min(d.getTime(), now - 60_000)
}

// ---------- Building blocks for message bodies ----------

const g = (...paras) => `<div dir="ltr">${paras.map((p) => (p === '' ? '<div><br></div>' : `<div>${p}</div>`)).join('')}</div>`
const sig = (name, line) => `<div><br></div><div>${name}</div>${line ? `<div style="color:#6b7280">${line}</div>` : ''}`
const quote = (who, email, stamp, inner) =>
  `<div class="gmail_quote"><div dir="ltr" class="gmail_attr">On ${stamp} ${who} &lt;${email}&gt; wrote:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">${inner}</blockquote></div>`

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

function notice({ brand, mark, accent, band, eyebrow, title, intro, rows = [], cta, foot, after = '' }) {
  const head = band
    ? `<tr><td style="background:${band};padding:22px 32px;color:#ffffff;font:700 17px ${FONT};letter-spacing:-0.2px">${mark}</td></tr>`
    : `<tr><td style="padding:26px 32px 0;font:700 15px ${FONT};color:${accent};letter-spacing:-0.2px">${mark}</td></tr>`
  const table = rows.length
    ? `<tr><td style="padding:6px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:11px 0;border-top:${i ? '1px solid #eceae5' : '0'};font:13px ${FONT};color:#6b7385;width:38%;vertical-align:top">${k}</td><td style="padding:11px 0;border-top:${i ? '1px solid #eceae5' : '0'};font:600 14px ${FONT};color:#1d2433">${v}</td></tr>`,
        )
        .join('')}</table></td></tr>`
    : ''
  const button = cta
    ? `<tr><td style="padding:22px 32px 6px"><a href="${cta.href}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font:700 14px ${FONT};padding:12px 20px;border-radius:8px">${cta.label}</a></td></tr>`
    : ''
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>@media (max-width:520px){.card{border-radius:0!important}.px{padding-left:20px!important;padding-right:20px!important}}</style></head>
<body style="margin:0;background:#f2f1ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f1ee"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" class="card" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
${head}
<tr><td class="px" style="padding:${band ? 26 : 18}px 32px 0">${eyebrow ? `<div style="font:700 11px ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:${accent}">${eyebrow}</div>` : ''}<div style="font:700 22px/1.25 ${FONT};color:#111827;margin-top:6px;letter-spacing:-0.3px">${title}</div>${intro ? `<div style="font:15px/1.6 ${FONT};color:#4b5563;margin-top:10px">${intro}</div>` : ''}</td></tr>
${table}${button}${after}
<tr><td style="padding:22px 32px 28px;font:12px/1.6 ${FONT};color:#8a909c">${foot}</td></tr>
</table></td></tr></table></body></html>`
}

const BLL = (name, business, city, wants, progress) =>
  notice({
    brand: 'BusinessLaunchList',
    mark: 'BusinessLaunchList',
    accent: '#0f766e',
    eyebrow: 'New sign-up',
    title: `${name} just started their launch checklist`,
    intro: `${name.split(' ')[0]} runs <strong>${business}</strong> in ${city} and asked to hear about help with their website.`,
    rows: [
      ['Business', business],
      ['Location', `${city}, NC`],
      ['Checklist progress', progress],
      ['Asked about', wants],
      ['Okay to contact', 'Yes, by email'],
    ],
    cta: { label: 'Open the lead', href: 'https://businesslaunchlist.com/' },
    foot: 'You get this email because businesslaunchlist.com sends new sign-ups to Developer of Code.',
  })

const FORM = (name, business, email, phone, budget, timeline, message) =>
  notice({
    mark: '&lt;/DOC&gt; Developer of Code',
    accent: '#c4410c',
    eyebrow: 'Website contact form',
    title: `Quote request from ${business}`,
    intro: message,
    rows: [
      ['Name', name],
      ['Business', business],
      ['Email', `<a href="mailto:${email}" style="color:#c4410c">${email}</a>`],
      ['Phone', phone],
      ['Budget', budget],
      ['Timeline', timeline],
    ],
    foot: 'Sent from the contact form on developerofcode.com. Reply to this email to answer them directly.',
  })

const RELAY = (title, intro, rows) =>
  notice({
    band: '#1b2a52',
    mark: 'Relay <span style="font-weight:400;opacity:.75">Solo</span>',
    accent: '#2c5ad6',
    eyebrow: 'Workspace activity',
    title,
    intro,
    rows,
    cta: { label: 'View in Relay Solo', href: 'https://relay-solo.vercel.app/' },
    foot: 'Relay Solo admin alerts. Change which alerts you get in Settings.',
  })

// ---------- The inbox ----------
// Each thread: id, messages[]. Each message: at, from, to, cc, subject, html or text, labels,
// attachments [{ art, filename, mimeType, size }], replyTo.

export function seedThreads(now) {
  const qd = (spec) => quoteDate(when(spec, now))
  return [
    {
      id: 't-carla',
      messages: [
        {
          at: { d: 2, h: 15, m: 40 },
          from: P.carla,
          to: [ME],
          subject: 'Homepage photos and the booking calendar',
          labels: ['INBOX', 'IMPORTANT', 'CATEGORY_PERSONAL', 'Label_clients'],
          html: g(
            'Hi Christian,',
            '',
            "Sending over the photos from Saturday's shoot for the homepage. The barn at golden hour is my favorite, but use whatever works best.",
            '',
            'Two questions on the booking calendar:',
            '1. Can couples see which Saturdays are already taken without calling us?',
            '2. Can we block off the first weekend of December for our own holiday market?',
            '',
            'Thanks!',
          ) + sig('Carla', 'Old Mill Event Barn, Claremont'),
          attachments: [
            { art: 'barnFront', filename: 'old-mill-golden-hour.jpg', mimeType: 'image/jpeg', size: 2_841_377 },
            { art: 'stringLights', filename: 'reception-string-lights.jpg', mimeType: 'image/jpeg', size: 3_102_554 },
            { art: 'ceremonyField', filename: 'ceremony-field.jpg', mimeType: 'image/jpeg', size: 2_633_018 },
          ],
        },
        {
          at: { d: 2, h: 17, m: 2 },
          from: ME,
          to: [P.carla],
          subject: 'Re: Homepage photos and the booking calendar',
          labels: ['SENT', 'Label_clients'],
          html:
            g(
              'Carla, these are great. The golden hour one is going right at the top.',
              '',
              "Yes to both. Booked Saturdays will show in gray on the calendar, and you'll get a Private event block you can set yourself from your admin. I'll have the homepage draft to you by Wednesday.",
            ) +
            sig('Christian', 'Developer of Code, LLC') +
            quote('Carla Hefner', P.carla.email, qd({ d: 2, h: 15, m: 40 }), g('Hi Christian,', '', "Sending over the photos from Saturday's shoot for the homepage.")),
        },
        {
          at: { min: 38 },
          from: P.carla,
          to: [ME],
          subject: 'Re: Homepage photos and the booking calendar',
          labels: ['INBOX', 'UNREAD', 'IMPORTANT', 'CATEGORY_PERSONAL', 'Label_clients'],
          html:
            g(
              'Perfect, thank you!',
              '',
              'One more thing. The couple from the Hollow Creek wedding said we can use their words on the site: "The barn felt like it was made for us." Is there a spot for reviews on the homepage?',
            ) +
            sig('Carla') +
            quote('Christian at Developer of Code', ME.email, qd({ d: 2, h: 17, m: 2 }), g('Carla, these are great. The golden hour one is going right at the top.')),
        },
      ],
    },
    {
      id: 't-dana',
      messages: [
        {
          at: { min: 84 },
          from: P.dana,
          to: [ME],
          subject: 'Estimate form emails going to spam?',
          labels: ['INBOX', 'UNREAD', 'STARRED', 'IMPORTANT', 'CATEGORY_PERSONAL', 'Label_clients'],
          html: g(
            'Hey Christian,',
            '',
            'Two customers told me they filled out the estimate form last week, but I never got anything. I found one of them sitting in my spam folder.',
            '',
            "Is there something we can change so these land in my inbox? This is our busiest stretch after the storms and I can't afford to miss them.",
          ) + sig('Dana Teague', 'Ironwood Roofing · (828) 555-0119'),
        },
      ],
    },
    {
      id: 't-bll-ava',
      messages: [
        {
          at: { min: 131 },
          from: P.bll,
          to: [ME],
          subject: 'New sign-up: Ava Bolick, Bolick Family Farm',
          labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES', 'Label_leads'],
          html: BLL('Ava Bolick', 'Bolick Family Farm', 'Vale', 'A website, online orders for CSA boxes', '7 of 24 steps'),
        },
      ],
    },
    {
      id: 't-dispatch-214',
      messages: [
        {
          at: { min: 186 },
          from: P.dispatch,
          to: [ME],
          subject: 'Ticket #214 from Twin Oaks Bakery: Holiday preorder limits',
          labels: ['INBOX', 'CATEGORY_UPDATES', 'Label_products'],
          html: notice({
            band: '#070a12',
            mark: '<span style="color:#ff5a1f">Dispatch</span>',
            accent: '#c4410c',
            eyebrow: 'New ticket · #214',
            title: 'Holiday preorder limits',
            intro: '"Can we change the pickup days to Tuesday and Wednesday only? Monday is our deep-clean day and we won\'t be at the counter." Marcus Yount, Twin Oaks Bakery',
            rows: [
              ['Client', 'Twin Oaks Bakery'],
              ['Priority', 'Normal'],
              ['Covered by', 'Care plan, small edits'],
            ],
            cta: { label: 'Open ticket #214', href: 'https://developerofcode.com/' },
            foot: 'Dispatch, the Developer of Code client support desk.',
          }),
        },
      ],
    },
    {
      id: 't-relay-hartley',
      messages: [
        {
          at: { min: 302 },
          from: P.relay,
          to: [ME],
          subject: 'Hartley Landscaping started a 14-day trial',
          labels: ['INBOX', 'CATEGORY_UPDATES', 'Label_products'],
          html: RELAY('Hartley Landscaping started a trial', 'A new workspace was created from the Relay Solo sign-up page.', [
            ['Workspace', 'Hartley Landscaping'],
            ['Owner', 'Wes Hartley'],
            ['Plan', 'Trial, 14 days'],
            ['Imported', '212 contacts from a spreadsheet'],
          ]),
        },
      ],
    },
    {
      id: 't-marcus',
      messages: [
        {
          at: { d: 3, h: 9, m: 14 },
          from: P.marcus,
          to: [ME],
          subject: 'Holiday preorders',
          labels: ['INBOX', 'Label_clients'],
          html: g(
            'Christian,',
            '',
            "We're thinking about taking holiday preorders online this year: pies, cinnamon knots and the big sourdough boules. Last year we oversold pecan pie by about 40.",
            '',
            'Can the site stop taking orders once we hit a number?',
          ) + sig('Marcus', 'Twin Oaks Bakery'),
        },
        {
          at: { d: 3, h: 11, m: 30 },
          from: ME,
          to: [P.marcus],
          subject: 'Re: Holiday preorders',
          labels: ['SENT', 'Label_clients'],
          html: g(
            'Yes. I can add a limit per item and per pickup day. When pecan pie hits your number, the site shows "Sold out for that day" and offers the next open day.',
            '',
            'Want me to set it up for Thanksgiving and Christmas pickup?',
          ) + sig('Christian'),
        },
        {
          at: { d: 2, h: 8, m: 2 },
          from: P.marcus,
          to: [ME],
          subject: 'Re: Holiday preorders',
          labels: ['INBOX', 'Label_clients'],
          html: g("That's exactly it. Limits are pecan 60, pumpkin 40, knots 30 dozen per day. Pickup the Tuesday and Wednesday before Thanksgiving.") + sig('Marcus'),
        },
        {
          at: { d: 1, h: 16, m: 12 },
          from: ME,
          to: [P.marcus],
          subject: 'Re: Holiday preorders',
          labels: ['SENT', 'INBOX', 'Label_clients'],
          html: g(
            "Done and live on the staging site. I opened a ticket so you can track the last few tweaks in Dispatch.",
            '',
            'Take a look when you get a minute: <a href="https://twinoaksbakery.example/holidays">twinoaksbakery.example/holidays</a>',
          ) + sig('Christian'),
        },
      ],
    },
    {
      id: 't-lakeside',
      messages: [
        {
          at: { d: 1, h: 11, m: 5 },
          from: P.forms,
          replyTo: [P.nadia],
          to: [ME],
          subject: 'Quote request: Lakeside Dental Arts',
          labels: ['INBOX', 'IMPORTANT', 'Label_leads'],
          html: FORM(
            'Dr. Nadia Ferreira',
            'Lakeside Dental Arts',
            P.nadia.email,
            '(828) 555-0164',
            '$5,000 to $8,000',
            'Before our open house on January 15',
            '"We\'re opening a second office in Sherrills Ford and our current site is a single page from 2017. We need online booking, insurance info and a page for each dentist."',
          ),
        },
        {
          at: { d: 1, h: 12, m: 20 },
          from: ME,
          to: [P.nadia],
          subject: 'Re: Quote request: Lakeside Dental Arts',
          labels: ['DRAFT'],
          draft: true,
          html: g(
            'Hi Dr. Ferreira,',
            '',
            "Thanks for reaching out, and congratulations on the second office. Online booking, insurance details and a page for each dentist are all things I build regularly, and January 15 is doable if we start in the next two weeks.",
            '',
            'Would a 20-minute call on',
          ),
        },
      ],
    },
    {
      id: 't-priya',
      messages: [
        {
          at: { d: 2, h: 10, m: 20 },
          from: P.priya,
          to: [ME],
          subject: 'Q4 care plan and one invoice question',
          labels: ['INBOX', 'Label_clients'],
          html: g(
            'Hi Christian, two quick things.',
            '',
            "We'd like to keep the care plan going into next year, same as now.",
            '',
            'And on the October invoice, the small edits line shows 3 hours. Was that the holiday hours banner plus the new fleece photos? I just want to log it right on our end.',
            '',
            'Thanks!',
          ) + sig('Priya Moretz', 'Lookout Ridge Outfitters, Boone'),
        },
      ],
    },
    {
      id: 't-outlay',
      messages: [
        {
          at: { d: 3, h: 7, m: 0 },
          from: P.outlay,
          to: [ME],
          subject: 'September in review: 23 business expenses',
          labels: ['INBOX', 'CATEGORY_UPDATES', 'Label_products'],
          html: notice({
            mark: 'Outlay',
            accent: '#1f8a52',
            eyebrow: 'Monthly summary · example numbers',
            title: '$1,184.66 across 23 expenses',
            intro: 'Here is where September went for Developer of Code, LLC. Four receipts are still missing.',
            rows: [
              ['Hosting and servers', '$186.00'],
              ['Software', '$214.37'],
              ['Equipment', '$412.99'],
              ['Domains', '$58.00'],
              ['Mileage, 147 miles', '$96.30'],
              ['Meals with clients', '$217.00'],
            ],
            cta: { label: 'Add the missing receipts', href: 'https://developerofcode.com/' },
            foot: 'Outlay monthly summary for Developer of Code, LLC.',
          }),
        },
      ],
    },
    {
      id: 't-leah',
      messages: [
        {
          at: { d: 4, h: 13, m: 48 },
          from: P.leah,
          to: [ME],
          subject: 'Thank you! (and a referral)',
          labels: ['INBOX', 'STARRED', 'CATEGORY_PERSONAL', 'Label_clients'],
          html: g(
            'Christian,',
            '',
            'I just wanted to say thank you. Since the new site went up, more new patients are booking online and the front desk is answering a lot fewer "are you taking new patients?" calls.',
            '',
            "My friend Dr. Kenji Ito is opening a pediatric practice in Hickory next spring and needs a site. I gave him your email, so watch for a note from him.",
          ) + sig('Leah', 'Riverbend Family Dental'),
        },
      ],
    },
    {
      id: 't-alliance',
      messages: [
        {
          at: { d: 5, h: 8, m: 30 },
          from: P.alliance,
          to: [ME],
          subject: 'November member mixer at Union Square',
          labels: ['INBOX', 'CATEGORY_UPDATES'],
          html: `<!doctype html><html><head><style>.wrap{max-width:600px;margin:0 auto}@media (max-width:600px){.pad{padding:20px!important}}</style></head><body style="margin:0;background:#f4f1ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:20px 8px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff">
<tr><td><img src="https://assets.foothillsalliance.example/news/nov-mixer.jpg" width="600" height="240" alt="Union Square at dusk" style="display:block;width:100%;height:auto"></td></tr>
<tr><td class="pad" style="padding:30px 36px 8px;font:15px/1.65 Georgia,serif;color:#2b2a28">
<div style="font:700 12px ${FONT};letter-spacing:1.5px;text-transform:uppercase;color:#8a5a2b">Member news · November</div>
<h1 style="font:400 30px/1.2 Georgia,serif;margin:10px 0 14px;color:#1d1b18">Meet your neighbors at the November mixer</h1>
<p>Join fellow members on Thursday, November 12 from 5:30 to 7:30 PM at the old depot on Union Square. Appetizers from Laurel Gap Coffee Co., music on the platform, and a short welcome for our eleven newest members.</p>
<p>Bring a stack of business cards. This is the one where people actually trade them.</p>
</td></tr>
<tr><td class="pad" style="padding:8px 36px 30px"><a href="https://foothillsalliance.example/events" style="display:inline-block;background:#1d1b18;color:#ffffff;font:700 14px ${FONT};text-decoration:none;padding:12px 22px;border-radius:999px">RSVP for the mixer</a></td></tr>
<tr><td class="pad" style="padding:20px 36px 34px;border-top:1px solid #ece6da;font:12px/1.6 ${FONT};color:#8b8478">Foothills Business Alliance · You're getting this as a member. <a href="https://foothillsalliance.example/unsubscribe" style="color:#8b8478">Unsubscribe</a></td></tr>
</table></td></tr></table>
<img src="https://t.foothillsalliance.example/o.gif?m=88213" width="1" height="1" alt="" style="display:block;border:0">
</body></html>`,
        },
      ],
    },
    {
      id: 't-backups',
      messages: [
        {
          at: { d: 6, h: 2, m: 14 },
          from: P.backups,
          to: [ME],
          subject: 'Nightly backups: 14 sites, all good',
          labels: ['INBOX', 'CATEGORY_UPDATES', 'Label_hosting'],
          html: notice({
            mark: '&lt;/DOC&gt; Site backups',
            accent: '#1f8a52',
            eyebrow: 'Nightly report',
            title: '14 of 14 client databases backed up',
            intro: 'Every copy finished and checked out. The largest was Lookout Ridge Outfitters at 412 MB.',
            rows: [
              ['Started', '2:00 AM'],
              ['Finished', '2:13 AM'],
              ['Copies kept', 'Three places, 30 days each'],
              ['Needs attention', 'Nothing'],
            ],
            foot: 'Sent by the Developer of Code backup job. Reports come every night at 2 AM.',
          }),
        },
      ],
    },
    {
      id: 't-reggie',
      messages: [
        {
          at: { d: 9, h: 16, m: 5 },
          from: ME,
          to: [P.reggie],
          cc: [P.jenna],
          subject: 'Draft homepage for Front Porch Florist',
          labels: ['SENT', 'Label_clients'],
          html: g(
            'Hi Reggie and Jenna,',
            '',
            'The first draft of the homepage is ready: <a href="https://frontporchflorist.example/preview">frontporchflorist.example/preview</a>',
            '',
            "Look it over on your phone first, since that's where most of your orders come from. Mark up anything you want changed and I'll turn it around within a day.",
          ) + sig('Christian'),
        },
        {
          at: { d: 8, h: 9, m: 40 },
          from: P.reggie,
          to: [ME],
          cc: [P.jenna],
          subject: 'Re: Draft homepage for Front Porch Florist',
          labels: ['INBOX', 'Label_clients'],
          html:
            g(
              'Christian, this looks fantastic. A few notes from Jenna and me:',
              '',
              '- The porch photo with the mums is perfect for the top.',
              '- Can "Same-day delivery in Conover and Newton" be bigger? People ask about it every single day.',
              '- The wedding section feels a little hidden. Could it get its own button?',
              '- Love the colors. Please don\'t change them.',
            ) +
            sig('Reggie') +
            quote(
              'Christian at Developer of Code',
              ME.email,
              qd({ d: 9, h: 16, m: 5 }),
              g('Hi Reggie and Jenna,', '', 'The first draft of the homepage is ready: frontporchflorist.example/preview', '', "Look it over on your phone first, since that's where most of your orders come from."),
            ),
        },
        {
          at: { d: 8, h: 14, m: 15 },
          from: ME,
          to: [P.reggie],
          cc: [P.jenna],
          subject: 'Re: Draft homepage for Front Porch Florist',
          labels: ['SENT', 'INBOX', 'Label_clients'],
          html:
            g(
              'All three are done. The delivery line now sits right under the headline in large type, and weddings have their own button next to Order flowers.',
              '',
              'Colors untouched. Same link as before.',
            ) +
            sig('Christian') +
            quote('Reggie Lutz', P.reggie.email, qd({ d: 8, h: 9, m: 40 }), g('Christian, this looks fantastic. A few notes from Jenna and me:')),
        },
      ],
    },
    {
      id: 't-ivy',
      messages: [
        {
          at: { d: 10, h: 10, m: 2 },
          from: P.ivy,
          to: [ME],
          subject: 'Menu PDF for the site',
          labels: ['INBOX', 'Label_clients'],
          text: "Hi Christian,\n\nHere's the fall menu. Could it be a real page on the site instead of only a PDF? People keep pinching and zooming on their phones.\n\nPrices on the seasonal lattes changed too, they're all $5.25 now.\n\nIvy\nLaurel Gap Coffee Co.",
          attachments: [{ art: 'menuPdf', filename: 'laurel-gap-fall-menu.pdf', mimeType: 'application/pdf', size: 418_220 }],
        },
      ],
    },
    {
      id: 't-hector',
      messages: [
        {
          at: { d: 12, h: 15, m: 33 },
          from: P.hector,
          to: [ME],
          subject: 'Can we add a coupons page?',
          labels: ['INBOX', 'Label_clients'],
          text: "Christian,\n\nThe old site had a coupons page and a few regulars still ask for it. Can we add one back? Mostly oil change and tire rotation deals that change every month.\n\nIdeally I could update them myself.\n\nThanks,\nHector\nCopperline Auto Works",
        },
      ],
    },
    {
      id: 't-desmond-kickoff',
      messages: [
        {
          at: { d: 15, h: 13, m: 0 },
          from: ME,
          to: [P.desmond],
          subject: 'Kickoff notes: Sugar Creek Pressure Washing',
          labels: ['SENT'],
          html: g(
            'Desmond, thanks for the time today. Here is what we agreed on:',
            '',
            '- Five pages: Home, Services, Gallery, Service area, Get a quote',
            '- Quote form that asks for the surface type and a photo',
            '- Before and after gallery with a slider',
            '- Launch target: the first week of November',
            '',
            "Send the before and after photos whenever they're ready.",
          ) + sig('Christian'),
        },
        {
          at: { d: 15, h: 18, m: 41 },
          from: P.desmond,
          to: [ME],
          subject: 'Re: Kickoff notes: Sugar Creek Pressure Washing',
          labels: ['Label_clients'],
          text: 'Looks good to me. Photos coming soon.\n\nDesmond',
        },
      ],
    },
    {
      id: 't-hector-live',
      messages: [
        {
          at: { d: 32, h: 10, m: 0 },
          from: ME,
          to: [P.hector],
          subject: 'Your new site is live!',
          labels: ['SENT'],
          html: g(
            'Hector, Copperline Auto Works is officially live at the new address.',
            '',
            'Online booking is on, and every request goes to the shop email and to your phone by text. Old links from the previous site now point to the right new pages, so nothing breaks for regulars.',
          ) + sig('Christian'),
        },
        {
          at: { d: 32, h: 12, m: 26 },
          from: P.hector,
          to: [ME],
          subject: 'Re: Your new site is live!',
          labels: ['Label_clients'],
          text: 'Already got two bookings this morning. Thank you!\n\nHector',
        },
      ],
    },
    {
      id: 't-draft-holiday',
      messages: [
        {
          at: { d: 2, h: 19, m: 30 },
          from: ME,
          to: [],
          subject: 'Holiday hours reminder',
          labels: ['DRAFT'],
          draft: true,
          html: g(
            'Hi everyone,',
            '',
            "If your hours change for Thanksgiving or Christmas, reply with the new times and I'll update your website and your Google profile the same day.",
          ),
        },
      ],
    },
    {
      id: 't-spam-rank',
      messages: [
        {
          at: { d: 3, h: 4, m: 12 },
          from: P.rank,
          to: [ME],
          subject: 'Your website is invisible on Google (urgent)',
          labels: ['SPAM', 'UNREAD'],
          text: 'Dear Website Owner,\n\nWe ran a FREE scan and found 37 critical errors stopping your site from ranking. Reply YES and we will fix all of them for one low payment.\n\nAct now, offer expires today.',
        },
      ],
    },
    {
      id: 't-spam-invoice',
      messages: [
        {
          at: { d: 6, h: 23, m: 51 },
          from: P.billing,
          to: [ME],
          subject: 'Invoice #44821 is overdue',
          labels: ['SPAM'],
          text: 'Your account has an overdue balance of $1,842.00. To avoid service interruption, confirm your payment details at the secure link within 24 hours.',
        },
      ],
    },
    {
      id: 't-trash-summit',
      messages: [
        {
          at: { d: 9, h: 7, m: 3 },
          from: P.summit,
          to: [ME],
          subject: 'Last chance: grow your agency to $50k a month',
          labels: ['TRASH', 'CATEGORY_PROMOTIONS'],
          text: 'Seats are almost gone for this year\'s summit. Three days of growth playbooks from agency owners who did it.',
        },
      ],
    },
  ]
}

// Remote images in the example newsletters, mapped to local artwork when you choose Show images
export const REMOTE_IMAGES = {
  'https://assets.foothillsalliance.example/news/nov-mixer.jpg': 'mixerHeader',
}
export const resolveRemote = (url) => (REMOTE_IMAGES[url] ? artUri(REMOTE_IMAGES[url]) : null)

// ---------- Mail that arrives while the preview is open ----------
// delay: seconds after the inbox opens (first one) or after the previous delivery.

export const LIVE = [
  {
    delay: 8,
    thread: 't-live-desmond',
    message: {
      from: P.desmond,
      to: [ME],
      subject: 'Before and after photos are ready',
      labels: ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL', 'Label_clients'],
      html: g(
        'Hey Christian,',
        '',
        'Here are the before and after shots from the Mountain View job. The driveway is my favorite. Use them anywhere on the site.',
      ) + sig('Desmond', 'Sugar Creek Pressure Washing'),
      attachments: [
        { art: 'drivewayBefore', filename: 'mountain-view-before.jpg', mimeType: 'image/jpeg', size: 1_904_331 },
        { art: 'drivewayAfter', filename: 'mountain-view-after.jpg', mimeType: 'image/jpeg', size: 1_877_045 },
      ],
    },
  },
  {
    delay: 40,
    thread: 't-live-bll',
    message: {
      from: P.bll,
      to: [ME],
      subject: 'New sign-up: Tomás Reyes, Reyes Mobile Detailing',
      labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES', 'Label_leads'],
      html: BLL('Tomás Reyes', 'Reyes Mobile Detailing', 'Newton', 'A website, booking, a Google profile', '11 of 24 steps'),
    },
  },
  {
    delay: 45,
    thread: 't-dana',
    message: {
      from: P.dana,
      to: [ME],
      subject: 'Re: Estimate form emails going to spam?',
      labels: ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL', 'Label_clients'],
      html: g('Quick add: both of those customers used Yahoo addresses, if that helps narrow it down.') + sig('Dana'),
    },
  },
  {
    delay: 55,
    thread: 't-live-paws',
    message: {
      from: P.forms,
      replyTo: [P.jolene],
      to: [ME],
      subject: 'Quote request: Blue Ridge Paws Grooming',
      labels: ['INBOX', 'UNREAD', 'IMPORTANT', 'Label_leads'],
      html: FORM(
        'Jolene Abee',
        'Blue Ridge Paws Grooming',
        P.jolene.email,
        '(828) 555-0181',
        '$2,500 to $4,000',
        'Spring',
        '"I take bookings by text right now and it\'s eating my evenings. I\'d love a simple site where people can pick a time and see prices."',
      ),
    },
  },
  {
    delay: 60,
    thread: 't-relay-hartley',
    message: {
      from: P.relay,
      to: [ME],
      subject: 'Hartley Landscaping upgraded to the Studio plan',
      labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES', 'Label_products'],
      html: RELAY('Hartley Landscaping upgraded', 'The trial turned into a paid workspace.', [
        ['Workspace', 'Hartley Landscaping'],
        ['Plan', 'Studio, billed monthly'],
        ['Seats', '3'],
      ]),
    },
  },
  {
    delay: 60,
    thread: 't-carla',
    message: {
      from: P.carla,
      to: [ME],
      subject: 'Re: Homepage photos and the booking calendar',
      labels: ['INBOX', 'UNREAD', 'IMPORTANT', 'CATEGORY_PERSONAL', 'Label_clients'],
      html: g('Found one more from the shoot. This might be the best one for the top of the page.') + sig('Carla'),
      attachments: [{ art: 'barnDoors', filename: 'barn-doors-mums.jpg', mimeType: 'image/jpeg', size: 2_210_964 }],
    },
  },
]

// Short replies that come back a little while after you write to someone in the preview
export const AUTO_REPLIES = {
  [P.carla.email]: 'Perfect, thank you! I will send the calendar link to this weekend\'s couples tonight.',
  [P.dana.email]: "Sounds good. I'll keep an eye on the estimates tomorrow morning and let you know.",
  [P.marcus.email]: 'Great, that works for us. See you Thursday.',
  [P.priya.email]: 'Thanks Christian, that answers it.',
  [P.reggie.email]: 'Jenna says it looks perfect. Ship it!',
  [P.ivy.email]: 'Love it. Thank you!',
  [P.hector.email]: 'Works for me. Thanks!',
  [P.desmond.email]: 'Awesome, thanks man.',
  [P.leah.email]: 'You are very welcome. Kenji is excited to talk.',
  [P.nadia.email]: 'Thank you for the quick reply. Tuesday afternoon works well for a call.',
  [P.jolene.email]: 'Yes please! Mornings are best for me.',
}
