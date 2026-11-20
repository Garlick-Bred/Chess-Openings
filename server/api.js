// The JSON API as a standard fetch handler: (Request) -> Response, or null for
// non-API paths. Runs unchanged in Cloudflare Workers (with D1) and in the
// local Node server (with node:sqlite).
//
// Two stores: `store` is this site's database (profiles, sessions, progress);
// `authStore` holds the family accounts shared with the endgame site. Without
// a separate account database, both are the same store.
import * as auth from './auth.js';
import { ensureSchema } from './schema.js';
import { lookup, validFen } from './explorer.js';
import { recentGames, validUsername } from './chesscom.js';
import {
  recordAttempt,
  getProgress,
  getTotals,
  getDay,
  getAchievements,
  getStats,
  getLeaderboard,
  ensureProfile,
  applyShields,
  parseSettings,
  deckFor,
  httpError,
} from './game.js';
import { RATING_SOURCES, validRating } from '../shared/cloves.js';
import { startingRating } from '../shared/rating.js';
import { DEFAULT_MOVE_SECONDS } from '../shared/curriculum.js';

export const AVATARS = ['♞', '♛', '♜', '♝', '♚', '🦉', '🐢', '🦊', '🐼', '🐸', '🦁', '🐙', '🌶️', '🍄', '🌟', '☕'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY = 64 * 1024;
const MOVE_SECONDS = [0, 3, 5, 8, 12];
const SURPRISE_RATES = [0, 0.15, 0.25, 0.4];

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function publicUser(u, profile) {
  const s = parseSettings(profile);
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatar: u.avatar,
    color: u.color,
    rating: u.rating ?? null,
    ratingSource: u.rating_source ?? null,
    openingRating: profile?.op_rating != null ? Math.round(profile.op_rating) : null,
    openingGames: profile?.op_games ?? 0,
    hasDeck: !!deckFor(profile),
    settings: {
      sound: true,
      coordinates: true,
      chesscom: '',
      moveSeconds: DEFAULT_MOVE_SECONDS,
      surpriseRate: 0.25,
      ...s,
    },
  };
}

/**
 * @param {{ store: object, authStore?: object, env?: Record<string,string> }} opts
 *   env.INVITE_CODE    - if set, sign-up requires it
 *   env.COOKIE_SECURE  - "1" forces Secure cookies (otherwise https requests get them)
 *   env.EXPLORER_URL   - alternative masters explorer endpoint
 *   env.LICHESS_TOKEN  - Lichess personal token: unlocks club-player statistics
 */
