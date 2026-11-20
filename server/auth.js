// Accounts: PBKDF2-SHA256 password hashing (Web Crypto, so it runs in Node and
// in Cloudflare Workers), random session tokens in an HttpOnly cookie, and a
// brute-force lockout stored in the database.
//
// Same scheme as the endgame site, and one sign-in for both: users *and*
// sessions live in the shared account database (the endgame site's), and the
// session cookie is shared across *.garlick.ca (COOKIE_DOMAIN=garlick.ca).
// The login lockout stays in this site's own database.
const SESSION_DAYS = 60;
// Cloudflare Workers allow at most 100,000 PBKDF2 iterations.
const ITERATIONS = 100_000;
export const COOKIE = 'garlick_session';
export const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

const enc = new TextEncoder();
const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iter, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'pbkdf2') return false;
  const expected = fromB64(hashB64);
  const actual = await derive(password, fromB64(saltB64), Number(iter));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function randomToken() {
  return toB64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createSession(store, userId) {
  const token = randomToken();
  const now = Date.now();
  await store.run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', token, userId, now, now + SESSION_DAYS * 86400e3);
  return token;
}

/** The signed-in user, from the shared account database (sessions and users). */
export async function sessionUser(authStore, token) {
  if (!token) return null;
  return authStore.get('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?', token, Date.now());
}

export async function destroySession(store, token) {
  if (token) await store.run('DELETE FROM sessions WHERE token = ?', token);
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/**
 * The cookie domain for this request: the configured shared domain when the
 * site is served under it, or null (host-only) elsewhere (workers.dev, localhost).
 */
export function cookieDomain(host, configured) {
  const d = String(configured ?? '').replace(/^\./, '').toLowerCase();
  const h = String(host ?? '').toLowerCase();
  if (!d) return null;
  return h === d || h.endsWith(`.${d}`) ? d : null;
}

export function sessionCookie(token, { secure, domain = null }) {
  const attrs = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_DAYS * 86400}`];
  if (domain) attrs.push(`Domain=${domain}`);
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearCookie({ secure, domain = null, name = COOKIE }) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${domain ? `; Domain=${domain}` : ''}${secure ? '; Secure' : ''}`;
}

// 8 failed logins for a username lock it for 5 minutes.
export async function throttled(store, key) {
  const row = await store.get('SELECT until FROM login_failures WHERE key = ?', key);
  return !!row && row.until > Date.now();
}

export async function recordFailure(store, key) {
  const row = (await store.get('SELECT count FROM login_failures WHERE key = ?', key)) ?? { count: 0 };
  const count = row.count + 1;
  const locked = count >= 8;
  await store.run(
    `INSERT INTO login_failures (key, count, until) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET count = excluded.count, until = excluded.until`,
    key,
    locked ? 0 : count,
    locked ? Date.now() + 5 * 60e3 : 0,
  );
}

export async function clearFailures(store, key) {
  await store.run('DELETE FROM login_failures WHERE key = ?', key);
}
