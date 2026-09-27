import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { apiRoutes, gtm } from './scripts/vite-plugins.mjs'

const page = (file) => fileURLToPath(new URL(file, import.meta.url))

// The Google Tag Manager container the live developerofcode.com pages load. Set to '' to drop it.
const GTM_ID = 'GTM-K2CNPHK'

// Standard multi-page production build for Vercel or Netlify.
// The api/ folder deploys as Vercel Functions alongside dist/ (see vercel.json); in dev the
// apiRoutes plugin serves those same handlers so the forms work locally.
export default defineConfig({
  plugins: [react(), apiRoutes(), gtm(GTM_ID)],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: page('./index.html'),
        intake: page('./intake.html'),
        products: page('./products.html'),
        notify: page('./notify.html'),
      },
    },
  },
})
