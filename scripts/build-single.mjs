// Builds dist-single/index.html, intake.html, products.html, and notify.html, each fully self-contained.
import { build } from 'vite'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const configFile = fileURLToPath(new URL('../vite.config.single.js', import.meta.url))

rmSync(new URL('../dist-single', import.meta.url), { recursive: true, force: true })

for (const name of ['index', 'intake', 'products', 'notify']) {
  await build({ root, configFile, mode: `single-${name}`, logLevel: 'warn' })
  console.log(`built dist-single/${name}.html`)
}
