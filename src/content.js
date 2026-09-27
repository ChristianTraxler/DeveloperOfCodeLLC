import heroDesk from './assets/img/hero-desk.webp'
import heroMob from './assets/img/hero-mob.webp'
import lake from './assets/img/lake.webp'
import door from './assets/img/door.webp'
import logo from './assets/img/logo-mark.webp'
import signature from './assets/img/signature.png'
import shotReaves from './assets/img/shot-reaves.webp'
import shotRwc from './assets/img/shot-rwc.webp'
import shotRwcMobile from './assets/img/shot-rwc-mobile.webp'
import shotLhr from './assets/img/shot-lhr.webp'
import shotSot from './assets/img/shot-sot.webp'
import shotJp from './assets/img/shot-jp.webp'
import shotVanderburg from './assets/img/shot-vanderburg.webp'
import shotTrainerwire from './assets/img/shot-trainerwire.webp'
import drReaves from './assets/img/dr-reaves.webp'
import kelsey from './assets/img/kelsey.webp'
import { pages } from './site.js'

export const images = { heroDesk, heroMob, lake, door, logo, signature }

export const pricing = {
  base: '$600',
  premium: '$2,500',
  note: 'Projects start around $600, with most landing between $1,200 and $2,200, and premium custom builds from $2,500.',
}

export const links = {
  intake: pages.intake,
  booking: 'https://squareup.com/appointments/book/qc33nk6zsmcyob/LPPR26E8Q19RH/start',
  shop: pages.products,
  support: 'https://support.developerofcode.com',
  status: 'https://status.developerofcode.com',
  photoscapes: 'https://photoscapesphotography.com',
  facebook: 'https://www.facebook.com/DeveloperOfCodeLLC',
  instagram: 'https://www.instagram.com/developer_of_code_llc/',
  x: 'https://twitter.com/DeveloperOfCode',
  email: 'mailto:developerofcodellc@gmail.com',
  phone: 'tel:+18287814674',
}

export const contact = {
  email: 'DeveloperOfCodeLLC@Gmail.com',
  phone: '(828) 781-4674',
  location: 'North Carolina, USA',
}

export const nav = [
  { label: 'Work', href: '#work' },
  { label: 'Services', href: '#services' },
  { label: 'Process', href: '#process' },
  { label: 'About', href: '#about' },
  { label: 'Shop', href: '#shop' },
]

export const principles = [
  {
    title: 'You work with me, start to finish',
    body: 'No account managers and no handoffs. The person on your first call is the person who designs, builds, and launches your site.',
  },
  {
    title: 'Priced for small business',
    body: 'Custom work at prices that make sense, with a clear written proposal before anything begins.',
  },
  {
    title: 'Here after launch',
    body: 'Updates, fixes, hosting, and hands-on training so you can make everyday changes yourself.',
  },
]

// The first project is featured with its phone view. The rest fill a staggered grid in this order.
export const projects = [
  {
    id: 'rwc',
    name: 'Renegade Wellness Center',
    kind: 'Wellness center',
    blurb: 'Services and natural products for a salt therapy and infrared wellness center.',
    url: 'https://renegadewellnesscenter.com',
    shot: shotRwc,
    mobile: shotRwcMobile,
  },
  {
    id: 'reaves',
    name: 'Reaves Chiropractic Health Centre',
    kind: 'Chiropractic practice',
    blurb: 'A calm, modern site for a chiropractic practice, with patient questionnaires ready to download before the first visit.',
    url: 'https://www.drreaveschiropractic.com',
    shot: shotReaves,
  },
  {
    id: 'lhr',
    name: 'LHR Excavation & Grading',
    kind: 'Excavation and grading, Newton',
    blurb: 'A bold, photo-first site for an excavation and grading crew serving Catawba County and the surrounding area.',
    url: 'https://www.lhrexcavationandgrading.com',
    shot: shotLhr,
  },
  {
    id: 'jp',
    name: 'JP Custom Gear',
    kind: 'Online store',
    blurb: 'An online store for custom hats made for first responders, hunters, and everyday wear.',
    url: 'https://www.jpcustomgear.com',
    shot: shotJp,
  },
  {
    id: 'sot',
    name: 'Sons of Thunder Ministry',
    kind: 'Ministry',
    blurb: 'A striking black and gold home for a ministry, built to share its mission and invite people in.',
    url: 'https://sons-of-thunder-ministry.org',
    shot: shotSot,
  },
  {
    id: 'vanderburg',
    name: 'Vanderburg Methodist Church',
    kind: 'Church, Mooresville',
    blurb: 'A welcoming site for a Mooresville church, with service times, sermons, and ministries up front.',
    url: 'https://vanderburgchurch.org',
    shot: shotVanderburg,
  },
  {
    id: 'trainerwire',
    name: 'TrainerWire',
    kind: 'Studio project',
    blurb: 'A live events hub for the Pokémon GO community, with events, raids, and news in one place.',
    url: 'https://trainer-wire.vercel.app',
    shot: shotTrainerwire,
  },
]

