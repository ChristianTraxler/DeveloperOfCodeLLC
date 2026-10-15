// One self-contained HTML file of SEO Review running on saved reviews (no server, no sign in).
// npm run build:preview  ->  preview/seo-review-preview.html
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'preview', emptyOutDir: true, target: 'es2022', assetsInlineLimit: 100_000_000, reportCompressedSize: false },
})
