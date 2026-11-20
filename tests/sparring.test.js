import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { SPAR, sampleMove, whiteSlip, enginePos, judgeSparMove, roundOver, sparDue } from '../shared/sparring.js';
import { pickNext, buildCurriculum } from '../shared/curriculum.js';
import { scoreRun } from '../shared/scoring.js';
import { posKey } from '../shared/pgn.js';
import { LINES } from '../shared/course-index.js';
import course from '../shared/course.json' with { type: 'json' };

const MOVES = [
  { san: 'Bf4', uci: 'c1f4', white: 300, draws: 50, black: 250 }, // 600
  { san: 'c4', uci: 'c2c4', white: 150, draws: 30, black: 120 }, // 300
  { san: 'Nf3', uci: 'g1f3', white: 50, draws: 10, black: 40 }, // 100
  { san: 'h4', uci: 'h2h4', white: 2, draws: 0, black: 3 }, // 5: under 1%, left out
];

/** A deterministic sequence of random numbers. */
const seq = (xs) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('White plays like club players', () => {
  it('picks moves in proportion to how often they are played', () => {
    const counts = {};
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const m = sampleMove(MOVES, seq([(i + 0.5) / n]), { total: 1005 });
      counts[m.san] = (counts[m.san] ?? 0) + 1;
    }
    expect(counts.Bf4 / n).toBeCloseTo(0.6, 1);
    expect(counts.c4 / n).toBeCloseTo(0.3, 1);
    expect(counts.Nf3 / n).toBeCloseTo(0.1, 1);
    expect(counts.h4).toBeUndefined();
  });
  it('reports the share of all games in the position, and can be limited to some moves', () => {
    const m = sampleMove(MOVES, () => 0, { total: 2000 });
    expect(m).toMatchObject({ san: 'Bf4', games: 600 });
    expect(m.share).toBeCloseTo(0.3, 5);
    expect(sampleMove(MOVES, () => 0.99, { allowed: ['c4', 'Nf3'] }).san).toBe('Nf3');
    expect(sampleMove([], Math.random)).toBeNull();
    expect(sampleMove(MOVES, Math.random, { allowed: ['e4'] })).toBeNull();
  });
});

describe('White’s slips', () => {
  it('a move that throws away winning chances, leaving you at least level, is a slip', () => {
    expect(whiteSlip({ beforeCp: 40, blackBestCp: 60 }).grade).toBe('inaccuracy');
    expect(whiteSlip({ beforeCp: 40, blackBestCp: 100 }).grade).toBe('mistake');
    expect(whiteSlip({ beforeCp: 40, blackBestCp: 400 }).grade).toBe('blunder');
  });
  it('small changes and engine noise are not slips', () => {
    expect(whiteSlip({ beforeCp: 30, blackBestCp: -10 }).grade).toBeNull();
    expect(whiteSlip({ beforeCp: 20, blackBestCp: 10 }).grade).toBeNull();
    // White was much better and is still better: not something to punish.
    expect(whiteSlip({ beforeCp: 250, blackBestCp: -60 }).grade).toBeNull();
    expect(whiteSlip({ beforeCp: null, blackBestCp: 300 }).grade).toBeNull();
  });
});

