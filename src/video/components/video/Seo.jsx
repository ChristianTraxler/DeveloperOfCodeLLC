import { useEffect } from 'react'
import { isPlaceholder } from '../../lib/format'

// Drops any field that still holds a [PLACEHOLDER], so unfinished
// details never appear in Google's structured data.
function clean(value) {
  if (Array.isArray(value)) return value.map(clean).filter((v) => v !== undefined)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const c = clean(v)
      if (c !== undefined && !(typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length === 0)) out[k] = c
    }
    return out
  }
  return isPlaceholder(value) ? undefined : value
}

export function buildJsonLd({ seo, links, packages, faq }) {
  const url = seo.siteUrl + seo.path
  const b = seo.business
  const business = {
    '@type': 'LocalBusiness',
    '@id': `${seo.siteUrl}/#business`,
    name: b.name,
    url: seo.siteUrl,
    email: links.email,
    telephone: links.phone,
    image: seo.ogImage,
    founder: { '@type': 'Person', name: b.founder },
    address: { '@type': 'PostalAddress', addressLocality: b.city, addressRegion: b.region, postalCode: b.postalCode, addressCountry: 'US' },
    areaServed: { '@type': 'State', name: b.areaServed },
  }
  const prices = packages.tiers.map((t) => t.price)
  const service = {
    '@type': 'Service',
    '@id': `${url}#service`,
    name: 'Done-for-you short-form video for small businesses',
    serviceType: 'Short-form social video production',
    description: seo.description,
    provider: { '@id': business['@id'] },
    areaServed: { '@type': 'State', name: b.areaServed },
    url,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: packages.tiers.length,
      offers: packages.tiers.map((t) => ({
        '@type': 'Offer',
        name: t.name,
        price: t.price,
        priceCurrency: 'USD',
        description: `${t.videos} videos per month. ${t.terms}.`,
      })),
    },
  }
  const faqPage = {
    '@type': 'FAQPage',
    mainEntity: faq.items
      .filter((i) => !isPlaceholder(i.a))
      .map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  }
  return clean({ '@context': 'https://schema.org', '@graph': [business, service, faqPage] })
}

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

// Sets title, description, Open Graph and JSON-LD for the page.
// If the main site already uses react-helmet or similar, move these tags there.
export default function Seo({ data }) {
  const { seo } = data
  useEffect(() => {
    const url = seo.siteUrl + seo.path
    const prevTitle = document.title
    document.title = seo.title
    setMeta('name', 'description', seo.description)
    setMeta('property', 'og:title', seo.title)
    setMeta('property', 'og:description', seo.description)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:image', seo.ogImage)
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', seo.title)
    setMeta('name', 'twitter:description', seo.description)

    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'video-service-jsonld'
    script.textContent = JSON.stringify(buildJsonLd(data))
    document.head.appendChild(script)

    return () => {
      document.title = prevTitle
      script.remove()
    }
  }, [data, seo])
  return null
}
