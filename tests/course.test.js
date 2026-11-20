import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import course from '../shared/course.json';
import { posKey } from '../shared/pgn.js';
import { LINES, CHAPTERS, DECKS } from '../shared/course-index.js';

describe('built course data', () => {
  const tags = new Set(course.principles.map((p) => p.id));
  it('has every line in a chapter, and the server index agrees', () => {
    const inChapters = course.chapters.flatMap((c) => c.lines);
    expect(new Set(inChapters)).toEqual(new Set(course.lines.map((l) => l.id)));
    expect(LINES.length).toBe(course.lines.length);
    expect(CHAPTERS.reduce((a, c) => a + c.lines, 0)).toBe(course.lines.length);
  });
  it('every line is legal, ends on a Black move, and has a plan question', () => {
    for (const l of course.lines) {
      const g = new Chess();
      for (const s of l.sans) g.move(s);
      expect(l.sans.length % 2, l.id).toBe(0);
      expect(l.plan.options[l.plan.answer], l.id).toBeTruthy();
    }
  });
  it('every position you play from has a note and Stockfish evaluations', () => {
    let missingEval = 0;
    for (const l of course.lines) {
      const g = new Chess();
      l.sans.forEach((s, i) => {
        const p = course.positions[posKey(g.fen())];
        expect(p, `${l.id} ply ${i}`).toBeTruthy();
        if (i % 2 === 1) {
          if (!p.e || p.e[s] == null) missingEval++;
        }
        g.move(s);
      });
    }
    expect(missingEval).toBe(0);
  });
  it('notes only use known principles', () => {
    for (const p of Object.values(course.positions)) {
      for (const n of Object.values(p.notes ?? {})) for (const t of n.p) expect(tags.has(t), t).toBe(true);
      for (const n of Object.values(p.alts ?? {})) for (const t of n.p) expect(tags.has(t), t).toBe(true);
    }
  });
  it('surprise mistakes are legal and lead to a punish position', () => {
    for (const [k, p] of Object.entries(course.positions)) {
      for (const s of p.s ?? []) {
        const g = new Chess(p.fen);
        g.move(s.san);
        expect(posKey(g.fen())).toBe(s.after);
        expect(course.positions[s.after].punish.moves.length).toBeGreaterThan(0);
      }
    }
  });
  it('personal deck index has stable ids', () => {
    for (const items of Object.values(DECKS)) expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
});
