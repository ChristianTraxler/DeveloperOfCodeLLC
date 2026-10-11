// Everything an email can pull from: your details, links, images, past work and services.
import ironwood from '../assets/work-ironwood.jpg'
import twinoaks from '../assets/work-twinoaks.jpg'
import riverbend from '../assets/work-riverbend.jpg'
import lookout from '../assets/work-lookout.jpg'
import mainstreet from '../assets/hero-mainstreet.jpg'
import care from '../assets/hero-care.jpg'
import refresh from '../assets/hero-refresh.jpg'

export const BUSINESS = {
  name: 'Developer of Code',
  legalName: 'Developer of Code, LLC',
  tagline: 'Built for Main Street',
  website: 'https://developerofcode.com/',
  websiteLabel: 'developerofcode.com',
  email: 'DeveloperOfCodeLLC@Gmail.com',
  phone: '(828) 781-4674',
  phoneHref: 'tel:+18287814674',
}

export const mailto = (subject) =>
  `mailto:${BUSINESS.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`

export const LINKS = [
  { id: 'site', label: 'Your website', url: BUSINESS.website },
  { id: 'email', label: 'Email you', url: mailto('') },
  { id: 'call', label: 'Call you', url: BUSINESS.phoneHref },
  { id: 'bll', label: 'BusinessLaunchList', url: 'https://businesslaunchlist.com/' },
]

// In the single-file preview, images arrive as data URIs. Blob URLs keep the email HTML small.
function toUsableUrl(src) {
  if (typeof window === 'undefined') return src
  try {
    if (src.startsWith('data:')) {
      const [head, body] = src.split(',')
      const mime = head.slice(5, head.indexOf(';'))
      const bytes = atob(body)
      const arr = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      return URL.createObjectURL(new Blob([arr], { type: mime }))
    }
    return new URL(src, document.baseURI).href
  } catch {
    return src
  }
}

const RAW_IMAGES = [
  { id: 'ironwood', name: 'Ironwood Roofing', group: 'work', src: ironwood, w: 1200, h: 750, alt: 'The Ironwood Roofing website on a laptop and a phone' },
  { id: 'twinoaks', name: 'Twin Oaks Bakery', group: 'work', src: twinoaks, w: 1200, h: 750, alt: 'The Twin Oaks Bakery website with ordering ahead on a phone' },
  { id: 'riverbend', name: 'Riverbend Family Dental', group: 'work', src: riverbend, w: 1200, h: 750, alt: 'The Riverbend Family Dental website with online booking' },
  { id: 'lookout', name: 'Lookout Ridge Outfitters', group: 'work', src: lookout, w: 1200, h: 750, alt: 'The Lookout Ridge Outfitters online store on a laptop and a phone' },
  { id: 'mainstreet', name: 'Main Street at dusk', group: 'studio', src: mainstreet, w: 1200, h: 600, alt: 'An illustrated row of small-town shops at dusk' },
  { id: 'care', name: 'Care plan summary', group: 'studio', src: care, w: 1200, h: 680, alt: 'A site care summary showing uptime, backups, updates and security' },
  { id: 'refresh', name: 'Before and after', group: 'studio', src: refresh, w: 1200, h: 680, alt: 'An old auto shop website next to its modern redesign' },
]

export const IMAGES = RAW_IMAGES.map((img) => ({ ...img, src: toUsableUrl(img.src) }))
export const imageById = (id) => IMAGES.find((img) => img.id === id)

// Example projects. Once connected, this list comes from shipped projects in the Projects Tracker.
export const WORK = [
  { id: 'ironwood', name: 'Ironwood Roofing', kind: 'Roofing contractor in Hickory', what: 'New site with an instant estimate form', image: 'ironwood', url: 'https://ironwoodroofing.example/' },
  { id: 'twinoaks', name: 'Twin Oaks Bakery', kind: 'Bakery in Newton', what: 'Order-ahead menu for weekend pickup', image: 'twinoaks', url: 'https://twinoaksbakery.example/' },
  { id: 'riverbend', name: 'Riverbend Family Dental', kind: 'Dental office in Morganton', what: 'Online booking in under a minute', image: 'riverbend', url: 'https://riverbenddental.example/' },
  { id: 'lookout', name: 'Lookout Ridge Outfitters', kind: 'Outdoor shop in Boone', what: 'Online store with local pickup', image: 'lookout', url: 'https://lookoutridge.example/' },
]
export const workById = (id) => WORK.find((w) => w.id === id)

export const SERVICES = [
  { id: 'custom', name: 'Custom websites', line: 'Designed and built from scratch around how your business works.' },
  { id: 'refresh', name: 'Website refresh', line: 'A modern look and faster pages, keeping what already works.' },
  { id: 'care', name: 'Care plan', line: 'Hosting, backups, updates and small edits, handled every month.' },
  { id: 'store', name: 'Online store', line: 'Sell products with secure checkout and simple inventory.' },
  { id: 'booking', name: 'Booking and scheduling', line: 'Let customers book a time without picking up the phone.' },
  { id: 'tools', name: 'Admin dashboards', line: 'Custom tools for orders, bookings and clients behind the scenes.' },
]
export const serviceById = (id) => SERVICES.find((s) => s.id === id)

export const DEFAULT_STEPS = [
  { title: 'Free call', text: 'Twenty minutes to talk about your business and what the site needs to do.' },
  { title: 'Design', text: 'You see the design first, and we refine it together until it feels right.' },
  { title: 'Build', text: 'I build it mobile first, fast to load, and easy for you to update.' },
  { title: 'Launch', text: 'We go live, you get a walkthrough, and the site is yours.' },
]
