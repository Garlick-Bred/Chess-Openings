// Thin JSON client for the server API.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
};

/** Local calendar day (YYYY-MM-DD) - the Garlick bulb resets at local midnight. */
export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface Settings {
  sound: boolean;
  coordinates: boolean;
  /** chess.com username: unlocks "Your games" and the personal decks built from them. */
  chesscom: string;
  /** Seconds per move on timed check-ups (0 = untimed). */
  moveSeconds: number;
  /** How often White plays a surprise mistake in a practice run (0-1). */
  surpriseRate: number;
}

export interface User {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  color: string;
  rating: number | null;
  ratingSource: string | null;
  /** Opening rating (Elo-style, same scale as a chess rating). */
  openingRating: number | null;
  openingGames: number;
  /** A personal deck (your mistakes, your opponents' mistakes) exists for your chess.com username. */
  hasDeck: boolean;
  settings: Settings;
}

export interface Config {
  inviteRequired: boolean;
  avatars: string[];
  ratingSources: Record<string, string>;
  moveSeconds: number[];
  surpriseRates: number[];
  sharedAccounts: boolean;
  /** Lichess club-player statistics are available (the server has a Lichess token). */
  clubStats?: boolean;
}

export interface World {
  number: number;
  name: string;
  icon: string;
  scenery: string[];
  accent: string;
  bg: [string, string];
  blurb: string;
}

/** Where a points total sits on the Garlick Path (shared/path.js). */
export interface PathPos {
  world: number;
  stage: number;
  label: string;
  into: number;
  step: number;
  progress: number;
  toNext: number;
  nextLabel: string;
  stageStart: number;
  info: World;
}

export interface Totals {
  points: number;
  runs: number;
  cleanRuns: number;
  golden: number;
  punished: number;
  surprisesFound: number;
  mistakesFixed: number;
  timedClean: number;
  bulbs: number;
  streak: number;
  shields: number;
  maxShields: number;
  braid: number;
  braidSize: number;
  repair: { streak: number; cloves: number } | null;
  shieldUsedOn: string | null;
  graduated: number;
  graduatedByChapter: Record<string, number>;
  chapterLines: Record<string, number>;
  lineCount: number;
  threeStars: number;
  sparRounds: number;
  sparPunished: number;
  path: PathPos;
}

export interface DayInfo {
  day: string;
  cloves: number;
  bulbDone: boolean;
  bonus: number;
  size: number;
  reviews: number;
  deck: number;
  /** Sparring rounds today. */
  spar: number;
  runs: number;
  points: number;
  successes: number;
}

export interface LineProgress {
  status: 'new' | 'learning' | 'graduated';
  cleanDays: number;
  lastDay: string | null;
  reviewDue: string | null;
  reviewStep: number;
  attempts: number;
  successes: number;
}
export interface DeckProgress {
  status: 'new' | 'learning' | 'mastered';
  step: number;
  due: string | null;
  lastDay: string | null;
  attempts: number;
  successes: number;
}

export interface Me {
  user: User;
  totals: Totals;
  today: DayInfo;
  progress: { lines: Record<string, LineProgress>; deck: Record<string, DeckProgress> };
}

export interface AttemptResult {
  points: number;
  /** 1 finished, 2 clean, 3 clean and fast. */
  stars: number;
  difficulty: string;
  /** Clean runs in a row today, including this one (0 if this one wasn't clean). */
  combo: number;
  path: { before: PathPos; after: PathPos; stagesUp: number; newWorld: World | null };
  breakdown: { label: string; points: number }[];
  clean: boolean;
  cloveGain: number;
  cloveNote?: string | null;
  golden: { points: number; total: number } | null;
  braid: { braid: number; shields: number; earned: number; size: number; max: number };
  repaired: { streak: number } | null;
  lessonReplay?: boolean;
  lessonCloveCapped?: boolean;
  rating: { rated: boolean; before: number; after: number; delta: number; puzzle: number };
  school: {
    atLevel: boolean;
    mode: string;
    status: 'new' | 'learning' | 'graduated';
    cleanDays: number;
    needed: number;
    reviewDue: string | null;
    events: { tested?: boolean; learnedDay?: boolean; graduated?: boolean; reviewPassed?: boolean; reviewSlow?: boolean; demoted?: boolean; reset?: boolean };
  } | null;
  deck: { status: string; due: string | null; events: { mastered?: boolean } } | null;
  day: DayInfo & { bulbCompletedNow: boolean; bulbBonus: number; streakBefore: number };
  newAchievements: { id: string; name: string; icon: string; desc: string }[];
  totals: { points: number; path: PathPos; streak: number; shields: number; graduated: number };
}

export interface ExplorerData {
  total: number;
  white: number;
  draws: number;
  black: number;
  opening: { eco: string; name: string } | null;
  moves: { san: string; uci: string; white: number; draws: number; black: number; rating: number }[];
}

export interface RecentGame {
  url: string;
  end: number;
  tc: string;
  color: 'w' | 'b';
  result: string;
  rating: number;
  opponent: string;
  oppRating: number;
  moves: string[];
}
