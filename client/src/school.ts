// Opening School on the client: the same curriculum rules the server uses.
import { buildCurriculum, pickNext, deckDue } from '@shared/curriculum.js';
import { posKey } from '@shared/pgn.js';
import { DEFAULT_RATING } from '@shared/cloves.js';
import { localDay, type Me } from './api';
import type { Course, Deck, Line } from './course';

export function myRating(me: Me): number {
  return me.user.openingRating ?? me.user.rating ?? DEFAULT_RATING;
}

export function curriculumFor(me: Me, course: Course) {
  return buildCurriculum({ lines: course.lines, progress: me.progress.lines, today: localDay() });
}

export function deckDueFor(me: Me, deck: Deck | null | undefined) {
  if (!deck) return [];
  return deckDue(deck.items, me.progress.deck, localDay());
}

/** Session memory: what was played in this browser tab today (for rotation and interleaving). */
const SESSION_KEY = 'go_session_recent';
export function sessionRecent(): string[] {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}');
    return s.day === localDay() ? s.recent ?? [] : [];
  } catch {
    return [];
  }
}
export function pushRecent(id: string) {
  try {
    const recent = [...sessionRecent(), id].slice(-30);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ day: localDay(), recent }));
  } catch {
    /* storage unavailable */
  }
}

/** The next School exercise as a route, or null when nothing is left. */
export function nextExerciseRoute(me: Me, course: Course, deck: Deck | null | undefined): string | null {
  const cur = curriculumFor(me, course);
  const next = pickNext(cur, {
    reviewsToday: me.today.reviews,
    recent: sessionRecent(),
    deckDue: deckDueFor(me, deck),
    deckToday: me.today.deck,
  });
  if (!next) return null;
  if (next.kind === 'deck') return `/deck/${next.id}?school=1`;
  // Learn first, remember later: a line you have never played starts with its lesson.
  if (!me.progress.lines[next.id]) return `/lesson/${next.id}?school=1`;
  return `/line/${next.id}?mode=${next.mode}&school=1`;
}

/**
 * Should White play a surprise mistake in this run, and where?
 * Only in practice runs (not check-ups or a line's first test), and only on
 * lines you have already got right at least once.
 */
export function planSurprise(course: Course, line: Line, me: Me, mode: string, lessonReplay: boolean, rng = Math.random, force = false) {
  if (mode === 'review' || lessonReplay) return null;
  const p = me.progress.lines[line.id];
  const known = p && (p.status === 'graduated' || p.cleanDays > 0);
  if (!known && !force) return null;
  // A surprise run never counts as the line's test for the day (the server
  // records it as practice), so the clean test still comes later.
  const rate = me.user.settings.surpriseRate ?? 0.25;
  if (!force && rng() >= rate) return null;
  const fens = course.lineFens[line.id];
  const options: { ply: number; san: string; after: string }[] = [];
  for (let ply = 2; ply < line.sans.length; ply += 2) {
    const pos = course.positions[posKey(fens[ply])];
    for (const s of pos?.s ?? []) options.push({ ply, san: s.san, after: s.after });
  }
  if (!options.length) return null;
  return options[Math.floor(rng() * options.length)];
}

/** Lines that have at least one surprise mistake to punish. */
export function surpriseLines(course: Course): Line[] {
  return course.lines.filter((l) => {
    const fens = course.lineFens[l.id];
    for (let ply = 2; ply < l.sans.length; ply += 2) if (course.positions[posKey(fens[ply])]?.s?.length) return true;
    return false;
  });
}
