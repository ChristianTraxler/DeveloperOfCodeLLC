// Run with: npm run test:demos
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import {
  DemoError, LIMITS, collectEnv, findEnvUsage, buildCommandFor, detectKind, parseEnv, prepareDemo,
  readZip, rewriteBuiltBase, stripWrappers, toVercelFiles, validateSlug, withSpaFallback,
} from '../api/_lib/demos-core.mjs';

const zip = (entries) => zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])));
const files = (entries) => new Map(Object.entries(entries).map(([k, v]) => [k, strToU8(v)]));
const text = (data) => new TextDecoder().decode(data);

const PKG = JSON.stringify({ scripts: { build: 'tsc -b && vite build' }, devDependencies: { vite: '^6.0.0' } });

test('validateSlug accepts good slugs and rejects bad or reserved ones', () => {
  assert.equal(validateSlug('halyard-house'), null);
  assert.equal(validateSlug('a'), null);
  for (const bad of ['', '-lead', 'Upper', 'has space', 'x'.repeat(41), '../etc', 'a/b', undefined]) {
    assert.ok(validateSlug(bad), `expected "${bad}" to be rejected`);
  }
  assert.match(validateSlug('admin'), /reserved/);
  assert.match(validateSlug('fonts'), /reserved/);
});

test('readZip rejects zip-slip paths', () => {
  assert.throws(() => readZip(zip({ '../evil.js': 'x' })), DemoError);
  assert.throws(() => readZip(zip({ 'a/../../evil.js': 'x' })), DemoError);
});

test('readZip drops macOS and git junk', () => {
  const out = readZip(zip({ 'index.html': '<p>', '__MACOSX/._index.html': 'x', '.DS_Store': 'x', 'assets/.DS_Store': 'x', '.git/HEAD': 'x' }));
  assert.deepEqual([...out.keys()], ['index.html']);
});

test('readZip enforces the file count limit before unpacking', () => {
  const many = {};
  for (let i = 0; i <= LIMITS.maxFiles; i++) many[`f${i}.txt`] = '';
  assert.throws(() => readZip(zip(many)), /Too many files/);
});

test('readZip rejects files that are not zips', () => {
  assert.throws(() => readZip(strToU8('not a zip')), /could not be read/);
});

test('stripWrappers removes one or more wrapping folders', () => {
  const out = stripWrappers(files({ 'site/dist/index.html': '', 'site/dist/assets/a.js': '' }));
  assert.deepEqual([...out.keys()].sort(), ['assets/a.js', 'index.html']);
  const flat = stripWrappers(files({ 'index.html': '', 'assets/a.js': '' }));
  assert.deepEqual([...flat.keys()].sort(), ['assets/a.js', 'index.html']);
});

test('detectKind tells source from built and rejects neither', () => {
  assert.equal(detectKind(files({ 'package.json': '{}', 'index.html': '' })), 'source');
  assert.equal(detectKind(files({ 'index.html': '' })), 'built');
  assert.throws(() => detectKind(files({ 'readme.md': '' })), DemoError);
});

test('parseEnv handles quotes, comments, and export', () => {
  assert.deepEqual(parseEnv('A=1\n# c\nexport B="two words"\nC=3 # note\nD=\'q#x\'\n bad line'), { A: '1', B: 'two words', C: '3', D: 'q#x' });
});

test('collectEnv keeps only VITE_ keys, later files win', () => {
  const env = collectEnv(files({ '.env': 'VITE_A=base\nSECRET=nope', '.env.production': 'VITE_A=prod\nVITE_B=b' }));
  assert.deepEqual(env, { VITE_A: 'prod', VITE_B: 'b' });
});

test('buildCommandFor passes --base through npm when the script ends with vite build', () => {
  assert.equal(buildCommandFor({ scripts: { build: 'tsc -b && vite build' } }, 'x').command, 'npm run build -- --base=/x/');
  const other = buildCommandFor({ scripts: { build: 'vite build && node postbuild.js' } }, 'x');
  assert.equal(other.command, 'npx vite build --base=/x/');
  assert.ok(other.warning);
});

test('rewriteBuiltBase prefixes root-absolute refs to files in the zip only', () => {
  const input = files({
    'index.html': '<script src="/assets/a.js"></script><link href="/favicon.svg"><a href="/">Home</a><a href="https://x.com/assets/y">',
    'assets/a.js': 'const v="/assets/v.mp4";fetch(`/assets/d.json`);const ext="/other/thing.png";',
    'assets/a.css': 'body{background:url(/assets/bg.webp)}',
    'favicon.svg': '<svg/>',
  });
  const { files: out, rewritten } = rewriteBuiltBase(input, 'demo');
  assert.equal(text(out.get('index.html')), '<script src="/demo/assets/a.js"></script><link href="/demo/favicon.svg"><a href="/">Home</a><a href="https://x.com/assets/y">');
  assert.equal(text(out.get('assets/a.js')), 'const v="/demo/assets/v.mp4";fetch(`/demo/assets/d.json`);const ext="/other/thing.png";');
  assert.equal(text(out.get('assets/a.css')), 'body{background:url(/demo/assets/bg.webp)}');
  assert.equal(rewritten, 5);
});

