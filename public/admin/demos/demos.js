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
const demoUrl = (slug) => `${DEMOS_ORIGIN}/${slug}/`;
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
const formatBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

let session = null;
let demos = [];
let slugTouched = false;
let file = null;

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
descEl.addEventListener('input', () => { $('descCount').textContent = `${descEl.value.length}/160`; });

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
  $('descCount').textContent = '0/160';
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
  nameEl.dispatchEvent(new Event('input'));
  descEl.dispatchEvent(new Event('input'));
  $('uploadTitle').textContent = `Replace ${demo.name}`;
  $('resetBtn').hidden = false;
  showForm();
  $('uploadForm').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  $('zip').focus();
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
  const payload = { slug, name: nameEl.value.trim(), description: descEl.value.trim(), concept: $('concept').checked, env: readEnv() };
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
      step('build', 'done');
      step('live', 'done');
      notice('ok',
        el('strong', {}, `${final.name} is live`),
        el('a', { class: 'result-url', href: demoUrl(slug), target: '_blank', rel: 'noopener' }, demoUrl(slug)),
        el('div', { class: 'btn-row' },
          el('a', { class: 'ghost', href: demoUrl(slug), target: '_blank', rel: 'noopener' }, 'Open'),
          el('button', { class: 'ghost', type: 'button', onclick: () => copy(demoUrl(slug)) }, 'Copy link')));
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

function badges(d) {
  const list = [];
  if (d.build_state === 'building') list.push(['building', 'Building']);
  else if (d.build_state === 'failed') list.push(['failed', 'Failed']);
  if (d.status === 'live') list.push(['live', 'Live']);
  else if (d.build_state !== 'building' && d.build_state !== 'failed') list.push(['', 'Draft']);
  if (d.hidden) list.push(['', 'Hidden']);
  if (d.concept) list.push(['', 'Concept']);
  return el('div', { class: 'badges' }, list.map(([cls, label]) => el('span', { class: `badge ${cls}` }, label)));
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
  demos.splice(index, 1);
  demos.splice(index + delta, 0, a);
  renderList();
  try {
    await Promise.all(demos.map((d, i) => (d.sort_order === i ? null : api('update', { method: 'POST', body: { slug: d.slug, sort_order: i } }).then(() => { d.sort_order = i; }))));
  } catch (error) { toast(error.message); loadList(); }
}

function editForm(d, item) {
  const name = el('input', { type: 'text', value: d.name, maxlength: '80', 'aria-label': 'Name' });
  const desc = el('input', { type: 'text', value: d.description || '', maxlength: '160', 'aria-label': 'Description' });
  const concept = el('input', { type: 'checkbox' });
  concept.checked = d.concept;
  const form = el('form', { class: 'edit-form' },
    name, desc,
    el('label', { class: 'check' }, concept, el('span', { class: 'check-text' }, 'Concept demo')),
    el('div', { class: 'btn-row' },
      el('button', { class: 'ghost', type: 'submit' }, 'Save'),
      el('button', { class: 'ghost', type: 'button', onclick: () => renderList() }, 'Cancel')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!name.value.trim()) { name.setAttribute('aria-invalid', 'true'); name.focus(); return; }
    await act(form.querySelector('[type=submit]'), async () => {
      const { demo } = await api('update', { method: 'POST', body: { slug: d.slug, name: name.value, description: desc.value, concept: concept.checked } });
      upsertLocal(demo);
    }, 'Saved');
  });
  item.querySelector('.demo-actions').replaceWith(form);
  name.focus();
}

function renderList() {
  const list = $('demoList');
  $('listState').replaceChildren();
  $('listCount').textContent = demos.length ? `${demos.filter((d) => d.status === 'live' && !d.hidden).length} of ${demos.length} public` : '';
  updatePreview();

  if (!demos.length) {
    list.replaceChildren();
    $('listState').append(el('div', { class: 'empty' }, 'No demos yet. Upload your first zip and it shows up here.'));
    return;
  }

  list.replaceChildren(...demos.map((d, i) => {
    const live = d.status === 'live';
    const item = el('li', { class: `demo${d.hidden ? ' is-hidden' : ''}` },
      el('div', { class: 'demo-top' },
        el('div', {},
          el('div', { class: 'demo-name' }, d.name || d.slug),
          d.description ? el('div', { class: 'demo-desc' }, d.description) : null,
          live ? el('a', { class: 'demo-url', href: demoUrl(d.slug), target: '_blank', rel: 'noopener' }, `/${d.slug}/`) : el('span', { class: 'demo-url' }, `/${d.slug}/`)),
        badges(d)),
      d.build_state === 'failed' && d.error
        ? el('div', { class: 'notice error' }, d.error, d.inspector_url ? el('span', {}, ' ', el('a', { href: d.inspector_url, target: '_blank', rel: 'noopener' }, 'Build log')) : null)
        : null,
      d.warnings?.length && d.build_state !== 'failed' ? warningsNotice(d.warnings) : null,
      el('div', { class: 'demo-actions' },
        live ? el('a', { class: 'ghost', href: demoUrl(d.slug), target: '_blank', rel: 'noopener' }, 'Open') : null,
        live ? el('button', { class: 'ghost', type: 'button', onclick: () => copy(demoUrl(d.slug)) }, 'Copy link') : null,
        el('button', { class: 'ghost', type: 'button', onclick: () => startReplace(d) }, 'Replace'),
        el('button', {
          class: 'ghost', type: 'button', disabled: d.build_state === 'building' || !d.kind,
          onclick: (e) => act(e.currentTarget, async () => {
            const { demo } = await api('build', { method: 'POST', body: { slug: d.slug } });
            upsertLocal(demo);
            upsertLocal(await pollUntilDone(d.slug));
          }, 'Rebuild finished'),
        }, 'Rebuild'),
        el('button', {
          class: 'ghost', type: 'button',
          onclick: (e) => act(e.currentTarget, async () => {
            const { demo } = await api('update', { method: 'POST', body: { slug: d.slug, hidden: !d.hidden } });
            upsertLocal(demo);
          }, d.hidden ? 'Visible on the demos page' : 'Hidden from the demos page'),
        }, d.hidden ? 'Show' : 'Hide'),
        el('button', { class: 'ghost', type: 'button', onclick: () => editForm(d, item) }, 'Edit'),
        el('button', { class: 'ghost', type: 'button', 'aria-label': `Move ${d.name} up`, disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
        el('button', { class: 'ghost', type: 'button', 'aria-label': `Move ${d.name} down`, disabled: i === demos.length - 1, onclick: () => move(i, 1) }, '↓'),
        el('button', {
          class: 'ghost danger', type: 'button',
          onclick: (e) => {
            if (!confirm(`Delete "${d.name}"? This removes it from the demos page and deletes its Vercel project. This cannot be undone.`)) return;
            act(e.currentTarget, async () => {
              await api('delete', { method: 'POST', body: { slug: d.slug } });
              demos = demos.filter((x) => x.slug !== d.slug);
              renderList();
            }, 'Deleted');
          },
        }, 'Delete')));
    return item;
  }));
}

// ── Scroll-to-top ───────────────────────────────────────────────────────────

const scrollBtn = $('scrollTop');
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const onScroll = () => scrollBtn.classList.toggle('show', window.scrollY > 300);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' }));
