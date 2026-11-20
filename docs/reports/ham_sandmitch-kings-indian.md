# King's Indian report: ham_sandmitch (chess.com)

**Data:** every game as Black where White didn't open 1.e4 and you played
...Nf6, ...g6 and ...Bg7 within your first eight moves. That is **269 games**
(86% of your Black games against anything but 1.e4), from 2018 to November
2026: 219 blitz, 21 bullet, 15 daily, 14 rapid; 157 of them in the last two
years.

**Method:**
* Every game was replayed with python-chess.
* The first 40 plies (20 moves) were evaluated with Stockfish 16 (300k nodes
  per position).
* Every move was compared with the Lichess masters database ("left theory" =
  a move with fewer than 5 master games).
* A mistake is a drop of 20% or more in winning chances (Lichess's "mistake").

The scripts are in [analysis/](../../analysis/).

## Headlines

1. **Your opponents almost never play the main-line King's Indian.** Only 27
   games had White's classic c4, Nc3 and e4 centre. The London (50 games), the
   Colle and 1.e3 set-ups (51), c4 without e4 (34) and the Jobava/Barry (21)
   are what you meet. Your opponents leave master theory first in **70%** of
   games, usually by **move 4**.
2. **The opening isn't losing you games; the move into the middlegame is.**
   * The position after move 10 is level on average (−0.14).
   * Your first mistake comes at a median of **move 11**: by move 10 in 33% of
     games, by move 20 in 79%, peaking at moves 8-12.
3. **Three habits cause most first mistakes** (213 games):
   * **Missed captures (32%):** the best move took something you didn't take.
     Example: 1.d4 Nf6 2.e4?! (and 1.Nf3 Nf6 2.e4?!), answered 2...g6 or
     2...d6 instead of 2...Nxe4 (+0.7).
   * **A slow move when a pawn break was ready (20%):** ...b6, ...a6, ...Qd7
     or ...Bd7 where Stockfish wanted ...e5, ...c5 or ...d5.
   * **Kingside pawn and king moves (14%):** ...h6, ...Kh7, ...h5, ...g5,
     which Stockfish almost never wants.
4. **One trap twice, both times checkmated:** 1.d4 Nf6 2.Nc3 g6 3.Bf4 Bg7
   4.e4 d6 5.e5 dxe5? 6.dxe5 Qxd1+ 7.Rxd1 Nh5 8.Nd5! Nxf4?? 9.Nxc7+ Kf8
   10.Rd8#.
   * The right answer to 5.e5 is **5...Nh5!**, hitting the bishop.
   * After 6.Be3 (or 6.Bd2), ...dxe5 then wins the e5 pawn: +1.0 for Black.
5. **Your opponents hand you chances.** In 230 of 269 games White made a
   mistake in the first 20 moves.
   * Your reply kept at least half of the gift in only **59%** of them, and
     was Stockfish's best move in 40%.
   * Against outright blunders you cashed in 67 of 114 times; 26 of the
     missed ones were simply free material.
6. **The clock.** By move 15 of a 5-minute game you have used a median 29% of
   your time, against 18% for your opponents. You were behind on the clock
   in 173 of 211 games. (The endgame report found time was your biggest
   endgame leak too.)
7. **Your move order changed recently.** In October and November 2026 you
   mostly played 1...d5 (12 games) and 1...d6 (8 games) against 1.d4, and
   1...Nf6 only twice. The course uses 1...Nf6, and the Games page recognises
   transpositions from 1...d6.

## By system

| White's system | Games | Your score | Mistake by move 10 | Median first mistake | Eval after move 10 |
|---|---|---|---|---|---|
| London (Bf4) | 50 | 54% | 24% | 12 | −0.12 |
| Colle / e3 systems | 35 | 37% | 29% | 11 | −0.12 |
| King's Indian: c4 without e4 | 34 | 60% | 32% | 11 | +0.06 |
| King's Indian main: Classical (Nf3) | 21 | 45% | 19% | 12 | −0.52 |
| Jobava / Barry (Nc3 + Bf4) | 21 | 48% | **57%** | **9** | −0.62 |
| 1.e3 systems | 16 | 44% | 44% | 9 | +0.03 |
| Réti / King's Indian Attack (1.Nf3) | 13 | 69% | 39% | 10 | +0.46 |
| English (1.c4) | 12 | 71% | 17% | 14 | −0.64 |
| e4 + Nc3 (Pirc / 150 style) | 12 | 67% | 25% | 12 | −0.75 |
| Fianchetto without c4 | 10 | 45% | 30% | 13 | −0.27 |
| Torre (Nf3 + Bg5) | 9 | 56% | **67%** | 10 | −0.79 |
| Nimzo-Larsen (1.b3) | 9 | 50% | 33% | 12 | +0.42 |
| Trompowsky (2.Bg5) | 5 | 80% | 40% | 10 | +0.36 |
| King's Indian: Fianchetto (c4 + g3) | 5 | 20% | 0% | 13 | −0.36 |
| Other main lines (Four Pawns, Sämisch, Averbakh...) | 6 | 17% | 50% | 11 | – |

"Eval after move 10" is Stockfish's evaluation from your side (negative means
White is better).

## What the site does about it

| Finding | In the site |
|---|---|
| You meet the London and Colle far more than the main lines | Chapters in that order; the plan cards say what to do against each |
| Mistakes start at moves 8-12, around the plan | Lines run 8-12 moves and end with a plan question; every note names a principle |
| Missed captures, and missed punishments | Surprise mistakes in practice runs; 203 opponent mistakes from your games to punish; the "Checks, captures, threats" principle |
| Slow moves instead of breaks; kingside pawn moves | Mistake explanations name *Pawn breaks* or *Leave your pawn shield alone*; authored notes on ...h6, ...Bg4, ...b6 |
| The Jobava trap | A line built around 5...Nh5!, with the trap as an authored "wrong move" note |
| 348 positions where you went wrong | A personal deck, spaced like the lines |
| The clock | Timed check-ups for graduated lines (5 s a move by default) |
