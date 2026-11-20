// Opening School: spaced repetition for repertoire lines and for the
// positions in your personal decks.
//
// Lines
// * "Now learning": the lines you have started plus new ones, up to
//   ACTIVE_SIZE at a time, in course order (the systems you meet most come
//   first). Lines you are struggling with (under 60% clean over 2+ tries)
//   come first.
// * The first run of a line each day is the test. A clean first run (every
//   move right, "good but not your repertoire" moves allowed) counts as a
//   learned day; a miss resets the count. Later runs that day are practice.
// * GRADUATE_DAYS learned days graduate a line. It then comes back for
//   check-ups after 3, 7, 14, 30 and 60 days (timed, see TIMED_CHECKUPS). A
//   clean check-up pushes the next one out; a slow one repeats the same
//   interval; a miss sends the line back to learning (one learned day kept).
//
// Deck positions (your own mistakes, and your opponents' mistakes to punish)
// * Served between lines (interleaving). A right answer schedules the next
//   look after 3, 10 and 30 days, then it is mastered; a wrong one brings it
//   back tomorrow.
//
// Sparring rounds (shared/sparring.js): White plays like club players. Two a
// day, each after three other exercises, and more once the day's work is done.
import { addDays } from './scoring.js';
import { sparDue } from './sparring.js';

export const ACTIVE_SIZE = 3;
export const GRADUATE_DAYS = 3;
export const REVIEW_DAYS = [3, 7, 14, 30, 60];
export const MAX_REVIEWS_PER_DAY = 6;
export const DECK_DAYS = [3, 10, 30];
export const DECK_PER_DAY = 6;
export const STRUGGLE_RATE = 0.6;
export const STRUGGLE_MIN_TRIES = 2;
/** Check-ups of graduated lines have a per-move clock (seconds; 0 = off). */
export const DEFAULT_MOVE_SECONDS = 5;

/**
 * Where every line stands for this player.
 * @template {{ id: string, chapter: string, rating: number }} L
 * @param {{ lines: L[], progress: Record<string, any>, today: string }} a
 */
export function buildCurriculum({ lines, progress, today }) {
  const items = lines.map((l, order) => {
    const p = progress[l.id] ?? {};
    const attempts = p.attempts ?? 0;
    const rate = attempts ? (p.successes ?? 0) / attempts : null;
    return {
      id: l.id,
      line: l,
      order,
      status: p.status ?? 'new',
      attempts,
      rate,
      struggling: attempts >= STRUGGLE_MIN_TRIES && rate < STRUGGLE_RATE && p.status !== 'graduated',
      cleanDays: p.cleanDays ?? 0,
      lastDay: p.lastDay ?? null,
      testedToday: p.lastDay === today,
      reviewDue: p.reviewDue ?? null,
      reviewStep: p.reviewStep ?? 0,
    };
  });
  const graduated = items.filter((i) => i.status === 'graduated').sort((a, b) => (a.reviewDue ?? '').localeCompare(b.reviewDue ?? ''));
  const started = items
    .filter((i) => i.status === 'learning')
    .sort((a, b) => Number(b.struggling) - Number(a.struggling) || a.order - b.order);
  const fresh = items.filter((i) => i.status === 'new');
  const active = [...started];
  for (const i of fresh) {
    if (active.length >= ACTIVE_SIZE) break;
    active.push(i);
  }
  return {
    active,
    upcoming: fresh.filter((i) => !active.includes(i)),
    graduated,
    due: graduated.filter((i) => i.reviewDue && i.reviewDue <= today),
    todo: active.filter((i) => !i.testedToday),
  };
}

/**
 * Is a run of this line "your level" today (worth a full clove)? The first run
 * of the day of a line you are learning (or starting), or a due check-up.
 */
export function lineAtLevel(p, today) {
  if (!p || p.status === 'new' || p.status === 'learning') return (p?.lastDay ?? null) !== today;
  return !!p.reviewDue && p.reviewDue <= today;
}

/** Same, from a built curriculum. */
export function atYourLevel(cur, lineId) {
  return cur.todo.some((i) => i.id === lineId) || cur.due.some((i) => i.id === lineId);
}

/**
 * The next School exercise.
 * @param {ReturnType<typeof buildCurriculum>} cur
 * @param {{ reviewsToday?: number, recent?: string[], deckDue?: { id: string }[], deckToday?: number, spar?: { available: boolean, today?: number } | null }} opts
 *   recent: exercise ids played this session, oldest first ("deck:<id>" for deck positions)
 * @returns {{ kind: 'line', id: string, mode: 'review'|'learn'|'extra' } | { kind: 'deck', id: string, mode: 'deck' } | { kind: 'spar', id: string, mode: 'spar' } | null}
 */
