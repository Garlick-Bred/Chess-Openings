// Local / self-hosted server: the shared fetch-style API on node:sqlite, plus
// the built client from client/dist. (On Cloudflare, worker/index.js plays
// this role with D1.)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.js';
import { createNodeStore } from './store-node.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT ?? 8787);
const DB_FILE = process.env.DB_FILE ?? path.join(ROOT, 'data', 'openings.db');
// Optional: the endgame site's database, to share its family accounts.
const AUTH_DB_FILE = process.env.AUTH_DB_FILE ?? null;
const DIST = path.join(ROOT, 'client', 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};
const FORWARD_HEADERS = ['cookie', 'content-type', 'content-length', 'accept', 'user-agent'];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(DIST, urlPath));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Client not built. Run: npm run build');
    return;
  }
  // Hashed build files, and the engine (its file names carry the version).
  const immutable = file.includes(`${path.sep}assets${path.sep}`) || file.includes(`${path.sep}engine${path.sep}`);
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

export function createServer({ store = createNodeStore(DB_FILE), authStore = AUTH_DB_FILE ? createNodeStore(AUTH_DB_FILE) : store, env = process.env } = {}) {
  const handle = createApi({ store, authStore, env });
  return http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const headers = new Headers();
        for (const h of FORWARD_HEADERS) if (req.headers[h]) headers.set(h, String(req.headers[h]));
        const hasBody = !['GET', 'HEAD'].includes(req.method);
        const request = new Request(`${proto}://${req.headers.host ?? 'localhost'}${req.url}`, {
          method: req.method,
          headers,
          body: hasBody ? await readBody(req) : undefined,
        });
        const response = await handle(request);
        const out = {};
        response.headers.forEach((v, k) => {
          if (k !== 'set-cookie') out[k] = v;
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) out['set-cookie'] = cookies;
        res.writeHead(response.status, out);
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      serveStatic(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server error' }));
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => console.log(`Garlick Openings listening on http://localhost:${PORT}`));
}
