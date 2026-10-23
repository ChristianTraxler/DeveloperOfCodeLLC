/*
 * VIDEO SERVICE PAGE: ALL CONTENT, PRICES AND LINKS
 * ---------------------------------------------------
 * Edit this file to change anything on /video. No component needs touching.
 *
 * Placeholders are written in [SQUARE BRACKETS, CAPITALS]. Run `npm run placeholders`
 * to list every one that is still left. Anything still in brackets is skipped in the
 * search-engine structured data, so a forgotten placeholder never goes public there.
 *
 * Sections can be switched off in `sections` below.
 */

// ---- Real sample files --------------------------------------------------
// To add a sample: drop the .mp4 (H.264, 720x1280 is plenty) and a poster image
// into src/assets/video/, import them here, then set `src` and `poster` on the
// matching entry in `samples` further down. `webm` is an optional fallback
// for browsers without H.264; the browser downloads only the one it can play. A sample with no `src` shows the
// designed "Sample reel coming soon" card instead.
import fiveSecondTest from '../assets/video/five-second-test.mp4'
import fiveSecondTestWebm from '../assets/video/five-second-test.webm'
import fiveSecondTestPoster from '../assets/video/five-second-test-poster.webp'

// ---- Links ---------------------------------------------------------------
// Every button on the page reads its link from here.
const email = 'DeveloperOfCodeLLC@Gmail.com'
const mail = (subject) => `mailto:${email}?subject=${encodeURIComponent(subject)}`

export const links = {
  // [BOOKING_URL] Replace with your Calendly, Cal.com or Google booking page.
  // Until then it opens an email with the subject filled in, so it still works.
  booking: '/consult.html',
  // [WEBSITE_SERVICES_URL] Your existing website services page.
  websiteServices: '/#services',
  email,
  phone: '(828) 781-4674',
  phoneHref: 'tel:+18287814674',
}

// ---- Page switches ------------------------------------------------------
export const sections = {
  problem: true,
  showcase: true,
  howItWorks: true,
  packages: true,
  addOns: true,
  why: true,
  bundle: true,
  proof: true, // also hides itself until a testimonial or result has verified: true
  faq: true,
  finalCta: true,
}

// ---- Search and sharing ---------------------------------------------------
export const seo = {
  title: 'Short-Form Video for Small Business in North Carolina | Developer of Code',
  description:
    'Done-for-you Reels, TikToks and Shorts for North Carolina small businesses. Planned, filmed, edited and captioned by a veteran-owned studio. Clear monthly pricing.',
  path: '/video',
  siteUrl: 'https://developerofcode.com',
  ogImage: 'https://developerofcode.com/og.jpg', // [OG_IMAGE] swap for a 1200x630 video-service image
  business: {
    name: 'Developer of Code, LLC',
    founder: 'Christian Traxler',
    city: '[CITY]',
    region: 'NC',
    postalCode: '[ZIP]',
    areaServed: 'North Carolina',
  },
}

// ---- Hero ----------------------------------------------------------------
export const hero = {
  eyebrow: 'Short-form video for Carolina small businesses',
  titleLead: 'Show up on every feed,',
  titleAccent: 'every week.',
  titleTail: 'Without filming or editing a thing.',
  body: 'Reels, TikToks and Shorts that look like you and sound like you. You run the business. I plan, shoot and edit the videos.',
  primaryCta: 'Book a free 15-minute video planning call',
  secondaryCta: 'See packages',
  reassurance: ['Veteran-owned', 'Month to month', 'You own every video'],
  // The middle phone plays this sample. Set to null to show a designed frame instead.
  featuredSampleId: 'before-after',
  sidePhones: [
    { caption: '3 things to check before you hire a roofer', tag: 'Talking tip', tone: 'ember' },
    { caption: 'Saturday at the farm stand: what just came in', tag: 'Behind the scenes', tone: 'cobalt' },
  ],
}

