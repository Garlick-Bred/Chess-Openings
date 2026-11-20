// Cloudflare Worker entry: the shared API on D1, plus the built client.
// The client files are embedded in the bundle by scripts/deploy-cloudflare.mjs
// (worker/assets.generated.js); if an ASSETS binding is configured instead
// (Wrangler "assets"), that is used.
import { createApi } from '../server/api.js';
import { createD1Store } from './store-d1.js';
import { ASSETS, BINARY } from './assets.generated.js';

let handle = null;
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};

function serveEmbedded(request) {
  const { pathname } = new URL(request.url);
  // Binary files (the Stockfish engine) are uploaded as separate data modules.
  const bin = BINARY?.[pathname];
  if (bin) {
    return new Response(bin.body, {
      headers: { 'Content-Type': bin.type, 'Cache-Control': 'public, max-age=31536000, immutable', ...SECURITY_HEADERS },
    });
  }
  const asset = ASSETS[pathname] ?? ASSETS['/index.html'];
  if (!asset) return new Response('Not found', { status: 404 });
  const immutable = (pathname.startsWith('/assets/') || pathname.startsWith('/engine/')) && ASSETS[pathname];
  return new Response(asset.body, {
    headers: {
      'Content-Type': asset.type,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...SECURITY_HEADERS,
    },
  });
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export default {
  async fetch(request, env, ctx) {
    // Always use HTTPS in production (session cookies are Secure there).
    const url = new URL(request.url);
    if (url.protocol === 'http:' && !LOCAL_HOSTS.has(url.hostname)) {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    // Cookies get the Secure flag whenever the request came in over HTTPS.
    // DB: this site's database. AUTH_DB: the endgame site's database, whose
    // users table holds the family accounts shared by both sites.
    handle ??= (() => {
      const store = createD1Store(env.DB);
      return createApi({
        store,
        authStore: env.AUTH_DB ? createD1Store(env.AUTH_DB) : store,
        env: {
          INVITE_CODE: env.INVITE_CODE ?? '',
          EXPLORER_URL: env.EXPLORER_URL,
          // Any capitalisation of LICHESS_TOKEN (the dashboard secret may be "Lichess_token").
          LICHESS_TOKEN: Object.entries(env).find(([k, v]) => /^lichess_?token$/i.test(k) && typeof v === 'string')?.[1] ?? '',
          COOKIE_DOMAIN: env.COOKIE_DOMAIN ?? '',
        },
      });
    })();
    const api = await handle(request, ctx);
    if (api) return api;
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return serveEmbedded(request);
  },
};
