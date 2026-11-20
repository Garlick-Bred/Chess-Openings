// Store adapter for local SQLite via Node's built-in node:sqlite. Same async
// interface as the Cloudflare D1 adapter (worker/store-d1.js):
//   get(sql, ...params) -> row | null
//   all(sql, ...params) -> rows
//   run(sql, ...params) -> { changes, lastId }
//   batch([[sql, params], ...]) -> runs atomically
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Loaded via require so test tooling that does not know the prefix-only
// node:sqlite builtin can still import this file.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

const clean = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));

export function createNodeStore(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const plain = (row) => (row ? { ...row } : null);
  return {
    async get(sql, ...params) {
      return plain(db.prepare(sql).get(...clean(params)));
    },
    async all(sql, ...params) {
      return db.prepare(sql).all(...clean(params)).map(plain);
    },
    async run(sql, ...params) {
      const r = db.prepare(sql).run(...clean(params));
      return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        for (const [sql, params = []] of statements) db.prepare(sql).run(...clean(params));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close() {
      db.close();
    },
  };
}