// ---- The problem ---------------------------------------------------------
export const problem = {
  eyebrow: 'Sound familiar?',
  title: 'Your online presence should work as hard as you do.',
  empathy:
    'You are on a job site, at the counter or with a client all day. Posting is the thing that slides, and that is normal.',
  points: [
    {
      title: 'No time to post',
      body: 'By the time the day is done, filming and editing a video is the last thing you want to do.',
    },
    {
      title: 'Posts come in bursts',
      body: 'Three posts one week, nothing for a month. The algorithm and your customers both notice.',
    },
    {
      title: 'Videos look homemade',
      body: 'Shaky, uncaptioned and off-brand clips make a good business look smaller than it is.',
    },
  ],
}

// ---- What the videos look like -----------------------------------------
// Each card is a 9:16 frame. With `src` it plays the video; without, it shows
// the designed "coming soon" card using `mock` as the caption.
export const showcase = {
  eyebrow: 'What the videos look like',
  title: 'Six formats that work for local businesses.',
  body: 'Every video is vertical, captioned and branded. Tap a card to play.',
}

export const samples = [
  {
    id: 'before-after',
    style: 'Before and after',
    title: 'The five-second test',
    blurb: 'A slow, confusing website against a fast one that gets the booking.',
    src: fiveSecondTest,
    webm: fiveSecondTestWebm,
    poster: fiveSecondTestPoster,
    duration: '0:58',
    silent: true,
    // On-screen text, for people using screen readers or watching with no video.
    transcript: [
      'Your customer just found you. You have 5 seconds.',
      'Before: still loading. No prices. No way to book.',
      'Time’s up. They’re gone.',
      'Rewind. Same customer.',
      'After: loads fast, built for phones. A real price in 3 seconds. Tap to call. Book in a few taps.',
      'Booked. No phone tag.',
      'Which one is yours? Lost the call, or got the booking.',
      'Developer of Code. Built by a veteran. Built to get the call. Custom websites for North Carolina small businesses that work from a phone.',
    ],
  },
  {
    id: 'talking-tip',
    style: 'Captioned talking tip',
    title: 'One quick, useful tip',
    blurb: 'You on camera for 30 seconds, captioned and trimmed tight.',
    mock: 'Why your deck needs sealing every two years',
    tone: 'ember',
  },
  {
    id: 'behind-the-scenes',
    style: 'Behind the scenes',
    title: 'How the work gets done',
    blurb: 'The prep, the crew and the care customers never get to see.',
    mock: '6 a.m. at the shop: prepping today’s install',
    tone: 'cobalt',
  },
  {
    id: 'local-promo',
    style: 'Local shout-out or event',
    title: 'Get people in the door',
    blurb: 'Promote an open house, a market day or a neighbor you work with.',
    mock: 'This Saturday: open house, 10 to 2',
    tone: 'signal',
  },
  {
    id: 'review-highlight',
    style: 'Testimonial or review',
    title: 'Let customers say it',
    blurb: 'A real review turned into a clean, captioned clip.',
    mock: '“They showed up when they said they would.”',
    tone: 'navy',
  },
  {
    id: 'spotlight',
    style: 'Product or service spotlight',
    title: 'Show one thing well',
    blurb: 'One product or service, what it is, who it is for, how to get it.',
    mock: 'Our most-booked service, in 20 seconds',
    tone: 'ember',
  },
]

// ---- How it works --------------------------------------------------------
export const steps = {
  eyebrow: 'How it works',
  title: 'Four steps. You only do two of them.',
  items: [
    { icon: 'plan', title: 'We plan', body: 'A quick call or message about your business and your best customers.' },
    { icon: 'capture', title: 'I capture', body: 'I shoot the footage and photos myself, so you never have to film a thing.' },
    { icon: 'edit', title: 'I write and edit', body: 'Scripted, captioned, branded and sized for every platform.' },
    {
      icon: 'post',
      title: 'You approve and post',
      body: 'One revision round is included. Then it is yours to post, or I post it for you with the add-on.',
    },
  ],
  // Hidden for now. Uncomment to show the AI note under the four steps.
  // aiNote:
  //   'I use AI-assisted editing tools to work faster, the same way a carpenter uses power tools. Every video is planned, directed and reviewed by me before you see it.',
}

