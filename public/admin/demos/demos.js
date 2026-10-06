// admin/demos/demos.js: upload form, build progress, and demo list for /admin/demos/.
// Talks to /api/demos (see api/demos.mjs). The zip goes straight from the browser to
// Supabase Storage through a signed URL, so it never passes through a Vercel function.

import { supabase, SUPABASE_ANON_KEY } from '/admin/supabase.js';

const DEMOS_ORIGIN = 'https://demos.developerofcode.com';
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const POLL_MS = 2500;
const POLL_LIMIT_MS = 15 * 60 * 1000;

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
};
// Private demos only open with their key; the demos site then remembers the browser for 30 days.
const demoUrl = (d) => `${DEMOS_ORIGIN}/${d.slug}/${d.private && d.access_key ? `?key=${d.access_key}` : ''}`;
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
const formatBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

let session = null;
let demos = [];
let slugTouched = false;
let file = null;
let filter = 'all';
let query = '';
let openMenu = null;
let sheetReturnFocus = null;
const expandedDescs = new Set(); // slugs whose description is open, kept across re-renders

// ── Session ─────────────────────────────────────────────────────────────────

const { data } = await supabase.auth.getSession();
session = data.session;
if (!session) {
  window.location.replace('/admin/');
} else {
  $('loading').hidden = true;
  $('loading').style.display = 'none';
  $('app').hidden = false;
  loadList();
}
supabase.auth.onAuthStateChange((_event, next) => {
  session = next;
  if (!next) window.location.replace('/admin/');
});
$('signoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.replace('/admin/');
});

async function api(action, { method = 'GET', body, query = '' } = {}) {
  const res = await fetch(`/api/demos?action=${action}${query}`, {
    method,
    headers: { Authorization: `Bearer ${session?.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (res.status === 401) window.location.replace('/admin/');
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status}).`);
  return payload;
}

// ── Toast ───────────────────────────────────────────────────────────────────

let toastTimer;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Link copied'); }
  catch { toast('Could not copy. Long-press the link instead.'); }
}

// ── Form ────────────────────────────────────────────────────────────────────

const nameEl = $('name');
const slugEl = $('slug');
const descEl = $('description');

function setFieldError(input, errorEl, message) {
  errorEl.textContent = message || '';
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function updatePreview() {
  const slug = slugEl.value;
  $('urlPreview').textContent = `demos.developerofcode.com/${slug || '…'}/`;
  const existing = demos.find((d) => d.slug === slug);
  $('submitBtn').textContent = existing ? 'Replace and publish' : 'Upload and publish';
}

nameEl.addEventListener('input', () => {
  $('nameCount').textContent = `${nameEl.value.length}/80`;
  if (!slugTouched) slugEl.value = slugify(nameEl.value);
  setFieldError(nameEl, $('nameError'), '');
  updatePreview();
});
slugEl.addEventListener('input', () => {
  slugTouched = slugEl.value.length > 0;
  slugEl.value = slugEl.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-');
  setFieldError(slugEl, $('slugError'), '');
  updatePreview();
});
descEl.addEventListener('input', () => { $('descCount').textContent = `${descEl.value.length}/1000`; });


function setFile(next) {
  file = null;
  const drop = $('drop');
  drop.classList.remove('has-file');
  $('dropTitle').textContent = 'Choose a zip';
  $('dropSub').textContent = 'or drop it here';
  setFieldError($('zip'), $('zipError'), '');
  if (!next) { checkEnv(null); return; }

  if (!/\.zip$/i.test(next.name)) { checkEnv(null); return setFieldError($('zip'), $('zipError'), 'That is not a .zip file.'); }
  if (next.size > MAX_ZIP_BYTES) {
    checkEnv(null);
    return setFieldError($('zip'), $('zipError'), `That zip is ${formatBytes(next.size)}. The limit is 50 MB, so leave node_modules out.`);
  }
  file = next;
  checkEnv(next);
  drop.classList.add('has-file');
  $('dropTitle').textContent = next.name;
  $('dropSub').textContent = `${formatBytes(next.size)} · tap to change`;

  // Suggest a name from the file name when the form is still empty.
  if (!nameEl.value.trim()) {
    const base = next.name.replace(/\.zip$/i, '').replace(/[-_](dist|build|source|src|main|master)$/i, '');
    nameEl.value = base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80);
    nameEl.dispatchEvent(new Event('input'));
  }
}

$('zip').addEventListener('change', (e) => setFile(e.target.files[0]));
const drop = $('drop');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('dragging')));
drop.addEventListener('drop', (e) => { e.preventDefault(); setFile(e.dataTransfer.files[0]); });

// ── Env check (runs on the phone before anything uploads) ──────────────────
// Mirrors findEnvUsage in api/_lib/demos-core.mjs; the server runs the same check as a backstop.