export const services = [
  {
    name: 'Websites',
    body: 'Custom sites from a single page to sixteen or more, designed from scratch and built to load fast on any phone.',
    includes: 'Contact forms, galleries, blogs, FAQ pages, search basics',
  },
  {
    name: 'Online stores',
    body: 'Product catalogs, carts, and checkout, with inventory tracking and payments that land in your account.',
    includes: 'Shopping cart, product catalog, payment processing, shipping setup',
  },
  {
    name: 'Booking, portals, and web apps',
    body: 'Scheduling, member logins, customer accounts, and databases for businesses that have outgrown a brochure site.',
    includes: 'Booking and scheduling, member portals, user accounts, databases',
  },
  {
    name: 'Care after launch',
    body: 'Domain and hosting setup, updates and fixes, and hands-on training so you can make everyday edits yourself.',
    includes: 'Domains, hosting, maintenance, SEO and analytics setup, training',
  },
]

export const steps = [
  {
    title: 'Free consultation',
    body: 'Book a call and tell me about your business, your customers, and what your current site is or isn’t doing for you.',
    link: { label: 'Book a free consultation', href: links.booking },
  },
  {
    title: 'Intake and proposal',
    body: 'Fill out the project intake form. I’ll send back a custom proposal with the scope, timeline, and price in writing.',
    link: { label: 'Open the intake form', href: links.intake },
  },
  {
    title: 'Design and build',
    body: 'I design and build your site while you review it along the way. Rush timelines run two to four weeks, and most sites take one to two months.',
  },
  {
    title: 'Launch and care',
    body: 'We launch together. I handle the domain and hosting details, then stay on for updates, fixes, and questions.',
  },
]

export const facts = [
  { k: 'Founded', v: '2019' },
  { k: 'Ownership', v: 'Veteran-owned' },
  { k: 'Education', v: 'B.S., Web Design and Development, magna cum laude' },
  { k: 'Based in', v: 'North Carolina' },
  { k: 'Photography', v: 'Photoscapes Photography', href: links.photoscapes },
]

export const testimonials = [
  {
    name: 'Dr. Ray Reaves',
    org: 'Reaves Chiropractic Health Centre',
    url: 'https://www.drreaveschiropractic.com',
    photo: drReaves,
    quote: [
      'I really didn’t know what I was missing!! I’m old school and not tech savvy so I never knew what having my own web page could do for my business. Not only has it reached out to a whole new potential customer base, but it has saved an enormous amount of time having “Patient Questionnaires” on the site to be downloaded.',
      'In my case, not knowing what I needed for my business, Christian Traxler was extremely knowledgeable and made it very easy. I highly recommend using him to build your custom web page. It will be the best decision you will ever make to grow your business!',
    ],
  },
  {
    name: 'Kelsey Reaves',
    org: 'Renegade Wellness Center',
    url: 'https://renegadewellnesscenter.com',
    photo: kelsey,
    quote: [
      'Christian is fantastic. He was very thorough and made sure my website had everything that I wanted just perfectly. Highly recommended!',
    ],
  },
]

export const software = [
  {
    id: 'relay-crm',
    name: 'Relay CRM',
    status: 'Coming soon',
    body: 'A clean, fast CRM built for small teams and growing agencies. Track contacts, deals, and follow-ups without the bloat of Salesforce or the chaos of a spreadsheet.',
    audience: 'Small teams and growing agencies',
    short: 'For small teams',
    features: 'Pipeline view, ⌘K search, and multiple users',
    price: 'To be announced',
    specimen: 'crm',
  },
  {
    id: 'relay-solo',
    name: 'Relay Solo',
    status: 'Coming soon',
    body: 'A focused, mobile-first CRM for solopreneurs and one-person agencies. Contacts, deals, tasks, and recurring client payments in one place. Own the code, pay once, and never rent your CRM again.',
    audience: 'Solopreneurs, freelancers, and one-person agencies',
    short: 'For one-person businesses',
    features: 'Recurring client payments, mobile-first design, and a one-time price',
    price: 'To be announced',
    specimen: 'solo',
  },
]

export const templates = [
  {
    id: 'habit',
    name: 'Habit Tracker',
    price: '$29',
    body: 'Make daily habits stick. Visualize streaks, set weekly intentions, and review your month in one tidy dashboard.',
    long: 'A Notion template designed to make daily habits stick. Visualize streaks, set weekly intentions, and review your month, all in one tidy dashboard.',
    features: ['Daily tracker', 'Weekly review', 'Streak counter', 'Mobile-friendly'],
    url: 'https://developerofcode.gumroad.com/l/thehabitarchitect',
    specimen: 'habit',
  },
  {
    id: 'wedding',
    name: 'Wedding Planner',
    price: '$27',
    body: 'Guest list, budget tracker, vendor manager, timeline, and seating chart in one Notion workspace.',
    long: 'Everything an engaged couple needs in one Notion workspace: guest list, budget tracker, vendor manager, timeline, and seating chart. Stop juggling six different apps.',
    features: ['Guest list', 'Budget tracker', 'Vendor manager', 'Timeline'],
    url: 'https://developerofcode.gumroad.com/l/hsczbp',
    specimen: 'wedding',
  },
  {
    id: 'journal',
    name: 'The Quiet Journal',
    price: '$14',
    body: 'A calm, structured journal for daily reflection, gratitude, and goal tracking, built for consistency, not perfection.',
    long: 'A calm, structured Notion journal for daily reflection, gratitude, and goal tracking. Prompts guide the page when the blank cursor won’t. Built for consistency, not perfection.',
    features: ['Daily prompts', 'Gratitude log', 'Mood tracker', 'Monthly review'],
    url: 'https://developerofcode.gumroad.com/l/thequietjournal',
    specimen: 'journal',
  },
]