test('rewriteBuiltBase leaves a site already built for the slug alone', () => {
  const input = files({ 'index.html': '<script src="/demo/assets/a.js"></script>', 'assets/a.js': '"/assets/x"' });
  assert.equal(rewriteBuiltBase(input, 'demo').rewritten, 0);
});

test('withSpaFallback adds the rewrite and merges an existing vercel.json', () => {
  const fresh = JSON.parse(text(withSpaFallback(files({ 'index.html': '' })).get('vercel.json')));
  assert.deepEqual(fresh.rewrites, [{ source: '/(.*)', destination: '/index.html' }]);
  const merged = JSON.parse(text(withSpaFallback(files({ 'vercel.json': '{"cleanUrls":true,"rewrites":[{"source":"/api/(.*)","destination":"/x"}]}' })).get('vercel.json')));
  assert.equal(merged.cleanUrls, true);
  assert.equal(merged.rewrites.length, 2);
});

test('prepareDemo: built zip in a wrapper folder', () => {
  const out = prepareDemo(zip({ 'my-site/index.html': '<script src="/assets/a.js"></script>', 'my-site/assets/a.js': 'x' }), 'my-site');
  assert.equal(out.kind, 'built');
  assert.match(text(out.files.get('index.html')), /\/my-site\/assets\/a\.js/);
  assert.ok(out.files.has('vercel.json'));
  assert.equal(out.settings.buildCommand, null);
});

test('prepareDemo: source zip drops build output, deps, and .env files, and collects env', () => {
  const out = prepareDemo(zip({
    'package.json': PKG,
    'index.html': '',
    'src/main.jsx': 'import { BrowserRouter } from "react-router-dom"',
    'node_modules/x/index.js': 'x',
    'dist/index.html': 'old',
    '.env': 'VITE_SUPABASE_URL=https://x.supabase.co\nPRIVATE=1',
  }), 'app');
  assert.equal(out.kind, 'source');
  assert.deepEqual(out.env, { VITE_SUPABASE_URL: 'https://x.supabase.co' });
  assert.ok(!out.files.has('.env'));
  assert.ok(![...out.files.keys()].some((p) => p.startsWith('node_modules/') || p.startsWith('dist/')));
  assert.equal(out.settings.buildCommand, 'npm run build -- --base=/app/');
  assert.ok(out.warnings.some((w) => /basename/.test(w)));
});

test('prepareDemo: source zip without vite or a build script fails clearly', () => {
  assert.throws(() => prepareDemo(zip({ 'package.json': '{"scripts":{"build":"x"}}' }), 'a'), /Vite project/);
  assert.throws(() => prepareDemo(zip({ 'package.json': '{"devDependencies":{"vite":"1"}}' }), 'a'), /"build" script/);
  assert.throws(() => prepareDemo(zip({ 'package.json': '{nope' }), 'a'), /not valid JSON/);
});

test('prepareDemo: warns about PWA plugins and absolute asset paths', () => {
  const out = prepareDemo(zip({
    'package.json': JSON.stringify({ scripts: { build: 'vite build' }, devDependencies: { vite: '6', 'vite-plugin-pwa': '1' } }),
    'src/App.jsx': '<img src="/images/logo.png" />',
  }), 'a');
  assert.ok(out.warnings.some((w) => /vite-plugin-pwa/.test(w)));
  assert.ok(out.warnings.some((w) => /images\/logo\.png/.test(w)));
});

test('toVercelFiles hashes each file with sha1', () => {
  const { manifest, blobs } = toVercelFiles(files({ 'a.txt': 'hello' }));
  assert.deepEqual(manifest, [{ file: 'a.txt', sha: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d', size: 5 }]);
  assert.equal(blobs.size, 1);
});

test('findEnvUsage lists VITE_ keys the source reads, ignoring built-ins and non-source files', () => {
  const used = findEnvUsage(files({
    'src/lib/supabase.js': 'createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)',
    'src/App.tsx': 'const base = import.meta.env.BASE_URL; const k = import.meta.env.VITE_SUPABASE_URL;',
    'vite.config.ts': 'import.meta.env.VITE_ANALYTICS_ID',
    'README.md': 'import.meta.env.VITE_DOCS_ONLY',
    'scripts/seed.js': 'import.meta.env.VITE_NOT_SCANNED',
  }));
  assert.deepEqual(used, ['VITE_ANALYTICS_ID', 'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL']);
});

test('prepareDemo warns only about env values that are still missing', () => {
  const source = {
    'package.json': PKG,
    'src/main.js': 'import.meta.env.VITE_A; import.meta.env.VITE_B; import.meta.env.VITE_C;',
    '.env': 'VITE_A=from-zip',
  };
  const out = prepareDemo(zip(source), 'app', { providedEnv: { VITE_B: 'typed' } });
  assert.deepEqual(out.usedEnv, ['VITE_A', 'VITE_B', 'VITE_C']);
  assert.deepEqual(out.missingEnv, ['VITE_C']);
  assert.ok(out.warnings.some((w) => /VITE_C/.test(w) && !/VITE_A|VITE_B/.test(w)));

  const complete = prepareDemo(zip(source), 'app', { providedEnv: { VITE_B: 'x', VITE_C: 'y' } });
  assert.deepEqual(complete.missingEnv, []);
  assert.ok(!complete.warnings.some((w) => /no value was provided/.test(w)));
});
