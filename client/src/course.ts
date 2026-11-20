// The course data (shared/course.json) and personal decks, loaded lazily so
// the first page stays small. Everything the trainer judges comes from here.
import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { posKey } from '@shared/pgn.js';

export interface Note {
  t: string;
  p: string[];
}
export interface Position {
  fen: string;
  notes?: Record<string, Note>;
  alts?: Record<string, Note & { v: string[] }>;
  m?: { t: number; mv: Record<string, number> };
  yours?: Record<string, number>;
  e?: Record<string, number>;
  pv?: Record<string, string[]>;
  s?: { san: string; after: string; seen: number }[];
  punish?: { moves: string[]; best: string; gain: number };
}
export interface Plan {
  q: string;
  options: string[];
  answer: number;
  why: string;
}
export interface Line {
  id: string;
  chapter: string;
  name: string;
  sans: string[];
  plan: Plan;
  blackMoves: number;
  rating: number;
}
export interface Chapter {
  id: string;
  name: string;
  white: string;
  games: number;
  plan: { structure: string; ideas: string[]; yourGames: string };
  lines: string[];
}
export interface Principle {
  id: string;
  title: string;
  short: string;
  body: string;
}
export interface Course {
  version: number;
  engine: string;
  course: { id: string; name: string; side: 'w' | 'b'; intro: string };
  principles: Principle[];
  chapters: Chapter[];
  lines: Line[];
  positions: Record<string, Position>;
  // Derived on load:
  lineById: Record<string, Line>;
  chapterById: Record<string, Chapter>;
  principleById: Record<string, Principle>;
  /** Repertoire moves per position (from every line), for "where did a game leave the repertoire?". */
  book: Record<string, Set<string>>;
  /** Position keys along each line, ply by ply (fen before each move). */
  lineFens: Record<string, string[]>;
  /** Every position on any line, for transposition-aware comparisons. */
  inRep: Set<string>;
}

export interface DeckItem {
  id: string;
  kind: 'mistake' | 'punish';
  key: string;
  moves: string[];
  played: string;
  theirs: string | null;
  best: string;
  accept: string[];
  found: boolean;
  chapter: string;
  game: { url: string; end: number; tc: string; oppRating: number | null; rating: number | null; result: string; system: string };
}
export interface Deck {
  user: string;
  items: DeckItem[];
  positions: Record<string, Position>;
  byId: Record<string, DeckItem>;
}

let coursePromise: Promise<Course> | null = null;

export function loadCourse(): Promise<Course> {
  coursePromise ??= import('@shared/course.json').then((mod) => {
    const raw = (mod as any).default ?? mod;
    const c = raw as Course;
    c.lineById = Object.fromEntries(c.lines.map((l) => [l.id, l]));
    c.chapterById = Object.fromEntries(c.chapters.map((ch) => [ch.id, ch]));
    c.principleById = Object.fromEntries(c.principles.map((p) => [p.id, p]));
    c.book = {};
    c.lineFens = {};
    c.inRep = new Set();
    for (const l of c.lines) {
      const g = new Chess();
      const fens: string[] = [];
      for (const san of l.sans) {
        fens.push(g.fen());
        (c.book[posKey(g.fen())] ??= new Set()).add(san);
        g.move(san);
      }
      fens.push(g.fen());
      c.lineFens[l.id] = fens;
      for (const f of fens) c.inRep.add(posKey(f));
    }
    return c;
  });
  return coursePromise;
}

const DECK_FILES = import.meta.glob('@shared/personal/*.json');
const deckPromises: Record<string, Promise<Deck | null>> = {};

/** The personal deck built from this chess.com username's games, if there is one. */
export function loadDeck(username: string | undefined | null): Promise<Deck | null> {
  const u = (username ?? '').toLowerCase();
  if (!u) return Promise.resolve(null);
  const entry = Object.entries(DECK_FILES).find(([p]) => p.toLowerCase().endsWith(`/${u}.json`));
  if (!entry) return Promise.resolve(null);
  deckPromises[u] ??= entry[1]().then((mod: any) => {
    const d = (mod.default ?? mod) as Deck;
    d.byId = Object.fromEntries(d.items.map((it) => [it.id, it]));
    return d;
  });
  return deckPromises[u];
}

export function useCourse(): Course | null {
  const [c, setC] = useState<Course | null>(null);
  useEffect(() => {
    let live = true;
    void loadCourse().then((x) => live && setC(x));
    return () => {
      live = false;
    };
  }, []);
  return c;
}

export function useDeck(username: string | undefined | null): Deck | null | undefined {
  const [d, setD] = useState<Deck | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void loadDeck(username).then((x) => live && setD(x));
    return () => {
      live = false;
    };
  }, [username]);
  return d;
}

export function positionOf(c: Course, fen: string): Position | undefined {
  return c.positions[posKey(fen)];
}

/** "9...Re8" style label for a move at a ply of a game from the start position. */
export function moveLabel(ply: number, san: string): string {
  const n = Math.floor(ply / 2) + 1;
  return ply % 2 === 0 ? `${n}.${san}` : `${n}...${san}`;
}

export interface Comparison {
  /** Ply of the last repertoire position the game reached (0 = only the start). */
  lastIn: number;
  /** Who played the move that left it for good, if anyone. */
  who: 'you' | 'them' | null;
  san: string | null;
  book: string[];
  fen: string;
  /** The game left the course and came back by a different move order. */
  transposed: boolean;
  /** The game followed a line to its end. */
  lineEnd: boolean;
}

/**
 * Where a game leaves the repertoire, by position (so other move orders that
 * transpose into a line still count).
 */
export function compareWithRepertoire(c: Course, moves: string[]): Comparison {
  const g = new Chess();
  const keys = [posKey(g.fen())];
  const fens = [g.fen()];
  for (const san of moves.slice(0, 40)) {
    try {
      g.move(san);
    } catch {
      break;
    }
    keys.push(posKey(g.fen()));
    fens.push(g.fen());
  }
  let lastIn = 0;
  let firstOut = -1;
  for (let i = 1; i < keys.length; i++) {
    if (c.inRep.has(keys[i])) lastIn = i;
    else if (firstOut < 0) firstOut = i;
  }
  const book = c.book[keys[lastIn]];
  const lineEnd = !book && lastIn > 0;
  const left = lastIn < keys.length - 1 && !lineEnd;
  return {
    lastIn,
    who: left ? (lastIn % 2 === 1 ? 'you' : 'them') : null,
    san: left ? moves[lastIn] : null,
    book: book ? [...book] : [],
    fen: fens[lastIn],
    transposed: firstOut > 0 && firstOut < lastIn,
    lineEnd,
  };
}
