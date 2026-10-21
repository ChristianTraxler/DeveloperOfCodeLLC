// Example queue used on first load and by "Reset to sample data".
// Dates are set relative to today so the board always looks current.
import { at } from '../lib/dates'
import halyard from '../assets/samples/halyard.jpg'
import fleurish from '../assets/samples/fleurish.jpg'
import sillridge from '../assets/samples/sillridge.jpg'
import tuneup from '../assets/samples/tuneup.jpg'
import finatlas from '../assets/samples/finatlas.jpg'
import renegade from '../assets/samples/renegade.jpg'
import speed from '../assets/samples/speed.jpg'

export const SAMPLE_IMAGES = { halyard, fleurish, sillridge, tuneup, finatlas, renegade, speed }

/** Turns a stored image value into something an <img> can load. */
export function resolveImage(url) {
  if (!url) return ''
  if (url.startsWith('sample:')) return SAMPLE_IMAGES[url.slice(7)] || ''
  return url
}

let n = 0
const id = () => `s${(++n).toString(36)}${Math.random().toString(36).slice(2, 6)}`

function post(p, now) {
  const created = p.created ?? -6
  return {
    id: id(),
    title: '',
    notes: '',
    body: '',
    platform: null,
    account: 'doc',
    imageUrl: '',
    scheduledAt: null,
    status: 'idea',
    tags: [],
    liveUrl: '',
    postedAt: null,
    promo: null,
    sample: true,
    ...p,
    createdAt: at(created, 10, 0, now),
    updatedAt: p.updated != null ? at(p.updated, 15, 20, now) : at(created, 10, 0, now),
  }
}

