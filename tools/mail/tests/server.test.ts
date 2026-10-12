// Tests for the Edge Function helpers: encoding, encryption, MIME building, Gmail parsing,
// change tracking and Google sign-in links. Run with: npm run test:server
//
// The functions run on Deno. Node runs these files directly (type stripping), with a tiny
// stand-in for Deno.env and a hook that maps "npm:" imports to node_modules.
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const vars: Record<string, string | undefined> = {
  MAIL_TOKEN_KEY: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),
  GOOGLE_CLIENT_ID: 'client-123.apps.googleusercontent.com',
  SUPABASE_URL: 'https://example-ref.supabase.co',
  MAIL_APP_ORIGINS: 'https://admin.developerofcode.com, http://localhost:5173',
}
;(globalThis as { Deno?: unknown }).Deno = { env: { get: (name: string) => vars[name] } }
register('./npm-specifiers.mjs', import.meta.url)

const fn = '../../../supabase/functions/_shared'
const base64 = await import(`${fn}/base64.ts`)
const { seal, unseal } = await import(`${fn}/crypto.ts`)
const { buildMime, encodeWord, formatAddress, isEmail } = await import(`${fn}/mime.ts`)
const parse = await import(`${fn}/parse.ts`)
const { historySince, HistoryGone } = await import(`${fn}/sync.ts`)
const { consentUrl, GMAIL_SCOPE } = await import(`${fn}/google.ts`)
const { corsHeaders, pool } = await import(`${fn}/http.ts`)
const { serviceKey } = await import(`${fn}/env.ts`)

const enc = (text: string) => base64.b64urlEncode(base64.utf8(text))
const CRLF = '\r\n'

// ---------- base64 ----------

test('base64 survives binary data and UTF-8 in both alphabets', () => {
  // Larger than the encoder's 32 KB chunk, to cover the chunk seams
  const bytes = Uint8Array.from({ length: 70_001 }, (_, i) => (i * 7919 + (i >> 3)) & 0xff)
  assert.deepEqual(base64.b64decode(base64.b64encode(bytes)), bytes)
  assert.deepEqual(base64.b64urlDecode(base64.b64urlEncode(bytes)), bytes)
  const text = 'Café menu, Tomás, 東京 ✓'
  assert.equal(new TextDecoder().decode(base64.b64urlDecode(enc(text))), text)
  assert.ok(!/[+/=]/.test(base64.b64urlEncode(bytes)), 'url-safe output has no + / =')
})

test('wrap76 keeps MIME lines short, b64Size estimates decoded size', () => {
  const b64 = base64.b64encode(crypto.getRandomValues(new Uint8Array(5000)))
  const lines = base64.wrap76(b64).split(CRLF)
  assert.ok(lines.every((l: string) => l.length <= 76))
  assert.equal(lines.join(''), b64)
  assert.ok(Math.abs(base64.b64Size(b64) - 5000) <= 2)
})

test('safeEqual matches equal secrets only, and never empty ones', () => {
  assert.equal(base64.safeEqual('s3cret-token', 's3cret-token'), true)
  assert.equal(base64.safeEqual('s3cret-token', 's3cret-tokem'), false)
  assert.equal(base64.safeEqual('s3cret', 's3cret-token'), false)
  assert.equal(base64.safeEqual('', ''), false)
  assert.match(base64.randomToken(), /^[0-9a-f]{48}$/)
})

// ---------- token encryption ----------

test('seal and unseal round-trip, with a fresh IV each time', async () => {
  const token = '1//0gExampleRefreshToken-abc_def'
  const a = await seal(token)
  const b = await seal(token)
  assert.match(a, /^v1\./)
  assert.notEqual(a, b)
  assert.equal(await unseal(a), token)
  assert.equal(await unseal(b), token)
})

test('unseal rejects tampered or unknown values', async () => {
  const sealed = await seal('refresh-token')
  const bytes = base64.b64decode(sealed.slice(3))
  bytes[bytes.length - 1] ^= 0xff
  await assert.rejects(unseal(`v1.${base64.b64encode(bytes)}`))
  await assert.rejects(unseal('plain-text-token'))
})

// ---------- MIME ----------

const sectionBody = (mime: string, type: string) => {
  const start = mime.indexOf(`Content-Type: ${type}`)
  assert.ok(start !== -1, `has a ${type} part`)
  const afterHeaders = mime.indexOf(CRLF + CRLF, start) + 4
  const end = mime.indexOf(`${CRLF}--`, afterHeaders)
  return new TextDecoder().decode(base64.b64decode(mime.slice(afterHeaders, end)))
}

