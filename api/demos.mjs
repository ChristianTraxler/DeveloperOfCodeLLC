// api/demos.mjs: demo uploads for /admin/demos/, one function with an ?action= switch.
//
// Flow: upload-url -> (browser uploads the zip straight to Supabase Storage) -> build
//       -> status (polled until the Vercel deployment is READY or fails).
// Each demo becomes its own Vercel project "demo-<slug>". demos.developerofcode.com
// rewrites /<slug>/* to that project's latest production_url (see the demos project).
//
// Every action requires a Supabase session whose email is in ADMIN_EMAILS. RLS alone
// is not enough: any signed-up Supabase user counts as "authenticated".
//
// Env vars (server only; none of these may be prefixed VITE_):
//   SUPABASE_SERVICE_ROLE_KEY  writes to the demos table and the demo-uploads bucket
//   ADMIN_EMAILS               comma-separated allowlist
//   DEMOS_VERCEL_TOKEN         team-scoped token with an expiry, separate from CI's VERCEL_TOKEN
//   VERCEL_TEAM_ID             the Developer Of Code team
//   SUPABASE_URL / SUPABASE_ANON_KEY  optional; fall back to the VITE_* values

import { DemoError, prepareDemo, toVercelFiles, validateSlug } from './_lib/demos-core.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const VERCEL_TOKEN = process.env.DEMOS_VERCEL_TOKEN || '';
const TEAM_ID = process.env.VERCEL_TEAM_ID || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const BUCKET = 'demo-uploads';
const ZIPS_KEPT = 3;
const UPLOAD_CONCURRENCY = 8;
const ZIP_PATH_RE = /^[a-z0-9][a-z0-9-]{0,39}\/\d{10,16}\.zip$/;
const ENV_KEY_RE = /^[A-Z_][A-Z0-9_]{0,63}$/;
// Returned to the admin page. Never includes tokens or anything from Vercel beyond these.
const PUBLIC_FIELDS = 'slug,name,description,concept,kind,status,build_state,hidden,private,sort_order,production_url,inspector_url,error,warnings,created_at,updated_at';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// ── Supabase (plain fetch, no SDK) ──────────────────────────────────────────

async function requireAdmin(request) {
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '')?.[1];
  if (!token) throw new HttpError(401, 'Sign in first.');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new HttpError(401, 'Your session expired. Sign in again.');
  const user = await res.json();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    throw new HttpError(403, 'This account is not allowed to manage demos.');
  }
  return user;
}

async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...init.headers },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase ${init.method || 'GET'} ${path.split('?')[0]} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return res;
}

async function getDemo(slug) {
  const res = await sb(`/rest/v1/demos?slug=eq.${encodeURIComponent(slug)}&select=*`);
  return (await res.json())[0] || null;
}

async function listDemos() {
  const res = await sb(`/rest/v1/demos?select=${PUBLIC_FIELDS}&order=sort_order.asc,created_at.desc`);
  return res.json();
}

async function upsertDemo(fields) {
  const res = await sb('/rest/v1/demos?on_conflict=slug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(fields),
  });
  return (await res.json())[0];
}

async function patchDemo(slug, fields) {
  const res = await sb(`/rest/v1/demos?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(fields),
  });
  return (await res.json())[0];
}

const pick = (row) => Object.fromEntries(PUBLIC_FIELDS.split(',').map((k) => [k, row?.[k] ?? null]));

async function listZips(slug) {
  const res = await sb(`/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: `${slug}/`, limit: 100, sortBy: { column: 'name', order: 'desc' } }),
  });
  return (await res.json()).map((o) => `${slug}/${o.name}`).filter((p) => ZIP_PATH_RE.test(p));
}

async function removeZips(paths) {
  if (!paths.length) return;
  await sb(`/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  });
}

// ── Vercel REST API ─────────────────────────────────────────────────────────

async function vercel(path, init = {}, { allow404 = false } = {}) {
  const url = new URL(`https://api.vercel.com${path}`);
  url.searchParams.set('teamId', TEAM_ID);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, ...init.headers },
  });
  if (allow404 && res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    // Most likely the yearly token expired; say so instead of a generic 500.
    throw new HttpError(502, 'Vercel rejected the demo upload token. It has probably expired: create a new team-scoped token at vercel.com/account/settings/tokens and replace DEMOS_VERCEL_TOKEN on the main site project, then redeploy.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Vercel ${init.method || 'GET'} ${path.split('?')[0]} failed (${res.status}): ${body?.error?.message || 'unknown error'}`);
  }
  return res.status === 204 ? {} : res.json();
}

const projectName = (slug) => `demo-${slug}`;