const ENV_SCAN = /(^|\/)(package\.json|\.env(\.local|\.production|\.production\.local)?|[^/]+\.html|vite\.config\.[cm]?[jt]s)$|(^|\/)src\/.+\.(jsx?|tsx?|vue|svelte)$/;
let envNeeds = { used: [], fromZip: [] };
let scanToken = 0;

function parseEnvKeys(source) {
  const keys = [];
  for (const line of source.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?(VITE_[A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && m[2].trim()) keys.push(m[1]);
  }
  return keys;
}

async function scanZip(blob) {
  const { unzipSync, strFromU8 } = await import('https://esm.sh/fflate@0.8.3');
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()), {
    filter: (f) => !/(^|\/)(node_modules|dist|\.git|__MACOSX)\//.test(f.name) && ENV_SCAN.test(f.name),
  });
  const names = Object.keys(entries);
  // The project root is wherever the shallowest package.json sits (zips often add a wrapper folder).
  const pkg = names.filter((n) => /(^|\/)package\.json$/.test(n)).sort((a, b) => a.split('/').length - b.split('/').length)[0];
  if (!pkg) return { kind: 'built', used: [], fromZip: [] };

  const root = pkg.slice(0, -'package.json'.length);
  const used = new Set();
  const fromZip = new Set();
  for (const name of names) {
    if (!name.startsWith(root)) continue;
    const rel = name.slice(root.length);
    const body = strFromU8(entries[name]);
    if (/^\.env/.test(rel)) parseEnvKeys(body).forEach((k) => fromZip.add(k));
    else if (!rel.includes('/') || rel.startsWith('src/')) {
      for (const m of body.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) used.add(m[1]);
    }
  }
  return { kind: 'source', used: [...used].sort(), fromZip: [...fromZip] };
}

const typedKeys = () => Object.entries(readEnv()).filter(([, v]) => v.trim()).map(([k]) => k);
const stillMissing = () => envNeeds.used.filter((k) => !envNeeds.fromZip.includes(k) && !typedKeys().includes(k));

function renderEnvCheck() {
  const box = $('envCheck');
  const { used, fromZip, kind } = envNeeds;
  if (!kind || kind === 'built') {
    box.hidden = kind !== 'built';
    box.replaceChildren(kind === 'built' ? el('div', { class: 'notice ok' }, 'Built site. Env values are already baked in, so none are needed.') : '');
    return;
  }
  const missing = stillMissing();
  const covered = used.filter((k) => !missing.includes(k));
  const code = (keys) => keys.flatMap((k, i) => [i ? ', ' : '', el('code', {}, k)]);
  box.hidden = false;
  if (!used.length) {
    box.replaceChildren(el('div', { class: 'notice ok' }, 'This project does not read any VITE_ env values. Nothing to add.'));
  } else if (!missing.length) {
    box.replaceChildren(el('div', { class: 'notice ok' }, 'All env values are covered: ', ...code(covered), '.'));
  } else {
    box.replaceChildren(el('div', { class: 'notice warn' },
      el('strong', {}, missing.length === 1 ? 'Needs 1 env value' : `Needs ${missing.length} env values`),
      el('div', {}, 'Add a value for ', ...code(missing), ' under Env vars below, or those parts of the demo will not work.'),
      covered.length ? el('div', { style: 'margin-top:0.35rem' }, 'Already covered: ', ...code(covered), '.') : null));
  }
}

async function checkEnv(blob) {
  const token = ++scanToken;
  envNeeds = { used: [], fromZip: [] };
  // Drop empty rows added for a previous zip; keep anything typed by hand.
  [...$('envRows').children].forEach((row) => {
    if (row.dataset.auto && !row.querySelectorAll('input')[1].value.trim()) row.remove();
  });
  if (!blob) { renderEnvCheck(); updateEnvSummary(); return; }

  $('envCheck').hidden = false;
  $('envCheck').replaceChildren(el('p', { class: 'hint' }, 'Checking which env values this project needs…'));
  try {
    const result = await scanZip(blob);
    if (token !== scanToken) return;
    envNeeds = result;
    const missing = stillMissing();
    const present = Object.keys(readEnv());
    missing.filter((k) => !present.includes(k)).forEach((k) => { addEnvRow(k).dataset.auto = '1'; });
    if (missing.length) $('envDetails').open = true;
  } catch {
    if (token !== scanToken) return;
    envNeeds = { used: [], fromZip: [] };
    $('envCheck').replaceChildren(el('p', { class: 'hint' }, 'Could not read the zip here. The server will still check it after upload.'));
    return;
  }
  renderEnvCheck();
  updateEnvSummary();
}

