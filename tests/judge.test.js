import { describe, it, expect } from 'vitest';
import { judgeLineMove, judgeChance, judgeDeckMove, isMiss, winChance, formatEval } from '../shared/judge.js';

const pos = { e: { e5: 20, c5: 25, Nbd7: 5, h6: -10, Qd7: -60, Nc6: -110, Nxe4: -400 }, m: { t: 1000, mv: { e5: 600, Nbd7: 300 } } };

describe('judgeLineMove', () => {
  it('the repertoire move is right', () => {
    expect(judgeLineMove({ pos, san: 'e5', book: 'e5' }).grade).toBe('book');
  });
  it('a move as good as the repertoire move is an alternative, not a miss', () => {
    expect(judgeLineMove({ pos, san: 'c5', book: 'e5' }).grade).toBe('alternative');
    expect(judgeLineMove({ pos, san: 'Nbd7', book: 'e5' }).grade).toBe('alternative'); // master move, small loss
    expect(isMiss('alternative')).toBe(false);
  });
  it('grades worse moves by lost winning chances', () => {
    expect(judgeLineMove({ pos, san: 'h6', book: 'e5' }).grade).toBe('inexact');
    expect(judgeLineMove({ pos, san: 'Qd7', book: 'e5' }).grade).toBe('inaccuracy');
    expect(judgeLineMove({ pos, san: 'Nc6', book: 'e5' }).grade).toBe('mistake');
    expect(judgeLineMove({ pos, san: 'Nxe4', book: 'e5' }).grade).toBe('blunder');
  });
  it('moves without data are "not in your repertoire"', () => {
    expect(judgeLineMove({ pos: {}, san: 'a6', book: 'e5' }).grade).toBe('unknown');
  });
});

describe('judgeChance', () => {
  const p = { e: { Nxe4: 180, Qa5: 150, e5: 20 }, punish: { moves: ['Nxe4'] } };
  it('finds, partial, missed', () => {
    expect(judgeChance({ pos: p, san: 'Nxe4' }).grade).toBe('found');
    expect(judgeChance({ pos: p, san: 'Qa5' }).grade).toBe('partial');
    expect(judgeChance({ pos: p, san: 'e5' }).grade).toBe('missed');
    expect(judgeDeckMove({ pos: p, san: 'e5', accept: ['Nxe4'] }).grade).toBe('mistake');
  });
  it('helpers', () => {
    expect(winChance(0)).toBe(0);
    expect(formatEval(130)).toBe('+1.3');
    expect(formatEval(-9990)).toBe('mated');
  });
});
