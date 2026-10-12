import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// The admin's static files (admin/supabase.js, admin/login.html, ...) live in the repo's public/ folder.
const siteRoot = path.resolve(__dirname, '../../public')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

// DEV ONLY: serve the main site's static admin files (the shared client and login page) from the
// same origin, so the session saved by /admin/login.html is the one Marketing reads. No effect on build.
function serveStaticAdmin() {
  return {
    name: 'marketing-serve-static-admin-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let pathname
        try {
          pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname)
        } catch {
          return next()
        }
        if (pathname.startsWith('/admin/marketing')) return next()
        const filePath = path.join(siteRoot, pathname.endsWith('/') ? `${pathname}index.html` : pathname)
        if (!filePath.startsWith(siteRoot)) return next()
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next()
        res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

// Served at /admin/marketing/ on the main site. The build lands in public/admin/marketing, which the
// site's own Vite build copies into dist/ untouched (same pattern as the Projects Tracker and Outlay).
export default defineConfig({
  base: '/admin/marketing/',
  plugins: [react(), serveStaticAdmin()],
  // DEV ONLY: point /api at a local copy of api/marketing.mjs (or a deployed one) while designing.
  server: { proxy: { '/api': process.env.MARKETING_API || 'http://localhost:3000' } },
  build: {
    outDir: '../../public/admin/marketing',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    reportCompressedSize: false,
    // Top-level await loads the shared admin client at run time (see src/app/session.js).
    target: 'es2022',
  },
})
