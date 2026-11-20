import { describe, it, expect } from 'vitest';
import { streakInfo, shieldDaysToUse, weaveBraid, rollGolden, goldenBonus, GOLDEN_PITY } from '../shared/streak.js';

const today = '2026-11-20';

describe('streaks with shields and repairs', () => {
  it('counts full-bulb days ending today or yesterday', () => {
    expect(streakInfo({ doneDays: ['2026-11-18', '2026-11-19'], today }).streak).toBe(2);
    expect(streakInfo({ doneDays: ['2026-11-19', '2026-11-20'], today }).streak).toBe(2);
  });
  it('a shield covers a missed day: the chain holds but the day adds nothing', () => {
    const done = ['2026-11-17', '2026-11-18'];
    expect(streakInfo({ doneDays: done, today, shields: 1 })).toMatchObject({ streak: 2, covered: true });
    expect(shieldDaysToUse({ doneDays: done, today, shields: 1 })).toEqual(['2026-11-19']);
    expect(streakInfo({ doneDays: done, protectedDays: ['2026-11-19'], today }).streak).toBe(2);
  });
  it('shields are kept when there are not enough to cover the gap', () => {
    const done = ['2026-11-16'];
    expect(streakInfo({ doneDays: done, today, shields: 2 }).streak).toBe(0);
    expect(shieldDaysToUse({ doneDays: done, today, shields: 2 })).toEqual([]);
    expect(shieldDaysToUse({ doneDays: done, today, shields: 3 })).toEqual(['2026-11-17', '2026-11-18', '2026-11-19']);
  });
  it('one missed day with no shield can be repaired today', () => {
    const done = ['2026-11-17', '2026-11-18'];
    expect(streakInfo({ doneDays: done, today })).toMatchObject({ streak: 0, repairable: { streak: 2 } });
    // Today's bulb alone restarts at 1; the repair keeps the old run going.
    expect(streakInfo({ doneDays: [...done, today], today }).streak).toBe(1);
    expect(streakInfo({ doneDays: [...done, today], protectedDays: ['2026-11-19'], today }).streak).toBe(3);
    // Two missed days can't be repaired.
    expect(streakInfo({ doneDays: ['2026-11-17'], today }).repairable).toBe(null);
  });
});

describe('garlic braid', () => {
  it('weaves cloves beyond the full bulb into shields, up to two', () => {
    expect(weaveBraid({ braid: 0, shields: 0, cloveBefore: 4, cloveAfter: 5 })).toEqual({ braid: 0, shields: 0, earned: 0 });
    expect(weaveBraid({ braid: 3, shields: 0, cloveBefore: 5, cloveAfter: 7 })).toEqual({ braid: 0, shields: 1, earned: 1 });
    expect(weaveBraid({ braid: 4.5, shields: 1, cloveBefore: 4.5, cloveAfter: 6 })).toEqual({ braid: 0.5, shields: 2, earned: 1 });
    // Full: the braid stays full until a shield is used.
    expect(weaveBraid({ braid: 4, shields: 2, cloveBefore: 8, cloveAfter: 10 }).braid).toBe(5);
  });
});

describe('golden cloves', () => {
  it('only eligible solves roll, and a dry spell is capped', () => {
    expect(rollGolden({ eligible: false, sinceLast: 99, rng: () => 0 })).toBe(false);
    expect(rollGolden({ eligible: true, sinceLast: 0, rng: () => 0.05 })).toBe(true);
    expect(rollGolden({ eligible: true, sinceLast: 0, rng: () => 0.5 })).toBe(false);
    expect(rollGolden({ eligible: true, sinceLast: GOLDEN_PITY - 1, rng: () => 0.99 })).toBe(true);
  });
  it('is worth half the drill base, at least 10', () => {
    expect(goldenBonus(32)).toBe(16);
    expect(goldenBonus(8)).toBe(10);
  });
});
