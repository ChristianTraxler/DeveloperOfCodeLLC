// Renders the sample post graphics used by the example data.
// Run with `npm run images`. Output: src/features/content-queue/assets/samples/*.jpg
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const fonts = path.resolve(root, '../src/app/fonts')
const out = path.resolve(root, '../src/features/content-queue/assets/samples')

const base = `
@font-face{font-family:L;src:url(file://${fonts}/literata-latin-opsz-normal.woff2);font-weight:200 900}
@font-face{font-family:M;src:url(file://${fonts}/mona-sans-latin-standard-normal.woff2);font-weight:200 900;font-stretch:75% 125%}
@font-face{font-family:P;src:url(file://${fonts}/ibm-plex-mono-latin-400-normal.woff2);font-weight:400}
@font-face{font-family:P;src:url(file://${fonts}/ibm-plex-mono-latin-500-normal.woff2);font-weight:500}
*{box-sizing:border-box;margin:0}
html,body{width:1080px;height:1080px;overflow:hidden}
body{font-family:M,sans-serif;-webkit-font-smoothing:antialiased}
.mono{font-family:P,monospace;letter-spacing:.08em;text-transform:uppercase}
.serif{font-family:L,serif}
.browser{border-radius:14px;overflow:hidden;box-shadow:0 30px 60px -20px rgba(0,0,0,.35)}
.bar{height:38px;display:flex;align-items:center;gap:8px;padding:0 16px}
.bar i{width:11px;height:11px;border-radius:50%;display:block;opacity:.5}
`