export function createApi({ store, authStore = store, env = {} }) {
  const inviteCode = env.INVITE_CODE ?? '';
  const ownsUsers = authStore === store;
  let ready = null;

  async function body(request) {
    const len = Number(request.headers.get('content-length') ?? 0);
    if (len > MAX_BODY) throw httpError(413, 'Request too large');
    const text = await request.text();
    if (text.length > MAX_BODY) throw httpError(413, 'Request too large');
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw httpError(400, 'Bad JSON');
    }
  }

  return async function handle(request, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return null;
    ready ??= ensureSchema(store, { ownsUsers }).catch((e) => {
      ready = null;
      throw e;
    });
    try {
      await ready;
      return await route(request, url, ctx);
    } catch (e) {
      const status = e.status ?? 500;
      if (status >= 500) console.error(e);
      return json({ error: status >= 500 ? `Server error: ${e.message}` : e.message }, status);
    }
  };

  async function route(request, url, ctx) {
    const method = request.method;
    const path = url.pathname;
    const secure = env.COOKIE_SECURE === '1' || url.protocol === 'https:';
    const token = auth.parseCookies(request.headers.get('cookie'))[auth.COOKIE];
    const day = DAY_RE.test(url.searchParams.get('day') ?? '') ? url.searchParams.get('day') : new Date().toISOString().slice(0, 10);
    const waitUntil = ctx?.waitUntil ? (p) => ctx.waitUntil(p) : undefined;
    const needUser = async () => {
      const u = await auth.sessionUser(store, authStore, token);
      if (!u) throw httpError(401, 'Please log in');
      return { user: u, profile: await ensureProfile(store, u) };
    };

    if (method === 'GET' && path === '/api/health') return json({ ok: true });
    if (method === 'GET' && path === '/api/config') {
      return json({ inviteRequired: !!inviteCode, avatars: AVATARS, ratingSources: RATING_SOURCES, moveSeconds: MOVE_SECONDS, surpriseRates: SURPRISE_RATES, sharedAccounts: !ownsUsers, clubStats: !!env.LICHESS_TOKEN });
    }

    if (method === 'POST' && path === '/api/auth/register') {
      const b = await body(request);
      if (inviteCode && String(b.inviteCode ?? '').trim() !== inviteCode) throw httpError(403, 'That family invite code is not right.');
      if (!auth.USERNAME_RE.test(b.username ?? '')) throw httpError(400, 'Username: 3-20 letters, numbers, _ or -');
      if (typeof b.password !== 'string' || b.password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
      const name = String(b.displayName || b.username).trim().slice(0, 24);
      if (await authStore.get('SELECT 1 x FROM users WHERE username = ?', b.username)) {
        throw httpError(409, 'That username is taken. If it’s yours from the endgame site, log in with the same password.');
      }
      const rating = b.rating == null || b.rating === '' ? null : validRating(b.rating);
      if (b.rating != null && b.rating !== '' && rating == null) throw httpError(400, 'Rating should be a number between 100 and 3000');
      const source = RATING_SOURCES[b.ratingSource] ? b.ratingSource : rating ? 'guess' : null;
      const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
      // Same columns the endgame site writes, so the account works there too.
      const r = await authStore.run(
        'INSERT INTO users (username, display_name, password_hash, avatar, rating, rating_source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        b.username,
        name,
        await auth.hashPassword(b.password),
        avatar,
        rating,
        source,
        Date.now(),
      );
      const userId = r.lastId ?? (await authStore.get('SELECT id FROM users WHERE username = ?', b.username)).id;
      await ensureProfile(store, { id: userId, rating });
      const t = await auth.createSession(store, userId);
      return json({ ok: true }, 200, { 'Set-Cookie': auth.sessionCookie(t, { secure }) });
    }

    if (method === 'POST' && path === '/api/auth/login') {
      const b = await body(request);
      const key = String(b.username ?? '').toLowerCase();
      if (await auth.throttled(store, key)) throw httpError(429, 'Too many attempts. Try again in a few minutes.');
      const user = await authStore.get('SELECT * FROM users WHERE username = ?', String(b.username ?? ''));
      if (!user || !(await auth.verifyPassword(String(b.password ?? ''), user.password_hash))) {
        await auth.recordFailure(store, key);
        throw httpError(401, 'Wrong username or password');
      }
      await auth.clearFailures(store, key);
      await ensureProfile(store, user);
      const t = await auth.createSession(store, user.id);
      return json({ ok: true }, 200, { 'Set-Cookie': auth.sessionCookie(t, { secure }) });
    }

    if (method === 'POST' && path === '/api/auth/logout') {
      await auth.destroySession(store, token);
      return json({ ok: true }, 200, { 'Set-Cookie': auth.clearCookie({ secure }) });
    }

    if (method === 'GET' && path === '/api/me') {
      const { user, profile } = await needUser();
      await applyShields(store, user.id, day);
      const [totals, today, progress] = await Promise.all([getTotals(store, user.id, day), getDay(store, user.id, day), getProgress(store, user.id)]);
      return json({ user: publicUser(user, profile), totals, today, progress });
    }

    if (method === 'PUT' && path === '/api/me') {
      const { user, profile } = await needUser();
      const b = await body(request);
      const settings = { ...parseSettings(profile) };
      if (typeof b.sound === 'boolean') settings.sound = b.sound;
      if (typeof b.coordinates === 'boolean') settings.coordinates = b.coordinates;
      if (typeof b.chesscom === 'string') {
        const cc = b.chesscom.trim();
        if (cc && !validUsername(cc)) throw httpError(400, 'That doesn’t look like a chess.com username');
        settings.chesscom = cc.slice(0, 40);
      }
      if (MOVE_SECONDS.includes(b.moveSeconds)) settings.moveSeconds = b.moveSeconds;
      if (SURPRISE_RATES.includes(b.surpriseRate)) settings.surpriseRate = b.surpriseRate;
      // Shared account fields (also used by the endgame site).
      const name = typeof b.displayName === 'string' && b.displayName.trim() ? b.displayName.trim().slice(0, 24) : user.display_name;
      const avatar = AVATARS.includes(b.avatar) ? b.avatar : user.avatar;
      const color = /^#[0-9a-fA-F]{6}$/.test(b.color ?? '') ? b.color : user.color;
      let rating = user.rating;
      let source = user.rating_source;
      if ('rating' in b) {
        rating = b.rating == null || b.rating === '' ? null : validRating(b.rating);
        if (b.rating != null && b.rating !== '' && rating == null) throw httpError(400, 'Rating should be a number between 100 and 3000');
      }
      if (RATING_SOURCES[b.ratingSource]) source = b.ratingSource;
      const writesAuth = [];
      if (typeof b.newPassword === 'string' && b.newPassword) {
        if (b.newPassword.length < 8) throw httpError(400, 'Password must be at least 8 characters');
        if (!(await auth.verifyPassword(String(b.currentPassword ?? ''), user.password_hash))) throw httpError(403, 'Current password is wrong');
        writesAuth.push(['UPDATE users SET password_hash = ? WHERE id = ?', [await auth.hashPassword(b.newPassword), user.id]]);
      }
      if (name !== user.display_name || avatar !== user.avatar || color !== user.color || rating !== user.rating || source !== user.rating_source) {
        writesAuth.push(['UPDATE users SET display_name = ?, avatar = ?, color = ?, rating = ?, rating_source = ? WHERE id = ?', [name, avatar, color, rating, source, user.id]]);
      }
      if (writesAuth.length) await authStore.batch(writesAuth);
      const writes = [['UPDATE profiles SET settings = ? WHERE user_id = ?', [JSON.stringify(settings), user.id]]];
      // No rated attempts yet: the opening rating restarts from the new chess rating.
      if (rating !== user.rating && !profile.op_games) writes.push(['UPDATE profiles SET op_rating = ? WHERE user_id = ?', [startingRating(rating), user.id]]);
      await store.batch(writes);
      const [u2, p2] = await Promise.all([authStore.get('SELECT * FROM users WHERE id = ?', user.id), store.get('SELECT * FROM profiles WHERE user_id = ?', user.id)]);
      return json({ user: publicUser(u2, p2) });
    }

    if (method === 'POST' && path === '/api/attempts') {
      const { user } = await needUser();
      return json(await recordAttempt(store, user, await body(request)));
    }
    if (method === 'GET' && path === '/api/stats') return json(await getStats(store, (await needUser()).user.id, day));
    if (method === 'GET' && path === '/api/achievements') return json(await getAchievements(store, (await needUser()).user.id));
    if (method === 'GET' && path === '/api/leaderboard') {
      await needUser();
      return json(await getLeaderboard(store, authStore, day));
    }

    if (method === 'GET' && path === '/api/explorer') {
      await needUser();
      const fen = url.searchParams.get('fen') ?? '';
      if (!validFen(fen)) throw httpError(400, 'Bad FEN');
      try {
        const db = url.searchParams.get('db') === 'club' ? 'club' : 'masters';
        return json(await lookup(store, fen, env.EXPLORER_URL, { waitUntil, db, token: env.LICHESS_TOKEN ?? '' }), 200, { 'Cache-Control': 'private, max-age=86400' });
      } catch (e) {
        if (e.status === 503) throw httpError(503, 'Club statistics need a Lichess token on the server.');
        throw httpError(502, `Opening explorer unavailable: ${e.message}`);
      }
    }

    if (method === 'GET' && path === '/api/games') {
      const { profile } = await needUser();
      const username = url.searchParams.get('username') || parseSettings(profile).chesscom;
      if (!validUsername(username)) throw httpError(400, 'Add your chess.com username in Settings first');
      try {
        return json(await recentGames(store, username, { waitUntil }));
      } catch (e) {
        throw httpError(e.status ?? 502, e.status ? e.message : `chess.com unavailable: ${e.message}`);
      }
    }

    throw httpError(404, 'Not found');
  }
}
