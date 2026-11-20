// The trainer: plays a repertoire line (or a position from your own games)
// with you as Black, judges every move against the precomputed Stockfish
// data, explains misses (the principle and the concrete reason), and records
// the run.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { posKey } from '@shared/pgn.js';
import { judgeLineMove, judgeChance, judgeDeckMove, isMiss, GRADE_INFO, formatEval } from '@shared/judge.js';
import { explainMove, formatLine, materialSwing } from '@shared/explain.js';
import { api, localDay, type AttemptResult } from '../api';
import { sfx } from '../sound';
import type { Course, Deck, DeckItem, Line, Position } from '../course';
import type { Arrow } from '../components/Board';

export type Exercise =
  | {
      kind: 'line';
      line: Line;
      mode: 'learn' | 'review' | 'extra' | 'free';
      lessonReplay: boolean;
      /** Seconds per move (0 = untimed). */
      moveSeconds: number;
      surprise: { ply: number; san: string; after: string } | null;
    }
  | { kind: 'mistake' | 'punish'; item: DeckItem };

export interface Feedback {
  grade: string;
  san: string;
  title: string;
  micro: string;
  author: string | null;
  principle: string | null;
  /** Why the repertoire move: shown once it's revealed (or after a right move). */
  bookNote: string | null;
  reveal: string | null;
  evalText: string | null;
}

export interface PlayedMove {
  san: string;
  by: 'you' | 'opp';
  grade?: string;
  slow?: boolean;
}

export interface TrainerView {
  phase: 'opponent' | 'user' | 'plan' | 'done';
  fen: string;
  lastMove: [string, string] | null;
  moves: PlayedMove[];
  startPly: number;
  feedback: Feedback | null;
  /** The explanation of the move just played (yours or White's), lesson-style. */
  note: { san: string; text: string; tags: string[]; by: 'you' | 'opp' } | null;
  arrows: Arrow[];
  misses: number;
  alternatives: number;
  ideaHints: number;
  moveHints: number;
  slowMoves: number;
  idea: string | null;
  surpriseLive: boolean;
  surpriseResult: { grade: string; found: boolean; san: string } | null;
  outcome: { success: boolean; reason: string } | null;
  result: AttemptResult | null;
  submitError: string | null;
  planAnswer: number | null;
  /** When the current timed move runs out (ms since epoch), if timed. */
  deadline: number | null;
}

const ARROW_RED = 'rgba(250, 65, 45, 0.85)';
const ARROW_GREEN = 'rgba(129, 182, 76, 0.9)';
const ARROW_ORANGE = 'rgba(255, 167, 38, 0.85)';
const ARROW_BLUE = 'rgba(80, 150, 255, 0.85)';

function arrowFor(fen: string, san: string, color: string): Arrow | null {
  try {
    const m = new Chess(fen).move(san);
    return { from: m.from, to: m.to, color };
  } catch {
    return null;
  }
}

/** The opponent's reply arrow after a move (first move of the refutation line). */
function replyArrow(fen: string, san: string, line: string[], color: string): Arrow | null {
  try {
    const g = new Chess(fen);
    g.move(san);
    return line[1] ? arrowFor(g.fen(), line[1], color) : null;
  } catch {
    return null;
  }
}