const scenes = {
  halyard: `
  <body style="background:#d9e5e1;padding:84px 80px;display:flex;flex-direction:column;gap:44px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;color:#1e3644">
      <div class="mono" style="font-size:20px">Case study 014</div>
      <div class="mono" style="font-size:20px">Carolina Beach, NC</div>
    </div>
    <div class="browser" style="background:#f4efe6;flex:1;display:flex;flex-direction:column">
      <div class="bar" style="background:#e7e0d3"><i style="background:#1e3644"></i><i style="background:#1e3644"></i><i style="background:#1e3644"></i></div>
      <div style="flex:1;display:grid;grid-template-rows:auto 1fr auto;">
        <div style="display:flex;justify-content:space-between;padding:26px 40px;color:#1e3644;font-size:18px;font-weight:600;letter-spacing:.02em">
          <span class="serif" style="font-size:24px;font-weight:600">Halyard House</span><span style="display:flex;gap:28px;opacity:.75"><span>The house</span><span>Rates</span><span>Book</span></span>
        </div>
        <div style="position:relative;background:linear-gradient(180deg,#9fc2c6 0%,#bcd6d4 52%,#e2d6bd 52%,#ead9b8 100%);display:flex;align-items:flex-end;padding:40px">
          <div style="position:absolute;left:0;right:0;top:52%;height:2px;background:#f4efe6;opacity:.7"></div>
          <div class="serif" style="font-size:96px;line-height:.95;color:#163040;font-weight:500;letter-spacing:-.02em;max-width:620px;position:relative">Wake up to the tide.</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0;border-top:1px solid #d8cfbf;color:#1e3644;font-size:17px">
          <div style="padding:22px 28px;border-right:1px solid #d8cfbf"><div class="mono" style="font-size:12px;opacity:.6">Check in</div><div style="font-weight:600;margin-top:6px">Fri, Jun 12</div></div>
          <div style="padding:22px 28px;border-right:1px solid #d8cfbf"><div class="mono" style="font-size:12px;opacity:.6">Check out</div><div style="font-weight:600;margin-top:6px">Mon, Jun 15</div></div>
          <div style="padding:22px 28px;border-right:1px solid #d8cfbf"><div class="mono" style="font-size:12px;opacity:.6">Guests</div><div style="font-weight:600;margin-top:6px">6 adults</div></div>
          <div style="padding:22px 34px;background:#1e3644;color:#f4efe6;font-weight:600;display:flex;align-items:center">Check dates</div>
        </div>
      </div>
    </div>
  </body>`,

  fleurish: `
  <body style="background:#24382b;display:grid;grid-template-columns:1fr 1fr;align-items:center;padding:90px;gap:60px;color:#e9efe3">
    <div style="display:flex;flex-direction:column;gap:30px">
      <div class="mono" style="font-size:18px;color:#a9c19a">New demo</div>
      <div class="serif" style="font-size:88px;line-height:.98;font-weight:400;letter-spacing:-.02em">Fleurish Green&shy;house</div>
      <div style="font-size:24px;line-height:1.45;color:#c5d3bb;max-width:380px">A venue site built around the room itself: tours, dates and a booking request in three taps.</div>
    </div>
    <div style="justify-self:center;width:350px;height:720px;border-radius:46px;background:#10180f;padding:14px;box-shadow:0 40px 80px -30px rgba(0,0,0,.6)">
      <div style="height:100%;border-radius:34px;overflow:hidden;background:#f2f0e8;display:flex;flex-direction:column">
        <div style="height:330px;background:radial-gradient(circle at 50% 120%,#a3c08f 0,#6f925f 40%,#40603c 75%);position:relative;display:flex;justify-content:center;align-items:flex-end;gap:14px;padding-bottom:0">
          <div style="width:70px;height:210px;border:5px solid #f2f0e8;border-bottom:0;border-radius:40px 40px 0 0"></div>
          <div style="width:90px;height:260px;border:5px solid #f2f0e8;border-bottom:0;border-radius:50px 50px 0 0"></div>
          <div style="width:70px;height:210px;border:5px solid #f2f0e8;border-bottom:0;border-radius:40px 40px 0 0"></div>
        </div>
        <div style="padding:26px 24px;color:#24382b;display:flex;flex-direction:column;gap:14px">
          <div class="serif" style="font-size:34px;line-height:1.05">Gather under glass.</div>
          <div style="font-size:16px;line-height:1.5;color:#55654d">Weddings, showers and supper clubs for up to 120 guests.</div>
          <div style="margin-top:8px;background:#24382b;color:#f2f0e8;border-radius:999px;padding:14px 0;text-align:center;font-weight:600;font-size:16px">Request a date</div>
        </div>
      </div>
    </div>
  </body>`,

  sillridge: `
  <body style="background:#1d1b19;color:#efe7da;padding:80px;display:flex;flex-direction:column;justify-content:space-between;background-image:linear-gradient(#2a2724 1px,transparent 1px),linear-gradient(90deg,#2a2724 1px,transparent 1px);background-size:54px 54px">
    <div style="display:flex;justify-content:space-between" class="mono"><span style="font-size:18px;color:#c6a477">Walkthrough</span><span style="font-size:18px;color:#8d857a">Plan 3B / 2,140 sq ft</span></div>
    <svg viewBox="0 0 920 420" width="920" height="420" style="display:block">
      <g fill="none" stroke="#c6a477" stroke-width="4" stroke-linejoin="round">
        <path d="M60 400 L60 210 L300 70 L540 210 L540 400 Z"/>
        <path d="M540 260 L540 400 L860 400 L860 260 L700 160 L540 260"/>
        <rect x="140" y="270" width="80" height="130"/>
        <rect x="360" y="260" width="110" height="80"/>
        <rect x="610" y="290" width="70" height="60"/><rect x="740" y="290" width="70" height="60"/>
      </g>
      <line x1="0" y1="400" x2="920" y2="400" stroke="#efe7da" stroke-width="3"/>
    </svg>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:40px">
      <div class="serif" style="font-size:92px;line-height:.95;letter-spacing:-.02em;font-weight:400">Sill &amp; Ridge<br/>Homes</div>
      <div style="font-size:22px;line-height:1.45;color:#b9b0a3;max-width:320px;padding-bottom:12px">Floor plans you can actually read on a phone.</div>
    </div>
  </body>`,

  tuneup: `
  <body style="background:#141312;color:#ede8e0;padding:86px;display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:700;font-stretch:112%;font-size:24px;letter-spacing:.01em">Developer of Code</div>
      <div class="mono" style="font-size:17px;color:#f07a3a">November slots</div>
    </div>
    <div>
      <div class="serif" style="font-size:138px;line-height:.9;letter-spacing:-.03em;font-weight:400">Fall<br/>tune&#8209;up.</div>
      <div style="height:3px;width:120px;background:#f07a3a;margin:44px 0 40px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 40px;font-size:27px;color:#cfc8bd;max-width:760px">
        <div><span class="mono" style="font-size:16px;color:#7b746b;margin-right:16px">01</span>Speed check</div>
        <div><span class="mono" style="font-size:16px;color:#7b746b;margin-right:16px">02</span>Forms tested</div>
        <div><span class="mono" style="font-size:16px;color:#7b746b;margin-right:16px">03</span>Search basics</div>
        <div><span class="mono" style="font-size:16px;color:#7b746b;margin-right:16px">04</span>Security updates</div>
      </div>
    </div>
    <div class="mono" style="font-size:17px;color:#7b746b">developerofcode.com</div>
  </body>`,

  finatlas: `
  <body style="background:#0f2430;color:#e7eef0;padding:84px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;position:relative">
    <svg viewBox="0 0 1080 1080" width="1080" height="1080" style="position:absolute;inset:0;opacity:.5">
      <g fill="none" stroke="#2f5566" stroke-width="2">
        ${Array.from({ length: 14 }, (_, i) => `<ellipse cx="760" cy="560" rx="${60 + i * 46}" ry="${36 + i * 30}" transform="rotate(-18 760 560)"/>`).join('')}
      </g>
    </svg>
    <div class="mono" style="font-size:18px;color:#8fb3c1;position:relative">Fin Atlas Apparel</div>
    <div style="position:relative">
      <div class="serif" style="font-size:112px;line-height:.95;letter-spacing:-.02em;font-weight:400;max-width:760px">New homepage. Same mission.</div>
      <div style="display:flex;gap:16px;margin-top:44px">
        <div style="border:2px solid #e7eef0;border-radius:999px;padding:16px 30px;font-size:22px;font-weight:600">Shop the drop</div>
        <div style="border-radius:999px;padding:16px 30px;font-size:22px;color:#8fb3c1">Our story</div>
      </div>
    </div>
  </body>`,

  renegade: `
  <body style="background:#efe9e1;color:#2a2420;padding:84px;display:grid;grid-template-rows:auto 1fr auto;gap:46px">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <div style="font-weight:700;font-stretch:108%;font-size:26px">Renegade Wellness Center</div>
      <div class="mono" style="font-size:16px;color:#8a7c6f">Online booking</div>
    </div>
    <div style="background:#fbf8f4;border:2px solid #dcd2c5;border-radius:18px;padding:36px;display:flex;flex-direction:column;gap:22px">
      <div style="display:flex;justify-content:space-between;align-items:center"><div class="serif" style="font-size:40px">Pick a time</div><div class="mono" style="font-size:16px;color:#8a7c6f">This week</div></div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;font-size:17px">
        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => `<div style="display:flex;flex-direction:column;gap:10px"><div class="mono" style="font-size:14px;color:#8a7c6f;text-align:center">${d}</div>${['9:00', '11:30', '2:00', '4:30'].map((t, j) => `<div style="text-align:center;padding:14px 0;border-radius:10px;${(i === 2 && j === 1) ? 'background:#2a2420;color:#fbf8f4;font-weight:600' : (i + j) % 3 === 0 ? 'color:#c0b5a8;text-decoration:line-through' : 'border:1.5px solid #dcd2c5'}">${t}</div>`).join('')}</div>`).join('')}
      </div>
    </div>
    <div class="serif" style="font-size:64px;line-height:1;letter-spacing:-.02em">Book your next visit in under a minute.</div>
  </body>`,

  speed: `
  <body style="background:#16181a;color:#e6e9ea;padding:84px;display:flex;flex-direction:column;justify-content:space-between">
    <div class="mono" style="font-size:18px;color:#8d969a">Lab test / mobile / slow 4G</div>
    <div style="display:flex;flex-direction:column;gap:26px">
      ${[['HTML', 18, 0], ['Fonts', 22, 10], ['Hero image', 38, 16], ['Script', 26, 30], ['Interactive', 8, 58]].map(([n, w, x]) => `<div style="display:grid;grid-template-columns:200px 1fr;align-items:center;gap:24px"><div class="mono" style="font-size:17px;color:#8d969a">${n}</div><div style="position:relative;height:30px"><div style="position:absolute;left:${x}%;width:${w}%;top:0;bottom:0;background:${n === 'Interactive' ? '#f07a3a' : '#3b4246'};border-radius:3px"></div></div></div>`).join('')}
      <div style="display:grid;grid-template-columns:200px 1fr;gap:24px"><div></div><div style="display:flex;justify-content:space-between" class="mono"><span style="font-size:14px;color:#5f676b">0s</span><span style="font-size:14px;color:#5f676b">1s</span><span style="font-size:14px;color:#5f676b">2s</span></div></div>
    </div>
    <div class="serif" style="font-size:96px;line-height:.95;letter-spacing:-.02em">Under two seconds, on purpose.</div>
  </body>`,
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 })
for (const [name, html] of Object.entries(scenes)) {
  await page.setContent(`<style>${base}</style>${html}`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
  const file = path.join(out, `${name}.jpg`)
  await page.screenshot({ path: file, type: 'jpeg', quality: 62 })
  console.log('wrote', file)
}
await browser.close()
