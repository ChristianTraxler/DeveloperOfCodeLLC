// Illustrations used as attachments and email images in the example inbox.
// Drawn as SVG so the preview carries no photos of real places or people.

const enc = (svg) => {
  const bytes = new TextEncoder().encode(svg)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const wrap = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}">${body}</svg>`

function barnFront() {
  return wrap(
    300,
    200,
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c88f"/><stop offset=".6" stop-color="#f0a77a"/><stop offset="1" stop-color="#d9826a"/></linearGradient>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c8f4e"/><stop offset="1" stop-color="#4f6236"/></linearGradient></defs>
<rect width="300" height="200" fill="url(#s)"/><circle cx="232" cy="74" r="26" fill="#fde5c2" opacity=".9"/>
<path d="M0 128 C60 112 110 122 170 114 S260 106 300 116 V200 H0Z" fill="#8e9d63" opacity=".7"/>
<path d="M0 150 C80 138 160 152 300 140 V200 H0Z" fill="url(#g)"/>
<path d="M70 150 V96 L118 62 L166 96 V150Z" fill="#8c3b2c"/><path d="M62 100 L118 58 L174 100" fill="none" stroke="#f4e6d2" stroke-width="5" stroke-linejoin="round"/>
<path d="M96 150 V112 H140 V150" fill="#5a2219"/><path d="M96 112 L140 150 M140 112 L96 150" stroke="#f4e6d2" stroke-width="2.5"/><rect x="96" y="112" width="44" height="38" fill="none" stroke="#f4e6d2" stroke-width="2.5"/>
<rect x="108" y="78" width="20" height="16" fill="#f7d78f"/><path d="M118 78 V94 M108 86 H128" stroke="#5a2219" stroke-width="1.6"/>
<path d="M166 150 V112 L206 112 L206 150Z" fill="#7a3326"/><path d="M162 114 L186 96 L210 114" fill="none" stroke="#f4e6d2" stroke-width="3.5"/>
<g fill="#3d4a2a"><circle cx="30" cy="132" r="16"/><circle cx="44" cy="124" r="12"/><rect x="34" y="132" width="4" height="22"/><circle cx="262" cy="128" r="14"/><rect x="260" y="128" width="4" height="20"/></g>
<path d="M0 176 C90 170 200 182 300 172" stroke="#d9c389" stroke-width="7" fill="none" opacity=".75"/>`,
  )
}

function stringLights() {
  const r = rng(41)
  let bulbs = ''
  for (const [y0, sag] of [
    [44, 26],
    [62, 22],
    [80, 18],
  ]) {
    for (let i = 0; i <= 24; i++) {
      const x = 10 + i * 11.7
      const t = (x - 10) / 280
      const y = y0 + Math.sin(t * Math.PI) * sag
      bulbs += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + r() * 1.2).toFixed(1)}" fill="#ffe2a3"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#ffd27a" opacity=".16"/>`
    }
  }
  return wrap(
    300,
    200,
    `<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2340"/><stop offset="1" stop-color="#3b2f45"/></linearGradient></defs>
<rect width="300" height="200" fill="url(#n)"/>
<path d="M10 44 Q150 96 290 44 M10 62 Q150 106 290 62 M10 80 Q150 116 290 80" stroke="#2a2537" stroke-width="1.2" fill="none"/>${bulbs}
<rect x="0" y="146" width="300" height="54" fill="#2a2030"/>
<g fill="#f6e7cf" opacity=".9"><rect x="40" y="128" width="62" height="5" rx="2"/><rect x="132" y="126" width="62" height="5" rx="2"/><rect x="222" y="128" width="54" height="5" rx="2"/></g>
<g fill="#4a3647"><rect x="44" y="133" width="4" height="22"/><rect x="94" y="133" width="4" height="22"/><rect x="136" y="131" width="4" height="24"/><rect x="186" y="131" width="4" height="24"/><rect x="226" y="133" width="4" height="22"/><rect x="268" y="133" width="4" height="22"/></g>
<g fill="#ffd27a" opacity=".85"><circle cx="70" cy="124" r="2.4"/><circle cx="164" cy="122" r="2.4"/><circle cx="248" cy="124" r="2.4"/></g>
<g fill="#7a5a6b"><circle cx="60" cy="112" r="6"/><circle cx="82" cy="110" r="5"/><circle cx="152" cy="110" r="6"/><circle cx="176" cy="112" r="5"/><circle cx="240" cy="111" r="6"/></g>`,
  )
}

