// Sparring rounds: White plays like real club players. Each White move is
// drawn from the Lichess database (players rated 1000-1800, blitz and rapid),
// in proportion to how often club players chose it in that position. Your job
// is to keep to your repertoire, and to notice and punish White's slips.
//
// Positions in your repertoire are judged with the course data, like a line.
// Anywhere else, Stockfish runs in your browser (client/src/engine.ts) and
// these rules turn its numbers into a verdict. Scores are centipawns from the
// side to move's point of view, as in judge.js.
import { winChance, THRESHOLDS, judgeLineMove, judgeChance } from './judge.js';

export const SPAR = {
  /** A round lasts this many of your moves at most. */
  MAX_BLACK_MOVES: 12,
  /** The round ends when fewer club games than this reach White's position. */
  MIN_GAMES: 25,
  /** Moves played in under 1% of the games are left out. */
  MIN_SHARE: 0.01,
  /** You're this far ahead (centipawns): the opening is won, round over. */
  WIN_CP: 350,
  /** Off the course: a move within this loss of winning chances of the best is fine. */
  OK_LOSS: 0.08,
  BEST_LOSS: 0.03,
  /** Punishing a slip: within this of the best move counts as found. */
  FOUND_LOSS: 0.05,
  /** White's move gave away at least this much of White's winning chances: a slip. */
  SLIP_LOSS: 0.12,
  /** ...and left you at least this well off. */
  SLIP_MIN_CP: 20,
  /** Opening School: rounds a day, and one after every this many other exercises. */
  PER_DAY: 2,
  EVERY: 3,
  /** Difficulty for points (shared/scoring.js): sparring is "Hard". */
  RATING: 1200,
  /** Engine settings: the position when it's your turn, and a single move you chose. */
  ROOT: { multipv: 3, depth: 15, movetime: 2500 },
  SINGLE: { depth: 14, movetime: 1500 },
};

const games = (m) => (m.white ?? 0) + (m.draws ?? 0) + (m.black ?? 0);

/**
 * Pick White's move in proportion to how often club players play it.
 * @param {{ san: string, uci: string, white: number, draws: number, black: number }[]} moves explorer moves
 * @param {() => number} rng
 * @param {{ total?: number, allowed?: string[]|null, minShare?: number }} opts
 *   total: games in the position (for the share shown to you); allowed: only these moves (SAN)
 * @returns {{ san: string, uci: string, games: number, share: number } | null}
 */
export function sampleMove(moves, rng = Math.random, { total = 0, allowed = null, minShare = SPAR.MIN_SHARE } = {}) {
  let pool = (moves ?? []).filter((m) => games(m) > 0 && (!allowed || allowed.includes(m.san)));
  const sum = pool.reduce((s, m) => s + games(m), 0);
  if (!sum) return null;
  pool = pool.filter((m) => games(m) / sum >= minShare);
  const kept = pool.reduce((s, m) => s + games(m), 0);
  const all = Math.max(total, sum);
  let r = rng() * kept;
  for (const m of pool) {
    r -= games(m);
    if (r < 0) return { san: m.san, uci: m.uci, games: games(m), share: games(m) / all };
  }
  const m = pool[pool.length - 1];
  return { san: m.san, uci: m.uci, games: games(m), share: games(m) / all };
}

/**
 * Did White's last move give something away?
 * @param {{ beforeCp: number, blackBestCp: number }} a
 *   beforeCp: the position before White's move, from White's side (minus the score of your previous move);
 *   blackBestCp: your best reply now, from your side.
 * @returns {{ loss: number, grade: 'inaccuracy'|'mistake'|'blunder'|null }}
 */
export function whiteSlip({ beforeCp, blackBestCp }) {
  if (beforeCp == null || blackBestCp == null) return { loss: 0, grade: null };
  const loss = Math.max(0, winChance(beforeCp) - winChance(-blackBestCp));
  let grade = null;
  if (loss >= SPAR.SLIP_LOSS && blackBestCp >= SPAR.SLIP_MIN_CP) grade = loss >= 0.3 ? 'blunder' : loss >= 0.2 ? 'mistake' : 'inaccuracy';
  return { loss, grade };
}

export const SLIP_SYMBOL = { inaccuracy: '?!', mistake: '?', blunder: '??' };

/**
 * A course-style position from engine lines, so judge.js and explain.js can
 * read it: e = { san: cp }, pv = { san: [san, ...] } (each line starts with its move).
 * @param {{ san: string, cp: number, pv: string[] }[]} lines
 * @returns {{ e: Record<string, number>, pv: Record<string, string[]> }}
 */