export function samplePosts(now = new Date()) {
  const P = (p) => post(p, now)
  return [
    // Ideas
    P({
      status: 'idea', platform: 'instagram', created: -1,
      title: 'Why your contact form gets no replies',
      notes: 'Three real patterns from audits: form buried under the fold, no reply-time promise, too many required fields. Could be a 5 slide carousel.',
      tags: ['tips', 'conversion'],
    }),
    P({
      status: 'idea', platform: 'linkedin', created: -3,
      title: 'What a small business site actually costs to run',
      notes: 'Domain, hosting, email, care plan. Plain numbers, no upsell. Pairs well with the care plan email.',
      tags: ['pricing', 'care-plans'],
    }),
    P({
      status: 'idea', platform: 'gbp', created: -4,
      title: 'Business Profile checklist for local trades',
      notes: 'Hours, service area, real photos, Q&A seeded with the questions customers ask on the phone.',
      tags: ['local-seo', 'tips'],
    }),
    P({
      status: 'idea', platform: null, created: -8,
      title: 'Why I started Developer of Code',
      notes: 'Veteran-owned angle. Keep it short and about the clients, not me. Maybe a Veterans Day post.',
      tags: ['story'],
    }),

    // Drafting
    P({
      status: 'drafting', platform: 'instagram', created: -5, updated: -1,
      title: 'Case study: Halyard House',
      imageUrl: 'sample:halyard',
      body: `Halyard House is a Carolina Beach rental that was living on listing sites and paying fees on every booking.

We built them a site that does one job: get guests from "this looks nice" to "these dates are mine" without leaving the page.

What changed:
Dates and guest count sit right under the photos
Rates are on the page, not in a PDF
The booking request works on a phone held in one hand

Swipe for the before and after.

#webdesign #vacationrental #smallbusiness #northcarolina #carolinabeach`,
      tags: ['case-study', 'hospitality'],
    }),
    P({
      status: 'drafting', platform: 'blog', created: -9, updated: -2,
      title: '5 signs your website is costing you phone calls',
      notes: 'Target 900 words. Link to the free audit at the end.',
      body: `Most small business websites do not fail loudly. They fail quietly, one missed call at a time.

1. Your phone number is not tappable
On a phone, a number that is not a link means copy, switch apps, paste. Plenty of people will not bother.

2. Your hours are in an image
Search engines cannot read them, and neither can someone with a screen reader.

3. The first screen does not say what you do and where
"Welcome to our website" tells a visitor nothing. "Pressure washing in Hickory, NC" tells them they are in the right place.

4. It takes more than three seconds to load on mobile
`,
      tags: ['tips', 'local-seo'],
    }),
    P({
      status: 'drafting', platform: 'email', created: -4, updated: 0,
      title: 'Your site, looked after every month',
      notes: 'Care plan explainer for past clients. Send after the November tune-up push.',
      body: `Hi there,

A website is not done when it launches. Plugins age, forms break quietly, and search rules change.

My care plans cover the boring parts so you do not have to think about them:

Monthly updates and backups
A check that every form still delivers
Small content changes, up to an hour a month
A short report so you can see what was done

If you would like me to keep an eye on your site, reply to this email and I will send over the options.

Christian
Developer of Code`,
      tags: ['care-plans'],
    }),
    P({
      status: 'drafting', platform: 'facebook', account: 'fin', created: -2, updated: -1,
      title: 'Link in bio page is live',
      body: `Everything in one place now. Tap the link in our bio for the newest drop, sizing help and our story.`,
      tags: ['client', 'launch'],
    }),

    // Scheduled
    P({
      status: 'scheduled', platform: 'linkedin', created: -6, updated: -1,
      scheduledAt: at(2, 9, 0, now),
      title: 'How I keep client sites under two seconds',
      imageUrl: 'sample:speed',
      body: `Speed is a feature your customers feel before they read a single word.

Here is what I do on every small business build:

Images are sized for the screen they land on, not the camera they came from.
Fonts load early and only in the weights the design uses.
Nothing runs until it is needed, so the page is usable while the rest loads.
Every build gets tested on a slow phone connection, not just office Wi-Fi.

None of it is exotic. It is just done every time.

If your site feels slow on your own phone, it feels slower to your customers.`,
      tags: ['performance', 'tips'],
    }),
    P({
      status: 'scheduled', platform: 'facebook', created: -7, updated: -2,
      scheduledAt: at(3, 12, 30, now),
      title: 'Fall website tune-up: November slots',
      imageUrl: 'sample:tuneup',
      body: `Before the holiday rush, give your website a once-over.

The fall tune-up covers a speed check, a test of every form, the search basics and security updates. You get a short report and I fix what I find.

I am taking six tune-ups in November. Message me or book through the link on my page.`,
      tags: ['offer', 'tune-up'],
    }),
    P({
      status: 'scheduled', platform: 'gbp', created: -5,
      scheduledAt: at(5, 8, 0, now),
      title: 'Now booking January website projects',
      body: `Now booking website projects for January. Custom design, built mobile first, with clear pricing up front. Call or visit developerofcode.com to start with a free 20 minute consult.`,
      tags: ['offer', 'local-seo'],
    }),
    P({
      status: 'scheduled', platform: 'x', created: -3,
      scheduledAt: at(7, 18, 0, now),
      title: 'Fewer pages, clearer site',
      body: `Small business owners: your site probably does not need more pages. It needs the three that matter to be impossible to miss. What you do, where you do it, how to reach you.`,
      tags: ['tips'],
    }),
    P({
      status: 'scheduled', platform: 'instagram', account: 'fin', created: -4, updated: -1,
      scheduledAt: at(9, 11, 0, now),
      title: 'New homepage launch',
      imageUrl: 'sample:finatlas',
      body: `New homepage. Same mission.

Faster to browse, easier to find your size, and the full story of where Fin Atlas started.

Take a look through the link in our bio.

#finatlasapparel #newsite #apparel`,
      tags: ['client', 'launch'],
    }),
    P({
      status: 'scheduled', platform: 'facebook', account: 'rwc', created: -3,
      scheduledAt: at(11, 10, 0, now),
      title: 'Online booking is open',
      imageUrl: 'sample:renegade',
      body: `You can now book your next visit online, any time of day. Pick a time that works for you on our website and you will get a confirmation right away.`,
      tags: ['client', 'launch'],
    }),

    P({
      status: 'scheduled', platform: 'gbp', created: -6, updated: -2,
      scheduledAt: at(-1, 16, 0, now),
      title: 'Free homepage review this week',
      body: `This week only: send me your website address and I will record a short video review of your homepage with three fixes you can make yourself. No cost, no sales call.`,
      tags: ['offer', 'local-seo'],
    }),

    // Posted
    P({
      status: 'posted', platform: 'instagram', created: -10, updated: -3,
      scheduledAt: at(-3, 9, 0, now), postedAt: at(-3, 9, 2, now),
      title: 'Fleurish Greenhouse demo',
      imageUrl: 'sample:fleurish',
      liveUrl: 'https://www.instagram.com/developerofcode/',
      body: `New demo: Fleurish Greenhouse.

A venue site built around the room itself. Tours, open dates and a booking request in three taps.

Want one like it for your venue? Link in bio.

#webdesign #eventvenue #greenhouse #smallbusiness`,
      tags: ['demo', 'hospitality'],
      promo: { queuedAt: at(-2, 14, 0, now), audiences: ['leads'] },
    }),
    P({
      status: 'posted', platform: 'linkedin', created: -12, updated: -6,
      scheduledAt: at(-6, 8, 30, now), postedAt: at(-6, 8, 31, now),
      title: 'Sill & Ridge Homes walkthrough',
      imageUrl: 'sample:sillridge',
      liveUrl: 'https://www.linkedin.com/company/developer-of-code/',
      body: `Home builders lose buyers on floor plans. A PDF that needs pinch and zoom on a phone is where interest goes to die.

For the Sill & Ridge Homes demo, every plan is a real page: room sizes you can read, a toggle for options, and a "Talk to a builder" button that stays in reach.

Full walkthrough in the comments.`,
      tags: ['demo', 'case-study'],
    }),
    P({
      status: 'posted', platform: 'blog', created: -16, updated: -9,
      scheduledAt: at(-9, 7, 0, now), postedAt: at(-9, 7, 5, now),
      title: 'How I price websites',
      liveUrl: 'https://developerofcode.com/',
      body: `Every quote I send has three parts: the pages you need, the features those pages do, and the care after launch. Here is how each one is priced and why.`,
      tags: ['pricing'],
    }),

    // Skipped
    P({
      status: 'skipped', platform: 'x', created: -14, updated: -5,
      title: 'Halloween "scary website" roast',
      notes: 'Felt off brand to poke fun at real sites. Revisit as a "spooky speed" tips post next year.',
      body: `The scariest thing this Halloween? A homepage carousel with eleven slides.`,
      tags: ['seasonal'],
    }),
    P({
      status: 'skipped', platform: 'facebook', created: -20, updated: -11,
      title: 'Poll: biggest website headache',
      notes: 'Low reach on polls last time. Fold the question into the tune-up post instead.',
      tags: ['engagement'],
    }),
  ]
}
