// Where each page lives.
// The single-file previews (npm run build:single) link the published claude.ai previews to one another.
// The production build (npm run build) uses normal site paths, ready for developerofcode.com.
export const PREVIEW = import.meta.env.MODE.startsWith('single')

const previewUrls = {
  home: 'https://claude.ai/artifact/AcVRrdjjcP2BFe4cpx2p3Q',
  intake: 'https://claude.ai/artifact/4Va1gTXTLCtHJypsKVxdkF',
  products: 'https://claude.ai/artifact/Vsg7YabMwTcjNDhnG1jRdv',
  notify: 'https://claude.ai/artifact/MNkcrANZC9SVa8TWKwHoHu',
  consult: '/consult.html',
}

const siteUrls = { home: '/', intake: '/intake.html', products: '/products.html', notify: '/notify.html', consult: '/consult.html' }

export const pages = PREVIEW ? previewUrls : siteUrls

// A link to a section of the home page, from the home page itself or from any other page.
export const homeSection = (hash, onHome) => (onHome ? hash : `${pages.home}${hash}`)

// Relay launch sign-ups. The notify page reads ?product= to tailor itself, same as the old page.
export const notifyUrl = (product) => `${pages.notify}?product=${encodeURIComponent(product)}`