// Env var rows
function addEnvRow(key = '', value = '') {
  const row = el('div', { class: 'env-row' },
    el('input', { type: 'text', placeholder: 'VITE_KEY', 'aria-label': 'Variable name', value: key, autocapitalize: 'characters', spellcheck: 'false' }),
    el('input', { type: 'text', placeholder: 'value', 'aria-label': 'Variable value', value, autocapitalize: 'none', spellcheck: 'false' }),
    el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove variable', onclick: () => { row.remove(); updateEnvSummary(); } }, '×'),
  );
  row.addEventListener('input', updateEnvSummary);
  $('envRows').append(row);
  return row;
}
function readEnv() {
  const env = {};
  for (const row of $('envRows').children) {
    const [k, v] = row.querySelectorAll('input');
    if (k.value.trim()) env[k.value.trim()] = v.value;
  }
  return env;
}
function updateEnvSummary() {
  const filled = typedKeys().length;
  const needed = envNeeds.kind === 'source' ? stillMissing().length : 0;
  $('envSummary').textContent = needed ? `(${needed} needed)` : filled ? `(${filled} set)` : '(optional)';
  if (envNeeds.kind === 'source') renderEnvCheck();
}
$('addEnv').addEventListener('click', () => addEnvRow().querySelector('input').focus());

function validate() {
  let ok = true;
  if (!file) { setFieldError($('zip'), $('zipError'), $('zipError').textContent || 'Choose a zip to upload.'); ok = false; }
  if (!nameEl.value.trim()) { setFieldError(nameEl, $('nameError'), 'Give the demo a name.'); ok = false; }
  if (!SLUG_RE.test(slugEl.value)) {
    setFieldError(slugEl, $('slugError'), 'Use lowercase letters, numbers, and hyphens, starting with a letter or number.');
    ok = false;
  }
  for (const key of Object.keys(readEnv())) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      $('envDetails').open = true;
      $('formMsg').textContent = `"${key}" is not a valid variable name. Use capitals, numbers, and underscores.`;
      $('formMsg').className = 'form-msg error';
      ok = false;
    }
  }
  return ok;
}

function resetForm() {
  $('uploadForm').reset();
  setFile(null);
  slugTouched = false;
  $('envRows').replaceChildren();
  envNeeds = { used: [], fromZip: [] };
  $('envCheck').hidden = true;
  updateEnvSummary();
  $('nameCount').textContent = '0/80';
  $('descCount').textContent = '0/1000';
  $('formMsg').textContent = '';
  $('resetBtn').hidden = true;
  updatePreview();
}
$('resetBtn').addEventListener('click', resetForm);

// Prefill the form to replace an existing demo's zip.
function startReplace(demo) {
  resetForm();
  nameEl.value = demo.name;
  slugEl.value = demo.slug;
  slugTouched = true;
  descEl.value = demo.description || '';
  $('concept').checked = demo.concept;
  $('private').checked = demo.private;
  nameEl.dispatchEvent(new Event('input'));
  descEl.dispatchEvent(new Event('input'));
  $('uploadTitle').textContent = `Replace ${demo.name}`;
  $('resetBtn').hidden = false;
  showForm();
  openSheet();
  $('zip').focus();
}

// ── Upload sheet (bottom sheet on phones, side drawer on desktop) ───────────

function openSheet() {
  sheetReturnFocus = document.activeElement;
  $('sheet').hidden = false;
  $('sheetBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  document.body.classList.add('sheet-open');
}
function closeSheet() {
  $('sheet').hidden = true;
  $('sheetBackdrop').hidden = true;
  document.body.style.overflow = '';
  document.body.classList.remove('sheet-open');
  sheetReturnFocus?.focus?.();
}
function newDemo() {
  resetForm();
  $('uploadTitle').textContent = 'New demo';
  showForm();
  openSheet();
  nameEl.focus();
}
['newBtn', 'fab'].forEach((id) => $(id).addEventListener('click', newDemo));
['sheetClose', 'progressClose', 'sheetBackdrop'].forEach((id) => $(id).addEventListener('click', closeSheet));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (openMenu) closeMenu(); else if (!$('sheet').hidden) closeSheet();
});

// ── Thumbnails ──────────────────────────────────────────────────────────────

// Take a screenshot once a demo is live. Never blocks or fails a build: errors are only logged.
// The demos site caches its slug lookups for up to a minute, so a demo that was already live
// waits that long to avoid shooting the previous version.
function scheduleThumb(slug, wasLive) {
  setTimeout(async () => {
    try {
      const { demo } = await api('thumb', { method: 'POST', body: { slug } });
      upsertLocal(demo);
    } catch (error) {
      console.warn('Thumbnail skipped:', error.message);
    }
  }, wasLive ? 65000 : 3000);
}

// ── Upload + build ──────────────────────────────────────────────────────────

function uploadWithProgress(url, blob, onProgress) {
  // Same request shape as supabase-js uploadToSignedUrl, but with XHR for progress events.
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', blob);
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(uploadError(xhr))));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(form);
  });
}
function uploadError(xhr) {
  try { return JSON.parse(xhr.responseText).message || `Upload failed (${xhr.status}).`; }
  catch { return `Upload failed (${xhr.status}).`; }
}

