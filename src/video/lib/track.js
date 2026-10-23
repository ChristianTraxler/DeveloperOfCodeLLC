// CTA click tracking.
// developerofcode.com loads Google Tag Manager (GTM-K2CNPHK), so clicks are pushed
// to window.dataLayer as a `cta_click` event. In GTM, add a Custom Event trigger
// named cta_click and read the cta_id and cta_location variables.
// Every CTA also carries data-cta and data-cta-location attributes for click triggers.
export function track(ctaId, location, extra = {}) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: 'cta_click', cta_id: ctaId, cta_location: location, page: 'video', ...extra })
}

export function ctaProps(ctaId, location, extra) {
  return {
    'data-cta': ctaId,
    'data-cta-location': location,
    onClick: () => track(ctaId, location, extra),
  }
}
