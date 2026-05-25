import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Repo root — the main static site lives here (admin/login.html, js/, img/, …).
const siteRoot = path.resolve(__dirname, '../..')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

// DEV ONLY: the tracker's AuthGate bounces to /admin/login.html when there's no
// Supabase session, but that page belongs to the main static site, which the
// Vite server doesn't host. Sessions live in localStorage scoped to the origin,
// so logging in on localhost:5173 is the only way to reach the tracker here.
// This plugin serves the main site's static files (everything outside the
// /admin/tracker base) so login works on the same origin. No effect on `build`.
function serveStaticSite() {
  return {
    name: 'serve-static-site-dev',
    apply: 'serve',
    configureServer(server) {
      // Registered directly (not via the returned post hook) so it runs BEFORE
      // Vite's base middleware — otherwise Vite answers /admin/login.html with
      // its "did you mean" 404 before we get a chance. We only act on existing
      // files outside the tracker base; everything else falls through to Vite.
      server.middlewares.use((req, res, next) => {
        let pathname
        try {
          pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname)
        } catch {
          return next()
        }
        // Vite owns the tracker app itself.
        if (pathname.startsWith('/admin/tracker')) return next()

        const rel = pathname.endsWith('/') ? pathname + 'index.html' : pathname
        const filePath = path.join(siteRoot, rel)
        // Stay inside the repo, and only serve real files.
        if (!filePath.startsWith(siteRoot)) return next()
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next()

        res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

// Served under /admin/tracker on the main site. `base` makes asset URLs
// resolve there; `outDir` writes the build into the main site's admin/tracker
// folder so Vercel serves it alongside the static pages.
export default defineConfig({
  base: '/admin/tracker/',
  plugins: [react(), serveStaticSite()],
  build: {
    outDir: '../../admin/tracker',
    emptyOutDir: true,
  },
})
