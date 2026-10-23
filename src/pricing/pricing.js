// Every price on the page comes from this file. Source: pricing handoff dated October 16, 2026.
// Items the handoff marks as "not yet decided" are NOT published here (see README).

export const careTerm = { months: 12, label: '12-month agreement' }

export const extraHourRate = 75 // dollars per hour, beyond plan hours and for extra CMS training

export const carePlans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 49,
    response: '2 business days',
    responseShort: '2 days',
    blurb: 'Keeps a finished site safe, current and watched.',
    inherits: null,
    features: [
      'Security and software updates',
      'Uptime monitoring',
      '1 small content edit a month (up to 30 minutes)',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 99,
    response: '1 business day',
    responseShort: '1 day',
    blurb: 'For sites that change often and need a steady hand.',
    inherits: 'Basic',
    recommended: true,
    features: [
      '2 hours of changes a month',
      'One new page or section each quarter',
      'Monthly site check report',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 179,
    response: 'Same business day',
    responseShort: 'Same day',
    blurb: 'For stores, member logins and sites with several connections.',
    inherits: 'Standard',
    features: ['5 hours of changes a month', 'Quarterly SEO and analytics review'],
  },
]

// Comparison rows: value per plan id. true = included, false = not included, string = shown as is.
export const compareRows = [
  { label: 'Security and software updates', basic: true, standard: true, plus: true },
  { label: 'Uptime monitoring', basic: true, standard: true, plus: true },
  { label: 'Changes each month', basic: '1 small edit, 30 min', standard: '2 hours', plus: '5 hours' },
  { label: 'New page or section', basic: false, standard: '1 a quarter', plus: '1 a quarter' },
  { label: 'Monthly site check report', basic: false, standard: true, plus: true },
  { label: 'SEO and analytics review', basic: false, standard: false, plus: 'Quarterly' },
  { label: 'Response time', basic: '2 business days', standard: '1 business day', plus: 'Same business day' },
]

export const setupSizes = [
  {
    id: 'small',
    name: 'Small',
    price: 300,
    from: false,
    pages: '1 to 3 pages',
    scope: ['Template-based design', 'Ideal for a first site or a single service'],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 500,
    from: false,
    pages: '4 to 6 pages',
    scope: ['Custom design', 'Contact form'],
  },
  {
    id: 'large',
    name: 'Large',
    price: 750,
    from: true,
    pages: '7 or more pages',
    scope: ['Custom design, up to 8 pages in the base', 'Booking, a store or client accounts as add-ons'],
  },
]

export const largeBase = {
  price: 750,
  includes: ['Up to 8 pages', 'Custom design', 'A contact form', 'Standard setup'],
}

// kind: 'range' adds min..max once; 'perRange' adds min..max per unit; 'per' adds price per unit; 'quote' is never totaled.
export const addOnGroups = [
  {
    title: 'Features',
    items: [
      { id: 'booking', name: 'Booking or scheduling', note: 'Appointments, reservations or class sign-ups.', kind: 'range', min: 200, max: 400 },
      { id: 'store', name: 'Online store', note: 'Up to 25 products, cart and checkout.', kind: 'range', min: 300, max: 600 },
      { id: 'login', name: 'Client login or member area', note: 'Accounts and pages only members can see.', kind: 'range', min: 400, max: 800 },
      { id: 'integration', name: 'Third-party integration', note: 'A CRM, an email list or another service, each.', kind: 'perRange', min: 150, max: 300, unit: 'integration', maxQty: 6 },
    ],
  },
  {
    title: 'Editing and records',
    items: [
      { id: 'cms-simple', name: 'Simple CMS', note: 'Edit text and images yourself in set sections.', kind: 'range', min: 450, max: 900, group: 'cms' },
      { id: 'cms-full', name: 'Full CMS', note: 'A blog or news section, drafts and more than one user.', kind: 'range', min: 1000, max: 1500, group: 'cms' },
      { id: 'crm', name: 'Custom CRM', note: 'Contacts, a pipeline, notes and reminders, built for you.', kind: 'quote' },
    ],
  },
  {
    title: 'More pages and content',
    items: [
      { id: 'pages', name: 'Pages beyond 8', note: 'Each page past the eight in the base.', kind: 'per', price: 50, unit: 'page', maxQty: 30 },
      { id: 'content', name: 'I write or enter your content', note: 'Writing or loading copy for you.', kind: 'perRange', min: 50, max: 75, unit: 'page', maxQty: 30 },
    ],
  },
]

export const addOnNotes = [
  'Each CMS includes one hour of training. More training is $75 an hour.',
  'If you already pay for a hosted CMS such as WordPress or Sanity, you keep paying that subscription directly.',
  'A custom CRM, or anything beyond the Full CMS, is quoted as its own project.',
  'Sites with client logins or several integrations are a better fit for the Plus care plan.',
]

export const allAddOns = addOnGroups.flatMap((g) => g.items)

export const money = (n) => '$' + n.toLocaleString('en-US')
export const priceLabel = (a) => {
  if (a.kind === 'range') return `${money(a.min)} to ${money(a.max)}`
  if (a.kind === 'perRange') return `${money(a.min)} to ${money(a.max)} per ${a.unit}`
  if (a.kind === 'per') return `${money(a.price)} per ${a.unit}`
  return 'Quoted separately'
}

// Short-form social video. Source: video service handoff dated October 23, 2026.
export const video = {
  page: '/video',
  bundle: 'Website care clients save 10 to 15% when bundled.',
  includes: [
    'Scripted 15 to 45 second videos',
    'Hooks written to stop the scroll',
    'Captions, your branding and music',
    'Sized for Facebook, Instagram, TikTok and Reels',
    'A suggested caption and call to action for each',
    'One revision round per video',
  ],
  packages: [
    { id: 'starter', name: 'Starter', price: 349, videos: 4, each: 87 },
    { id: 'growth', name: 'Growth', price: 649, videos: 8, each: 81, recommended: true },
    { id: 'authority', name: 'Authority', price: 949, videos: 12, each: 79, extra: 'Posting calendar included' },
  ],
  pilot: { price: 199, videos: 3 },
  single: 99,
  terms: ['Billed monthly in advance', 'Month to month', 'Unused videos do not roll over'],
}
