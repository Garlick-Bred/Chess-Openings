#!/usr/bin/env node
// Deploy Garlick Openings to Cloudflare: Worker (API + embedded client) + D1.
// Family accounts are shared with the endgame site: its D1 database is bound
// as AUTH_DB (AUTH_D1_NAME, default garlick-endgames).
//
//   CLOUDFLARE_API_TOKEN=...        token with Workers Scripts:Edit and D1:Edit
//   CLOUDFLARE_ACCOUNT_ID=...       optional (defaults to the token's only account)
//   INVITE_CODE=...                 sets/changes the family sign-up code (kept otherwise)
//   WORKER_NAME=garlick-openings    optional
//   AUTH_D1_NAME=garlick-endgames   the database with the shared accounts
//   node scripts/deploy-cloudflare.mjs [--skip-build] [--build-only]
//
// Behind an HTTPS proxy on Node >= 22.21, run with NODE_USE_ENV_PROXY=1.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { SCHEMA } from '../server/schema.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'client', 'dist');
const OUT = path.join(ROOT, '.deploy');
const NAME = process.env.WORKER_NAME ?? 'garlick-openings';
const AUTH_DB_NAME = process.env.AUTH_D1_NAME ?? 'garlick-endgames';
const DB_NAME = process.env.D1_NAME ?? NAME;
const API = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const COMPAT_DATE = '2025-09-01';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const BUILD_ONLY = process.argv.includes('--build-only');
if (!TOKEN && !BUILD_ONLY) {
  console.error('Set CLOUDFLARE_API_TOKEN (Workers Scripts:Edit + D1:Edit).');
  process.exit(1);
}

async function cf(method, apiPath, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(API + apiPath, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(`${method} ${apiPath} -> HTTP ${res.status}: ${JSON.stringify(data.errors ?? data).slice(0, 600)}`);
  }
  return data.result;
}

function step(msg) {
  console.log(`\n▸ ${msg}`);
}

// 1. Build the client.
if (!process.argv.includes('--skip-build')) {
  step('Building client');
  const r = spawnSync('npx', ['vite', 'build', '--config', 'client/vite.config.ts'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// 2. Embed the built files and bundle the Worker.
step('Bundling Worker with embedded client');
fs.mkdirSync(OUT, { recursive: true });
const assets = {};
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const rel = '/' + path.relative(DIST, full).split(path.sep).join('/');
      const type = TYPES[path.extname(entry.name)];
      if (!type) throw new Error(`No content type for ${rel}; add it to TYPES.`);
      assets[rel] = { type, body: fs.readFileSync(full, 'utf8') };
    }
  }
})(DIST);
const generated = path.join(OUT, 'assets.generated.js');
fs.writeFileSync(generated, `export const ASSETS = ${JSON.stringify(assets)};\n`);
await build({
  entryPoints: [path.join(ROOT, 'worker', 'index.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  conditions: ['worker'],
  target: 'es2022',
  minify: true,
  outfile: path.join(OUT, 'worker.js'),
  logLevel: 'warning',
  plugins: [
    {
      name: 'embedded-assets',
      setup(b) {
        b.onResolve({ filter: /assets\.generated\.js$/ }, () => ({ path: generated }));
      },
    },
  ],
});
const script = fs.readFileSync(path.join(OUT, 'worker.js'), 'utf8');
console.log(`  ${Object.keys(assets).length} files embedded, worker.js ${(script.length / 1024).toFixed(0)} KB`);
if (BUILD_ONLY) {
  console.log(`  built ${path.join(OUT, 'worker.js')} (--build-only: not deploying)`);
  process.exit(0);
}

// 3. Account.
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? (await cf('GET', '/accounts'))[0].id;

// 4. D1 database + schema.
step(`D1 database "${DB_NAME}"`);
let db = (await cf('GET', `/accounts/${accountId}/d1/database?name=${encodeURIComponent(DB_NAME)}`)).find((d) => d.name === DB_NAME);
if (!db) {
  db = await cf('POST', `/accounts/${accountId}/d1/database`, { name: DB_NAME });
  console.log(`  created ${db.uuid}`);
} else console.log(`  using ${db.uuid}`);
await cf('POST', `/accounts/${accountId}/d1/database/${db.uuid}/query`, { sql: SCHEMA.join(';\n') });
console.log(`  schema applied (${SCHEMA.length} statements)`);

// 5. Upload the Worker.
step(`Uploading Worker "${NAME}"`);
const authDb = (await cf('GET', `/accounts/${accountId}/d1/database?name=${encodeURIComponent(AUTH_DB_NAME)}`)).find((d) => d.name === AUTH_DB_NAME);
if (!authDb) throw new Error(`Account database "${AUTH_DB_NAME}" not found`);
const bindings = [
  { type: 'd1', name: 'DB', id: db.uuid },
  { type: 'd1', name: 'AUTH_DB', id: authDb.uuid },
];
const metadata = { main_module: 'worker.js', compatibility_date: COMPAT_DATE, bindings };
if (process.env.INVITE_CODE) bindings.push({ type: 'secret_text', name: 'INVITE_CODE', text: process.env.INVITE_CODE });
else metadata.keep_bindings = ['secret_text'];
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
form.append('worker.js', new Blob([script], { type: 'application/javascript+module' }), 'worker.js');
await cf('PUT', `/accounts/${accountId}/workers/scripts/${NAME}`, form);
console.log('  uploaded');

// 6. Public workers.dev address.
step('Enabling workers.dev route');
await cf('POST', `/accounts/${accountId}/workers/scripts/${NAME}/subdomain`, { enabled: true, previews_enabled: false });
const sub = (await cf('GET', `/accounts/${accountId}/workers/subdomain`)).subdomain;
const url = `https://${NAME}.${sub}.workers.dev`;
console.log(`\n✓ Deployed: ${url}`);

// 7. Best-effort health check (DNS for a new workers.dev name can take a minute).
for (let i = 0; i < 6; i++) {
  try {
    const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      console.log(`✓ Health check OK (${JSON.stringify(await r.json())})`);
      break;
    }
    console.log(`  health check HTTP ${r.status}, retrying…`);
  } catch (e) {
    console.log(`  health check not reachable yet (${e.cause?.code ?? e.message})`);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