export function enginePos(lines) {
  /** @type {Record<string, number>} */
  const e = {};
  /** @type {Record<string, string[]>} */
  const pv = {};
  for (const l of lines) {
    if (e[l.san] != null) continue;
    e[l.san] = l.cp;
    pv[l.san] = l.pv;
  }
  return { e, pv };
}

function bestOf(e) {
  let best = null;
  for (const [san, cp] of Object.entries(e)) if (best == null || cp > e[best]) best = san;
  return best;
}

/**
 * Judge your move in a sparring round.
 *
 * In your repertoire (`book` given, `pos` = the course position) it's judged
 * like a line: the repertoire move is right; another good move asks you to
 * try again without counting a miss. Right after a White slip, any move that
 * cashes in is right too.
 *
 * Off the course, `live` holds the engine's verdicts ({ e, pv }) and the move
 * only has to be about as good as the best one.
 *
 * @param {{ san: string, book?: string|null, pos?: any, live?: { e: Record<string, number>, pv: Record<string, string[]> } | null, chance?: boolean }} a
 * @returns {{ grade: string, ok: boolean, retry: boolean, found: boolean, loss: number,
 *             cp: number|null, best: string|null, bestCp: number|null, source: 'book'|'engine', masters?: number }}
 */
export function judgeSparMove({ san, book = null, pos = null, live = null, chance = false }) {
  if (book && pos?.e) {
    if (chance) {
      const r = judgeChance({ pos, san, accept: [book] });
      if (r.grade === 'found') return { ...r, ok: true, retry: false, found: true, source: 'book' };
    }
    const r = judgeLineMove({ pos, san, book });
    const ok = r.grade === 'book';
    return { ...r, grade: chance && !ok && r.grade !== 'alternative' ? 'missed' : r.grade, ok, retry: r.grade === 'alternative', found: false, source: 'book' };
  }
  const e = live?.e ?? {};
  const best = bestOf(e);
  const cp = e[san] ?? null;
  const bestCp = best != null ? e[best] : null;
  if (cp == null || bestCp == null) return { grade: 'unknown', ok: true, retry: false, found: false, loss: 0, cp, best, bestCp, source: 'engine' };
  const loss = Math.max(0, winChance(bestCp) - winChance(cp));
  let grade;
  if (chance) grade = loss <= SPAR.FOUND_LOSS ? 'found' : loss <= SPAR.OK_LOSS ? 'partial' : 'missed';
  else if (loss <= SPAR.BEST_LOSS) grade = 'best';
  else if (loss <= SPAR.OK_LOSS) grade = 'good';
  else if (loss < THRESHOLDS.inexact) grade = 'inexact';
  else if (loss < THRESHOLDS.inaccuracy) grade = 'inaccuracy';
  else if (loss < THRESHOLDS.mistake) grade = 'mistake';
  else grade = 'blunder';
  const ok = ['found', 'partial', 'best', 'good'].includes(grade);
  return { grade, ok, retry: false, found: grade === 'found', loss, cp, best, bestCp, source: 'engine' };
}

/**
 * Why the round stops here, or null to keep going.
 * @param {{ blackMoves: number, games?: number|null, gameOver?: boolean, evalCp?: number|null }} a
 *   games: club games reaching White's position (null = not looked up yet)
 *   evalCp: the position after your move, from your side
 */
export function roundOver({ blackMoves, games: n = null, gameOver = false, evalCp = null }) {
  if (gameOver) return 'The game is over.';
  if (evalCp != null && evalCp >= SPAR.WIN_CP) return 'You’re clearly winning: that opening went your way.';
  if (blackMoves >= SPAR.MAX_BLACK_MOVES) return `${SPAR.MAX_BLACK_MOVES} moves played: the opening is over.`;
  if (n != null && n < SPAR.MIN_GAMES) return 'White is out of the database here: too few games reach this position.';
  return null;
}

/** Opening School: is a sparring round due? `recent` is today's exercise ids in this browser, newest last. */
export function sparDue({ recent = [], today = 0, available = false, extra = false }) {
  if (!available) return false;
  let since = 0;
  for (let i = recent.length - 1; i >= 0 && recent[i] !== 'spar'; i--) since++;
  if (since < SPAR.EVERY) return false;
  return extra || today < SPAR.PER_DAY;
}
