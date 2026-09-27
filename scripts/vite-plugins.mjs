// Two small Vite plugins used by vite.config.js.
//
//   apiRoutes()  For `npm run dev` only. Vercel serves the handlers in api/ as functions in
//                production, but the Vite dev server knows nothing about them, so the notify
//                form and the status badge would 404 locally. This mounts each api/<name>.mjs
//                at /api/<name> using the same web-standard `{ fetch(request) }` shape Vercel
//                calls, so the file that works locally is the file that runs in production.
//                Server-side env vars come from .env / .env.local (see .env.example).
//
//   gtm(id)      Production build only. Injects the Google Tag Manager snippet the live
//                developerofcode.com pages already load. Skipped in dev and in the single-file
//                previews so nothing fires from a preview or a local session.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'

export function apiRoutes() {
  return {
    name: 'doc-api-routes',
    apply: 'serve',
    configureServer(server) {
      const { root, mode } = server.config
      // Vite only exposes VITE_* to the browser; the handlers read everything else off process.env.
      for (const [key, value] of Object.entries(loadEnv(mode, root, ''))) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        const match = /^\/api\/([\w-]+)\/?(?:\?|$)/.exec(req.url || '')
        if (!match) return next()
        const file = join(root, 'api', `${match[1]}.mjs`)
        if (!existsSync(file)) return next()

        try {
          // Cache-bust so edits to api/*.mjs take effect without restarting the dev server.
          const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`)
          const handler = mod.default?.fetch
          if (typeof handler !== 'function') throw new Error(`${match[1]}.mjs has no default { fetch }`)

          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = Buffer.concat(chunks)
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
            else if (value !== undefined) headers.set(key, value)
          }
          const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          })

          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(`[api/${match[1]}] ${error?.stack || error}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, message: 'Local API error. See the dev server log.' }))
        }
      })
    },
  }
}

export function gtm(id) {
  return {
    name: 'doc-gtm',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!id) return html
        return {
          html,
          tags: [
            {
              tag: 'script',
              injectTo: 'head-prepend',
              children: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`,
            },
            {
              tag: 'noscript',
              injectTo: 'body-prepend',
              children: `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
            },
          ],
        }
      },
    },
  }
}
