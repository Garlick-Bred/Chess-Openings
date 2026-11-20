// Caching proxy for the Lichess masters opening explorer
// (explorer.lichess.ovh/masters), using the same pattern as the endgame
// site's tablebase proxy: edge cache (Workers only), then the database, then
// Lichess, with cache writes after the response and no retries on 429.
// Lichess's "lichess players" database needs an account token, so only the
// masters database is used.
const DEFAULT_ENDPOINT = 'https://explorer.lichess.ovh/masters';
const FEN_RE = /^([pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8} [wb] (-|[KQkq]{1,4}) (-|[a-h][36])( \d+ \d+)?$/;
const inflight = new Map();
const MAX_AGE_DAYS = 60;

export function validFen(fen) {
  return FEN_RE.test(fen);
}

function slim(d) {
  return {
    total: (d.white ?? 0) + (d.draws ?? 0) + (d.black ?? 0),
    white: d.white ?? 0,
    draws: d.draws ?? 0,
    black: d.black ?? 0,
    opening: d.opening ? { eco: d.opening.eco, name: d.opening.name } : null,
    moves: (d.moves ?? []).slice(0, 10).map((m) => ({ san: m.san, uci: m.uci, white: m.white, draws: m.draws, black: m.black, rating: m.averageRating })),
  };
}

const edgeCache = () => (typeof caches !== 'undefined' && caches.default ? caches.default : null);
const edgeKey = (key) => new Request(`https://explorer-cache.garlick/${encodeURIComponent(key)}`);

export async function lookup(store, fen, endpoint = DEFAULT_ENDPOINT, { waitUntil } = {}) {
  const parts = fen.split(' ');
  const key = parts.slice(0, 4).join(' ');
  const background = (p) => (waitUntil ? waitUntil(p.catch(() => undefined)) : p.catch(() => undefined));
  const edge = edgeCache();
  if (edge) {
    const hit = await edge.match(edgeKey(key)).catch(() => null);
    if (hit) return hit.json();
  }
  const row = await store.get('SELECT data, fetched_at FROM explorer_cache WHERE fen = ?', key);
  if (row && Date.now() - row.fetched_at < MAX_AGE_DAYS * 86400e3) {
    if (edge) background(edge.put(edgeKey(key), new Response(row.data, { headers: { 'Cache-Control': 'public, max-age=604800' } })));
    return JSON.parse(row.data);
  }
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const url = `${endpoint ?? DEFAULT_ENDPOINT}?fen=${encodeURIComponent(`${key} 0 1`)}&moves=10&topGames=0`;
    const res = await fetch(url, { headers: { 'User-Agent': 'garlick-openings/0.1 (family openings trainer)' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`explorer HTTP ${res.status}`);
    const data = slim(await res.json());
    const text = JSON.stringify(data);
    background(store.run('INSERT OR REPLACE INTO explorer_cache (fen, data, fetched_at) VALUES (?, ?, ?)', key, text, Date.now()));
    if (edge) background(edge.put(edgeKey(key), new Response(text, { headers: { 'Cache-Control': 'public, max-age=604800' } })));
    return data;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}
