import { describe, it, expect } from 'vitest';
import { buildCurriculum, pickNext, advanceLine, advanceDeck, deckDue, ACTIVE_SIZE, GRADUATE_DAYS, REVIEW_DAYS } from '../shared/curriculum.js';

const lines = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, chapter: 'x', rating: 1000 }));
const D = '2026-11-20';

describe('buildCurriculum', () => {
  it('fills the rotation with new lines in course order', () => {
    const cur = buildCurriculum({ lines, progress: {}, today: D });
    expect(cur.active.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(cur.active.length).toBe(ACTIVE_SIZE);
    expect(cur.todo.length).toBe(3);
    expect(cur.upcoming.map((i) => i.id)).toEqual(['d', 'e']);
  });
  it('keeps every started line in the rotation and puts struggling lines first', () => {
    const progress = {
      d: { status: 'learning', attempts: 4, successes: 1 },
      e: { status: 'learning', attempts: 2, successes: 2 },
    };
    const cur = buildCurriculum({ lines, progress, today: D });
    expect(cur.active.map((i) => i.id)).toEqual(['d', 'e', 'a']);
  });
  it('lists graduated lines due for a check-up', () => {
    const progress = { a: { status: 'graduated', reviewDue: '2026-11-19' }, b: { status: 'graduated', reviewDue: '2026-12-01' } };
    const cur = buildCurriculum({ lines, progress, today: D });
    expect(cur.due.map((i) => i.id)).toEqual(['a']);
    expect(cur.graduated.length).toBe(2);
  });
  it('a line tested today is done for the day', () => {
    const cur = buildCurriculum({ lines, progress: { a: { status: 'learning', lastDay: D } }, today: D });
    expect(cur.todo.map((i) => i.id)).toEqual(['b', 'c']);
  });
});

describe('advanceLine', () => {
  it('only the first run of the day is the test', () => {
    let s = advanceLine(undefined, { success: true }, D);
    expect(s.status).toBe('learning');
    expect(s.cleanDays).toBe(1);
    expect(s.events.learnedDay).toBe(true);
    s = advanceLine(s, { success: true }, D);
    expect(s.cleanDays).toBe(1);
    s = advanceLine(s, { success: false }, D); // practice later the same day doesn't reset
    expect(s.cleanDays).toBe(1);
  });
  it(`graduates after ${GRADUATE_DAYS} clean days, then schedules check-ups`, () => {
    let s = advanceLine(undefined, { success: true }, '2026-11-18');
    s = advanceLine(s, { success: true }, '2026-11-19');
    s = advanceLine(s, { success: true }, '2026-11-20');
    expect(s.status).toBe('graduated');
    expect(s.events.graduated).toBe(true);
    expect(s.reviewDue).toBe('2026-11-23');
  });
  it('a miss on the day’s test resets the count', () => {
    let s = advanceLine(undefined, { success: true }, '2026-11-18');
    s = advanceLine(s, { success: false }, '2026-11-19');
    expect(s.cleanDays).toBe(0);
    expect(s.events.reset).toBe(true);
  });
  it('check-ups: pass pushes out, slow repeats the interval, miss demotes', () => {
    const g = { status: 'graduated', cleanDays: 3, reviewDue: D, reviewStep: 0 };
    const pass = advanceLine(g, { success: true }, D);
    expect(pass.reviewStep).toBe(1);
    expect(pass.reviewDue).toBe('2026-11-27'); // REVIEW_DAYS[1] = 7
    const slow = advanceLine(g, { success: true, slow: true }, D);
    expect(slow.reviewStep).toBe(0);
    expect(slow.reviewDue).toBe('2026-11-23');
    const miss = advanceLine(g, { success: false }, D);
    expect(miss.status).toBe('learning');
    expect(miss.cleanDays).toBe(1);
    expect(miss.events.demoted).toBe(true);
    expect(REVIEW_DAYS[0]).toBe(3);
  });
  it('runs before the check-up is due, surprise runs and lesson replays do not move the schedule', () => {
    const g = { status: 'graduated', cleanDays: 3, reviewDue: '2026-12-01', reviewStep: 1 };
    expect(advanceLine(g, { success: false }, D).status).toBe('graduated');
    const l = { status: 'learning', cleanDays: 1, lastDay: '2026-11-19' };
    const s = advanceLine(l, { success: true, counted: false }, D);
    expect(s.cleanDays).toBe(1);
    expect(s.lastDay).toBe('2026-11-19');
  });
});

describe('pickNext', () => {
  it('serves check-ups first, then lines to learn, interleaving deck positions', () => {
    const progress = { e: { status: 'graduated', reviewDue: D } };
    const cur = buildCurriculum({ lines, progress, today: D });
    expect(pickNext(cur, {})).toEqual({ kind: 'line', id: 'e', mode: 'review' });
    expect(pickNext(cur, { recent: ['e'] })).toEqual({ kind: 'line', id: 'a', mode: 'learn' });
    const deck = [{ id: 'm1' }];
    expect(pickNext(cur, { recent: ['e', 'a'], deckDue: deck })).toEqual({ kind: 'deck', id: 'm1', mode: 'deck' });
  });
  it('falls back to extra practice when today is done', () => {
    const progress = Object.fromEntries(['a', 'b', 'c'].map((id) => [id, { status: 'learning', lastDay: D }]));
    const cur = buildCurriculum({ lines: lines.slice(0, 3), progress, today: D });
    expect(pickNext(cur, { recent: ['a'] }).mode).toBe('extra');
  });
});

describe('deck positions', () => {
  it('spaces right answers and brings misses back tomorrow', () => {
    let s = advanceDeck(undefined, { success: true }, D);
    expect(s.due).toBe('2026-11-23');
    s = advanceDeck(s, { success: true }, '2026-11-23');
    expect(s.due).toBe('2026-12-03');
    s = advanceDeck(s, { success: true }, '2026-12-03');
    s = advanceDeck(s, { success: true }, '2027-01-02');
    expect(s.status).toBe('mastered');
    expect(advanceDeck(undefined, { success: false }, D).due).toBe('2026-11-21');
  });
  it('due list: reviews first, then new positions', () => {
    const items = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const progress = { y: { status: 'learning', due: D }, z: { status: 'mastered' } };
    expect(deckDue(items, progress, D).map((i) => i.id)).toEqual(['y', 'x']);
  });
});
