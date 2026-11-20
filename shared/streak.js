// Streak protection and golden cloves.
//
// Garlic braid and streak shields
//   Once the day's bulb is full, every further clove weaves into a braid.
//   BRAID_SIZE extra cloves make a streak shield (hold up to MAX_SHIELDS). A
//   shield is used automatically for a day you miss, so one bad day doesn't
//   wipe out a streak. A shielded day keeps the chain unbroken but doesn't add
//   to the count. If you miss a day with no shield left, filling a double
//   bulb (REPAIR_CLOVES) the next day repairs the streak.
//
// Golden cloves
//   About GOLDEN_CHANCE of solves at your level (no "Show piece", not a lesson
//   replay) turn golden and earn bonus points. Never more than GOLDEN_PITY
//   such solves go by without one. Golden cloves don't change your rating,
//   levels or School progress.
import { addDays } from './scoring.js';

export const BRAID_SIZE = 5;
export const MAX_SHIELDS = 2;
export const BULB_SIZE = 5;
export const REPAIR_CLOVES = 10;
export const GOLDEN_CHANCE = 1 / 8;
export const GOLDEN_PITY = 15;
export const GOLDEN_SHARE = 0.5; // bonus points as a share of the drill's base points

/**
 * The current streak.
 * @param {{ doneDays: string[], protectedDays?: string[], today: string, shields?: number }} a
 *   doneDays: full-bulb days; protectedDays: days covered by a shield or repair.
 *   shields: unused shields, which (as they would be on your next visit) cover
 *   the days missed since your last active day, if there are enough of them.
 * @returns {{ streak: number, gap: number, covered: boolean, repairable: { streak: number } | null }}
 *   gap: days missed just before today (0 if none); covered: shields cover them;
 *   repairable: yesterday was missed with no shield, and a double bulb today saves the streak.
 */
export function streakInfo({ doneDays, protectedDays = [], today, shields = 0 }) {
  const done = new Set(doneDays);
  const prot = new Set(protectedDays);
  const active = (d) => done.has(d) || prot.has(d);
  const countFrom = (from) => {
    let n = 0;
    let x = from;
    while (active(x)) {
      if (done.has(x)) n++;
      x = addDays(x, -1);
    }
    return n;
  };
  // Days missed just before today (looking back a little further than shields reach).
  let gap = 0;
  let d = addDays(today, -1);
  while (!active(d) && gap <= MAX_SHIELDS) {
    gap++;
    d = addDays(d, -1);
  }
  const before = active(d) ? countFrom(d) : 0; // the streak up to the last active day
  const todayDone = done.has(today) ? 1 : 0;
  if (gap === 0) return { streak: before + todayDone, gap: 0, covered: true, repairable: null };
  if (before > 0 && gap <= shields) return { streak: before + todayDone, gap, covered: true, repairable: null };
  const repairable = before > 0 && gap === 1 ? { streak: before } : null;
  return { streak: todayDone, gap, covered: false, repairable };
}

/** Days missed since the last active day that shields should cover now (oldest first), or []. */
export function shieldDaysToUse({ doneDays, protectedDays = [], today, shields }) {
  const info = streakInfo({ doneDays, protectedDays, today, shields });
  if (!info.covered || info.gap === 0) return [];
  const days = [];
  for (let i = info.gap; i >= 1; i--) days.push(addDays(today, -i));
  return days;
}

/**
 * Weave extra cloves (beyond the full bulb) into the braid.
 * @returns {{ braid: number, shields: number, earned: number }}
 */
export function weaveBraid({ braid, shields, cloveBefore, cloveAfter }) {
  const extra = Math.max(0, cloveAfter - BULB_SIZE) - Math.max(0, cloveBefore - BULB_SIZE);
  let b = braid + Math.max(0, extra);
  let s = shields;
  let earned = 0;
  while (b >= BRAID_SIZE - 1e-9 && s < MAX_SHIELDS) {
    b -= BRAID_SIZE;
    s++;
    earned++;
  }
  if (s >= MAX_SHIELDS) b = Math.min(b, BRAID_SIZE);
  return { braid: Math.max(0, b), shields: s, earned };
}

/** Does this solve turn golden? `sinceLast` = eligible solves since the last golden clove. */
export function rollGolden({ eligible, sinceLast, rng = Math.random }) {
  if (!eligible) return false;
  return sinceLast + 1 >= GOLDEN_PITY || rng() < GOLDEN_CHANCE;
}

export function goldenBonus(basePoints) {
  return Math.max(10, Math.round(basePoints * GOLDEN_SHARE));
}
