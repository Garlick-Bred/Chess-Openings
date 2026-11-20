# Built Worker bundle

`worker.js` is the complete Cloudflare Worker: the API (`server/`) plus the
built client and course data embedded as strings. It contains no secrets.

Rebuild after any change with `npm run bundle`, commit, push, and deploy
through the Cloudflare connector:

1. Fetch the file at the exact commit with Browser Rendering:
   `raw.githubusercontent.com/Garlick-Bred/Chess-Openings/<sha>/deploy/worker.js`.
2. Check its SHA-256 and length.
3. `PUT /accounts/{id}/workers/scripts/garlick-openings` as a module upload with:
   * `compatibility_date: 2025-09-01`
   * D1 binding `DB` → `garlick-openings` (this site's data)
   * D1 binding `AUTH_DB` → `garlick-endgames` (the shared family accounts)
   * `keep_bindings: ["secret_text"]`, so secrets set in the dashboard
     (`LICHESS_TOKEN`, `INVITE_CODE`) survive the upload
4. The custom domain is `openings.garlick.ca` (a Workers custom domain).

The schema is created on the first request (`ensureSchema`), so no
migration step is needed.