function showForm() { $('uploadForm').hidden = false; $('progress').hidden = true; }
function showProgress() {
  $('uploadForm').hidden = true;
  $('progress').hidden = false;
  $('progressNotices').replaceChildren();
  $('progressDone').hidden = true;
  $('uploadBar').style.width = '0';
  $('uploadMeta').textContent = '';
  $('buildMeta').textContent = '';
  document.querySelectorAll('.step').forEach((s) => { s.className = 'step'; s.querySelector('.dot').innerHTML = ''; });
}
// SVG rather than text glyphs: iOS draws ✓ with its own metrics, so it sat off-center.
const STEP_ICONS = {
  done: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  fail: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="13"/><line x1="12" y1="19" x2="12" y2="19.01"/></svg>',
};
function step(name, state) {
  const s = document.querySelector(`.step[data-step="${name}"]`);
  s.className = `step ${state}`;
  s.querySelector('.dot').innerHTML = STEP_ICONS[state] || '';
}
function notice(kind, ...content) {
  const n = el('div', { class: `notice ${kind}` }, ...content);
  $('progressNotices').append(n);
  return n;
}
function warningsNotice(warnings) {
  if (!warnings?.length) return null;
  return el('div', { class: 'notice warn' },
    el('strong', {}, warnings.length === 1 ? 'Heads up' : `${warnings.length} things to check`),
    el('ul', {}, warnings.map((w) => el('li', {}, w))));
}

$('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('formMsg').textContent = '';
  if (!validate()) return;

  const missing = stillMissing();
  if (missing.length && !confirm(`${missing.join(', ')} ${missing.length === 1 ? 'has' : 'have'} no value, so parts of the demo may not work. Publish anyway?`)) {
    $('envDetails').open = true;
    $('envRows').querySelector('[data-auto] input:last-of-type')?.focus();
    return;
  }

  const slug = slugEl.value;
  const payload = { slug, name: nameEl.value.trim(), description: descEl.value.trim(), concept: $('concept').checked, private: $('private').checked, env: readEnv() };
  $('progressTitle').textContent = `Publishing ${payload.name}`;
  showProgress();

  try {
    step('upload', 'active');
    const { uploadUrl, path } = await api('upload-url', { method: 'POST', body: { slug } });
    await uploadWithProgress(uploadUrl, file, (p) => {
      $('uploadBar').style.width = `${Math.round(p * 100)}%`;
      $('uploadMeta').textContent = `${Math.round(p * 100)}%`;
    });
    step('upload', 'done');
    $('uploadBar').style.width = '100%';
    $('uploadMeta').textContent = formatBytes(file.size);

    step('check', 'active');
    const wasLive = demos.find((d) => d.slug === slug)?.status === 'live';
    const { demo, envFromZip } = await api('build', { method: 'POST', body: { ...payload, path } });
    step('check', 'done');
    $('buildLabel').textContent = demo.kind === 'built' ? 'Deploying built site' : 'Building on Vercel';
    const w = warningsNotice(demo.warnings);
    if (w) $('progressNotices').append(w);
    if (envFromZip?.length) notice('ok', `Picked up ${envFromZip.join(', ')} from the zip's .env file.`);
    upsertLocal(demo);

    step('build', 'active');
    const final = await pollUntilDone(slug, (elapsed) => { $('buildMeta').textContent = `${Math.round(elapsed / 1000)}s`; });
    upsertLocal(final);

    if (final.build_state === 'ready') {
      scheduleThumb(slug, wasLive);
      step('build', 'done');
      step('live', 'done');
      notice('ok',
        el('strong', {}, final.private ? `${final.name} is live (private link)` : `${final.name} is live`),
        el('a', { class: 'result-url', href: demoUrl(final), target: '_blank', rel: 'noopener' }, demoUrl(final)),
        el('div', { class: 'btn-row' },
          el('a', { class: 'ghost', href: demoUrl(final), target: '_blank', rel: 'noopener' }, 'Open'),
          el('button', { class: 'ghost', type: 'button', onclick: () => copy(demoUrl(final)) }, 'Copy link')));
    } else {
      step('build', 'fail');
      notice('error',
        el('strong', {}, 'Build failed. '), final.error || '',
        final.inspector_url ? el('div', { style: 'margin-top:0.5rem' }, el('a', { href: final.inspector_url, target: '_blank', rel: 'noopener' }, 'Open the build log')) : null,
        final.status === 'live' ? el('div', { style: 'margin-top:0.5rem' }, 'The previous version is still live.') : null);
    }
  } catch (error) {
    const current = document.querySelector('.step.active');
    if (current) step(current.dataset.step, 'fail');
    notice('error', error.message);
    loadList();
  }
  $('progressDone').hidden = false;
  $('anotherBtn').focus();
});

$('anotherBtn').addEventListener('click', () => { resetForm(); $('uploadTitle').textContent = 'New demo'; showForm(); });

