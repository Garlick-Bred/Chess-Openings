# What's next, decisions to check, and open questions

## Still worth building

1. **A 1.e4 repertoire with 1...d6 (the Pirc)**, the King's Indian's cousin,
   would reuse most of the same ideas. (Decided: against 1.d4 the course starts
   1...Nf6, and the first lesson explains why not 1...d5 or 1...d6.)
2. **More of your own positions.** The decks come from games up to November
   2026. A button (or a weekly job) could re-run the analysis on new games.
   That needs Stockfish, so it's offline today; Stockfish in the browser
   (WebAssembly) could do it on your phone.
3. **Lines deeper where you go wrong.** The Jobava/Barry and Torre chapters
   have the earliest mistakes; a second line against 5.Qd2 (with ...c5) and
   one against the Torre's early e4 would help.
4. **A "play it out" mode:** after a line ends, play the middlegame plan for a
   few moves against Stockfish in the browser.
5. **Other family members' decks.** Each person with a chess.com username
   can get their own decks and insights by running the analysis for them
   (`analysis/README.md`).
6. **White repertoire and other openings:** the course format
   (`course/*.js`) and build already support more courses; the site
   currently shows one.
7. **Password reset by an admin**, as on the endgame site.

## Decisions I made that you might want to change

| Decision | Current choice | Alternatives |
|---|---|---|
| Against the London | ...c5, ...cxd4, then ...e5 or ...Qb6 | The classic ...Nbd7 and ...e5 set-up |
| Against the Classical main line | 7...Nc6 (Mar del Plata) | 7...Na6 or 7...exd4, less theory |
| Against 2.Nc3 lines | Keep the King's Indian set-up (Stockfish prefers 2...d5 by about 0.8) | A ...d5 system against Nc3 |
| Graduation | 3 clean days; check-ups at 3/7/14/30/60 days | More or fewer days |
| Surprise rate | 25% of practice runs of known lines | Settings: never, rarely, sometimes, often |
| Check-up clock | 5 s a move | Settings: off, 3, 8 or 12 s |
| "Good but not your repertoire" | Within 0.04 winning chances of the repertoire move, or a master move within 0.08 | Stricter: only the repertoire move counts |
| New lines | Lesson first; the replay after it counts as the day's test (unrated) | Require a separate test the next day |
| Deck size | All 551 positions, 6 a day | Only the most recent, or only first mistakes |
| Sign-ups | Open, and new accounts are created in the shared account database | An invite code |
| The path | 10 stages a world; 100 points a stage in world 1, +50 per world | Faster or slower; more stages per world |
| Speed par | Thinking time 6 s a move for lines (full bonus at 3 s), 40 s for positions from your games | Tighter for blitz practice |

## Open questions

1. **Family members:** on hold for now. Their decks can be built from their
   chess.com games whenever you like.
2. **The endgame leaderboard** lists every account in the shared users table,
   so someone who signs up here also appears there with 0 points. Fine, or
   should the endgame board hide people who never played endgames?
3. **Club statistics in the course build:** the live site now uses your
   Lichess token for "club players 1000-1600" in lessons. To also pick
   surprise mistakes from what club players really play, the token would need
   to be added to the cloud environment's network secrets for
   `explorer.lichess.ovh`.

## Done since the first version

* One sign-in for both Garlick sites (a `garlick_session` cookie on
  `.garlick.ca`, sessions in the endgame site's database).
* The Garlick Path (worlds and stages), stars, combos, speed and difficulty
  points.
* Club-player statistics in lessons (Worker secret `Lichess_token` or
  `LICHESS_TOKEN`).