async function ensureProject(slug, settings) {
  let project = await vercel(`/v9/projects/${projectName(slug)}`, {}, { allow404: true });
  if (!project) {
    project = await vercel('/v11/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName(slug), framework: settings.framework }),
    });
  }
  // Keep build settings in step with the upload kind, and make every deployment URL
  // public: demos.developerofcode.com rewrites to them, so protection would show a login wall.
  await vercel(`/v9/projects/${project.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...settings, ssoProtection: null, passwordProtection: null }),
  });
  return project.id;
}

async function upsertEnv(projectId, env) {
  const entries = Object.entries(env);
  if (!entries.length) return;
  await vercel(`/v10/projects/${projectId}/env?upsert=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Sensitive to match the team policy; Vercel's own build infra can still read them.
    body: JSON.stringify(entries.map(([key, value]) => ({ key, value, type: 'sensitive', target: ['production'] }))),
  });
}

// Keys already set on the demo's Vercel project (from an earlier upload) count as provided,
// so a Rebuild or Replace does not warn about values that are already there.
async function existingEnvKeys(projectId, formEnv) {
  const keys = { ...formEnv };
  if (!projectId) return keys;
  const res = await vercel(`/v10/projects/${projectId}/env`, {}, { allow404: true });
  for (const entry of res?.envs || []) {
    if (entry.target?.includes('production') && !(entry.key in keys)) keys[entry.key] = '';
  }
  return keys;
}

async function uploadBlobs(blobs) {
  const queue = [...blobs.entries()];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const [sha, data] = item;
      await vercel('/v2/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'x-vercel-digest': sha, 'Content-Length': String(data.byteLength) },
        body: data,
      });
    }
  };
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
}

// ── Input checks ────────────────────────────────────────────────────────────

function cleanText(value, max, label, { required = false } = {}) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new HttpError(400, `${label} is required.`);
  if (s.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return s;
}

function cleanEnv(env) {
  if (env == null) return {};
  if (typeof env !== 'object' || Array.isArray(env)) throw new HttpError(400, 'Env vars must be key and value pairs.');
  const entries = Object.entries(env);
  if (entries.length > 50) throw new HttpError(400, 'Too many env vars (limit 50).');
  for (const [key, value] of entries) {
    if (!ENV_KEY_RE.test(key)) throw new HttpError(400, `Invalid env var name: ${key}`);
    if (typeof value !== 'string' || value.length > 4096) throw new HttpError(400, `Invalid value for ${key}`);
  }
  return Object.fromEntries(entries);
}

function requireSlug(slug) {
  const error = validateSlug(slug);
  if (error) throw new HttpError(400, error);
  return slug;
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function uploadUrl(body) {
  const slug = requireSlug(body.slug);
  if (!(await getDemo(slug))) await upsertDemo({ slug, name: slug });

  const path = `${slug}/${Date.now()}.zip`;
  const res = await sb(`/storage/v1/object/upload/sign/${BUCKET}/${path}`, { method: 'POST' });
  const { url } = await res.json();
  return { path, uploadUrl: `${SUPABASE_URL}/storage/v1${url}` };
}

async function build(body) {
  const slug = requireSlug(body.slug);
  const existing = await getDemo(slug);
  if (!existing) throw new HttpError(404, 'Upload a zip for this demo first.');

  const zipPath = body.path ?? existing.zip_path; // no path = Rebuild with the latest zip
  if (!zipPath || !ZIP_PATH_RE.test(zipPath) || !zipPath.startsWith(`${slug}/`)) {
    throw new HttpError(400, 'No uploaded zip found for this demo.');
  }

  const fields = { zip_path: zipPath };
  if (body.name !== undefined) fields.name = cleanText(body.name, 80, 'Name', { required: true });
  if (body.description !== undefined) fields.description = cleanText(body.description, 1000, 'Description');
  if (body.concept !== undefined) fields.concept = Boolean(body.concept);
  if (body.private !== undefined) fields.private = Boolean(body.private);
  const formEnv = cleanEnv(body.env);

  const zip = new Uint8Array(await (await sb(`/storage/v1/object/${BUCKET}/${zipPath}`)).arrayBuffer());

  let prepared;
  try {
    prepared = prepareDemo(zip, slug, { providedEnv: await existingEnvKeys(existing.vercel_project_id, formEnv) });
  } catch (error) {
    if (!(error instanceof DemoError)) throw error;
    // A bad zip never takes a live demo down: only the latest attempt is marked failed.
    await patchDemo(slug, { ...fields, build_state: 'failed', error: error.message, inspector_url: null, warnings: [] });
    throw new HttpError(422, error.message);
  }

  const projectId = await ensureProject(slug, prepared.settings);
  await upsertEnv(projectId, { ...prepared.env, ...formEnv }); // form values win over .env files

  const { manifest, blobs } = toVercelFiles(prepared.files);
  await uploadBlobs(blobs);
  const deployment = await vercel('/v13/deployments?skipAutoDetectionConfirmation=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: projectName(slug), project: projectId, target: 'production', files: manifest, projectSettings: prepared.settings }),
  });

  const row = await patchDemo(slug, {
    ...fields,
    kind: prepared.kind,
    vercel_project_id: projectId,
    deployment_id: deployment.id,
    build_state: 'building',
    inspector_url: deployment.inspectorUrl || null,
    error: null,
    warnings: prepared.warnings,
  });

  // Keep the newest few zips so Rebuild works; drop the rest.
  const zips = await listZips(slug);
  await removeZips(zips.filter((p) => p !== zipPath).slice(ZIPS_KEPT - 1));

  return { demo: pick(row), envFromZip: Object.keys(prepared.env), missingEnv: prepared.missingEnv || [] };
}

