import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The admin's static files (admin/supabase.js, admin/login.html, ...) live in the repo's public/ folder.
const siteRoot = path.resolve(__dirname, '../../public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// DEV ONLY: serve the main site's static admin files (the shared client and login page) from the
// same origin, so the session saved by /admin/login.html is the one Outlay reads. No effect on build.
function serveStaticAdmin() {
  return {
    name: 'outlay-serve-static-admin-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let pathname;
        try {
          pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        } catch {
          return next();
        }
        if (pathname.startsWith('/admin/outlay')) return next();
        const filePath = path.join(siteRoot, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
        if (!filePath.startsWith(siteRoot)) return next();
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next();
        res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

// The design lives in src/directions/dial.
const direction = process.env.DIRECTION || 'dial';

// Served at /admin/outlay/ on the main site. The build lands in public/admin/outlay, which the
// site's own Vite build copies into dist/ untouched (same pattern as the Projects Tracker).
export default defineConfig({
  base: '/admin/outlay/',
  plugins: [react(), serveStaticAdmin()],
  resolve: {
    alias: {
      '@direction': fileURLToPath(new URL(`./src/directions/${direction}`, import.meta.url)),
    },
  },
  build: {
    outDir: '../../public/admin/outlay',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    reportCompressedSize: false,
    // Top-level await loads the shared admin client at run time (see src/data/supabaseClient.js).
    target: 'es2022',
  },
});
