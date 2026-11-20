// Judging a move against the precomputed course data (shared/course.json or a
// personal deck). No engine runs on the site: every legal move in every
// position you can reach was evaluated by Stockfish when the course was built.
//
// Evaluations are centipawns from the side to move's point of view (you).
// Comparisons use Lichess's winning-chances scale (-1..1), so 50 centipawns
// matter more in a level position than when you're already a piece up.

export function winChance(cp) {
  const c = Math.max(-1500, Math.min(1500, cp));
  return 2 / (1 + Math.exp(-0.00368208 * c)) - 1;
}

/** Lichess-style labels by loss of winning chances (-1..1 scale). */
export const THRESHOLDS = { alternative: 0.04, inexact: 0.1, inaccuracy: 0.2, mistake: 0.3 };
/** A move played in at least this many master games is never called a mistake when it's within this loss. */
export const MASTER_GAMES = 50;
export const MASTER_LOSS = 0.08;

export const GRADE_INFO = {
  book: { label: 'Repertoire move', symbol: '✓', tone: 'good' },
  alternative: { label: 'Good move, but not your repertoire', symbol: '≈', tone: 'ok' },
  inexact: { label: 'Not quite', symbol: '?!', tone: 'warn' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', tone: 'warn' },
  mistake: { label: 'Mistake', symbol: '?', tone: 'bad' },
  blunder: { label: 'Blunder', symbol: '??', tone: 'bad' },
  unknown: { label: 'Not in your repertoire', symbol: '·', tone: 'warn' },
  found: { label: 'You punished it!', symbol: '!', tone: 'good' },
  partial: { label: 'Better, but not the most', symbol: '!?', tone: 'ok' },
  missed: { label: 'Missed chance', symbol: '?', tone: 'bad' },
};

function bestOf(e) {
  let best = null;
  for (const [san, cp] of Object.entries(e)) if (best == null || cp > e[best]) best = san;
  return best;
}

/**
 * A move in a repertoire line.
 * @param {{ pos: any, san: string, book: string }} a
 * @returns {{ grade: string, loss: number, cp: number|null, best: string|null, bestCp: number|null, masters: number }}
 */
export function judgeLineMove({ pos, san, book }) {
  const masters = pos?.m?.mv?.[san] ?? 0;
  const e = pos?.e;
  if (san === book) return { grade: 'book', loss: 0, cp: e?.[san] ?? null, best: e ? bestOf(e) : null, bestCp: e ? e[bestOf(e)] : null, masters };
  if (!e || e[san] == null) {
    return { grade: masters >= MASTER_GAMES ? 'alternative' : 'unknown', loss: 0, cp: null, best: null, bestCp: null, masters };
  }
  const best = bestOf(e);
  const loss = Math.max(0, winChance(e[best]) - winChance(e[san]));
  // Compare with the repertoire move too: never call a move worse than "book"
  // a mistake when it is better than the move we teach.
  const bookLoss = e[book] != null ? Math.max(0, winChance(e[best]) - winChance(e[book])) : 0;
  const rel = Math.max(0, loss - bookLoss);
  let grade;
  if (rel <= THRESHOLDS.alternative || (masters >= MASTER_GAMES && rel <= MASTER_LOSS)) grade = 'alternative';
  else if (rel < THRESHOLDS.inexact) grade = 'inexact';
  else if (rel < THRESHOLDS.inaccuracy) grade = 'inaccuracy';
  else if (rel < THRESHOLDS.mistake) grade = 'mistake';
  else grade = 'blunder';
  return { grade, loss: rel, cp: e[san], best, bestCp: e[best], masters };
}

/** Does this grade count as getting the move wrong? */
export function isMiss(grade) {
  return grade !== 'book' && grade !== 'alternative';
}

/**
 * Punishing a mistake: White has just gone wrong and you should cash in.
 * Found = one of the moves that keeps (nearly) all of the advantage.
 * @param {{ pos: any, san: string, accept?: string[] }} a
 */
export function judgeChance({ pos, san, accept }) {
  const e = pos?.e ?? {};
  const best = bestOf(e);
  const ok = accept ?? pos?.punish?.moves ?? [];
  const cp = e[san] ?? null;
  const loss = cp == null || best == null ? 1 : Math.max(0, winChance(e[best]) - winChance(cp));
  let grade;
  if (ok.includes(san) || loss <= 0.05) grade = 'found';
  else if (cp != null && cp >= 80 && loss <= 0.2) grade = 'partial';
  else grade = 'missed';
  return { grade, loss, cp, best, bestCp: best ? e[best] : null };
}

/**
 * One of your own mistakes from a game: anything about as good as Stockfish's best counts.
 * @param {{ pos: any, san: string, accept?: string[] }} a
 */
export function judgeDeckMove({ pos, san, accept }) {
  const r = judgeChance({ pos, san, accept });
  if (r.grade === 'partial') r.grade = 'inaccuracy';
  if (r.grade === 'missed') r.grade = r.loss >= THRESHOLDS.inaccuracy ? 'mistake' : 'inaccuracy';
  return r;
}

/** A centipawn score as a friendly number, e.g. +1.3 (from your side). */
export function formatEval(cp) {
  if (cp == null) return '?';
  if (Math.abs(cp) >= 9000) return cp > 0 ? 'mate' : 'mated';
  const v = cp / 100;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
}
