import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { go, useApp, type Route } from '../App';
import Board from '../components/Board';
import ResultModal from '../components/ResultModal';
import { PrincipleChip, CloveChip, MoveTimer, ChapterPlan, niceDate } from '../components/ui';
import { useCourse, useDeck, type Course, type Deck, moveLabel } from '../course';
import { useTrainer, type Exercise } from '../game/useTrainer';
import { nextExerciseRoute, planSurprise, pushRecent } from '../school';
import { GRADE_INFO } from '@shared/judge.js';
import { lineAtLevel } from '@shared/curriculum.js';
import { localDay } from '../api';

const MODE_LABEL: Record<string, string> = {
  learn: '🎓 Learning',
  review: '🩺 Check-up',
  extra: '🔁 Extra practice',
  free: '♟ Practice',
  deck: '',
};

/** /line/<id>?mode=… and /deck/<id> */
export default function DrillPage({ route }: { route: Route }) {
  const { me } = useApp();
  const course = useCourse();
  const deck = useDeck(me.user.settings.chesscom);
  if (!course || deck === undefined) return <div className="page">Loading…</div>;
  return <DrillLoader key={window.location.hash} route={route} course={course} deck={deck} />;
}

function DrillLoader({ route, course, deck }: { route: Route; course: Course; deck: Deck | null }) {
  const { me } = useApp();
  const exercise = useMemo<Exercise | null>(() => {
    if (route.page === 'deck') {
      const item = deck?.byId[route.arg ?? ''];
      return item ? { kind: item.kind, item } : null;
    }
    const line = course.lineById[route.arg ?? ''];
    if (!line) return null;
    const p = me.progress.lines[line.id];
    let mode = (route.query.get('mode') as 'learn' | 'review' | 'extra' | 'free') || 'free';
    if (!['learn', 'review', 'extra', 'free'].includes(mode)) mode = 'free';
    // A check-up is only timed when it's really due.
    const due = mode === 'review' && p?.status === 'graduated' && p.reviewDue && p.reviewDue <= new Date().toISOString().slice(0, 10);
    const lessonReplay = route.query.get('lesson') === '1';
    return {
      kind: 'line',
      line,
      mode,
      lessonReplay,
      moveSeconds: due ? me.user.settings.moveSeconds : 0,
      surprise: planSurprise(course, line, me, mode, lessonReplay, Math.random, route.query.get('surprise') === '1'),
    };
    // decided once per run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!exercise) {
    return (
      <div className="page">
        <p>That exercise doesn’t exist (any more).</p>
        <a href="#/train">Back to training</a>
      </div>
    );
  }
  return <Session course={course} deck={deck} exercise={exercise} school={route.query.get('school') === '1'} />;
}

function Session({ course, deck, exercise, school }: { course: Course; deck: Deck | null; exercise: Exercise; school: boolean }) {
  const { me, refresh } = useApp();
  const { view, onMove, ideaHint, showMove, answerPlan, giveUp } = useTrainer({ course, deck, exercise });
  const [flipped, setFlipped] = useState(false);
  const [modalOpen, setModalOpen] = useState(true);
  const [showPlan, setShowPlan] = useState(false);
  const prevCloves = useMemo(() => me.today.cloves, []); // eslint-disable-line react-hooks/exhaustive-deps
  const line = exercise.kind === 'line' ? exercise.line : null;
  const item = exercise.kind !== 'line' ? exercise.item : null;
  const chapter = course.chapterById[line?.chapter ?? item?.chapter ?? ''];
  const atLevel = useMemo(() => (line ? lineAtLevel(me.progress.lines[line.id], localDay()) && !(exercise.kind === 'line' && exercise.surprise) : true), []); // eslint-disable-line react-hooks/exhaustive-deps
  const exerciseId = line ? line.id : `deck:${item!.id}`;

  useEffect(() => {
    if (view.result) void refresh();
  }, [view.result, refresh]);
  useEffect(() => {
    if (view.phase === 'done') {
      setModalOpen(true);
      pushRecent(exerciseId);
    }
  }, [view.phase, exerciseId]);

  const dests = useMemo(() => {
    const m = new Map<string, string[]>();
    if (view.phase !== 'user') return m;
    const g = new Chess(view.fen);
    for (const mv of g.moves({ verbose: true })) {
      const list = m.get(mv.from) ?? [];
      list.push(mv.to);
      m.set(mv.from, list);
    }
    return m;
  }, [view.fen, view.phase]);
  const check = useMemo(() => {
    const g = new Chess(view.fen);
    if (!g.inCheck()) return null;
    for (const row of g.board()) for (const p of row) if (p && p.type === 'k' && p.color === g.turn()) return p.square;
    return null;
  }, [view.fen]);

  const next = () => {
    if (school) {
      const r = nextExerciseRoute(me, course, deck);
      if (r) return go(r);
      return go('/train');
    }
    if (line) return go(`/line/${line.id}?mode=free&r=${Date.now()}`);
    return go('/train');
  };
  const retry = () => (line ? go(`/line/${line.id}?mode=free&r=${Date.now()}`) : go(`/deck/${item!.id}?r=${Date.now()}`));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'h' && view.phase === 'user') ideaHint();
      if (e.key === 'f') setFlipped((f) => !f);
      if (e.key === 'Enter' && view.phase === 'done' && view.result && !view.result.day.bulbCompletedNow) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mode = exercise.kind === 'line' ? exercise.mode : 'deck';
  const fb = view.feedback;
  const info = fb ? GRADE_INFO[fb.grade as keyof typeof GRADE_INFO] : null;
  const pairs: { n: number; w?: (typeof view.moves)[number]; b?: (typeof view.moves)[number] }[] = [];
  view.moves.forEach((m, i) => {
    const ply = view.startPly + i;
    const idx = Math.floor(ply / 2);
    pairs[idx - Math.floor(view.startPly / 2)] ??= { n: idx + 1 };
    pairs[idx - Math.floor(view.startPly / 2)][ply % 2 === 0 ? 'w' : 'b'] = m;
  });

  const title = line ? line.name : item!.kind === 'punish' ? 'Punish the mistake' : 'Your game: find a better move';
  const g = item?.game;
  const lastTheirs = item?.kind === 'punish' ? moveLabel(item.moves.length - 1, item.theirs ?? '') : null;
  const intro = item
    ? item.kind === 'punish'
      ? `From your ${g!.tc} game (${niceDate(g!.end)}). White just played ${lastTheirs}, a mistake. In the game you played ${item.played}${item.found ? ' and cashed in' : ''}. Find the move that punishes it.`
      : `From your ${g!.tc} game (${niceDate(g!.end)}). Here you played ${moveLabel(item.moves.length, item.played)} and things went wrong. Find a better move.`
    : exercise.kind === 'line' && exercise.lessonReplay
      ? 'You’ve just seen this line in the lesson. Now play Black’s moves from memory.'
      : 'Play Black’s moves from memory. White replies with your repertoire.';

  return (
    <div className="play">
      <div className="board-col">
        <div className={`board-wrap ${view.phase === 'opponent' ? 'waiting' : ''}`}>
          <Board
            fen={view.fen}
            orientation={flipped ? 'w' : 'b'}
            userColor="b"
            interactive={view.phase === 'user'}
            dests={dests}
            lastMove={view.lastMove}
            check={check}
            arrows={view.arrows}
            coordinates={me.user.settings.coordinates}
            autoQueen
            onMove={onMove}
          />
        </div>
      </div>

      <aside className="panel">
        <div className="panel-head">
          <div className="eyebrow">
            {MODE_LABEL[mode] ? `${MODE_LABEL[mode]} · ` : ''}
            {exercise.kind === 'line' && exercise.lessonReplay ? '📖 After the lesson · ' : ''}
            {item ? (item.kind === 'punish' ? '🎯 From your games · ' : '🩹 Your mistakes · ') : ''}
            {chapter?.name}
          </div>
          <h2>{title}</h2>
          <div style={{ marginTop: 6 }}>
            <CloveChip mode={mode} atLevel={atLevel} lessonReplay={exercise.kind === 'line' && exercise.lessonReplay} />
          </div>
          <div className="goal">
            <span className="side-dot b" />
            <span>{intro}</span>
          </div>
          {item && (
            <a className="small" href={item.game.url} target="_blank" rel="noreferrer">
              Open the game on chess.com ↗
            </a>
          )}
        </div>

        {exercise.kind === 'line' && exercise.moveSeconds > 0 && view.phase === 'user' && view.deadline && (
          <MoveTimer deadline={view.deadline} seconds={exercise.moveSeconds} key={view.deadline} />
        )}
        {exercise.kind === 'line' && exercise.moveSeconds > 0 && view.phase !== 'done' && (
          <div className="small muted">⏱️ Timed check-up: {exercise.moveSeconds}s a move, like a blitz game. Slow moves still count, but the check-up repeats sooner.</div>
        )}

        {view.surpriseLive && view.phase === 'user' && (
          <div className="surprise-banner">
            <b>⚡ That’s not the usual move!</b> White has gone off script. Is there something to punish?
          </div>
        )}

        <div className={`feedback ${fb ? `tone-${info?.tone ?? ''}` : ''}`}>
          {fb ? (
            <>
              <span className={`grade-dot tone-${info?.tone ?? ''}`}>{info?.symbol ?? '·'}</span>
              <div className="feedback-body">
                <b>{fb.title}</b>
                {fb.author && <p className="author-note">{fb.author}</p>}
                {fb.micro && <p className="small">{fb.micro}</p>}
                {fb.principle && <PrincipleChip course={course} id={fb.principle} />}
                {fb.reveal && (
                  <p className="small reveal">
                    {exercise.kind === 'line' && view.phase === 'user' ? (
                      <>
                        The repertoire move is <b>{fb.reveal}</b> (green arrow). {fb.bookNote}
                      </>
                    ) : (
                      <>
                        The move to find: <b>{fb.reveal}</b>.
                      </>
                    )}
                  </p>
                )}
                {!fb.reveal && view.phase === 'user' && fb.grade !== 'alternative' && <p className="small muted">Try again.</p>}
              </div>
            </>
          ) : view.note ? (
            <div className="feedback-body">
              <b>
                {view.note.by === 'you' ? '✓ ' : ''}
                {view.note.san}
              </b>
              <p className="small">{view.note.text}</p>
              {view.note.tags[0] && <PrincipleChip course={course} id={view.note.tags[0]} />}
            </div>
          ) : (
            <div className="small muted">{view.phase === 'opponent' ? 'White is moving…' : view.phase === 'user' ? 'Your move (Black).' : ''}</div>
          )}
        </div>

        {view.idea && view.phase === 'user' && (
          <div className="hint-box">
            <b>💡 Idea</b> {view.idea}
          </div>
        )}

        {view.phase === 'plan' && line && (
          <div className="plan-quiz">
            <b>🧭 {line.plan.q}</b>
            {line.plan.options.map((o, i) => (
              <button key={i} className="btn plan-option" onClick={() => answerPlan(i)}>
                {o}
              </button>
            ))}
          </div>
        )}
        {view.planAnswer != null && line && (
          <div className={`plan-quiz answered ${view.planAnswer === line.plan.answer ? 'right' : 'wrong'}`}>
            <b>{view.planAnswer === line.plan.answer ? '✓ Right plan.' : `The plan: ${line.plan.options[line.plan.answer]}`}</b>
            <p className="small">{line.plan.why}</p>
          </div>
        )}

        <div className="moves">
          {pairs.length === 0 && <div className="muted small">Moves will appear here.</div>}
          {pairs.map((p) =>
            p ? (
              <div key={p.n} className="move-row">
                <span className="move-n">{p.n}.</span>
                <MoveCell m={p.w} />
                <MoveCell m={p.b} />
              </div>
            ) : null,
          )}
        </div>

        <div className="actions">
          {exercise.kind === 'line' && (
            <>
              <button className="btn" onClick={ideaHint} disabled={view.phase !== 'user' || !!view.idea} title="The idea behind the move, not the move (keyboard: H)">
                💡 Idea <small>-10%</small>
              </button>
              <button className="btn" onClick={showMove} disabled={view.phase !== 'user' || view.surpriseLive} title="Shows the repertoire move">
                👁 Show move <small>-25%</small>
              </button>
            </>
          )}
          <button className="btn" onClick={() => setFlipped((f) => !f)} title="Keyboard: F">
            ⇅ Flip
          </button>
          {view.phase !== 'done' ? (
            <button className="btn ghost" onClick={giveUp}>
              Stop
            </button>
          ) : (
            <button className="btn primary" onClick={next}>
              Next ▸
            </button>
          )}
        </div>

        {chapter && (
          <div className="tips">
            <button className="tips-toggle" onClick={() => setShowPlan((s) => !s)}>
              {showPlan ? '▾' : '▸'} The plan against the {chapter.name}
            </button>
            {showPlan && <ChapterPlan chapter={chapter} />}
          </div>
        )}
        {line && (
          <div className="row gap small">
            <a href={`#/lesson/${line.id}`}>📖 Lesson for this line</a>
            <a href={`#/lines/${line.chapter}`}>All {chapter?.name} lines</a>
          </div>
        )}
      </aside>

      {view.phase === 'done' && view.outcome && modalOpen && (
        <ResultModal
          title={
            view.outcome.success
              ? item
                ? 'Found it!'
                : view.surpriseResult?.found
                  ? 'Punished!'
                  : 'Line complete!'
              : line && view.outcome.reason !== 'Stopped early.'
                ? 'Finished, with misses'
                : 'Not this time'
          }
          outcome={view.outcome}
          result={view.result}
          submitError={view.submitError}
          prevCloves={prevCloves}
          lineName={line?.name ?? null}
          surprise={view.surpriseResult}
          onNext={next}
          onRetry={retry}
          onLesson={line ? () => go(`/lesson/${line.id}`) : null}
          onReview={() => setModalOpen(false)}
          onBack={() => go('/train')}
          onDone={() => go('/done')}
          nextLabel={school ? 'Next exercise ▸' : line ? 'Play it again ▸' : 'Back to training ▸'}
        />
      )}
    </div>
  );
}

function MoveCell({ m }: { m?: { san: string; by: string; grade?: string; slow?: boolean } }) {
  if (!m) return <span className="move-cell" />;
  return (
    <span className={`move-cell ${m.by} ${m.grade ? `g-${m.grade}` : ''}`} title={m.slow ? 'Over the clock' : undefined}>
      {m.san}
      {m.slow ? ' ⏱' : ''}
    </span>
  );
}
