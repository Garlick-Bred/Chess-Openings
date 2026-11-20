// Points and stars for every exercise, and the daily Garlick bulb. Pure
// functions so the server can recompute everything the client shows.
//
// Points move you along the Garlick Path (shared/path.js). They reward
// effort: finishing, harder challenges, clean play, speed and streaks. The
// opening rating (shared/rating.js) is separate and measures strength.

export const BULB_CLOVES = 5;

/** Full-bulb bonus: 50 points, +10 per day of your current streak (up to +100). */
export function bulbBonus(streakDays = 0) {
  return 50 + 10 * Math.min(10, Math.max(0, streakDays));
}

/** Base points: a line (or a sparring round) is worth more the more moves you play. */
export function basePoints({ kind, blackMoves = 6 }) {
  if (kind === 'line' || kind === 'spar') return 8 + 2 * blackMoves;
  if (kind === 'punish') return 15;
  return 12; // one of your own mistakes
}

/** Harder challenges are worth more: by the exercise's rating. */
export const DIFFICULTY = [
  { max: 950, name: 'Easy', mult: 1 },
  { max: 1150, name: 'Medium', mult: 1.25 },
  { max: 1300, name: 'Hard', mult: 1.5 },
  { max: Infinity, name: 'Expert', mult: 2 },
];
export function difficultyFor(rating) {
  return DIFFICULTY.find((d) => (rating ?? 1000) <= d.max);
}

/**
 * Thinking time per move for the full speed bonus is half of par or less;
 * at par or slower there is no speed bonus. Lines: par 6 s a move (blitz
 * pace). Sparring rounds: 12 s (the moves aren't all known). Positions from
 * your games: par 40 s.
 */
export const SPEED_PAR = { line: 6, spar: 12, deck: 40 };
export function speedFactor({ kind, thinkMs, userMoves }) {
  if (!userMoves || thinkMs == null) return 0;
  const par = kind === 'line' ? SPEED_PAR.line : kind === 'spar' ? SPEED_PAR.spar : SPEED_PAR.deck;
  const spm = thinkMs / 1000 / userMoves;
  return Math.max(0, Math.min(1, (par - spm) / (par / 2)));
}

/** Clean runs in a row (today) before this one add +10% each, up to +50%. */
export const MAX_COMBO = 5;

/**
 * Score a finished exercise.
 *
 * Completed   = base x difficulty (Easy 1, Medium 1.25, Hard 1.5, Expert 2)
 * Finished a line with misses = 40% of that (and one star)
 * Clean       = +25% with no misses and no hints
 * Speed       = up to +30%: full at half of par thinking time per move or less
 * Combo       = +10% for each clean run in a row before this one today (max +50%)
 * Punished    = +50% for cashing in on a surprise mistake; in a sparring
 *               round +30% for each slip of White's you punished (up to 3)
 * Hints       = -10% per idea hint, -25% per move shown
 * Lesson replay = half (the line was just shown)
 * Stars: 1 finished, 2 clean, 3 clean and fast (speed bonus at least half).
 */
export function scoreRun(a) {
  const { kind, blackMoves, rating, success, finished = false, misses = 0, ideaHints = 0, moveHints = 0, thinkMs = null, userMoves = 0, combo = 0, surprise = null, punished = 0, lessonReplay = false } = a;
  const base = basePoints({ kind, blackMoves });
  const diff = difficultyFor(rating);
  const completion = Math.round(base * diff.mult);
  const breakdown = [];
  const speed = speedFactor({ kind, thinkMs, userMoves });
  const slips = kind === 'spar' ? Math.min(3, Math.max(0, punished)) : 0;
  const slipPoints = Math.round(completion * 0.3 * slips);
  const slipRow = { label: `Punished White’s slip${slips > 1 ? `s ×${slips}` : ''}`, points: slipPoints };
  if (!success) {
    if ((kind === 'line' || kind === 'spar') && finished) {
      const p = Math.round(completion * 0.4);
      const rows = [{ label: `${kind === 'spar' ? 'Round' : 'Line'} finished, with misses · ${diff.name}`, points: p }];
      if (slips) rows.push(slipRow);
      return { total: p + (slips ? slipPoints : 0), base, completion, clean: false, stars: 1, speed, difficulty: diff.name, breakdown: rows };
    }
    return { total: 0, base, completion, clean: false, stars: 0, speed, difficulty: diff.name, breakdown: [{ label: 'Missed', points: 0 }] };
  }
  const what = kind === 'line' ? `Line completed (${blackMoves} moves)` : kind === 'spar' ? `Sparring round (${blackMoves} moves)` : 'Solved';
  breakdown.push({ label: `${what} · ${diff.name}`, points: completion });
  let total = completion;
  const clean = misses === 0 && ideaHints === 0 && moveHints === 0;
  if (clean) {
    const b = Math.round(completion * 0.25);
    breakdown.push({ label: 'Clean: no misses, no hints', points: b });
    total += b;
  }
  const speedPts = Math.round(completion * 0.3 * speed);
  if (speedPts > 0) {
    breakdown.push({ label: `Speed: ${(thinkMs / 1000 / Math.max(1, userMoves)).toFixed(1)}s a move`, points: speedPts });
    total += speedPts;
  }
  if (clean && combo > 0) {
    const n = Math.min(MAX_COMBO, combo);
    const b = Math.round(completion * 0.1 * n);
    breakdown.push({ label: `Combo ×${combo + 1}: clean runs in a row`, points: b });
    total += b;
  }
  if (surprise?.found) {
    const b = Math.round(completion * 0.5);
    breakdown.push({ label: 'Punished White’s mistake', points: b });
    total += b;
  }
  if (slips) {
    breakdown.push(slipRow);
    total += slipPoints;
  }
  if (ideaHints) {
    const p = Math.round(completion * 0.1 * ideaHints);
    breakdown.push({ label: `Idea hints x${ideaHints}`, points: -p });
    total -= p;
  }
  if (moveHints) {
    const p = Math.round(completion * 0.25 * moveHints);
    breakdown.push({ label: `Moves shown x${moveHints}`, points: -p });
    total -= p;
  }
  total = Math.max(Math.round(completion * 0.2), total);
  if (lessonReplay) {
    const half = Math.round(total / 2);
    breakdown.push({ label: 'Replay after the lesson x1/2', points: half - total });
    total = half;
  }
  const stars = clean ? (speed >= 0.5 ? 3 : 2) : 1;
  return { total, base, completion, clean, stars, speed, difficulty: diff.name, breakdown };
}

export function addDays(isoDay, delta) {
  const [y, m, d] = isoDay.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return t.toISOString().slice(0, 10);
}
