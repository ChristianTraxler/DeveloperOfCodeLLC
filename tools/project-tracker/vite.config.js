import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served under /admin/tracker on the main site. `base` makes asset URLs
// resolve there; `outDir` writes the build into the main site's admin/tracker
// folder so Vercel serves it alongside the static pages.
export default defineConfig({
  base: '/admin/tracker/',
  plugins: [react()],
  build: {
    outDir: '../../admin/tracker',
    emptyOutDir: true,
  },
})
