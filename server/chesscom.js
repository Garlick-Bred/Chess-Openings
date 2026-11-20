// Recent games from the public chess.com API (no key needed), slimmed down
// to what the "Your games" page needs: who played what, and the first moves.
// The comparison with your repertoire happens in the browser, which has the
// full course data. Cached for 10 minutes per username.
import { Chess } from 'chess.js';

const USER_RE = /^[a-zA-Z0-9_-]{2,40}$/;
const TTL = 10 * 60e3;
const MONTHS = 2;
const PLIES = 40;

export function validUsername(u) {
  return USER_RE.test(u ?? '');
}

function movesFromPgn(pgn) {
  // The PGN's movetext, without comments ({[%clk ...]}) and move numbers.
  const body = pgn.split(/\n\n/).slice(1).join(' ').replace(/\{[^}]*\}/g, ' ').replace(/\d+\.(\.\.)?/g, ' ');
  const g = new Chess();
  const out = [];
  for (const tok of body.split(/\s+/)) {
    if (!tok || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
    try {
      out.push(g.move(tok).san);
    } catch {
      break;
    }
    if (out.length >= PLIES) break;
  }
  return out;
}

export async function recentGames(store, username, { waitUntil, fetchImpl = fetch } = {}) {
  const user = username.toLowerCase();
  const row = await store.get('SELECT data, fetched_at FROM games_cache WHERE username = ?', user);
  if (row && Date.now() - row.fetched_at < TTL) return JSON.parse(row.data);
  const headers = { 'User-Agent': 'garlick-openings/0.1 (family openings trainer)' };
  const a = await fetchImpl(`https://api.chess.com/pub/player/${user}/games/archives`, { headers, signal: AbortSignal.timeout(8000) });
  if (a.status === 404) throw Object.assign(new Error('No chess.com player with that username'), { status: 404 });
  if (!a.ok) throw new Error(`chess.com HTTP ${a.status}`);
  const archives = ((await a.json()).archives ?? []).slice(-MONTHS);
  const games = [];
  for (const url of archives.reverse()) {
    const r = await fetchImpl(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!r.ok) continue;
    for (const g of (await r.json()).games ?? []) {
      if (g.rules !== 'chess' || !g.pgn) continue;
      const white = g.white.username.toLowerCase() === user;
      const me = white ? g.white : g.black;
      const opp = white ? g.black : g.white;
      games.push({
        url: g.url,
        end: g.end_time,
        tc: g.time_class,
        color: white ? 'w' : 'b',
        result: me.result,
        rating: me.rating,
        opponent: opp.username,
        oppRating: opp.rating,
        moves: movesFromPgn(g.pgn),
      });
    }
  }
  games.sort((x, y) => y.end - x.end);
  const data = { username: user, fetchedAt: Date.now(), games: games.slice(0, 60) };
  const p = store.run('INSERT OR REPLACE INTO games_cache (username, data, fetched_at) VALUES (?, ?, ?)', user, JSON.stringify(data), Date.now());
  if (waitUntil) waitUntil(p.catch(() => undefined));
  else await p;
  return data;
}