// ---- Packages ------------------------------------------------------------
// Prices are plain numbers. `ctaHref` can be a Stripe Payment Link or your booking link.
const shared = 'Scripted 15 to 45 second videos with captions, your branding and music'
const common = (videos) => [
  `${videos} videos per month`,
  shared,
  'Hooks written to stop the scroll',
  'A suggested caption and call to action for each',
  '1 revision round per video',
  'Turnaround: 1 to 2 business days',
]

export const packages = {
  eyebrow: 'Packages',
  title: 'Clear monthly pricing. No agency runaround.',
  body: 'Pick a pace that fits. Packages are billed monthly in advance, and unused videos do not roll over.',
  bundleNote: 'Website care clients save 10 to 15% when bundled.',
  honesty:
    'Results vary by business and market, and no one can promise views or revenue. Consistent posting is what builds momentum, so these plans are built to keep you showing up.',
  tiers: [
    {
      id: 'pilot',
      name: 'Pilot',
      price: 199,
      period: null,
      videos: 3,
      videosLabel: '3 videos, one time',
      badge: 'New clients',
      terms: 'For a testimonial',
      extra: 'about $66 each',
      summary: 'A one-time starter set for new clients, in exchange for a testimonial.',
      features: [
        '3 videos, one time',
        shared,
        'Hooks written to stop the scroll',
        'A suggested caption and call to action for each',
        '1 revision round per video',
        'Turnaround: 1 to 2 business days',
      ],
      cta: 'Start with the Pilot',
      ctaHref: mail('Pilot video package'),
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 349,
      period: 'month',
      videos: 4,
      terms: 'Month to month',
      extra: 'about $87 a video',
      summary: 'A steady weekly video so your feed never goes quiet.',
      features: common(4),
      cta: 'Start with Starter',
      ctaHref: mail('Starter video package'),
    },
    {
      id: 'growth',
      name: 'Growth',
      price: 649,
      period: 'month',
      videos: 8,
      featured: true,
      badge: 'Recommended',
      terms: 'Month to month',
      extra: 'about $81 a video',
      summary: 'Two videos a week, so every week has something worth watching.',
      features: common(8),
      cta: 'Choose Growth',
      ctaHref: mail('Growth video package'),
    },
    {
      id: 'authority',
      name: 'Authority',
      price: 949,
      period: 'month',
      videos: 12,
      terms: 'Month to month',
      extra: 'Posting calendar included, about $79 a video',
      summary: 'Three a week, with a posting calendar so you always know what goes out when.',
      features: common(12),
      cta: 'Choose Authority',
      ctaHref: mail('Authority video package'),
    },
  ],
}

// ---- A la carte add-ons -----------------------------------------------------
// `unit` prints after the price. Every price here is editable.
export const addOns = {
  eyebrow: 'A la carte',
  title: 'Add what you need.',
  body: 'Any add-on works with any package.',
  items: [
    { name: 'Single video', detail: 'One video, no package needed', price: 99, unit: 'each' },
    { name: 'Posting and scheduling to your accounts', price: '$100 to $200', unit: 'per month' },
    { name: 'Extra revision round', price: 25, unit: 'per video' },
    { name: 'Rush turnaround', detail: '48 hours', price: 40, unit: 'extra per video' },
    { name: 'On-location filming', detail: 'A planned shoot at your location', price: 'Custom quote', unit: 'quoted up front' },
  ],
}

// ---- Why work with me --------------------------------------------------------
export const why = {
  eyebrow: 'Why work with me',
  title: 'You work with the person who makes your videos.',
  // [HEADSHOT] Put a portrait (about 800x1000) in src/assets/ and import it here.
  headshot: null,
  headshotAlt: 'Christian Traxler, founder of Developer of Code',
  founderName: 'Christian Traxler',
  founderRole: 'Founder, Developer of Code, LLC',
  // [PLACEHOLDER] Two sentences in your own words.
  blurb: [
    '[PLACEHOLDER: one sentence on your service and what you bring from it.]',
    '[PLACEHOLDER: one sentence on why you help Carolina small businesses.]',
  ],
  points: [
    { title: 'Veteran-owned', body: 'Reliable, on time and accountable. If I say Thursday, it is Thursday.' },
    { title: 'One on one', body: 'No account managers or hand-offs. You text the person editing your video.' },
    { title: 'Fast turnaround', body: 'Videos come back on a set schedule, so your posting plan stays on track.' },
    { title: 'Local to North Carolina', body: 'I support Carolina small businesses and can be on-site when it counts.' },
  ],
}

