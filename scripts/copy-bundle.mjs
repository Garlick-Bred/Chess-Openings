#!/usr/bin/env node
// npm run bundle: copy the built Worker (and its data modules, as base64) into
// deploy/, which is committed so the Cloudflare connector can fetch it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, '.deploy');
const DST = path.join(ROOT, 'deploy');
fs.mkdirSync(DST, { recursive: true });
fs.copyFileSync(path.join(SRC, 'worker.js'), path.join(DST, 'worker.js'));
const modules = JSON.parse(fs.readFileSync(path.join(SRC, 'modules.json'), 'utf8'));
for (const f of fs.readdirSync(DST)) if (f.endsWith('.b64') && !modules.some((m) => m.base64 === f)) fs.rmSync(path.join(DST, f));
for (const m of modules) fs.copyFileSync(path.join(SRC, m.base64), path.join(DST, m.base64));
fs.copyFileSync(path.join(SRC, 'modules.json'), path.join(DST, 'modules.json'));
console.log(`deploy/: worker.js${modules.map((m) => ` + ${m.base64}`).join('')}`);
