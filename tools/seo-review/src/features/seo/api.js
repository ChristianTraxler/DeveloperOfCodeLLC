// Picks the real backend, or the saved sample reviews for the stand-alone preview build.
// The flag is fixed at build time, so the production bundle never includes the samples.
export const isDemo = import.meta.env.VITE_SEO_DEMO === '1'
export const api = import.meta.env.VITE_SEO_DEMO === '1' ? await import('./demoApi.js') : await import('./seoApi.js')
