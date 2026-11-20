# Reusing this codebase

Garlick Openings was built from Garlick Endgames
(`garlick-bred/chess-app`, branch `claude/chess-endgame-puzzle-app-f9m906`)
following that repo's REUSE.md. For a third sibling, start from whichever is
closer. This file says what this repo added.

## Copied unchanged from the endgame site

The storage adapters (`server/store-node.js`, `worker/store-d1.js`), the
schema mechanism, auth (PBKDF2, sessions, lockout), the API skeleton, the Node
and Worker servers, build + deploy scripts, the app shell (hash router, auth
gate, reload after deploys, bottom tab bar), account screens, styles, sounds,
the board, the Garlick bulb, golden clove, streak shields
(`shared/streak.js`), the result screen and the family board.

## New here, reusable for another trainer

| Piece | Files | Notes |
|---|---|---|
| Shared family accounts across sites | `server/api.js` (`authStore`), `server/auth.js`, `worker/index.js` | Bind the first site's D1 as `AUTH_DB`; keep sessions, profiles and everything else in the new site's own D1. New accounts are written with the first site's columns |
| A course format | `course/*.js`, `shared/pgn.js` | Annotated PGN: `{#principle note}` after a move, `(variation {why})` for tempting wrong moves. Notes are stored per position, so transpositions share them |
| Build-time engine judging | `scripts/build-course.mjs`, `scripts/lib/uci.mjs` | Stockfish evaluates every legal move once; the site judges moves with no engine. Cached in `scripts/.cache` |
| Move judging + explanations | `shared/judge.js`, `shared/explain.js` | Lichess winning-chance thresholds; concrete reasons from engine lines; principle selection rules |
| Line-level spaced repetition | `shared/curriculum.js` | First run of the day is the test; graduation after N days; timed check-ups; deck positions interleaved |
| Personal decks from chess.com games | `analysis/` | Mistake and punish positions with every legal move evaluated |
| Masters explorer proxy | `server/explorer.js` | Same cache pattern as the tablebase proxy |
| chess.com recent games | `server/chesscom.js`, `compareWithRepertoire` in `client/src/course.ts` | Transposition-aware comparison |

## Deploying (what worked)

* Worker `garlick-openings`, D1 `garlick-openings` (DB) plus `garlick-endgames`
  (AUTH_DB), custom domain `openings.garlick.ca`, `compatibility_date`
  2025-09-01.
* There is no working Cloudflare API token in the cloud environment, so
  deploys go through the Cloudflare connector. Browser Rendering fetches the
  committed `deploy/worker.js` from GitHub at the commit SHA, then a multipart
  `PUT` uploads it.
* Node's `fetch` ignores `HTTPS_PROXY` unless it runs with
  `NODE_USE_ENV_PROXY=1`. The course build and local server need it in the
  cloud environment.
* The Lichess club-player explorer needs an OAuth token; the masters explorer
  answered without one (November 2026).

## Lessons learned

* Lines that transpose must agree: the build rejects two different Black moves
  for the same position.
* Surprise mistakes need a "natural move" filter, or Stockfish's biggest
  blunders (pieces dropped for free) crowd out the instructive ones.
* Store engine lines only for plausible moves; the full data was over 1 MB.
  Fall back to a simple "what's hanging" check for the rest.
* Phones: put move feedback above the title on narrow screens (flex `order`),
  or it lands below the fold.