export function pickNext(cur, { reviewsToday = 0, recent = [], deckDue = [], deckToday = 0, spar = null } = {}) {
  const last = recent[recent.length - 1];
  // Sparring against club players' moves: two a day, one after every three other exercises.
  if (spar && sparDue({ recent, today: spar.today ?? 0, available: !!spar.available })) return { kind: 'spar', id: 'spar', mode: 'spar' };
  const linesSinceDeck = (() => {
    let n = 0;
    for (let i = recent.length - 1; i >= 0 && !recent[i].startsWith('deck:'); i--) n++;
    return n;
  })();
  const deck = deckDue.find((d) => !recent.includes(`deck:${d.id}`));
  // Interleave: a deck position after every two lines, while any are due.
  if (deck && deckToday < DECK_PER_DAY && linesSinceDeck >= 2) return { kind: 'deck', id: deck.id, mode: 'deck' };
  if (reviewsToday < MAX_REVIEWS_PER_DAY) {
    const review = cur.due.find((i) => i.id !== last && !recent.includes(i.id)) ?? cur.due.find((i) => !recent.includes(i.id));
    if (review) return { kind: 'line', id: review.id, mode: 'review' };
  }
  if (cur.todo.length) {
    const choices = cur.todo.length > 1 ? cur.todo.filter((i) => i.id !== last) : cur.todo;
    return { kind: 'line', id: choices[0].id, mode: 'learn' };
  }
  if (deck && deckToday < DECK_PER_DAY) return { kind: 'deck', id: deck.id, mode: 'deck' };
  // Everything for today is done: extra practice on what you're learning,
  // with a sparring round in between.
  if (spar && sparDue({ recent, today: spar.today ?? 0, available: !!spar.available, extra: true })) return { kind: 'spar', id: 'spar', mode: 'spar' };
  const pool = cur.active.length ? cur.active : cur.graduated;
  if (!pool.length) return null;
  const plays = (id) => recent.filter((r) => r === id).length;
  const choices = pool.length > 1 ? pool.filter((i) => i.id !== last) : pool;
  const pick = choices.reduce((best, i) => (plays(i.id) < plays(best.id) ? i : best), choices[0]);
  return { kind: 'line', id: pick.id, mode: 'extra' };
}

/**
 * Update a line after a run.
 * @param {object|undefined} prev stored progress { status, cleanDays, lastDay, reviewDue, reviewStep }
 * @param {{ success: boolean, slow?: boolean, counted?: boolean }} run
 *   success: no misses; slow: a timed check-up went over the clock; counted: false for runs that
 *   must not move the schedule (surprise runs, lesson replays)
 * @returns {{ status, cleanDays, lastDay, reviewDue, reviewStep, events: { tested?, learnedDay?, graduated?, reviewPassed?, reviewSlow?, demoted?, reset? } }}
 */
export function advanceLine(prev, { success, slow = false, counted = true }, today) {
  const s = {
    status: prev?.status ?? 'new',
    cleanDays: prev?.cleanDays ?? 0,
    lastDay: prev?.lastDay ?? null,
    reviewDue: prev?.reviewDue ?? null,
    reviewStep: prev?.reviewStep ?? 0,
  };
  const events = {};
  if (s.status === 'new') s.status = 'learning';
  if (!counted) return { ...s, events };
  if (s.status === 'graduated') {
    if (!s.reviewDue || s.reviewDue > today) return { ...s, events }; // practice, not a check-up
    events.tested = true;
    if (!success) {
      Object.assign(s, { status: 'learning', cleanDays: 1, reviewDue: null, reviewStep: 0, lastDay: today });
      events.demoted = true;
    } else if (slow) {
      s.reviewDue = addDays(today, REVIEW_DAYS[Math.min(s.reviewStep, REVIEW_DAYS.length - 1)]);
      events.reviewSlow = true;
    } else {
      s.reviewStep += 1;
      s.reviewDue = addDays(today, REVIEW_DAYS[Math.min(s.reviewStep, REVIEW_DAYS.length - 1)]);
      events.reviewPassed = true;
    }
    return { ...s, events };
  }
  // Learning: only the first run of the day is the test.
  if (s.lastDay === today) return { ...s, events };
  s.lastDay = today;
  events.tested = true;
  if (success) {
    s.cleanDays += 1;
    events.learnedDay = true;
    if (s.cleanDays >= GRADUATE_DAYS) {
      Object.assign(s, { status: 'graduated', reviewStep: 0, reviewDue: addDays(today, REVIEW_DAYS[0]) });
      events.graduated = true;
    }
  } else {
    if (s.cleanDays > 0) events.reset = true;
    s.cleanDays = 0;
  }
  return { ...s, events };
}

/** Update a deck position after an answer. */
export function advanceDeck(prev, { success }, today) {
  const s = { status: prev?.status ?? 'new', step: prev?.step ?? 0, due: prev?.due ?? null, lastDay: prev?.lastDay ?? null };
  const events = {};
  if (s.lastDay === today && s.status !== 'new') return { ...s, events }; // once a day
  s.lastDay = today;
  if (success) {
    if (s.step >= DECK_DAYS.length) {
      s.status = 'mastered';
      s.due = null;
      events.mastered = true;
    } else {
      s.status = 'learning';
      s.due = addDays(today, DECK_DAYS[s.step]);
      s.step += 1;
    }
  } else {
    s.status = 'learning';
    s.step = 0;
    s.due = addDays(today, 1);
  }
  return { ...s, events };
}

/** Deck positions due today: due reviews first (the ones you got wrong), then new ones in deck order. */
export function deckDue(items, progress, today) {
  const reviews = [];
  const fresh = [];
  for (const it of items) {
    const p = progress[it.id];
    if (!p || p.status === 'new') fresh.push(it);
    else if (p.status !== 'mastered' && p.due && p.due <= today) reviews.push(it);
  }
  return [...reviews, ...fresh];
}