async function status(slug) {
  requireSlug(slug);
  let row = await getDemo(slug);
  if (!row) throw new HttpError(404, 'No demo with that slug.');

  if (row.build_state === 'building' && row.deployment_id) {
    const d = await vercel(`/v13/deployments/${row.deployment_id}`);
    if (d.readyState === 'READY') {
      // The immutable deployment URL, so the demos site always points at exactly this build.
      row = await patchDemo(slug, { build_state: 'ready', status: 'live', production_url: `https://${d.url}`, error: null });
    } else if (d.readyState === 'ERROR' || d.readyState === 'CANCELED') {
      row = await patchDemo(slug, {
        build_state: 'failed',
        error: d.errorMessage || (d.readyState === 'CANCELED' ? 'The build was canceled.' : 'The build failed. Open the build log for details.'),
      });
    }
  }
  return { demo: pick(row) };
}

async function update(body) {
  const slug = requireSlug(body.slug);
  const fields = {};
  if (body.name !== undefined) fields.name = cleanText(body.name, 80, 'Name', { required: true });
  if (body.description !== undefined) fields.description = cleanText(body.description, 1000, 'Description');
  if (body.concept !== undefined) fields.concept = Boolean(body.concept);
  if (body.hidden !== undefined) fields.hidden = Boolean(body.hidden);
  if (body.private !== undefined) fields.private = Boolean(body.private);
  if (body.sort_order !== undefined) {
    if (!Number.isInteger(body.sort_order)) throw new HttpError(400, 'sort_order must be a whole number.');
    fields.sort_order = body.sort_order;
  }
  if (!Object.keys(fields).length) throw new HttpError(400, 'Nothing to update.');
  const row = await patchDemo(slug, fields);
  if (!row) throw new HttpError(404, 'No demo with that slug.');
  return { demo: pick(row) };
}

async function remove(body) {
  const slug = requireSlug(body.slug);
  const row = await getDemo(slug);
  if (!row) throw new HttpError(404, 'No demo with that slug.');
  if (row.vercel_project_id) {
    await vercel(`/v9/projects/${row.vercel_project_id}`, { method: 'DELETE' }, { allow404: true });
  }
  await removeZips(await listZips(slug));
  await sb(`/rest/v1/demos?slug=eq.${encodeURIComponent(slug)}`, { method: 'DELETE' });
  return { deleted: slug };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export default {
  async fetch(request) {
    const missing = [
      ['SUPABASE_URL', SUPABASE_URL], ['SUPABASE_ANON_KEY', SUPABASE_ANON_KEY], ['SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY],
      ['ADMIN_EMAILS', ADMIN_EMAILS.length], ['DEMOS_VERCEL_TOKEN', VERCEL_TOKEN], ['VERCEL_TEAM_ID', TEAM_ID],
    ].filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) return json({ error: `Demo uploads are not configured yet. Missing: ${missing.join(', ')}` }, 503);

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    try {
      await requireAdmin(request);

      if (request.method === 'GET') {
        if (action === 'list') return json({ demos: await listDemos() });
        if (action === 'status') return json(await status(url.searchParams.get('slug')));
        throw new HttpError(400, 'Unknown action.');
      }
      if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

      const body = await request.json().catch(() => { throw new HttpError(400, 'Invalid JSON body.'); });
      if (action === 'upload-url') return json(await uploadUrl(body));
      if (action === 'build') return json(await build(body));
      if (action === 'update') return json(await update(body));
      if (action === 'delete') return json(await remove(body));
      throw new HttpError(400, 'Unknown action.');
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error('[api/demos]', error);
      return json({ error: 'Something went wrong on the server. Check the function logs.' }, 500);
    }
  },
};