function ceremonyField() {
  let chairs = ''
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 5; i++) {
      const y = 140 + row * 12
      chairs += `<rect x="${44 + i * 14 - row * 2}" y="${y}" width="9" height="7" rx="1.5" fill="#fbf4e6"/><rect x="${206 + i * 14 - row * 2 - 50}" y="${y}" width="9" height="7" rx="1.5" fill="#fbf4e6"/>`
    }
  }
  return wrap(
    300,
    200,
    `<defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d6e6"/><stop offset="1" stop-color="#f3e6cf"/></linearGradient></defs>
<rect width="300" height="200" fill="url(#k)"/>
<path d="M0 104 C70 92 140 104 210 94 S280 90 300 96 V200 H0Z" fill="#9db37a"/><path d="M0 120 C90 112 180 126 300 116 V200 H0Z" fill="#7f9a5a"/>
<path d="M126 132 V72 Q150 52 174 72 V132" fill="none" stroke="#8a6a48" stroke-width="5"/>
<g fill="#f3c7c4"><circle cx="132" cy="70" r="6"/><circle cx="144" cy="62" r="5"/><circle cx="158" cy="62" r="6"/><circle cx="170" cy="70" r="5"/></g>
<g fill="#ffffff" opacity=".9"><circle cx="136" cy="64" r="3"/><circle cx="164" cy="64" r="3"/></g>
<path d="M150 132 V200" stroke="#e8dcc0" stroke-width="16" opacity=".8"/>${chairs}`,
  )
}

function driveway(after) {
  const r = rng(after ? 7 : 3)
  let stains = ''
  if (!after) {
    for (let i = 0; i < 34; i++) {
      stains += `<ellipse cx="${(40 + r() * 220).toFixed(0)}" cy="${(70 + r() * 120).toFixed(0)}" rx="${(4 + r() * 18).toFixed(0)}" ry="${(2 + r() * 8).toFixed(0)}" fill="#3e3a33" opacity="${(0.12 + r() * 0.25).toFixed(2)}"/>`
    }
    stains += `<path d="M60 90 Q90 120 70 150 T90 190" stroke="#2f5a2a" stroke-width="4" fill="none" opacity=".35"/>`
  }
  const slab = after ? '#d9d4ca' : '#8f877a'
  const seam = after ? '#c3bdb2' : '#6d665b'
  return wrap(
    300,
    200,
    `<rect width="300" height="200" fill="${after ? '#cfe1ec' : '#b9c2c9'}"/>
<path d="M0 70 H300 V60 H0Z" fill="#6f8a55"/><rect x="0" y="40" width="300" height="22" fill="${after ? '#e9e2d4' : '#cfc6b6'}"/>
<path d="M60 200 L118 70 H182 L240 200Z" fill="${slab}"/>
<path d="M118 70 L240 200 M182 70 L60 200 M150 70 V200 M89 135 H211" stroke="${seam}" stroke-width="1.6" opacity=".7"/>${stains}
<rect x="12" y="12" width="${after ? 56 : 62}" height="20" rx="10" fill="${after ? '#1f8a52' : '#2b2b2b'}" opacity=".88"/>
<text x="${after ? 40 : 43}" y="26" font-family="Helvetica,Arial,sans-serif" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">${after ? 'AFTER' : 'BEFORE'}</text>`,
  )
}

