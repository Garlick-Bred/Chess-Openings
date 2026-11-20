import { describe, it, expect } from 'vitest';
import { scoreRun, basePoints, rankFor, addDays } from '../shared/scoring.js';

describe('scoreRun', () => {
  it('a clean line earns base + 25%', () => {
    const r = scoreRun({ kind: 'line', blackMoves: 6, success: true });
    expect(basePoints({ kind: 'line', blackMoves: 6 })).toBe(20);
    expect(r.total).toBe(25);
    expect(r.clean).toBe(true);
  });
  it('a missed run earns nothing', () => {
    expect(scoreRun({ kind: 'line', blackMoves: 6, success: false }).total).toBe(0);
  });
  it('beating the clock and punishing a surprise add bonuses; hints cost points', () => {
    expect(scoreRun({ kind: 'line', blackMoves: 6, success: true, timed: true }).total).toBe(30);
    expect(scoreRun({ kind: 'line', blackMoves: 6, success: true, surprise: { found: true } }).total).toBe(35);
    expect(scoreRun({ kind: 'line', blackMoves: 6, success: true, moveHints: 1 }).total).toBe(15);
    expect(scoreRun({ kind: 'line', blackMoves: 6, success: true, moveHints: 9 }).total).toBe(4); // floor 20%
  });
  it('lesson replays are worth half', () => {
    expect(scoreRun({ kind: 'line', blackMoves: 6, success: true, lessonReplay: true }).total).toBe(13);
  });
  it('ranks and dates', () => {
    expect(rankFor(800).name).toBe('Clove');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});
