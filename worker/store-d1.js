// Store adapter for Cloudflare D1, matching server/store-node.js.
const clean = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));

export function createD1Store(d1) {
  const prep = (sql, params) => (params.length ? d1.prepare(sql).bind(...clean(params)) : d1.prepare(sql));
  return {
    async get(sql, ...params) {
      return (await prep(sql, params).first()) ?? null;
    },
    async all(sql, ...params) {
      return (await prep(sql, params).all()).results ?? [];
    },
    async run(sql, ...params) {
      const r = await prep(sql, params).run();
      return { changes: r.meta?.changes ?? 0, lastId: r.meta?.last_row_id ?? null };
    },
    async batch(statements) {
      if (statements.length) await d1.batch(statements.map(([sql, params = []]) => prep(sql, params)));
    },
  };
}