function mixerHeader() {
  const r = rng(12)
  let stars = ''
  for (let i = 0; i < 26; i++) stars += `<circle cx="${(r() * 600).toFixed(0)}" cy="${(r() * 90).toFixed(0)}" r="${(0.6 + r()).toFixed(1)}" fill="#fff" opacity=".7"/>`
  return wrap(
    600,
    240,
    `<defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16244a"/><stop offset=".7" stop-color="#5a3c64"/><stop offset="1" stop-color="#e2845e"/></linearGradient></defs>
<rect width="600" height="240" fill="url(#d)"/>${stars}
<g fill="#20223a"><rect x="20" y="110" width="110" height="130"/><rect x="140" y="86" width="96" height="154"/><rect x="246" y="120" width="120" height="120"/><rect x="376" y="96" width="92" height="144"/><rect x="478" y="116" width="110" height="124"/></g>
<g fill="#ffcf7f"><rect x="36" y="128" width="18" height="22"/><rect x="66" y="128" width="18" height="22"/><rect x="156" y="104" width="16" height="20"/><rect x="196" y="140" width="16" height="20"/><rect x="262" y="140" width="22" height="24"/><rect x="300" y="140" width="22" height="24"/><rect x="392" y="116" width="16" height="20"/><rect x="430" y="150" width="16" height="20"/><rect x="496" y="134" width="18" height="22"/><rect x="540" y="134" width="18" height="22"/></g>
<path d="M0 214 H600" stroke="#ffd59a" stroke-width="2" opacity=".5"/>
<g stroke="#ffe2a3" stroke-width="1"><path d="M20 120 Q300 170 588 122" fill="none" opacity=".6"/></g>
<g fill="#ffe2a3">${Array.from({ length: 18 }, (_, i) => {
      const x = 20 + i * 33
      const t = (x - 20) / 568
      return `<circle cx="${x}" cy="${(120 + Math.sin(t * Math.PI) * 26).toFixed(1)}" r="2.6"/>`
    }).join('')}</g>`,
  )
}

function barnDoors() {
  return wrap(
    300,
    200,
    `<rect width="300" height="200" fill="#efe3cf"/><rect x="60" y="20" width="180" height="180" fill="#8c3b2c"/>
<rect x="76" y="40" width="70" height="160" fill="#7a3326"/><rect x="154" y="40" width="70" height="160" fill="#7a3326"/>
<path d="M76 40 L146 200 M146 40 L76 200 M154 40 L224 200 M224 40 L154 200" stroke="#f4e6d2" stroke-width="3"/>
<rect x="76" y="40" width="70" height="160" fill="none" stroke="#f4e6d2" stroke-width="3"/><rect x="154" y="40" width="70" height="160" fill="none" stroke="#f4e6d2" stroke-width="3"/>
<g fill="#6f8a55"><ellipse cx="44" cy="186" rx="34" ry="22"/><ellipse cx="258" cy="186" rx="34" ry="22"/></g>
<g fill="#f3c7c4"><circle cx="30" cy="176" r="6"/><circle cx="46" cy="170" r="5"/><circle cx="58" cy="180" r="6"/><circle cx="246" cy="176" r="6"/><circle cx="262" cy="170" r="5"/><circle cx="274" cy="180" r="6"/></g>
<g fill="#fff6e8"><circle cx="38" cy="182" r="3"/><circle cx="266" cy="182" r="3"/></g>`,
  )
}

// A one-page PDF that says what it is, for the example menu attachment
function menuPdf() {
  const text = 'BT /F1 22 Tf 72 720 Td (Laurel Gap Coffee Co.) Tj ET BT /F1 14 Tf 72 690 Td (Fall menu, example attachment) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return btoa(pdf)
}

const cache = new Map()
const lazy = (key, make) => () => {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

export const ART = {
  barnFront: lazy('barnFront', () => ({ mimeType: 'image/svg+xml', data: enc(barnFront()) })),
  stringLights: lazy('stringLights', () => ({ mimeType: 'image/svg+xml', data: enc(stringLights()) })),
  ceremonyField: lazy('ceremonyField', () => ({ mimeType: 'image/svg+xml', data: enc(ceremonyField()) })),
  barnDoors: lazy('barnDoors', () => ({ mimeType: 'image/svg+xml', data: enc(barnDoors()) })),
  drivewayBefore: lazy('drivewayBefore', () => ({ mimeType: 'image/svg+xml', data: enc(driveway(false)) })),
  drivewayAfter: lazy('drivewayAfter', () => ({ mimeType: 'image/svg+xml', data: enc(driveway(true)) })),
  mixerHeader: lazy('mixerHeader', () => ({ mimeType: 'image/svg+xml', data: enc(mixerHeader()) })),
  menuPdf: lazy('menuPdf', () => ({ mimeType: 'application/pdf', data: menuPdf() })),
}

export const artUri = (key) => {
  const a = ART[key]?.()
  return a ? `data:${a.mimeType};base64,${a.data}` : ''
}
