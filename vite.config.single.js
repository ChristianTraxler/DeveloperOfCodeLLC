import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Swaps the favicon links for inline data URIs so each file has zero outside requests.
const inlineIcons = () => ({
  name: 'inline-icons',
  transformIndexHtml(html) {
    const png = (file) =>
      'data:image/png;base64,' + readFileSync(new URL(`./public/${file}`, import.meta.url)).toString('base64')
    return html
      .replace('href="/favicon-32.png"', `href="${png('favicon-32.png')}"`)
      .replace('href="/apple-touch-icon.png"', `href="${png('apple-touch-icon.png')}"`)
  },
})

// One self-contained HTML file per page, with every script, style, font, and image inlined.
// scripts/build-single.mjs runs this once per page with the mode single-index, single-intake, single-products, or single-notify.
export default defineConfig(({ mode }) => {
  const name = mode.replace(/^single-/, '') || 'index'
  return {
    plugins: [react(), viteSingleFile(), inlineIcons()],
    publicDir: false,
    build: {
      outDir: 'dist-single',
      emptyOutDir: false,
      rollupOptions: { input: fileURLToPath(new URL(`./${name}.html`, import.meta.url)) },
    },
  }
})