// ---- Bundle with a website -----------------------------------------------
export const bundle = {
  title: 'Videos bring attention. Your website turns it into calls.',
  body: 'Pair a video plan with a premium website or a website care plan and both work harder. Care clients save 10 to 15% on video.',
  cta: 'See website services',
}

// ---- Proof -------------------------------------------------------------------
// The whole section stays hidden until at least one entry has verified: true.
// Only mark an entry verified when it is real and you have permission to share it.
export const proof = {
  eyebrow: 'Results',
  title: 'What clients say.',
  previewInDev: true, // shows the empty slots while running `npm run dev`, never on the live site
  testimonials: [
    { quote: '[CLIENT QUOTE]', name: '[CLIENT NAME]', business: '[CLIENT BUSINESS]', verified: false },
    { quote: '[CLIENT QUOTE]', name: '[CLIENT NAME]', business: '[CLIENT BUSINESS]', verified: false },
  ],
  results: [
    { metric: '[CLIENT RESULT]', label: '[WHAT CHANGED AND OVER WHAT PERIOD]', business: '[CLIENT NAME]', verified: false },
  ],
}

// ---- FAQ ---------------------------------------------------------------------------
export const faq = {
  eyebrow: 'Questions',
  title: 'Straight answers.',
  items: [
    {
      q: 'What do I need to provide?',
      a: 'A quick call or message about your business and your best customers, plus your logo and colors. I handle the filming, writing and editing.',
    },
    {
      q: 'Do you come to my location?',
      a: 'Yes. I shoot the footage myself. A longer, planned shoot at your location is quoted up front before anything is booked.',
    },
    {
      q: 'How many revisions do I get?',
      a: 'One round per video on every package. Extra rounds are $25 per video.',
    },
    {
      q: 'Who owns the videos?',
      a: 'You do. Finished videos are yours to keep and post anywhere. Music is either licensed for commercial use or picked from the platform’s own cleared library, so your posts do not get muted or taken down.',
    },
    {
      q: 'How fast is turnaround?',
      a: 'Standard turnaround is 1 to 2 business days. Rush is 48 hours for $40 extra per video.',
    },
    {
      q: 'How does billing work?',
      a: 'Packages are billed monthly in advance through a secure payment link. Unused videos do not roll over to the next month.',
    },
    {
      q: 'Can I cancel?',
      a: 'Starter, Growth and Authority are month to month. Cancel before your next billing date and you will not be charged again. The Pilot is a one-time package.',
    },
    {
      q: 'Do you guarantee views or followers?',
      a: 'No, and you should be careful with anyone who does. Platforms change what they show people all the time. What I control is quality and consistency: clear, branded videos that go out on schedule, built around what your customers actually ask about. That steady presence is what builds trust over time.',
    },
    {
      q: 'Do you post for me?',
      a: 'Posting and scheduling is a $100 to $200 per month add-on. Otherwise you get finished files and a suggested caption and call to action for each video.',
    },
    {
      q: 'What platforms?',
      a: 'Facebook, Instagram, TikTok and Reels. Every video comes sized for each one.',
    },
    // Hidden for now. Uncomment to bring this question back.
    // {
    //   q: 'How is AI used?',
    //   a: 'I use AI-assisted tools for things like caption timing, cleanup and rough cuts so you get more polish for the price. The ideas, direction, final edit and review are mine. Nothing goes to you that I have not watched start to finish.',
    // },
  ],
}

// ---- Final call to action --------------------------------------------------------
export const finalCta = {
  title: 'Let’s get your business seen, every week.',
  body: 'Book a free 15-minute call. We will talk goals, pick a pace and sketch your first month of videos. No pressure.',
  cta: 'Book a free 15-minute video planning call',
  contactLine: 'Prefer to talk now? Call or text',
}