async function pollUntilDone(slug, onTick) {
  const started = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    onTick?.(Date.now() - started);
    const { demo } = await api('status', { query: `&slug=${encodeURIComponent(slug)}` });
    if (demo.build_state !== 'building') return demo;
    if (Date.now() - started > POLL_LIMIT_MS) throw new Error('Still building after 15 minutes. Check the list below later.');
  }
}

// ── List ────────────────────────────────────────────────────────────────────

function upsertLocal(demo) {
  const i = demos.findIndex((d) => d.slug === demo.slug);
  if (i === -1) demos.push(demo); else demos[i] = demo;
  renderList();
}

async function loadList() {
  try {
    const { demos: rows } = await api('list');
    demos = rows;
    renderList();
    // Resume polling for anything still building (e.g. after a refresh mid-build).
    demos.filter((d) => d.build_state === 'building').forEach((d) =>
      pollUntilDone(d.slug).then(upsertLocal).catch(() => {}));
  } catch (error) {
    $('listState').replaceChildren(el('div', { class: 'notice error', style: 'margin:0' }, error.message,
      el('div', { style: 'margin-top:0.6rem' }, el('button', { class: 'ghost', type: 'button', onclick: () => { $('listState').replaceChildren(el('div', { class: 'skeleton' })); loadList(); } }, 'Try again'))));
  }
}

const ICON_PATHS = {
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  rebuild: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3"/>',
  up: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  down: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
};
function icon(name, size = 16) {
  const holder = document.createElement('span');
  holder.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
  return holder.firstChild;
}

