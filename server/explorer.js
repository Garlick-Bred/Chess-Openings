// Caching proxy for the Lichess opening explorer, using the same pattern as
// the endgame site's tablebase proxy: edge cache (Workers only), then the
// database, then Lichess, with cache writes after the response.
//   db = 'masters': the masters database (no token needed)
//   db = 'club':    Lichess players rated 1000-1600, blitz and rapid. Lichess
//                   requires an account token for it: set the Worker secret
//                   LICHESS_TOKEN (any personal token, no scopes needed).
const DEFAULT_ENDPOINT = 'https://explorer.lichess.ovh/masters';
const CLUB_ENDPOINT = 'https://explorer.lichess.ovh/lichess';
export const CLUB_RATINGS = '1000,1200,1400,1600';
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

export async function lookup(store, fen, endpoint = DEFAULT_ENDPOINT, { waitUntil, db = 'masters', token = '' } = {}) {
  const parts = fen.split(' ');
  const pos = parts.slice(0, 4).join(' ');
  // Masters entries keep the plain position as their key; club ones are prefixed.
  const key = db === 'club' ? `club:${pos}` : pos;
  if (db === 'club' && !token) throw Object.assign(new Error('Club statistics need a Lichess token (Worker secret LICHESS_TOKEN)'), { status: 503 });
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
    const fenParam = encodeURIComponent(`${pos} 0 1`);
    const url =
      db === 'club'
        ? `${CLUB_ENDPOINT}?variant=standard&speeds=blitz,rapid&ratings=${CLUB_RATINGS}&fen=${fenParam}&moves=10&topGames=0&recentGames=0`
        : `${endpoint ?? DEFAULT_ENDPOINT}?fen=${fenParam}&moves=10&topGames=0`;
    const headers = { 'User-Agent': 'garlick-openings/0.1 (family openings trainer)' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw Object.assign(new Error(`explorer HTTP ${res.status}`), res.status === 401 ? { status: 503 } : {});
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
