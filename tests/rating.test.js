import { describe, it, expect } from 'vitest';
import { rateAttempt, runScore, startingRating } from '../shared/rating.js';

describe('opening rating', () => {
  it('clean runs of harder lines raise it more; easy ones not at all', () => {
    const hard = rateAttempt({ rating: 1100, games: 0, puzzle: 1300, score: 1 });
    const even = rateAttempt({ rating: 1100, games: 0, puzzle: 1100, score: 1 });
    const easy = rateAttempt({ rating: 1300, games: 0, puzzle: 800, score: 1 });
    expect(hard.delta).toBeGreaterThan(even.delta);
    expect(easy.delta).toBe(0);
  });
  it('misses lower it, clean runs never do', () => {
    expect(rateAttempt({ rating: 1200, games: 30, puzzle: 1000, score: 0 }).delta).toBeLessThan(0);
    expect(rateAttempt({ rating: 1200, games: 30, puzzle: 1000, score: 0.5, anchor: 900 }).delta).toBeGreaterThanOrEqual(0);
  });
  it('hints earn partial credit', () => {
    expect(runScore({ success: true })).toBe(1);
    expect(runScore({ success: true, ideaHints: 1 })).toBe(0.75);
    expect(runScore({ success: true, moveHints: 1 })).toBe(0.5);
    expect(runScore({ success: false })).toBe(0);
    expect(startingRating(null)).toBe(1000);
  });
});
