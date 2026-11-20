import { describe, it, expect } from 'vitest';
import { scoreRun, basePoints, difficultyFor, speedFactor, bulbBonus, addDays } from '../shared/scoring.js';

const line = (over = {}) => ({ kind: 'line', blackMoves: 6, rating: 900, success: true, thinkMs: null, userMoves: 6, ...over });

describe('scoreRun', () => {
  it('completion is base x difficulty, plus a clean bonus', () => {
    expect(basePoints({ kind: 'line', blackMoves: 6 })).toBe(20);
    const easy = scoreRun(line());
    expect(easy.completion).toBe(20);
    expect(easy.total).toBe(25);
    expect(easy.stars).toBe(2);
    const hard = scoreRun(line({ rating: 1250 }));
    expect(hard.completion).toBe(30);
    expect(hard.difficulty).toBe('Hard');
    expect(difficultyFor(1400).mult).toBe(2);
  });
  it('speed: full bonus at half of par, none at par; fast and clean is three stars', () => {
    expect(speedFactor({ kind: 'line', thinkMs: 18000, userMoves: 6 })).toBe(1); // 3 s a move
    expect(speedFactor({ kind: 'line', thinkMs: 36000, userMoves: 6 })).toBe(0); // 6 s a move
    const fast = scoreRun(line({ thinkMs: 12000 }));
    expect(fast.total).toBe(31);
    expect(fast.stars).toBe(3);
  });
  it('combos reward clean runs in a row, up to +50%', () => {
    expect(scoreRun(line({ combo: 2 })).total).toBe(29);
    expect(scoreRun(line({ combo: 9 })).total).toBe(35);
    expect(scoreRun(line({ combo: 3, ideaHints: 1 })).breakdown.some((b) => /Combo/.test(b.label))).toBe(false);
  });
  it('finishing a line with misses earns 40% and one star; a missed position nothing', () => {
    const r = scoreRun(line({ success: false, finished: true, misses: 2 }));
    expect(r.total).toBe(8);
    expect(r.stars).toBe(1);
    expect(scoreRun({ kind: 'punish', rating: 1050, success: false }).total).toBe(0);
  });
  it('surprises, hints and lesson replays', () => {
    expect(scoreRun(line({ surprise: { found: true } })).total).toBe(35);
    expect(scoreRun(line({ moveHints: 1 })).total).toBe(15);
    expect(scoreRun(line({ moveHints: 9 })).total).toBe(4); // floor 20%
    expect(scoreRun(line({ lessonReplay: true })).total).toBe(13);
  });
  it('bulb bonus grows with the streak; dates', () => {
    expect(bulbBonus(0)).toBe(50);
    expect(bulbBonus(3)).toBe(80);
    expect(bulbBonus(30)).toBe(150);
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});