describe('judging your moves', () => {
  const live = enginePos([
    { san: 'e5', cp: 40, pv: ['e5', 'dxe5', 'dxe5'] },
    { san: 'c5', cp: 25, pv: ['c5', 'd5'] },
    { san: 'Nc6', cp: 5, pv: ['Nc6'] },
    { san: 'h5', cp: -30, pv: ['h5', 'e4'] },
  ]);
  it('off the course, Stockfish decides: about as good as the best move is fine', () => {
    expect(judgeSparMove({ san: 'e5', live })).toMatchObject({ grade: 'best', ok: true, source: 'engine' });
    expect(judgeSparMove({ san: 'c5', live })).toMatchObject({ grade: 'best', ok: true });
    expect(judgeSparMove({ san: 'Nc6', live })).toMatchObject({ grade: 'good', ok: true });
    const bad = judgeSparMove({ san: 'h5', live });
    expect(bad.ok).toBe(false);
    expect(bad.grade).toBe('inaccuracy');
    expect(bad.best).toBe('e5');
  });
  it('after a slip, only the moves that cash in count as punishing it', () => {
    expect(judgeSparMove({ san: 'e5', live, chance: true })).toMatchObject({ grade: 'found', found: true, ok: true });
    expect(judgeSparMove({ san: 'Nc6', live, chance: true })).toMatchObject({ grade: 'partial', found: false, ok: true });
    expect(judgeSparMove({ san: 'h5', live, chance: true })).toMatchObject({ grade: 'missed', ok: false });
  });
  it('in your repertoire, the repertoire move is right and another good move means try again', () => {
    const line = course.lines.find((l) => l.id === 'lon-castle') ?? course.lines[0];
    const g = new Chess();
    for (const s of line.sans.slice(0, 3)) g.move(s); // 1.d4 Nf6 2.Bf4: Black to move
    const pos = course.positions[posKey(g.fen())];
    const book = line.sans[3];
    expect(judgeSparMove({ san: book, book, pos, live })).toMatchObject({ grade: 'book', ok: true, source: 'book' });
    const other = Object.entries(pos.e).sort((a, b) => b[1] - a[1]).find(([s]) => s !== book)[0];
    const r = judgeSparMove({ san: other, book, pos, live });
    expect(r.ok).toBe(false);
    if (r.grade === 'alternative') expect(r.retry).toBe(true);
    const worst = Object.entries(pos.e).sort((a, b) => a[1] - b[1])[0][0];
    expect(judgeSparMove({ san: worst, book, pos, live })).toMatchObject({ ok: false, retry: false });
  });
});

describe('the round', () => {
  it('ends after twelve moves, out of the database, when the game is over or clearly won', () => {
    expect(roundOver({ blackMoves: 3, games: 5000 })).toBeNull();
    expect(roundOver({ blackMoves: SPAR.MAX_BLACK_MOVES, games: 5000 })).toMatch(/12 moves/);
    expect(roundOver({ blackMoves: 5, games: 10 })).toMatch(/out of the database/);
    expect(roundOver({ blackMoves: 5, evalCp: 500 })).toMatch(/winning/);
    expect(roundOver({ blackMoves: 5, gameOver: true })).toMatch(/over/);
  });
  it('is scored like a line, with a bonus for every slip punished', () => {
    const base = { kind: 'spar', blackMoves: 10, rating: SPAR.RATING, finished: true, userMoves: 10, thinkMs: 200e3 };
    const clean = scoreRun({ ...base, success: true });
    const punished = scoreRun({ ...base, success: true, punished: 2 });
    expect(clean.completion).toBe(Math.round((8 + 2 * 10) * 1.5));
    expect(punished.total - clean.total).toBe(Math.round(clean.completion * 0.6));
    expect(punished.breakdown.map((b) => b.label).join(' ')).toMatch(/slips ×2/);
    const misses = scoreRun({ ...base, success: false, misses: 2, punished: 1 });
    expect(misses.stars).toBe(1);
    expect(misses.total).toBe(Math.round(clean.completion * 0.4) + Math.round(clean.completion * 0.3));
  });
});

describe('sparring in Opening School', () => {
  const cur = buildCurriculum({ lines: LINES, progress: {}, today: '2026-11-20' });
  it('comes after every three other exercises, twice a day', () => {
    expect(sparDue({ recent: ['a', 'b'], today: 0, available: true })).toBe(false);
    expect(sparDue({ recent: ['a', 'b', 'c'], today: 0, available: true })).toBe(true);
    expect(sparDue({ recent: ['a', 'spar', 'b', 'c'], today: 1, available: true })).toBe(false);
    expect(sparDue({ recent: ['spar', 'a', 'b', 'c'], today: 1, available: true })).toBe(true);
    expect(sparDue({ recent: ['a', 'b', 'c'], today: 2, available: true })).toBe(false);
    expect(sparDue({ recent: ['a', 'b', 'c'], today: 2, available: true, extra: true })).toBe(true);
    expect(sparDue({ recent: ['a', 'b', 'c'], today: 0, available: false })).toBe(false);
  });
  it('pickNext serves a round when one is due', () => {
    const recent = [LINES[0].id, LINES[1].id, LINES[2].id];
    expect(pickNext(cur, { recent, spar: { available: true, today: 0 } })).toEqual({ kind: 'spar', id: 'spar', mode: 'spar' });
    expect(pickNext(cur, { recent, spar: { available: false, today: 0 } }).kind).toBe('line');
    expect(pickNext(cur, { recent }).kind).toBe('line');
  });
});
