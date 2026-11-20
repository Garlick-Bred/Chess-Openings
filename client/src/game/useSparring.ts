// A sparring round: White plays like club players. Each White move is drawn
// from the Lichess database in proportion to how often club players chose it
// (shared/sparring.js). You play Black; your moves are judged with the course
// data while you're in your repertoire, and by Stockfish running in your
// browser (client/src/engine.ts) once White leaves it. When White slips, you
// aren't warned: the round notes whether you found the punishment.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { posKey } from '@shared/pgn.js';
import { GRADE_INFO, formatEval } from '@shared/judge.js';
import { explainMove, formatLine, materialSwing } from '@shared/explain.js';
import { SPAR, sampleMove, whiteSlip, enginePos, judgeSparMove, roundOver, SLIP_SYMBOL } from '@shared/sparring.js';
import { api, ApiError, localDay, type AttemptResult, type Config, type ExplorerData } from '../api';
import { sfx } from '../sound';
import { engine, type EngineLine } from '../engine';
import type { Course } from '../course';
import type { Arrow } from '../components/Board';
import type { Feedback } from './useTrainer';

const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const ARROW_RED = 'rgba(250, 65, 45, 0.85)';
const ARROW_GREEN = 'rgba(129, 182, 76, 0.9)';
const ARROW_ORANGE = 'rgba(255, 167, 38, 0.85)';
const ARROW_BLUE = 'rgba(80, 150, 255, 0.85)';

export interface SparMove {
  san: string;
  by: 'you' | 'opp';
  grade?: string;
  /** White's move turned out to be a slip: ?!, ? or ?? (shown once you've answered it). */
  slip?: string;
}

export interface SparSlip {
  ply: number;
  san: string;
  grade: 'inaccuracy' | 'mistake' | 'blunder';
  share: number;
  /** Your first answer cashed in (null until you've answered). */
  found: boolean | null;
  answer: string | null;
  best: string | null;
}

export interface WhiteInfo {
  san: string;
  share: number;
  games: number;
  total: number;
  db: 'club' | 'masters';
}

export interface SparView {
  phase: 'opponent' | 'user' | 'checking' | 'done';
  fen: string;
  lastMove: [string, string] | null;
  moves: SparMove[];
  feedback: Feedback | null;
  note: { san: string; text: string; tags: string[]; by: 'you' | 'opp' } | null;
  arrows: Arrow[];
  misses: number;
  alternatives: number;
  ideaHints: number;
  moveHints: number;
  idea: string | null;
  slips: SparSlip[];
  white: WhiteInfo | null;
  opening: string | null;
  /** The course chapter the round ran into, if any. */
  chapter: string | null;
  inBook: boolean;
  db: 'club' | 'masters';
  busy: string | null;
  outcome: { success: boolean; reason: string } | null;
  result: AttemptResult | null;
  submitError: string | null;
}

function arrowFor(fen: string, san: string, color: string): Arrow | null {
  try {
    const m = new Chess(fen).move(san);
    return { from: m.from, to: m.to, color };
  } catch {
    return null;
  }
}

/** UCI moves to SAN from a position (stops at the first illegal one). */
export function uciToSan(fen: string, uci: string[]): string[] {
  const g = new Chess(fen);
  const out: string[] = [];
  for (const u of uci) {
    try {
      out.push(g.move({ from: u.slice(0, 2) as Square, to: u.slice(2, 4) as Square, promotion: u[4] }).san);
    } catch {
      break;
    }
  }
  return out;
}

function sanLines(fen: string, lines: EngineLine[]) {
  return lines
    .map((l) => ({ ...l, sans: uciToSan(fen, l.pv) }))
    .filter((l) => l.sans.length)
    .map((l) => ({ san: l.sans[0], cp: l.cp, pv: l.sans }));
}

const pct = (x: number) => (x < 0.01 ? 'under 1%' : `${Math.round(x * 100)}%`);

