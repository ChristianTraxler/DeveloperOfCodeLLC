// Starting points for new emails. Every word, image and color can change afterward.
import { makeBlock as b, makeCampaign } from './blocks.js'
import { BUSINESS, mailto } from './library.js'
import { monthName } from '../lib/format.js'

const header = (layout = 'left') => b('header', { layout })
const footer = () => b('footer')

export const TEMPLATES = [
  {
    id: 'notes',
    name: 'Studio notes',
    tag: 'Newsletter',
    blurb: 'A monthly roundup: recent launches, one quick tip and an open door.',
    build: (now = new Date()) => {
      const month = monthName(now)
      return {
        name: `${month} studio notes`,
        subject: `${month} studio notes: two launches and a quick Google tip`,
        preheader: 'What left the workshop this month, plus a five-minute fix for your Google listing.',
        style: { theme: 'studio', headings: 'serif', buttons: 'rounded' },
        blocks: [
          header('left'),
          b('heading', { eyebrow: `${month} studio notes`, text: 'Two new sites went live this month', size: 'l', align: 'left' }),
          b('text', { html: "<p>Hi {First name},</p><p>Here's a quick look at what I launched this month, plus one small change that helps local customers find you.</p>" }),
          b('work', { title: 'Just launched', items: ['ironwood', 'lookout'], cta: 'See the site' }),
          b('divider', { style: 'line' }),
          b('heading', { eyebrow: 'A five-minute fix', text: 'Set your holiday hours on Google', size: 'm', align: 'left' }),
          b('text', { html: '<p>Holiday hours change fast. Open your Google Business Profile, choose <strong>Edit profile</strong>, then <strong>Hours</strong>, and add special hours for Thanksgiving and Christmas. It saves customers a trip to a locked door.</p>' }),
          b('text', { html: "<p>Thinking about a new site or a refresh for next year? Reply to this email and I'll get back to you within a day.</p>", tone: 'fine' }),
          b('button', { label: 'Start a project', url: mailto('New project'), align: 'left' }),
          footer(),
        ],
      }
    },
  },
  {
    id: 'launch',
    name: 'Just launched',
    tag: 'New work',
    blurb: 'Show off one new site with a big screenshot and what it does.',
    build: () => ({
      name: 'Just launched: Ironwood Roofing',
      subject: 'Just launched: a new site for Ironwood Roofing',
      preheader: 'An instant estimate form, a gallery of real jobs and a site built for phones.',
      style: { theme: 'studio', headings: 'sans', buttons: 'rounded' },
      blocks: [
        header('center'),
        b('image', { image: 'ironwood', alt: 'The new Ironwood Roofing website on a laptop and a phone', url: 'https://ironwoodroofing.example/' }),
        b('heading', { eyebrow: 'Just launched', text: 'Ironwood Roofing has a new home online', size: 'l', align: 'center' }),
        b('text', { html: '<p>Ironwood has roofed homes around Hickory for years. Their new site finally shows it, with photos of real jobs and an estimate form that works on any phone.</p>', align: 'center' }),
        b('text', { html: '<ul><li>Instant estimate form that texts the owner</li><li>Before and after photos from real jobs</li><li>A storm damage page built to show up in search</li></ul>' }),
        b('button', { label: 'See the new site', url: 'https://ironwoodroofing.example/', align: 'center' }),
        b('text', { html: '<p>Want something like this for {Business}? Reply and tell me a little about it.</p>', align: 'center', tone: 'fine' }),
        footer(),
      ],
    }),
  },
  {
    id: 'checkup',
    name: 'Site checkup',
    tag: 'Past clients',
    blurb: 'Offer older sites a free review of speed, phones and search.',
    audience: { segments: ['older'], siteMonths: 18, quietDays: 60, people: [] },
    build: () => ({
      name: 'Free site checkup',
      subject: "A free checkup for {Business}'s website",
      preheader: 'Twenty minutes, no cost: speed, phones, search and anything that feels dated.',
      audience: { segments: ['older'], siteMonths: 18, quietDays: 60, people: [] },
      style: { theme: 'studio', headings: 'serif', buttons: 'rounded' },
      blocks: [
        header('left'),
        b('image', { image: 'refresh', alt: 'An older website next to a modern redesign' }),
        b('heading', { text: 'Is your site still pulling its weight?', size: 'l', align: 'left' }),
        b('text', { html: "<p>Hi {First name},</p><p>Websites age faster than we'd like. Phones change, Google changes, and a site that looked sharp at launch can start to feel slow.</p><p>This month I'm setting aside a few spots for a free checkup of sites I've built.</p>" }),
        b('offer', { label: 'For past clients', headline: 'Free site checkup', details: 'A 20-minute review of speed, phones, search and security, with a written list of fixes.', note: 'Reply to grab a spot. No cost and no pressure.' }),
        b('button', { label: 'Book my checkup', url: mailto('Site checkup'), align: 'left' }),
        footer(),
      ],
    }),
  },
  {
    id: 'care',
    name: 'Care plan',
    tag: 'Announcement',
    blurb: 'Introduce hosting, backups and updates as a simple monthly plan.',
    audience: { segments: ['clients', 'past'], siteMonths: 18, quietDays: 60, people: [] },
    build: () => ({
      name: 'Care plan launch',
      subject: 'Hosting, backups and updates, handled for you',
      preheader: 'A simple monthly plan that keeps your site fast, safe and backed up.',
      audience: { segments: ['clients', 'past'], siteMonths: 18, quietDays: 60, people: [] },
      style: { theme: 'navy', headings: 'serif', buttons: 'rounded' },
      blocks: [
        header('band'),
        b('image', { image: 'care', alt: 'A care plan summary showing uptime, backups, updates and security' }),
        b('heading', { eyebrow: 'New for clients', text: 'Your site, looked after every month', size: 'l', align: 'center' }),
        b('text', { html: "<p>Once your site is live, someone has to keep it fast, safe and up to date. The new care plan makes that someone me.</p>", align: 'center' }),
        b('text', { html: '<ul><li>Hosting on your own account, so the site stays yours</li><li>Backups kept in three separate places</li><li>Updates, security checks and small text or photo edits</li></ul>' }),
        b('button', { label: 'Add a care plan', url: mailto('Care plan'), align: 'center' }),
        b('text', { html: `<p>Questions? Reply here or call <strong>${BUSINESS.phone}</strong>.</p>`, align: 'center', tone: 'fine' }),
        footer(),
      ],
    }),
  },
  {
    id: 'howitworks',
    name: 'How it works',
    tag: 'New leads',
    blurb: 'Walk new leads through your process, from first call to launch.',
    audience: { segments: ['newleads'], siteMonths: 18, quietDays: 60, people: [] },
    build: () => ({
      name: 'Welcome, new leads',
      subject: "Thanks for reaching out, {First name}. Here's what happens next",
      preheader: 'Four simple steps from a free call to launch day.',
      audience: { segments: ['newleads'], siteMonths: 18, quietDays: 60, people: [] },
      style: { theme: 'studio', headings: 'sans', buttons: 'rounded' },
      blocks: [
        header('left'),
        b('heading', { text: "Here's how a build works", size: 'l', align: 'left' }),
        b('text', { html: "<p>Hi {First name},</p><p>Thanks for your interest in a website for {Business}. Here's what working together looks like, so there are no surprises.</p>" }),
        b('steps', { title: '' }),
        b('button', { label: 'Book a free call', url: mailto('Free call'), align: 'left' }),
        b('contact'),
        footer(),
      ],
    }),
  },
  {
    id: 'followup',
    name: 'Still thinking?',
    tag: 'Follow-up',
    blurb: 'A short, personal note for leads who went quiet.',
    audience: { segments: ['quiet'], siteMonths: 18, quietDays: 60, people: [] },
    build: () => ({
      name: 'Still thinking it over?',
      subject: 'Still thinking about a website for {Business}?',
      preheader: "No pressure. Here's an easy way to pick things back up.",
      audience: { segments: ['quiet'], siteMonths: 18, quietDays: 60, people: [] },
      style: { theme: 'clean', headings: 'sans', buttons: 'rounded' },
      blocks: [
        header('minimal'),
        b('text', { html: "<p>Hi {First name},</p><p>A while back you asked about a website for {Business}. I didn't want your note to fall through the cracks.</p><p>If the timing is better now, reply with a good day for a quick call. If you went another direction, no hard feelings at all. I hope business is going well.</p><p>Christian<br>Developer of Code</p>" }),
        b('button', { label: 'Pick a time to talk', url: mailto('Picking things back up'), align: 'left', style: 'outline' }),
        footer(),
      ],
    }),
  },
  {
    id: 'referral',
    name: 'Referrals',
    tag: 'Referral',
    blurb: 'Ask happy clients to send a business your way.',
    audience: { segments: ['clients', 'past'], siteMonths: 18, quietDays: 60, people: [] },
    build: () => ({
      name: 'Referral thank-you',
      subject: 'Know a business that needs a better website?',
      preheader: "Send them my way and I'll take $100 off your next invoice.",
      audience: { segments: ['clients', 'past'], siteMonths: 18, quietDays: 60, people: [] },
      style: { theme: 'studio', headings: 'serif', buttons: 'pill' },
      blocks: [
        header('center'),
        b('image', { image: 'mainstreet', alt: 'An illustrated row of small-town shops at dusk' }),
        b('heading', { eyebrow: 'Built for Main Street', text: 'Know a business that deserves a better site?', size: 'l', align: 'center' }),
        b('text', { html: "<p>Most of my work comes from word of mouth, and I'm grateful for every introduction. If a friend or a business you love needs a website, I'd be glad to help.</p>", align: 'center' }),
        b('offer', { label: 'A thank-you from me', headline: '$100 off', details: 'Your next invoice, for every referral that books a project', note: 'No limit. Three referrals means $300 off.' }),
        b('button', { label: 'Make an introduction', url: mailto('Referral'), align: 'center' }),
        b('text', { html: '<p>Reply with their name and email, or forward this to them.</p>', align: 'center', tone: 'fine' }),
        footer(),
      ],
    }),
  },
  {
    id: 'blank',
    name: 'Start from scratch',
    tag: 'Blank',
    blurb: 'Your logo and footer, ready for your own words.',
    build: () => ({
      name: 'Untitled email',
      subject: '',
      preheader: '',
      blocks: [header('left'), b('heading', { text: '' }), b('text', { html: '' }), b('button', { label: 'Start a project' }), footer()],
    }),
  },
]

export const templateById = (id) => TEMPLATES.find((t) => t.id === id)

export function fromTemplate(id, settings = {}, now = new Date(), overrides = {}) {
  const tpl = templateById(id) || templateById('blank')
  const built = tpl.build(now)
  const base = makeCampaign({ template: tpl.id }, settings)
  return {
    ...base,
    ...built,
    style: { ...base.style, ...(built.style || {}) },
    audience: { ...base.audience, ...(built.audience || {}) },
    ...overrides,
  }
}