test('buildMime writes a plain ASCII message with CRLF lines and both bodies', () => {
  const mime = buildMime({
    from: { name: 'Christian at Developer of Code', email: 'developerofcodellc@gmail.com' },
    to: [{ name: 'Dana Teague', email: 'dana@ironwoodroofing.example' }],
    cc: [{ name: 'Lutz, Reggie', email: 'reggie@frontporch.example' }],
    bcc: [{ name: '', email: 'records@developerofcode.example' }],
    subject: 'Spam fix for the estimate form',
    html: '<p>Hi Dana, the form now sends from your domain.</p>',
    text: 'Hi Dana, the form now sends from your domain.',
    inReplyTo: '<abc@mail.example>',
    references: '<root@mail.example> <abc@mail.example>',
  })
  assert.ok(/^[\x00-\x7f]*$/.test(mime), 'only ASCII')
  assert.ok(!/[^\r]\n/.test(mime), 'no bare line feeds')
  assert.ok(mime.split(CRLF).every((l: string) => l.length <= 998), 'no line over 998 characters')
  assert.match(mime, /^From: Christian at Developer of Code <developerofcodellc@gmail\.com>\r\n/)
  assert.match(mime, /\r\nCc: "Lutz, Reggie" <reggie@frontporch\.example>\r\n/)
  assert.match(mime, /\r\nBcc: records@developerofcode\.example\r\n/)
  assert.match(mime, /\r\nIn-Reply-To: <abc@mail\.example>\r\n/)
  assert.match(mime, /\r\nReferences: <root@mail\.example> <abc@mail\.example>\r\n/)
  assert.match(mime, /\r\nMIME-Version: 1\.0\r\nContent-Type: multipart\/alternative; boundary="/)
  assert.equal(sectionBody(mime, 'text/plain'), 'Hi Dana, the form now sends from your domain.')
  assert.equal(sectionBody(mime, 'text/html'), '<p>Hi Dana, the form now sends from your domain.</p>')
})

test('buildMime encodes non-ASCII headers and attachment names, and wraps files in multipart/mixed', () => {
  const pdf = base64.b64encode(base64.utf8('%PDF-1.4 example'))
  const mime = buildMime({
    from: { name: 'Café Owner', email: 'owner@cafe.example' },
    to: [{ name: 'Tomás Reyes', email: 'tomas@reyes.example' }],
    subject: 'Menú de otoño, versión 2',
    html: '<p>Adjunto el menú.</p>',
    text: 'Adjunto el menú.',
    attachments: [{ filename: 'menú otoño.pdf', mimeType: 'application/pdf', data: pdf }],
  })
  assert.ok(/^[\x00-\x7f]*$/.test(mime))
  assert.match(mime, /^From: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <owner@cafe\.example>/)
  const subject = mime.match(/\r\nSubject: ((?:.|\r\n )+?)\r\n(?! )/)?.[1] ?? ''
  assert.equal(parse.decodeWords(subject.replace(/\r\n /g, ' ')), 'Menú de otoño, versión 2')
  assert.match(mime, /Content-Type: multipart\/mixed; boundary="=_doc_mixed_/)
  assert.match(mime, /Content-Disposition: attachment; filename="men_ oto_o\.pdf"; filename\*=UTF-8''men%C3%BA%20oto%C3%B1o\.pdf/)
  assert.equal(sectionBody(mime, 'application/pdf'), '%PDF-1.4 example')
})

test('header values cannot smuggle in extra headers', () => {
  const mime = buildMime({
    from: { name: 'Me', email: 'me@x.example' },
    to: [{ name: 'Dana\r\nBcc: evil@attacker.example', email: 'dana@x.example' }],
    subject: 'Hello\r\nBcc: evil@attacker.example',
    html: '<p>Hi</p>',
    text: 'Hi',
  })
  assert.ok(!/\r\nBcc:/.test(mime), 'no injected Bcc header')
})

test('encodeWord splits long text without breaking characters', () => {
  const text = 'Ünïcödé '.repeat(20)
  const encoded = encodeWord(text)
  const words = encoded.split(`${CRLF} `)
  assert.ok(words.length > 1)
  for (const w of words) {
    assert.ok(w.length <= 75, 'each encoded word fits RFC 2047')
    const data = w.match(/^=\?UTF-8\?B\?(.*)\?=$/)?.[1]
    assert.ok(data)
    new TextDecoder('utf-8', { fatal: true }).decode(base64.b64decode(data!)) // throws on a split character
  }
  assert.equal(parse.decodeWords(words.join(' ')), text.trim())
})

test('formatAddress and isEmail', () => {
  assert.equal(formatAddress({ name: '', email: 'a@b.example' }), 'a@b.example')
  assert.equal(formatAddress({ name: 'a@b.example', email: 'a@b.example' }), 'a@b.example')
  assert.equal(formatAddress({ name: 'Jo "JJ" Smith', email: 'jo@x.example' }), '"Jo \\"JJ\\" Smith" <jo@x.example>')
  assert.equal(isEmail('dana@ironwoodroofing.example'), true)
  assert.equal(isEmail('dana@localhost'), false)
  assert.equal(isEmail('dana teague@x.example'), false)
})

// ---------- Parsing what Gmail returns ----------

test('decodeWords handles B and Q encodings and joins adjacent words', () => {
  assert.equal(parse.decodeWords('=?UTF-8?B?Q2Fmw6k=?= =?UTF-8?Q?_menu?='), 'Café menu')
  assert.equal(parse.decodeWords('=?ISO-8859-1?Q?Se=F1or_Reyes?='), 'Señor Reyes')
  assert.equal(parse.decodeWords('Plain subject'), 'Plain subject')
})

test('parseAddresses splits lists with quoted commas, comments and semicolons', () => {
  const list = parse.parseAddresses('"Lutz, Reggie" <reggie@frontporch.example>, Dana Teague <dana@ironwood.example>; plain@z.example, carla@x.example (Carla Hefner)')
  assert.deepEqual(list, [
    { name: 'Lutz, Reggie', email: 'reggie@frontporch.example' },
    { name: 'Dana Teague', email: 'dana@ironwood.example' },
    { name: '', email: 'plain@z.example' },
    { name: 'Carla Hefner', email: 'carla@x.example' },
  ])
  assert.deepEqual(parse.parseAddresses('=?UTF-8?B?VG9tw6FzIFJleWVz?= <tomas@reyes.example>'), [{ name: 'Tomás Reyes', email: 'tomas@reyes.example' }])
  assert.deepEqual(parse.parseAddresses(''), [])
})

const ME = 'developerofcodellc@gmail.com'
const headers = (h: Record<string, string>) => Object.entries(h).map(([name, value]) => ({ name, value }))
const msg = (id: string, labels: string[], h: Record<string, string>, date: number, snippet = '') => ({
  id,
  threadId: 't1',
  labelIds: labels,
  snippet,
  internalDate: String(date),
  payload: { mimeType: 'text/plain', headers: headers(h) },
})

test('summarize lists people in the order they joined, and reads drafts separately', () => {
  const carla = 'Carla Hefner <carla@oldmill.example>'
  const me = `Christian <${ME}>`
  const thread = {
    id: 't1',
    historyId: '900',
    messages: [
      msg('m1', ['INBOX', 'CATEGORY_PERSONAL'], { From: carla, To: ME, Subject: 'Homepage photos' }, 1000, 'Sending the photos'),
      msg('m2', ['SENT'], { From: me, To: carla, Subject: 'Re: Homepage photos' }, 2000, 'These are great'),
      msg('m3', ['INBOX', 'UNREAD', 'Label_7'], { From: carla, To: ME, Subject: 'Re: Homepage photos' }, 3000, 'Perfect, thank you!'),
      msg('m4', ['DRAFT'], { From: me, To: carla, Subject: 'Re: Homepage photos' }, 4000, 'Draft reply'),
    ],
  }
  const s = parse.summarize(thread, [ME])
  assert.equal(s.subject, 'Homepage photos')
  assert.equal(s.snippet, 'Perfect, thank you!')
  assert.equal(s.count, 3)
  assert.equal(s.date, 3000)
  assert.equal(s.unread, true)
  assert.equal(s.draft, true)
  assert.equal(s.lastFromMe, false)
  assert.deepEqual(s.people.map((p: { email: string; me: boolean }) => [p.email, p.me]), [['carla@oldmill.example', false], [ME, true]])
  assert.deepEqual(s.draftTo, [{ name: 'Carla Hefner', email: 'carla@oldmill.example' }])
  assert.ok(s.labels.includes('Label_7') && s.labels.includes('DRAFT'))
})

test('summarize ignores trashed messages unless the whole thread is in Trash', () => {
  const t = {
    id: 't2',
    messages: [
      msg('a', ['INBOX'], { From: 'A <a@x.example>', Subject: 'Kept' }, 1, 'kept'),
      msg('b', ['TRASH'], { From: 'B <b@x.example>', Subject: 'Gone' }, 2, 'gone'),
    ],
  }
  assert.equal(parse.summarize(t, [ME]).snippet, 'kept')
  const all = { id: 't3', messages: [msg('c', ['TRASH'], { From: 'C <c@x.example>', Subject: 'Bin' }, 5, 'binned')] }
  assert.equal(parse.summarize(all, [ME]).snippet, 'binned')
})

test('parseMessage separates bodies, inline images and attachments; inlineImages swaps cid links', async () => {
  const png = base64.b64urlEncode(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
  const message = {
    id: 'm9',
    threadId: 't9',
    labelIds: ['INBOX', 'UNREAD'],
    snippet: 'Here&#39;s the fall menu',
    internalDate: '1760000000000',
    payload: {
      mimeType: 'multipart/mixed',
      headers: headers({
        From: 'Ivy Coffey <ivy@laurelgap.example>',
        To: `Christian <${ME}>`,
        Subject: '=?UTF-8?Q?Men=C3=BA_PDF?=',
        'Message-ID': '<menu@laurelgap.example>',
        'List-Unsubscribe': '<https://laurelgap.example/unsub>',
      }),
      parts: [
        {
          mimeType: 'multipart/related',
          parts: [
            {
              mimeType: 'multipart/alternative',
              parts: [
                { partId: '0.0', mimeType: 'text/plain', headers: headers({ 'Content-Type': 'text/plain; charset="UTF-8"' }), body: { data: enc('Fall menu attached ☕') } },
                { partId: '0.1', mimeType: 'text/html', headers: headers({ 'Content-Type': 'text/html; charset=UTF-8' }), body: { data: enc('<p>Fall menu <img src="cid:logo@laurel"></p>') } },
              ],
            },
            { partId: '1', mimeType: 'image/png', filename: 'logo.png', headers: headers({ 'Content-ID': '<logo@laurel>', 'Content-Disposition': 'inline' }), body: { attachmentId: 'att-logo', size: 8 } },
          ],
        },
        { partId: '2', mimeType: 'application/pdf', filename: 'menu.pdf', headers: headers({ 'Content-Disposition': 'attachment; filename="menu.pdf"' }), body: { attachmentId: 'att-pdf', size: 52_000 } },
      ],
    },
  }
  const parsed = parse.parseMessage(message, [ME])
  assert.equal(parsed.subject, 'Menú PDF')
  assert.equal(parsed.snippet, "Here's the fall menu")
  assert.equal(parsed.text, 'Fall menu attached ☕')
  assert.match(parsed.html, /cid:logo@laurel/)
  assert.equal(parsed.unread, true)
  assert.equal(parsed.fromMe, false)
  assert.equal(parsed.unsubscribe, '<https://laurelgap.example/unsub>')
  assert.deepEqual(parsed.attachments.map((a: { filename: string; inline: boolean }) => [a.filename, a.inline]), [['logo.png', true], ['menu.pdf', false]])

  const fetched: string[] = []
  const withImages = await parse.inlineImages(parsed, async (id: string) => {
    fetched.push(id)
    return png
  })
  assert.deepEqual(fetched, ['att-logo'], 'only the image the HTML uses is fetched')
  assert.match(withImages.html, /src="data:image\/png;base64,iVBORw0KGgo=?"/)
})

test('resolveBodies fetches bodies Gmail sent by reference', async () => {
  const parsed = parse.parseMessage(
    {
      id: 'big',
      threadId: 'tb',
      labelIds: ['INBOX'],
      payload: { mimeType: 'text/html', headers: headers({ From: 'A <a@x.example>', 'Content-Type': 'text/html; charset=utf-8' }), body: { attachmentId: 'body-1', size: 9_000_000 } },
    },
    [ME],
  )
  assert.equal(parsed.html, '')
  const done = await parse.resolveBodies(parsed, async () => enc('<p>Very long newsletter</p>'))
  assert.equal(done.html, '<p>Very long newsletter</p>')
  assert.equal('pendingBodies' in done, false)
})

// ---------- Change tracking ----------

function fakeGmail(pages: Record<string, unknown>[], status = 200) {
  const calls: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string | URL) => {
    calls.push(String(url))
    if (status !== 200) return new Response(JSON.stringify({ error: { message: 'Requested entity was not found.', status: 'NOT_FOUND' } }), { status })
    const page = pages[Math.min(calls.length - 1, pages.length - 1)]
    return new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

test('historySince collects every touched thread and only real inbox arrivals', async () => {
  const gmail = fakeGmail([
    {
      history: [
        { id: '101', messagesAdded: [{ message: { id: 'n1', threadId: 'tA', labelIds: ['INBOX', 'UNREAD'] } }] },
        { id: '102', messagesAdded: [{ message: { id: 's1', threadId: 'tB', labelIds: ['SENT'] } }] },
        { id: '103', messagesAdded: [{ message: { id: 'd1', threadId: 'tC', labelIds: ['DRAFT'] } }] },
        { id: '104', labelsRemoved: [{ message: { id: 'n0', threadId: 'tD' }, labelIds: ['INBOX'] }] },
      ],
      nextPageToken: 'page-2',
      historyId: '104',
    },
    {
      history: [
        { id: '105', messagesAdded: [{ message: { id: 'n2', threadId: 'tA', labelIds: ['INBOX', 'CATEGORY_UPDATES'] } }] },
        { id: '106', messagesDeleted: [{ message: { id: 'x', threadId: 'tE' } }] },
      ],
      historyId: '110',
    },
  ])
  try {
    const changes = await historySince('token', '100')
    assert.equal(changes.historyId, '110')
    assert.deepEqual([...changes.threadIds].sort(), ['tA', 'tB', 'tC', 'tD', 'tE'])
    assert.deepEqual(changes.newMail, [
      { messageId: 'n1', threadId: 'tA' },
      { messageId: 'n2', threadId: 'tA' },
    ])
    assert.equal(gmail.calls.length, 2)
    assert.match(gmail.calls[0], /history\?startHistoryId=100&maxResults=500$/)
    assert.match(gmail.calls[1], /pageToken=page-2/)
  } finally {
    gmail.restore()
  }
})

test('historySince reports a history id Gmail no longer keeps', async () => {
  const gmail = fakeGmail([], 404)
  try {
    await assert.rejects(historySince('token', '5'), HistoryGone)
  } finally {
    gmail.restore()
  }
})

test('push payloads decode from base64 or base64url', () => {
  const note = JSON.stringify({ emailAddress: 'developerofcodellc@gmail.com', historyId: 987654321, pad: '>>>???~~~' })
  const std = base64.b64encode(base64.utf8(note))
  const url = base64.b64urlEncode(base64.utf8(note))
  assert.notEqual(std, url)
  for (const data of [std, url]) assert.equal(new TextDecoder().decode(base64.b64urlDecode(data)), note)
})

// ---------- Google sign-in and HTTP plumbing ----------

test('consentUrl asks for offline access to Gmail with a fresh consent screen', () => {
  const url = new URL(consentUrl('state-xyz', 'developerofcodellc@gmail.com'))
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  const p = url.searchParams
  assert.equal(p.get('client_id'), vars.GOOGLE_CLIENT_ID)
  assert.equal(p.get('redirect_uri'), 'https://example-ref.supabase.co/functions/v1/mail-auth')
  assert.equal(p.get('scope'), GMAIL_SCOPE)
  assert.equal(p.get('access_type'), 'offline')
  assert.equal(p.get('prompt'), 'consent')
  assert.equal(p.get('response_type'), 'code')
  assert.equal(p.get('state'), 'state-xyz')
  assert.equal(p.get('login_hint'), 'developerofcodellc@gmail.com')
})

test('CORS only echoes origins on the allow list', () => {
  const allowed = corsHeaders(new Request('https://x.example', { headers: { Origin: 'http://localhost:5173' } }))
  assert.equal(allowed['Access-Control-Allow-Origin'], 'http://localhost:5173')
  const other = corsHeaders(new Request('https://x.example', { headers: { Origin: 'https://evil.example' } }))
  assert.equal(other['Access-Control-Allow-Origin'], 'https://admin.developerofcode.com')
})

test('serviceKey prefers MAIL_SERVICE_KEY, then the new secret keys, then the legacy key', () => {
  vars.SUPABASE_SERVICE_ROLE_KEY = 'legacy'
  assert.equal(serviceKey(), 'legacy')
  vars.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'sb_secret_default' })
  assert.equal(serviceKey(), 'sb_secret_default')
  vars.MAIL_SERVICE_KEY = 'explicit'
  assert.equal(serviceKey(), 'explicit')
  delete vars.MAIL_SERVICE_KEY
  delete vars.SUPABASE_SECRET_KEYS
  delete vars.SUPABASE_SERVICE_ROLE_KEY
})

test('pool never runs more than the limit at once and keeps order', async () => {
  let running = 0
  let peak = 0
  const out = await pool([1, 2, 3, 4, 5, 6, 7], 3, async (n: number) => {
    running++
    peak = Math.max(peak, running)
    await new Promise((r) => setTimeout(r, 5 + (n % 3) * 4))
    running--
    return n * 10
  })
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60, 70])
  assert.ok(peak <= 3)
})
