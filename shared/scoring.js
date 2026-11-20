// Points, ranks and the daily Garlick bulb. Pure functions so the server can
// recompute everything the client shows.

export const BULB_CLOVES = 5;
export const BULB_BONUS = 50;

/** Base points: a line is worth more the more moves you have to know. */
export function basePoints({ kind, blackMoves = 6 }) {
  if (kind === 'line') return 8 + 2 * blackMoves;
  if (kind === 'punish') return 15;
  return 12; // one of your own mistakes
}

/**
 * Score a finished exercise.
 *
 * Done          = base points (a line: 8 + 2 per move you play)
 * Clean         = +25% with no misses and no hints
 * Beat the clock= +25% on a timed check-up with every move inside the clock
 * Punished      = +50% for cashing in on a surprise mistake
 * Hints         = -10% per idea hint, -25% per move shown
 * Lesson replay = half points (the line was just shown)
 * A finished exercise is worth at least 20% of base; a missed one earns 0.
 */
export function scoreRun(a) {
  const { kind, blackMoves, success, misses = 0, ideaHints = 0, moveHints = 0, timed = false, slowMoves = 0, surprise = null, lessonReplay = false } = a;
  const base = basePoints({ kind, blackMoves });
  const breakdown = [];
  if (!success) return { total: 0, base, clean: false, breakdown: [{ label: 'Missed', points: 0 }] };
  breakdown.push({ label: kind === 'line' ? `Line played (${blackMoves} moves)` : 'Solved', points: base });
  let total = base;
  const clean = misses === 0 && ideaHints === 0 && moveHints === 0;
  if (clean) {
    const b = Math.round(base * 0.25);
    breakdown.push({ label: 'Clean: no misses, no hints', points: b });
    total += b;
  }
  if (timed && slowMoves === 0) {
    const b = Math.round(base * 0.25);
    breakdown.push({ label: 'Beat the clock on every move', points: b });
    total += b;
  }
  if (surprise?.found) {
    const b = Math.round(base * 0.5);
    breakdown.push({ label: 'Punished White’s mistake', points: b });
    total += b;
  }
  if (ideaHints) {
    const p = Math.round(base * 0.1 * ideaHints);
    breakdown.push({ label: `Idea hints x${ideaHints}`, points: -p });
    total -= p;
  }
  if (moveHints) {
    const p = Math.round(base * 0.25 * moveHints);
    breakdown.push({ label: `Moves shown x${moveHints}`, points: -p });
    total -= p;
  }
  total = Math.max(Math.round(base * 0.2), total);
  if (lessonReplay) {
    const half = Math.round(total / 2);
    breakdown.push({ label: 'Replay after the lesson x1/2', points: half - total });
    total = half;
  }
  return { total, base, clean, breakdown };
}

export const RANKS = [
  { min: 0, name: 'Sprout' },
  { min: 250, name: 'Seedling' },
  { min: 750, name: 'Clove' },
  { min: 2000, name: 'Bulb' },
  { min: 5000, name: 'Braid' },
  { min: 10000, name: 'Garlick Knight' },
  { min: 20000, name: 'Garlick Grandmaster' },
];

export function rankFor(points) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (points >= RANKS[i].min) idx = i;
  const next = RANKS[idx + 1];
  return {
    name: RANKS[idx].name,
    index: idx,
    next: next ? next.name : null,
    progress: next ? (points - RANKS[idx].min) / (next.min - RANKS[idx].min) : 1,
    toNext: next ? next.min - points : 0,
  };
}

export function addDays(isoDay, delta) {
  const [y, m, d] = isoDay.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return t.toISOString().slice(0, 10);
}
