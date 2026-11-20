// How much of the daily Garlick bulb an exercise fills (adapted from the
// endgame site). Work at your level fills a whole clove:
//
//   exercise                                          | clove
//   a line you are learning (today's test) or a due    | 1
//     check-up
//   a deck position (your mistakes / punish)           | 1
//   extra practice of a line already tested today      | 1/2
//   replaying a line right after its lesson            | 1 (at most LESSON_CLOVES_PER_DAY a day)
//
// Showing the move halves it; the idea hint doesn't. A missed run fills
// nothing (but you can try again).

export const DEFAULT_RATING = 1000;
export const RATING_MIN = 100;
export const RATING_MAX = 3000;
export const LESSON_CLOVES_PER_DAY = 2;

export const RATING_SOURCES = {
  'chesscom-rapid': 'chess.com rapid',
  'chesscom-blitz': 'chess.com blitz',
  'chesscom-daily': 'chess.com daily',
  lichess: 'Lichess',
  fide: 'FIDE',
  cfc: 'CFC (Canada)',
  uscf: 'US Chess',
  guess: 'Best guess',
};

export function validRating(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= RATING_MIN && n <= RATING_MAX ? n : null;
}

/** Clove fraction (0-1) for a finished exercise. */
export function cloveValue({ success, mode, moveHints = 0, lessonReplay = false }) {
  if (!success) return 0;
  if (lessonReplay) return 1;
  let v = mode === 'extra' || mode === 'free' ? 0.5 : 1;
  if (moveHints > 0) v *= 0.5;
  return v;
}

/** Why an exercise filled less than a clove (for the result screen), or null. */
export function cloveShortfall({ mode, moveHints = 0 }) {
  const why = [];
  if (mode === 'extra' || mode === 'free') why.push('practice of a line you already played today');
  if (moveHints > 0) why.push('the move was shown');
  return why.length ? `${why.join(' and ')}.` : null;
}

/** 0.5 -> "½", 1.25 -> "1¼". */
export function formatCloves(x) {
  const v = Math.max(0, Math.round(x * 8) / 8);
  const whole = Math.floor(v + 1e-9);
  const frac = Math.round((v - whole) * 8);
  const glyph = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'][frac];
  if (!whole && glyph) return glyph;
  return `${whole}${glyph}`;
}