// Placeholder thumbnail: a gradient picked from the slug, with the name's first letter.
function thumbArt(d) {
  let h = 0;
  for (const c of d.slug) h = (h * 31 + c.charCodeAt(0)) % 360;
  const tile = () => el('div', { class: 'thumb-art', style: `background:linear-gradient(135deg,hsl(${h} 42% 30%),hsl(${(h + 48) % 360} 52% 14%))` },
    el('span', {}, (d.name || d.slug).trim().charAt(0).toUpperCase()));
  const src = d.cover_url || d.thumb_url;
  if (!src) return tile();
  // A custom cover wins over the automatic screenshot; a broken image falls back to the tile.
  const art = el('div', { class: 'thumb-art has-img' });
  const img = el('img', { src, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => art.replaceWith(tile()));
  art.append(img);
  return art;
}

function relDate(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 30) return `Updated ${days} days ago`;
  return `Updated ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

// What the card shows for one demo: label, dot style, and whether its thumbnail is dimmed.
function stateOf(d) {
  if (d.build_state === 'building') return { label: 'Building', cls: 'building', pill: 'Building', spin: true, dim: true };
  if (d.build_state === 'failed') return { label: 'Failed', cls: 'failed', pill: 'Build failed', fail: true, dim: true };
  if (d.hidden) return { label: 'Offline', cls: '', pill: 'Offline', dim: true };
  if (d.status === 'live') return { label: 'Live', cls: 'live' };
  return { label: 'Draft', cls: '', pill: 'Draft', dim: true };
}

// ── Overflow menu ───────────────────────────────────────────────────────────

function closeMenu() {
  if (!openMenu) return;
  openMenu.backdrop.remove();
  openMenu.menu.remove();
  openMenu.card.classList.remove('menu-open');
  openMenu.trigger.setAttribute('aria-expanded', 'false');
  openMenu.trigger.focus();
  openMenu = null;
}
function showMenu(trigger, card, title, rows) {
  closeMenu();
  const menu = el('div', { class: 'menu', role: 'menu' }, el('div', { class: 'menu-title' }, title),
    rows.filter(Boolean).map((r) => (r === 'sep' ? el('hr') : el('button', {
      type: 'button', role: 'menuitem', class: r.danger ? 'danger' : '', disabled: r.disabled,
      onclick: () => { closeMenu(); r.run(); },
    }, icon(r.icon, 18), r.label))));
  const backdrop = el('div', { class: 'menu-backdrop', onclick: closeMenu });
  trigger.parentElement.append(backdrop, menu);
  card.classList.add('menu-open');
  trigger.setAttribute('aria-expanded', 'true');
  openMenu = { menu, backdrop, card, trigger };
  menu.querySelector('button:not(:disabled)')?.focus();
}

async function act(button, work, done) {
  button.disabled = true;
  try { await work(); if (done) toast(done); }
  catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}

async function move(index, delta) {
  const a = demos[index];
  const b = demos[index + delta];
  if (!a || !b) return;
  // Normalize to list positions first so equal sort_order values still swap.
  // FLIP: note each card's position, re-render, then slide cards from old to new.
  const before = new Map([...document.querySelectorAll('li.demo[data-slug]')].map((li) => [li.dataset.slug, li.getBoundingClientRect().top]));
  demos.splice(index, 1);
  demos.splice(index + delta, 0, a);
  renderList();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('li.demo[data-slug]').forEach((li) => {
      const dy = before.get(li.dataset.slug) - li.getBoundingClientRect().top;
      if (!dy) return;
      const moved = li.dataset.slug === a.slug;
      li.style.position = 'relative';
      li.style.zIndex = moved ? '2' : '1';
      li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' })
        .finished.then(() => { li.style.position = ''; li.style.zIndex = ''; }, () => {});
    });
    // Keep the moved card in view if it slid off-screen.
    const el2 = document.querySelector(`li.demo[data-slug="${a.slug}"]`);
    const r = el2?.getBoundingClientRect();
    if (r && (r.top < 0 || r.bottom > innerHeight)) el2.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  try {
    await Promise.all(demos.map((d, i) => (d.sort_order === i ? null : api('update', { method: 'POST', body: { slug: d.slug, sort_order: i } }).then(() => { d.sort_order = i; }))));
  } catch (error) { toast(error.message); loadList(); }
}

function editForm(d, item) {
  const name = el('input', { type: 'text', value: d.name, maxlength: '80', 'aria-label': 'Name' });
  const desc = el('textarea', { maxlength: '1000', rows: '5', 'aria-label': 'Description' });
  desc.value = d.description || '';
  const concept = el('input', { type: 'checkbox' });
  concept.checked = d.concept;
  const cover = el('input', { type: 'file', accept: 'image/webp,image/png,image/jpeg', 'aria-label': 'Cover image' });
  const coverError = el('p', { class: 'field-error', role: 'alert' });
  cover.addEventListener('change', () => {
    const f = cover.files[0];
    coverError.textContent = f && f.size > 5 * 1024 * 1024 ? 'That image is over 5 MB.' : '';
    if (coverError.textContent) cover.value = '';
  });
  const form = el('form', { class: 'edit-form' },
    name, desc,
    el('label', { class: 'check' }, concept, el('span', { class: 'check-text' }, 'Concept demo')),
    el('div', { class: 'field', style: 'margin:0' },
      el('span', { class: 'label' }, 'Cover image'),
      cover,
      el('p', { class: 'hint' }, d.cover_url ? 'A custom cover is set. Choose a new image to replace it.' : 'Optional. Replaces the automatic screenshot. WebP, PNG or JPEG, up to 5 MB.'),
      coverError,
      d.cover_url ? el('button', { class: 'ghost', type: 'button', style: 'margin-top:0.4rem', onclick: (e) => act(e.currentTarget, async () => {
        const { demo } = await api('clear-cover', { method: 'POST', body: { slug: d.slug } });
        upsertLocal(demo);
      }, 'Cover removed. The screenshot is back.') }, 'Remove cover') : null),
    el('div', { class: 'btn-row' },
      el('button', { class: 'ghost', type: 'submit' }, 'Save'),
      el('button', { class: 'ghost', type: 'button', onclick: () => renderList() }, 'Cancel')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!name.value.trim()) { name.setAttribute('aria-invalid', 'true'); name.focus(); return; }
    if (coverError.textContent) return;
    await act(form.querySelector('[type=submit]'), async () => {
      let { demo } = await api('update', { method: 'POST', body: { slug: d.slug, name: name.value, description: desc.value, concept: concept.checked } });
      const picked = cover.files[0];
      if (picked) {
        const { path, uploadUrl } = await api('cover-upload-url', { method: 'POST', body: { slug: d.slug, type: picked.type } });
        await uploadWithProgress(uploadUrl, picked, () => {});
        ({ demo } = await api('set-cover', { method: 'POST', body: { slug: d.slug, path } }));
      }
      upsertLocal(demo);
    }, 'Saved');
  });
  item.querySelector('.demo-actions').replaceWith(form);
  name.focus();
}

// ── Collapsible description ─────────────────────────────────────────────────

const DESC_COLLAPSED_PX = 92; // about 4 lines at the list's font size

function descBlock(d) {
  const text = el('div', { class: 'demo-desc' }, d.description);
  const clip = el('div', { class: 'desc-clip', id: `desc-${d.slug}` }, text);
  const label = el('span', {}, 'Show more');
  const toggle = el('button', { class: 'desc-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': clip.id, hidden: true },
    label,
    el('span', { 'aria-hidden': 'true', style: 'display:inline-flex' }));
  toggle.lastChild.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  const setOpen = (open, animate) => {
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Show less' : 'Show more';
    if (open) expandedDescs.add(d.slug); else expandedDescs.delete(d.slug);
    if (!animate) {
      clip.style.maxHeight = open ? 'none' : `${DESC_COLLAPSED_PX}px`;
      clip.classList.toggle('is-collapsed', !open);
      return;
    }
    // Animate between fixed pixel heights, then release to "none" when open so the
    // text can still reflow if the window is resized.
    clip.style.maxHeight = `${open ? DESC_COLLAPSED_PX : clip.scrollHeight}px`;
    clip.offsetHeight; // commit the start height before changing it
    clip.classList.toggle('is-collapsed', !open);
    clip.style.maxHeight = `${open ? clip.scrollHeight : DESC_COLLAPSED_PX}px`;
    const done = () => {
      clip.removeEventListener('transitionend', done);
      if (open) clip.style.maxHeight = 'none';
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else clip.addEventListener('transitionend', done);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true', true));

  // Measure once the card is in the page; short descriptions get no toggle at all.
  requestAnimationFrame(() => {
    if (text.scrollHeight <= DESC_COLLAPSED_PX + 8) return;
    toggle.hidden = false;
    setOpen(expandedDescs.has(d.slug), false);
  });
  return el('div', {}, clip, toggle);
}

function segButton(label, pressed, onclick, count, extra = {}) {
  return el('button', { type: 'button', 'aria-pressed': String(pressed), onclick, ...extra },
    label, count == null ? null : el('span', { class: 'n' }, String(count)));
}

function renderFilter(all, pub, priv) {
  $('filterSeg').replaceChildren(
    segButton('All', filter === 'all', () => { filter = 'all'; renderList(); }, all),
    segButton('Public', filter === 'public', () => { filter = 'public'; renderList(); }, pub),
    segButton('Link only', filter === 'link', () => { filter = 'link'; renderList(); }, priv));
}

function matches(d) {
  const q = query.trim().toLowerCase();
  return !q || `${d.name} ${d.slug} ${d.description || ''}`.toLowerCase().includes(q);
}

function card(d) {
  const st = stateOf(d);
  const live = d.status === 'live';
  const path = d.private ? `/${d.slug}/?key=${d.access_key || ''}` : `${DEMOS_ORIGIN.replace('https://', '')}/${d.slug}`;
  const publicList = demos.filter((x) => x.private === d.private);
  const at = publicList.indexOf(d);
  const canMove = !query.trim();
  const goMove = (neighbor) => move(demos.indexOf(d), demos.indexOf(neighbor) - demos.indexOf(d));
  const item = el('li', { class: `demo${st.dim ? ' is-dim' : ''}`, 'data-slug': d.slug });
  const moreBtn = el('button', { class: 'ghost more-btn', type: 'button', 'aria-label': `More actions for ${d.name}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('more', 18));
  moreBtn.addEventListener('click', () => showMenu(moreBtn, item, d.name, [
    { label: 'Edit details', icon: 'pencil', run: () => editForm(d, item) },
    { label: 'Replace zip', icon: 'upload', run: () => startReplace(d) },
    { label: 'Rebuild', icon: 'rebuild', disabled: d.build_state === 'building' || !d.kind,
      run: () => act(moreBtn, async () => {
        const { demo } = await api('build', { method: 'POST', body: { slug: d.slug } });
        upsertLocal(demo);
        const done = await pollUntilDone(d.slug);
        upsertLocal(done);
        if (done.build_state === 'ready') scheduleThumb(d.slug, d.status === 'live');
      }, 'Rebuild finished') },
    { label: 'Capture thumbnail', icon: 'camera', disabled: d.status !== 'live' || d.hidden || d.build_state === 'building',
      run: () => act(moreBtn, async () => {
        const { demo } = await api('thumb', { method: 'POST', body: { slug: d.slug } });
        upsertLocal(demo);
      }, 'Thumbnail updated') },
    d.private && { label: 'Generate new key', icon: 'key',
      run: () => {
        if (!confirm(`Give "${d.name}" a new key? Anyone with the current link will lose access, including people already viewing it. Only the new link will work.`)) return;
        act(moreBtn, async () => {
          const { demo } = await api('rotate-key', { method: 'POST', body: { slug: d.slug } });
          upsertLocal(demo);
        }, 'New key made. Copy the new link to share it.');
      } },
    canMove && at > 0 && { label: 'Move up', icon: 'up', run: () => goMove(publicList[at - 1]) },
    canMove && at < publicList.length - 1 && { label: 'Move down', icon: 'down', run: () => goMove(publicList[at + 1]) },
    { label: d.hidden ? 'Put online' : 'Take offline', icon: 'power',
      run: () => act(moreBtn, async () => {
        const { demo } = await api('update', { method: 'POST', body: { slug: d.slug, hidden: !d.hidden } });
        upsertLocal(demo);
      }, d.hidden ? 'Back online' : 'Offline: the link no longer works') },
    'sep',
    { label: 'Delete demo', icon: 'trash', danger: true,
      run: () => {
        if (!confirm(`Delete "${d.name}"? This removes it from the demos page and deletes its Vercel project. This cannot be undone.`)) return;
        act(moreBtn, async () => {
          await api('delete', { method: 'POST', body: { slug: d.slug } });
          demos = demos.filter((x) => x.slug !== d.slug);
          renderList();
        }, 'Deleted');
      } },
  ]));

  const visibility = el('div', { class: 'seg fill', role: 'group', 'aria-label': `Visibility of ${d.name}` },
    ['Public', 'Link only'].map((label, i) => {
      const wantPrivate = i === 1;
      return el('button', {
        type: 'button', 'aria-pressed': String(d.private === wantPrivate),
        onclick: (e) => {
          if (d.private === wantPrivate) return;
          act(e.currentTarget, async () => {
            const { demo } = await api('update', { method: 'POST', body: { slug: d.slug, private: wantPrivate } });
            upsertLocal(demo);
          }, wantPrivate ? 'Private: only the keyed link works' : 'Now listed on the demos page, no key needed');
        },
      }, label);
    }));

  item.append(
    el('div', { class: 'thumb' }, thumbArt(d),
      st.pill ? el('div', { class: 'thumb-pill' }, el('span', {}, el('i', { class: st.spin ? 'spin' : st.fail ? 'fail' : '' }), st.pill)) : null),
    el('div', { class: 'demo-body' },
      el('div', { class: 'demo-top' },
        el('div', { style: 'min-width:0' },
          el('h3', { class: 'demo-name' }, d.name || d.slug),
          live && !d.hidden
            ? el('a', { class: 'demo-url', href: demoUrl(d), target: '_blank', rel: 'noopener' }, icon(d.private ? 'lock' : 'globe', 13), el('span', {}, path))
            : el('span', { class: 'demo-url' }, icon(d.private ? 'lock' : 'globe', 13), el('span', {}, path))),
        el('span', { class: `state ${st.cls}` }, el('i'), st.label)),
      d.description ? descBlock(d) : null,
      el('p', { class: 'demo-meta' }, d.concept ? el('span', { class: 'badge' }, 'Concept') : null, relDate(d.updated_at)),
      d.build_state === 'failed' && d.error
        ? el('div', { class: 'notice error' }, d.error, d.inspector_url ? el('span', {}, ' ', el('a', { href: d.inspector_url, target: '_blank', rel: 'noopener' }, 'Build log')) : null)
        : null,
      d.warnings?.length && d.build_state !== 'failed' ? warningsNotice(d.warnings) : null,
      el('div', { class: 'demo-actions' },
        live ? el('a', { class: 'ghost solid', href: demoUrl(d), target: '_blank', rel: 'noopener' }, icon('external'), 'Open')
          : el('button', { class: 'ghost solid', type: 'button', disabled: true }, icon('external'), 'Open'),
        el('button', { class: 'ghost', type: 'button', disabled: !live, onclick: () => copy(demoUrl(d)) }, icon('copy'), 'Copy link'),
        visibility,
        el('div', { class: 'more-wrap' }, moreBtn))));
  return item;
}

