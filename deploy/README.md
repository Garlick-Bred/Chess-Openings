# Built Worker bundle

`worker.js` is the Cloudflare Worker: the API (`server/`) plus the built
client and course data embedded as strings. It contains no secrets. It imports
one data module, the Stockfish WebAssembly file for sparring rounds
(`stockfish-19-lite-single.wasm.bin`). Its bytes are committed here as base64
(`*.b64`), with the size and SHA-256 in `modules.json`.

Rebuild after any change with `npm run bundle`, commit, push, and deploy
through the Cloudflare connector:

1. Fetch the files at the exact commit with Browser Rendering:
   `raw.githubusercontent.com/Garlick-Bred/Chess-Openings/<sha>/deploy/worker.js`
   and each `deploy/<module>.b64` named in `modules.json`.
2. Check worker.js's SHA-256 and length. Decode each module from base64 and
   check its bytes against `modules.json`.
3. `PUT /accounts/{id}/workers/scripts/garlick-openings` as a module upload:
   `worker.js` (`application/javascript+module`), plus each module under its
   `name` as `application/octet-stream` (a data module). Settings:
   * `compatibility_date: 2025-09-01`
   * D1 binding `DB` → `garlick-openings` (this site's data)
   * D1 binding `AUTH_DB` → `garlick-endgames` (the shared family accounts)
   * plain-text binding `COOKIE_DOMAIN` = `garlick.ca` (one sign-in; the
     endgame Worker has the same)
   * `keep_bindings: ["secret_text"]`, so secrets set in the dashboard
     (`Lichess_token`, `INVITE_CODE`) survive the upload
4. The custom domain is `openings.garlick.ca` (a Workers custom domain).

The schema is created on the first request (`ensureSchema`), so no
migration step is needed.