export function useSparring({ course, rng = Math.random }: { course: Course; rng?: () => number }) {
  const gameRef = useRef(new Chess());
  const startRef = useRef(Date.now());
  const thinkRef = useRef(0);
  const turnStartRef = useRef<number | null>(null);
  const userMovesRef = useRef(0);
  const blackMovesRef = useRef(0);
  const triesRef = useRef(0);
  const submittedRef = useRef(false);
  const finishedRef = useRef(false);
  const firstMissRef = useRef<{ ply: number; san: string; grade: string; principle: string | null } | null>(null);
  const chapterRef = useRef<string | null>(null);
  // Club statistics need a Lichess token on the server (/api/config says); masters otherwise.
  const dbRef = useRef<'club' | 'masters' | null>(null);
  // White's view of the position before White's move (minus the score of your last move).
  const whiteBeforeRef = useRef<number | null>(null);
  // Engine analysis of the position on your turn: the lines, and whether White just slipped.
  const rootRef = useRef<Promise<{ lines: { san: string; cp: number; pv: string[] }[] } | null> | null>(null);
  const slipRef = useRef<SparSlip | null>(null);
  const timers = useRef<number[]>([]);
  const alive = useRef(true);

  // Which course chapter each repertoire position belongs to (the first line that reaches it).
  const chapterOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of course.lines) for (const f of course.lineFens[l.id] ?? []) if (!m.has(posKey(f))) m.set(posKey(f), l.chapter);
    return m;
  }, [course]);
  const firstMoves = useMemo(() => [...new Set(course.lines.map((l) => l.sans[0]))], [course]);

  const [view, setView] = useState<SparView>(() => ({
    phase: 'opponent',
    fen: new Chess().fen(),
    lastMove: null,
    moves: [],
    feedback: null,
    note: null,
    arrows: [],
    misses: 0,
    alternatives: 0,
    ideaHints: 0,
    moveHints: 0,
    idea: null,
    slips: [],
    white: null,
    opening: null,
    chapter: null,
    inBook: true,
    db: 'club',
    busy: 'White is choosing a move…',
    outcome: null,
    result: null,
    submitError: null,
  }));
  const viewRef = useRef(view);
  viewRef.current = view;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      alive.current = false;
      timers.current.forEach((t) => clearTimeout(t));
    },
    [],
  );

  /** The repertoire move in this position, if it's one of your lines. */
  const bookMove = (fen: string): string | null => {
    const set = course.book[posKey(fen)];
    return set && set.size ? [...set][0] : null;
  };

  const submit = useCallback(async (success: boolean, reason: string, final: Partial<SparView> = {}, record = true) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const v = { ...viewRef.current, ...final };
    setView((x) => ({ ...x, ...final, phase: 'done', outcome: { success, reason }, busy: null }));
    if (success) sfx.success();
    else sfx.fail();
    if (blackMovesRef.current === 0 || !record) return; // nothing played (or the engine failed): nothing to record
    const g = gameRef.current;
    const body = {
      kind: 'spar',
      itemId: 'spar',
      mode: 'spar',
      chapter: chapterRef.current,
      success,
      misses: v.misses,
      alternatives: v.alternatives,
      ideaHints: v.ideaHints,
      moveHints: v.moveHints,
      blackMoves: blackMovesRef.current,
      slips: v.slips.map((s) => ({ ply: s.ply, san: s.san, grade: s.grade, found: !!s.found })),
      moves: g.history().join(' '),
      firstMiss: firstMissRef.current,
      principle: firstMissRef.current?.principle ?? null,
      durationMs: Date.now() - startRef.current,
      thinkMs: Math.round(thinkRef.current),
      finished: finishedRef.current,
      userMoves: userMovesRef.current,
      day: localDay(),
    };
    try {
      const result = await api.post<AttemptResult>('/api/attempts', body);
      if (alive.current) setView((x) => ({ ...x, result }));
    } catch (e) {
      if (alive.current) setView((x) => ({ ...x, submitError: (e as Error).message }));
    }
  }, []);

  const finish = useCallback(
    (reason: string, final: Partial<SparView> = {}) => {
      finishedRef.current = true;
      const v = viewRef.current;
      const clean = v.misses === 0;
      void submit(clean, clean ? `${reason} No misses.` : `${reason} ${v.misses} miss${v.misses > 1 ? 'es' : ''} on the way.`, final);
    },
    [submit],
  );

  /** Club statistics for a position (falls back to the masters database without a Lichess token). */
  const explorer = async (fen: string): Promise<ExplorerData> => {
    const get = (db: string) => api.get<ExplorerData>(`/api/explorer?fen=${encodeURIComponent(fen)}&db=${db}`);
    if (dbRef.current == null) {
      const cfg = await api.get<Config>('/api/config').catch(() => null);
      dbRef.current = cfg?.clubStats === false ? 'masters' : 'club';
      setView((x) => ({ ...x, db: dbRef.current! }));
    }
    if (dbRef.current === 'club') {
      try {
        return await get('club');
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 503) throw e;
        dbRef.current = 'masters';
        setView((x) => ({ ...x, db: 'masters' }));
      }
    }
    return get('masters');
  };

  /** Start analysing the position on your turn (runs while you think). */
  const analyseRoot = (fen: string) => {
    const p = engine()
      .analyse(fen, SPAR.ROOT)
      .then((lines) => ({ lines: sanLines(fen, lines) }))
      .catch(() => null);
    rootRef.current = p;
    // Did White's last move give something away? Kept quiet until you answer.
    void p.then((r) => {
      if (!r?.lines.length || whiteBeforeRef.current == null) return;
      const s = whiteSlip({ beforeCp: whiteBeforeRef.current, blackBestCp: r.lines[0].cp });
      const v = viewRef.current;
      const last = v.moves[v.moves.length - 1];
      if (s.grade && last?.by === 'opp' && slipRef.current === null && gameRef.current.fen() === fen) {
        slipRef.current = { ply: v.moves.length - 1, san: last.san, grade: s.grade, share: v.white?.share ?? 0, found: null, answer: null, best: r.lines[0].san };
      }
    });
  };

  // White plays a move club players play here, in proportion to how often they play it.
  const whiteMove = useCallback(async () => {
    const g = gameRef.current;
    const fen = g.fen();
    const t0 = Date.now();
    setView((x) => ({ ...x, phase: 'opponent', busy: 'White is choosing a move…' }));
    let data: ExplorerData;
    try {
      data = await explorer(fen);
    } catch (e) {
      if (!alive.current) return;
      if (blackMovesRef.current > 0) finish(`The opening database couldn't be reached (${(e as Error).message}).`);
      else void submit(false, `The opening database couldn't be reached: ${(e as Error).message}`);
      return;
    }
    if (!alive.current || submittedRef.current) return;
    const over = g.history().length > 0 ? roundOver({ blackMoves: blackMovesRef.current, games: data.total }) : null;
    // On move 1, White picks among the systems your course covers.
    const pick = over ? null : sampleMove(data.moves, rng, { total: data.total, allowed: g.history().length === 0 ? firstMoves : null });
    if (!pick) {
      finish(over ?? 'White is out of the database here.');
      return;
    }
    const wait = Math.max(0, 550 - (Date.now() - t0));
    later(() => {
      if (!alive.current || submittedRef.current) return;
      const before = g.fen();
      const m = g.move(pick.san);
      if (m.captured) sfx.capture();
      else sfx.move();
      const after = g.fen();
      const key = posKey(after);
      const book = bookMove(after);
      if (book && chapterOf.has(key)) chapterRef.current = chapterOf.get(key)!;
      const courseNote = course.positions[posKey(before)]?.notes?.[m.san];
      slipRef.current = null;
      triesRef.current = 0;
      turnStartRef.current = Date.now();
      analyseRoot(after);
      setView((x) => ({
        ...x,
        phase: 'user',
        busy: null,
        fen: after,
        lastMove: [m.from, m.to],
        moves: [...x.moves, { san: m.san, by: 'opp' }],
        note: courseNote ? { san: m.san, text: courseNote.t, tags: courseNote.p, by: 'opp' } : null,
        feedback: null,
        arrows: [],
        idea: null,
        white: { san: m.san, share: pick.share, games: pick.games, total: data.total, db: dbRef.current ?? 'club' },
        opening: data.opening?.name ?? x.opening,
        chapter: chapterRef.current,
        inBook: !!book,
      }));
    }, wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start: load the engine while White makes the first move.
  useEffect(() => {
    void engine()
      .warmUp()
      .catch(() => undefined);
    later(() => void whiteMove(), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = useCallback(async (from: string, to: string, promotion?: string) => {
    const v = viewRef.current;
    if (v.phase !== 'user') return;
    const g = gameRef.current;
    const fen = g.fen();
    let mv;
    try {
      mv = new Chess(fen).move({ from: from as Square, to: to as Square, promotion: promotion ?? 'q' });
    } catch {
      return;
    }
    const san = mv.san;
    const uci = mv.from + mv.to + (mv.promotion ?? '');
    userMovesRef.current++;
    if (turnStartRef.current != null) {
      thinkRef.current += Date.now() - turnStartRef.current;
      turnStartRef.current = null;
    }
    setView((x) => ({ ...x, phase: 'checking', busy: 'Checking your move…', arrows: [{ from: mv.from, to: mv.to, color: ARROW_BLUE }] }));

    // The engine's view of this position, plus your move if it wasn't among its top lines.
    const root = await rootRef.current;
    if (!alive.current) return;
    if (!root) {
      void submit(false, 'Stockfish couldn’t run on this device, so the round stops here (it isn’t recorded).', { arrows: [] }, false);
      return;
    }
    const lines = [...root.lines];
    if (!lines.some((l) => l.san === san)) {
      try {
        const extra = await engine().analyse(fen, { ...SPAR.SINGLE, searchmoves: [uci] });
        lines.push(...sanLines(fen, extra).filter((l) => l.san === san));
      } catch {
        /* judged without it */
      }
    }
    if (!alive.current) return;
    const live = enginePos(lines);
    const book = bookMove(fen);
    const pos = book ? course.positions[posKey(fen)] : null;
    const slip = slipRef.current;
    const firstTry = triesRef.current === 0;
    const judged = judgeSparMove({ san, book, pos, live, chance: !!slip });
    const chapter = chapterRef.current;
    const answerFound = judged.found;

    // A good move, but not your repertoire: try again (not a miss).
    if (judged.retry) {
      sfx.tick();
      const masters = judged.masters ? ` Masters have played it ${judged.masters.toLocaleString()} times.` : '';
      turnStartRef.current = Date.now();
      setView((x) => ({
        ...x,
        phase: 'user',
        busy: null,
        arrows: [],
        alternatives: x.alternatives + 1,
        feedback: {
          grade: 'alternative',
          san,
          title: GRADE_INFO.alternative.label,
          micro: `${san} is a good move too (Stockfish ${formatEval(judged.cp)}).${masters} You're still in your repertoire, which plays something else here: try again.`,
          author: pos?.alts?.[san]?.t ?? null,
          principle: null,
          bookNote: null,
          reveal: null,
          evalText: formatEval(judged.cp),
        },
      }));
      return;
    }

    // White's slip: your first answer decides whether you punished it.
    let slips = v.slips;
    let moves = v.moves;
    if (slip && firstTry) {
      const done = { ...slip, found: answerFound, answer: san, best: judged.best ?? slip.best };
      slips = [...slips, done];
      moves = moves.map((m, i) => (i === slip.ply ? { ...m, slip: SLIP_SYMBOL[slip.grade] } : m));
    }

    if (judged.ok) {
      g.move(san);
      if (mv.captured) sfx.capture();
      else sfx.move();
      blackMovesRef.current++;
      const after = g.fen();
      const myCp = live.e[san] ?? judged.cp ?? null;
      whiteBeforeRef.current = myCp != null ? -myCp : null;
      const wasMiss = triesRef.current > 0;
      triesRef.current = 0;
      slipRef.current = null;
      if (pos && book && chapterOf.has(posKey(fen))) chapterRef.current = chapterOf.get(posKey(fen))!;
      const grade = judged.found ? 'found' : judged.grade;
      let feedback: Feedback | null = null;
      let note: SparView['note'] = null;
      const arrows: Arrow[] = [];
      if (slip && firstTry) {
        const label = `White’s ${Number(fen.split(' ')[5])}.${slip.san}${SLIP_SYMBOL[slip.grade]}`;
        if (judged.found) {
          sfx.success();
          const pv = live.pv[san];
          const sw = pv ? materialSwing(fen, pv.slice(0, 6), 'b') : null;
          feedback = {
            grade: 'found',
            san,
            title: `${GRADE_INFO.found.label} ${san}!`,
            micro: `${label}, played by ${pct(slip.share)} of ${dbRef.current === 'masters' ? 'masters' : 'club players'} here, was a slip. ${
              sw && sw.delta >= 1 && pv ? `Stockfish's line: ${formatLine(fen, pv.slice(0, Math.max(2, sw.upto)))}.` : `Stockfish agrees: you're better now (${formatEval(myCp)}).`
            }`,
            author: null,
            principle: null,
            bookNote: null,
            reveal: null,
            evalText: formatEval(myCp),
          };
        } else {
          const best = judged.best ?? slip.best;
          const bestLine = best ? live.pv[best] ?? (pos?.pv?.[best] ?? [best]) : [];
          feedback = {
            grade: 'partial',
            san,
            title: `${GRADE_INFO.partial.label}: ${san}`,
            micro: `${label} was a slip (${pct(slip.share)} of ${dbRef.current === 'masters' ? 'masters' : 'club players'} play it). ${best ? `${formatLine(fen, [best], 1)} punished it${bestLine.length > 1 ? `: ${formatLine(fen, bestLine.slice(0, 5))}` : ''} (${formatEval(live.e[best] ?? judged.bestCp)}).` : ''} Your move keeps the game going.`,
            author: null,
            principle: 'cct',
            bookNote: null,
            reveal: null,
            evalText: formatEval(myCp),
          };
          if (best) {
            const a = arrowFor(fen, best, ARROW_GREEN);
            if (a) arrows.push(a);
          }
        }
      } else if (judged.source === 'book') {
        const n = pos?.notes?.[san];
        if (n) note = { san, text: n.t, tags: n.p, by: 'you' };
      } else {
        const best = judged.best;
        const info = GRADE_INFO[grade as keyof typeof GRADE_INFO];
        const better = best && best !== san && grade === 'good' ? ` Stockfish slightly prefers ${formatLine(fen, [best], 1)} (${formatEval(judged.bestCp)}).` : '';
        feedback = {
          grade,
          san,
          title: `${info?.label ?? 'Fine'}: ${san}`,
          micro: `You're off the course here, so Stockfish judged it: ${formatEval(myCp)}.${better}`,
          author: null,
          principle: null,
          bookNote: null,
          reveal: null,
          evalText: formatEval(myCp),
        };
      }
      const moveList = [...moves, { san, by: 'you' as const, grade: wasMiss ? 'fixed' : grade }];
      setView((x) => ({ ...x, phase: 'opponent', busy: null, fen: after, lastMove: [mv.from, mv.to], moves: moveList, slips, feedback, note, arrows, idea: null, chapter: chapterRef.current }));
      const over = roundOver({ blackMoves: blackMovesRef.current, gameOver: g.isGameOver(), evalCp: myCp });
      if (over) {
        later(() => finish(over), 400);
        return;
      }
      void whiteMove();
      return;
    }

    // A miss: explain it, show the move on the second try.
    triesRef.current += 1;
    // "line" context: the explanation doesn't name the move to find before the second try.
    const ex = explainMove({ fen, san, pos: pos ?? live, book, judged, context: 'line', chapter });
    if (slip && ex.principle === 'centre') ex.principle = 'cct';
    if (!firstMissRef.current) firstMissRef.current = { ply: g.history().length, san, grade: judged.grade, principle: ex.principle };
    if (judged.grade === 'mistake' || judged.grade === 'blunder') sfx.blunder();
    else sfx.tick();
    const target = book ?? judged.best;
    const reveal = triesRef.current >= 2 ? target : null;
    const arrows: Arrow[] = [];
    const tried = arrowFor(fen, san, ARROW_ORANGE);
    if (tried) arrows.push(tried);
    const reply = (pos?.pv?.[san] ?? live.pv[san])?.[1];
    if (reply) {
      try {
        const g2 = new Chess(fen);
        g2.move(san);
        const a = arrowFor(g2.fen(), reply, ARROW_RED);
        if (a) arrows.push(a);
      } catch {
        /* no arrow */
      }
    }
    if (reveal) {
      const a = arrowFor(fen, reveal, ARROW_GREEN);
      if (a) arrows.push(a);
    }
    const info = GRADE_INFO[judged.grade as keyof typeof GRADE_INFO];
    let micro = ex.micro;
    if (slip && firstTry) micro = `White's last move was a slip, and there was more to get. ${micro}`.trim();
    if (!micro && judged.grade === 'unknown') micro = `${san} isn't part of your repertoire.`;
    turnStartRef.current = Date.now();
    setView((x) => ({
      ...x,
      phase: 'user',
      busy: null,
      misses: x.misses + 1,
      slips,
      moves,
      arrows,
      feedback: {
        grade: judged.grade,
        san,
        title: `${capitalise(info?.label ?? judged.grade)}: ${san}`,
        micro,
        author: ex.author,
        principle: ex.principle,
        bookNote: reveal && book ? ex.bookNote : null,
        reveal,
        evalText: judged.cp != null ? formatEval(judged.cp) : null,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The idea, without the move: the principle in your repertoire, the kind of move off it. */
  const ideaHint = useCallback(async () => {
    const v = viewRef.current;
    if (v.phase !== 'user' || v.idea) return;
    const fen = gameRef.current.fen();
    const book = bookMove(fen);
    let text: string;
    if (slipRef.current) {
      text = 'White’s last move gave something away. Check every capture, check and threat first.';
    } else if (book) {
      const tag = course.positions[posKey(fen)]?.notes?.[book]?.p?.[0];
      const p = tag ? course.principleById[tag] : null;
      text = p ? `${p.title}. ${p.short}` : 'You’re still in your repertoire: keep to your set-up.';
    } else {
      const root = await rootRef.current;
      const best = root?.lines[0]?.san;
      const m = best ? new Chess(fen).move(best) : null;
      text = m ? `The best move here is a ${NAME[m.piece]} move${m.captured ? ' that captures' : ''}.` : 'Look for the move that fights for the centre and finishes your development.';
    }
    if (!alive.current) return;
    setView((x) => ({ ...x, idea: text, ideaHints: x.ideaHints + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Show the move (arrow): counts as a hint, not a miss. */
  const showMove = useCallback(async () => {
    const v = viewRef.current;
    if (v.phase !== 'user') return;
    const fen = gameRef.current.fen();
    const target = bookMove(fen) ?? (await rootRef.current)?.lines[0]?.san;
    if (!target || !alive.current) return;
    const a = arrowFor(fen, target, ARROW_BLUE);
    setView((x) => ({ ...x, arrows: a ? [a] : x.arrows, moveHints: x.moveHints + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const giveUp = useCallback(() => {
    if (viewRef.current.phase === 'done') return;
    void submit(false, 'Stopped early.');
  }, [submit]);

  return { view, onMove, ideaHint, showMove, giveUp };
}

function capitalise(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