function renderList() {
  closeMenu();
  $('listState').replaceChildren();
  const pubAll = demos.filter((d) => !d.private);
  const privAll = demos.filter((d) => d.private);
  const searching = query.trim().length > 0;
  const pub = pubAll.filter(matches);
  const priv = privAll.filter(matches);
  const showPub = filter !== 'link';
  const showPriv = filter !== 'public';
  $('pageCount').textContent = demos.length ? `${demos.length} demos in total. ${pubAll.length} on the public page, ${privAll.length} link only.` : '';
  renderFilter(demos.length, pubAll.length, privAll.length);
  updatePreview();

  $('secPublic').hidden = true;
  $('secPrivate').hidden = true;
  if (!demos.length) {
    $('listState').append(el('div', { class: 'empty' }, 'No demos yet. Upload your first zip and it shows up here.'));
    return;
  }
  const nothing = searching && (showPub ? pub.length : 0) + (showPriv ? priv.length : 0) === 0;
  if (nothing) {
    $('listState').append(el('div', { class: 'empty' }, `No demos match "${query.trim()}". Try a client name or part of a URL slug.`,
      el('div', { style: 'margin-top:1rem' }, el('button', { class: 'ghost', type: 'button', onclick: () => { query = ''; $('search').value = ''; renderList(); } }, 'Clear search'))));
    return;
  }
  const fill = (section, list, countEl, rows, emptyEl, total) => {
    section.hidden = false;
    countEl.textContent = rows.length;
    list.replaceChildren(...rows.map(card));
    emptyEl.hidden = total > 0;
  };
  if (showPub) {
    fill($('secPublic'), $('demoList'), $('pubCount'), pub, $('pubEmpty'), pubAll.length);
    $('pubHint').textContent = searching ? 'Clear the search to reorder.' : 'Visitors see these in this order. Use Move up and Move down in the menu to reorder.';
  }
  if (showPriv) {
    fill($('secPrivate'), $('privateList'), $('privCount'), priv, $('privEmpty'), privAll.length);
    $('privHint').textContent = searching ? 'Clear the search to reorder.' : 'Hidden from the page. Anyone with the key link can open them. Use Move up and Move down in the menu to reorder.';
  }
}

$('search').addEventListener('input', (e) => { query = e.target.value; renderList(); });

// ── Scroll-to-top ───────────────────────────────────────────────────────────

const scrollBtn = $('scrollTop');
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const onScroll = () => scrollBtn.classList.toggle('show', window.scrollY > 300);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' }));
