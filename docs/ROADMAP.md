# What's next, decisions to check, and open questions

## Still worth building

1. **Your move order.** In October and November 2026 you mostly answered
   1.d4 with 1...d5 or 1...d6, not 1...Nf6. Either drill 1...Nf6 (the course
   as built), or add a 1...d6 chapter (it allows 2.e4 and a Pirc).
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

1. **1...Nf6 or 1...d6?** (see above)
2. **Should the endgame site also log you in automatically?** Today the
   accounts are shared but each site has its own login session. One sign-in
   for both needs a small change and redeploy of the endgame site (a cookie
   for `.garlick.ca` and shared sessions).
3. **Other family members:** who plays the King's Indian, and what are their
   chess.com usernames? I can build their decks.
4. **A Lichess token** would show what 1000-1400 players actually play in each
   position (better surprise mistakes than Stockfish's guesses). You said no
   for now; it's easy to add later.
5. **The endgame leaderboard** lists every account in the shared users table,
   so someone who signs up here also appears there with 0 points. Fine, or
   should the endgame board hide people who never played endgames?