function capitalise(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function useTrainer({ course, deck, exercise }: { course: Course; deck: Deck | null | undefined; exercise: Exercise }) {
  const gameRef = useRef(new Chess());
  const plyRef = useRef(0);
  const triesRef = useRef(0);
  const startRef = useRef(Date.now());
  const userMovesRef = useRef(0);
  const firstMissRef = useRef<{ ply: number; san: string; grade: string; principle: string | null } | null>(null);
  const submittedRef = useRef(false);
  // Thinking time: from the moment it's your turn to each move you try (for the speed bonus).
  const thinkRef = useRef(0);
  const turnStartRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const timers = useRef<number[]>([]);

  const isLine = exercise.kind === 'line';
  const line = isLine ? exercise.line : null;
  const item = !isLine ? exercise.item : null;
  const chapter = line?.chapter ?? item?.chapter ?? null;
  const positions: Record<string, Position> = isLine ? course.positions : deck?.positions ?? {};

  const initial = useMemo<TrainerView>(() => {
    const g = new Chess();
    let startPly = 0;
    if (item) {
      for (const s of item.moves) g.move(s);
      startPly = item.moves.length;
    }
    return {
      phase: item ? 'user' : 'opponent',
      fen: g.fen(),
      lastMove: null,
      moves: [],
      startPly,
      feedback: null,
      note: null,
      arrows: [],
      misses: 0,
      alternatives: 0,
      ideaHints: 0,
      moveHints: 0,
      slowMoves: 0,
      idea: null,
      surpriseLive: false,
      surpriseResult: null,
      outcome: null,
      result: null,
      submitError: null,
      planAnswer: null,
      deadline: null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [view, setView] = useState<TrainerView>(initial);
  const viewRef = useRef(view);
  viewRef.current = view;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  // Set up the starting position.
  useEffect(() => {
    const g = new Chess();
    if (item) {
      let last: [string, string] | null = null;
      for (const s of item.moves) {
        const m = g.move(s);
        last = [m.from, m.to];
      }
      gameRef.current = g;
      setView((v) => ({ ...v, fen: g.fen(), lastMove: last, phase: 'user' }));
      startRef.current = Date.now();
      turnStartRef.current = Date.now();
    } else {
      gameRef.current = g;
      plyRef.current = 0;
      later(() => opponentMove(), 450);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveSeconds = isLine ? exercise.moveSeconds : 0;

  const submit = useCallback(
    async (success: boolean, reason: string, final: Partial<TrainerView> = {}) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const v = { ...viewRef.current, ...final };
      const outcome = { success, reason };
      setView((x) => ({ ...x, ...final, phase: 'done', outcome, deadline: null }));
      if (success) sfx.success();
      else sfx.fail();
      const body = {
        kind: exercise.kind,
        itemId: line?.id ?? item?.id,
        mode: isLine ? exercise.mode : 'deck',
        success,
        misses: v.misses,
        alternatives: v.alternatives,
        ideaHints: v.ideaHints,
        moveHints: v.moveHints,
        timed: moveSeconds > 0,
        slowMoves: v.slowMoves,
        surprise: v.surpriseResult,
        firstMiss: firstMissRef.current,
        principle: firstMissRef.current?.principle ?? (v.surpriseResult && !v.surpriseResult.found ? 'cct' : null),
        durationMs: Date.now() - startRef.current,
        thinkMs: Math.round(thinkRef.current),
        finished: finishedRef.current,
        userMoves: userMovesRef.current,
        lessonReplay: isLine ? exercise.lessonReplay : false,
        day: localDay(),
      };
      try {
        const result = await api.post<AttemptResult>('/api/attempts', body);
        setView((x) => ({ ...x, result }));
      } catch (e) {
        setView((x) => ({ ...x, submitError: (e as Error).message }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const userTurn = () => (moveSeconds > 0 ? Date.now() + moveSeconds * 1000 : null);

  // White plays the next line move (or the planned surprise mistake).
  const opponentMove = useCallback(() => {
    if (!line) return;
    const g = gameRef.current;
    const ply = plyRef.current;
    const isSurprise = isLine && exercise.surprise && exercise.surprise.ply === ply;
    const san = isSurprise ? exercise.surprise!.san : line.sans[ply];
    if (!san) return;
    const before = g.fen();
    const m = g.move(san);
    if (m.captured) sfx.capture();
    else sfx.move();
    const note = isSurprise ? null : course.positions[posKey(before)]?.notes?.[san];
    plyRef.current = ply + 1;
    turnStartRef.current = Date.now();
    setView((v) => ({
      ...v,
      fen: g.fen(),
      lastMove: [m.from, m.to],
      moves: [...v.moves, { san: m.san, by: 'opp' }],
      note: note ? { san: m.san, text: note.t, tags: note.p, by: 'opp' } : null,
      feedback: null,
      arrows: [],
      idea: null,
      phase: 'user',
      surpriseLive: !!isSurprise,
      deadline: userTurn(),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishLine = useCallback(() => {
    const v = viewRef.current;
    if (line?.plan) {
      setView((x) => ({ ...x, phase: 'plan', deadline: null }));
      return;
    }
    void submit(v.misses === 0, v.misses === 0 ? 'Every move right.' : `${v.misses} miss${v.misses > 1 ? 'es' : ''} on the way.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answerPlan = useCallback((i: number) => {
    const v = viewRef.current;
    if (v.phase !== 'plan' || v.planAnswer != null) return;
    setView((x) => ({ ...x, planAnswer: i }));
    const clean = v.misses === 0;
    void submit(clean, clean ? 'Every move right.' : `${v.misses} miss${v.misses > 1 ? 'es' : ''} on the way: the line comes back tomorrow.`, { planAnswer: i });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = useCallback(
    (from: string, to: string, promotion?: string) => {
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
      const slow = v.deadline != null && Date.now() > v.deadline;
      userMovesRef.current++;
      if (turnStartRef.current != null) {
        thinkRef.current += Date.now() - turnStartRef.current;
        turnStartRef.current = Date.now(); // a retry after a miss keeps counting from here
      }

      // ---- A position from your games, or a surprise mistake to punish.
      if (!isLine || v.surpriseLive) {
        const pos = !isLine ? positions[item!.key] : course.positions[exercise.kind === 'line' ? exercise.surprise!.after : ''];
        const judged = !isLine
          ? item!.kind === 'punish'
            ? judgeChance({ pos, san, accept: item!.accept })
            : judgeDeckMove({ pos, san, accept: item!.accept })
          : judgeChance({ pos, san });
        const found = judged.grade === 'found';
        const ex = explainMove({ fen, san, pos, book: null, judged, context: 'chance', chapter });
        const best = judged.best;
        let micro = ex.micro;
        if (found) {
          const pv = pos?.pv?.[san] ?? (san === best ? pos?.pv?.[best] : null);
          const sw = pv ? materialSwing(fen, pv.slice(0, 6), fen.split(' ')[1]) : null;
          micro = sw && sw.delta >= 1 ? `Stockfish's line: ${formatLine(fen, pv!.slice(0, Math.max(2, sw.upto)))}.` : `Stockfish agrees: this keeps a clear advantage (${formatEval(judged.cp)}).`;
        } else if (best) {
          const bestLine = pos?.pv?.[best] ?? [best];
          micro = `${micro ? micro + ' ' : ''}Best was ${formatLine(fen, [best], 1)}${bestLine.length > 1 ? `: ${formatLine(fen, bestLine.slice(0, 5))}` : ''} (${formatEval(judged.bestCp)}).`.trim();
        }
        g.move(san);
        if (mv.captured) sfx.capture();
        else sfx.move();
        const arrows: Arrow[] = [];
        if (!found && best) {
          const a = arrowFor(fen, best, ARROW_GREEN);
          if (a) arrows.push(a);
        }
        const info = GRADE_INFO[judged.grade as keyof typeof GRADE_INFO];
        const feedback: Feedback = {
          grade: judged.grade,
          san,
          title: info?.label ?? judged.grade,
          micro,
          author: null,
          principle: found ? null : ex.principle,
          bookNote: null,
          reveal: found ? null : best,
          evalText: judged.cp != null ? formatEval(judged.cp) : null,
        };
        if (!found && !firstMissRef.current) firstMissRef.current = { ply: v.startPly + v.moves.length, san, grade: judged.grade, principle: ex.principle };
        const surpriseResult = isLine ? { grade: judged.grade, found, san } : null;
        const moves = [...v.moves, { san, by: 'you' as const, grade: found ? 'found' : judged.grade }];
        const final = { fen: g.fen(), lastMove: [mv.from, mv.to] as [string, string], moves, feedback, arrows, surpriseLive: false, surpriseResult };
        finishedRef.current = true;
        turnStartRef.current = null;
        if (isLine) {
          const ok = v.misses === 0;
          void submit(ok, found ? 'You punished White’s mistake!' : 'White made a mistake and it slipped by.', final);
        } else {
          void submit(found, found ? (item!.kind === 'punish' ? 'You cashed in.' : 'Much better than in your game.') : 'Not this time.', final);
        }
        return;
      }

      // ---- A move in a repertoire line.
      const ply = plyRef.current;
      const book = line!.sans[ply];
      const pos = course.positions[posKey(fen)];
      const judged = judgeLineMove({ pos, san, book });
      if (judged.grade === 'book') {
        g.move(san);
        if (mv.captured) sfx.capture();
        else sfx.move();
        const note = pos?.notes?.[san];
        plyRef.current = ply + 1;
        turnStartRef.current = null;
        if (plyRef.current >= line!.sans.length) finishedRef.current = true;
        const wasMiss = triesRef.current > 0;
        triesRef.current = 0;
        setView((x) => ({
          ...x,
          fen: g.fen(),
          lastMove: [mv.from, mv.to],
          moves: [...x.moves, { san, by: 'you', grade: wasMiss ? 'fixed' : 'book', slow }],
          note: note ? { san, text: note.t, tags: note.p, by: 'you' } : null,
          feedback: null,
          arrows: [],
          idea: null,
          slowMoves: x.slowMoves + (slow ? 1 : 0),
          phase: 'opponent',
          deadline: null,
        }));
        if (plyRef.current >= line!.sans.length) later(() => finishLine(), 350);
        else later(() => opponentMove(), 450);
        return;
      }
      const ex = explainMove({ fen, san, pos, book, judged, context: 'line', chapter });
      if (judged.grade === 'alternative') {
        sfx.tick();
        const masters = judged.masters ? ` Masters have played it ${judged.masters.toLocaleString()} times.` : '';
        setView((x) => ({
          ...x,
          alternatives: x.alternatives + 1,
          feedback: {
            grade: 'alternative',
            san,
            title: GRADE_INFO.alternative.label,
            micro: `${san} is a good move too (Stockfish ${formatEval(judged.cp)}).${masters} Your repertoire plays something else here: try again.`,
            author: ex.author,
            principle: null,
            bookNote: null,
            reveal: null,
            evalText: formatEval(judged.cp),
          },
          arrows: [],
        }));
        return;
      }
      // A miss: explain, and reveal the move on the second try.
      triesRef.current += 1;
      if (!firstMissRef.current) firstMissRef.current = { ply, san, grade: judged.grade, principle: ex.principle };
      if (judged.grade === 'mistake' || judged.grade === 'blunder') sfx.blunder();
      else sfx.tick();
      const reveal = triesRef.current >= 2 ? book : null;
      const arrows: Arrow[] = [];
      const tried = arrowFor(fen, san, ARROW_ORANGE);
      if (tried) arrows.push(tried);
      const rep = pos?.pv?.[san] ? replyArrow(fen, san, pos.pv[san], ARROW_RED) : null;
      if (rep) arrows.push(rep);
      if (reveal) {
        const a = arrowFor(fen, book, ARROW_GREEN);
        if (a) arrows.push(a);
      }
      const info = GRADE_INFO[judged.grade as keyof typeof GRADE_INFO];
      setView((x) => ({
        ...x,
        misses: x.misses + 1,
        feedback: {
          grade: judged.grade,
          san,
          title: `${capitalise(info?.label ?? judged.grade)}: ${san}`,
          micro: ex.micro || (judged.grade === 'unknown' ? `${san} isn't part of your repertoire, and Stockfish has no verdict stored for it here.` : ''),
          author: ex.author,
          principle: ex.principle,
          bookNote: reveal ? ex.bookNote : null,
          reveal,
          evalText: judged.cp != null ? formatEval(judged.cp) : null,
        },
        arrows,
        moves: x.moves,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** The idea behind the repertoire move, without the move itself. */
  const ideaHint = useCallback(() => {
    const v = viewRef.current;
    if (v.phase !== 'user' || v.idea) return;
    let text: string | null = null;
    if (isLine && !v.surpriseLive) {
      const pos = course.positions[posKey(gameRef.current.fen())];
      const tag = pos?.notes?.[line!.sans[plyRef.current]]?.p?.[0];
      const p = tag ? course.principleById[tag] : null;
      text = p ? `${p.title}. ${p.short}` : 'Look for the move that keeps to your set-up and fights for the centre.';
    } else {
      text = 'White’s last move left something loose or allowed a tactic. Check every capture and every check first.';
    }
    setView((x) => ({ ...x, idea: text, ideaHints: x.ideaHints + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Show the repertoire move (arrow). Counts as a hint, not a miss. */
  const showMove = useCallback(() => {
    const v = viewRef.current;
    if (v.phase !== 'user' || v.surpriseLive || !isLine) return;
    const fen = gameRef.current.fen();
    const a = arrowFor(fen, line!.sans[plyRef.current], ARROW_BLUE);
    setView((x) => ({ ...x, arrows: a ? [a] : x.arrows, moveHints: x.moveHints + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const giveUp = useCallback(() => {
    const v = viewRef.current;
    if (v.phase === 'done') return;
    void submit(false, 'Stopped early.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { view, onMove, ideaHint, showMove, answerPlan, giveUp, gameRef, isMiss };
}
