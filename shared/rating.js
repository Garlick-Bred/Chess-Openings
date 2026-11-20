// Opening rating: an Elo-style rating for your opening play, on the same
// scale as a chess rating (adapted from the endgame site).
//
// Every exercise has a rating: a line's comes from its chapter and length
// (the main lines are harder than the tricks), a deck position's from how
// hard it was to find. A clean run raises your rating more when the exercise
// is rated above you, a miss lowers it, and runs far below your level barely
// count. A clean run never lowers it.
//
// It starts at your chess rating and is gently pulled back toward it.

export const DEFAULT_OPENING_RATING = 1000;
export const RATING_MIN = 100;
export const RATING_MAX = 3000;
/** Clean runs of exercises rated this far below you can't raise your rating. */
export const NO_GAIN_BELOW = 400;
/** Share of the gap to your chess rating closed after each rated attempt. */
export const ANCHOR_PULL = 0.03;
/** Timed check-ups are a little harder than untimed runs. */
export const TIMED_BONUS = 75;

/**
 * How well a run went, from 0 (missed) to 1 (clean).
 * An "idea" hint costs a quarter, showing the move costs half.
 */
export function runScore({ success, ideaHints = 0, moveHints = 0 }) {
  if (!success) return 0;
  if (moveHints > 0) return 0.5;
  if (ideaHints > 0) return 0.75;
  return 1;
}

export function kFactor(games) {
  return games < 15 ? 40 : games < 50 ? 28 : 20;
}

export function expectedScore(rating, puzzle) {
  return 1 / (1 + 10 ** ((puzzle - rating) / 400));
}

/**
 * One rated attempt.
 * @param {{ rating: number, games: number, puzzle: number, score: number, anchor?: number|null }} a
 */
export function rateAttempt({ rating, games, puzzle, score, anchor = null }) {
  const expected = expectedScore(rating, puzzle);
  let perf = kFactor(games) * (score - expected);
  if (perf > 0 && puzzle <= rating - NO_GAIN_BELOW) perf = 0;
  let delta = perf;
  if (anchor != null && perf !== 0) {
    delta = perf + ANCHOR_PULL * (anchor - rating);
    delta = perf > 0 ? Math.max(0, delta) : Math.min(0, delta);
  }
  if (score > 0) delta = Math.max(0, delta);
  delta = Math.round(delta);
  const after = Math.max(RATING_MIN, Math.min(RATING_MAX, rating + delta));
  return { before: rating, after, delta: after - rating, expected, puzzle };
}

export function startingRating(chessRating) {
  return chessRating ?? DEFAULT_OPENING_RATING;
}
