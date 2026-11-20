import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { go, useApp } from '../App';
import Board from '../components/Board';
import ResultModal from '../components/ResultModal';
import { PrincipleChip, CloveChip, ChapterPlan } from '../components/ui';
import { useCourse, useDeck, type Course, type Deck } from '../course';
import { useSparring, type SparMove, type SparSlip } from '../game/useSparring';
import { nextExerciseRoute, pushRecent } from '../school';
import { GRADE_INFO } from '@shared/judge.js';
import { SPAR, SLIP_SYMBOL } from '@shared/sparring.js';
import { engineSupported } from '../engine';

/** /spar: a sparring round against club players' moves. */
export default function SparPage() {
  const { me } = useApp();
  const course = useCourse();
  const deck = useDeck(me.user.settings.chesscom);
  if (!course || deck === undefined) return <div className="page">Loading…</div>;
  if (!engineSupported()) {
    return (
      <div className="page">
        <p>Sparring needs Stockfish to run in your browser, and this browser can’t (no WebAssembly or Web Workers).</p>
        <a href="#/train">Back to training</a>
      </div>
    );
  }
  return <Round key={window.location.hash} course={course} deck={deck} />;
}

function Round({ course, deck }: { course: Course; deck: Deck | null }) {
  const { me, refresh } = useApp();
  const { view, onMove, ideaHint, showMove, giveUp } = useSparring({ course });
  const [flipped, setFlipped] = useState(false);
  const [modalOpen, setModalOpen] = useState(true);
  const [showPlan, setShowPlan] = useState(false);
  const prevCloves = useMemo(() => me.today.cloves, []); // eslint-disable-line react-hooks/exhaustive-deps
  const atLevel = useMemo(() => (me.today.spar ?? 0) < SPAR.PER_DAY, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view.result) void refresh();
  }, [view.result, refresh]);
  useEffect(() => {
    if (view.phase === 'done') {
      setModalOpen(true);
      pushRecent('spar');
    }
  }, [view.phase]);

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

  const next = () => go(nextExerciseRoute(me, course, deck) ?? '/train');
  const again = () => go(`/spar?r=${Date.now()}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'h' && view.phase === 'user') void ideaHint();
      if (e.key === 'f') setFlipped((f) => !f);
      if (e.key === 'Enter' && view.phase === 'done' && view.result && !view.result.day.bulbCompletedNow) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fb = view.feedback;
  const info = fb ? GRADE_INFO[fb.grade as keyof typeof GRADE_INFO] : null;
  const pairs: { n: number; w?: SparMove; b?: SparMove }[] = [];
  view.moves.forEach((m, i) => {
    const idx = Math.floor(i / 2);
    pairs[idx] ??= { n: idx + 1 };
    pairs[idx][i % 2 === 0 ? 'w' : 'b'] = m;
  });
  const chapter = view.chapter ? course.chapterById[view.chapter] : null;
  const dbLabel = view.db === 'club' ? 'club players (Lichess, rated 1000–1800, blitz and rapid)' : 'masters (no Lichess token on the server, so the masters database stands in)';
  const found = view.slips.filter((s) => s.found).length;

  return (
    <div className="play">
      <div className="board-col">
        <div className={`board-wrap ${view.phase === 'opponent' || view.phase === 'checking' ? 'waiting' : ''}`}>
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
            onMove={(f, t, p) => void onMove(f, t, p)}
          />
        </div>
      </div>

      <aside className="panel">
        <div className="panel-head">
          <div className="eyebrow">🥊 Sparring{view.opening ? ` · ${view.opening}` : ''}</div>
          <h2>Sparring round</h2>
          <div style={{ marginTop: 6 }}>
            <CloveChip mode="spar" atLevel={atLevel} />
          </div>
          <div className="goal">
            <span className="side-dot b" />
            <span>
              White plays like {dbLabel}: each move is picked in proportion to how often they play it. Keep to your repertoire, and when White slips, punish
              it. Nobody will warn you.
            </span>
          </div>
        </div>

        {view.white && (
          <div className="spar-white small">
            <b>{view.white.san}</b> is played in {view.white.share < 0.01 ? 'under 1%' : `${Math.round(view.white.share * 100)}%`} of{' '}
            {view.white.total.toLocaleString()} {view.white.db === 'club' ? 'club' : 'master'} games here.
            {!view.inBook && view.phase !== 'done' && <span className="spar-offbook"> You’re off the course now: Stockfish is the judge.</span>}
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
                {fb.reveal && view.phase === 'user' && (
                  <p className="small reveal">
                    Play <b>{fb.reveal}</b> (green arrow). {fb.bookNote}
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
            <div className="small muted">{view.busy ?? (view.phase === 'user' ? 'Your move (Black).' : '')}</div>
          )}
          {fb && view.busy && <div className="small muted spar-busy">{view.busy}</div>}
        </div>

        {view.idea && view.phase === 'user' && (
          <div className="hint-box">
            <b>💡 Idea</b> {view.idea}
          </div>
        )}

        <div className="moves">
          {pairs.length === 0 && <div className="muted small">Moves will appear here.</div>}
          {pairs.map((p) => (
            <div key={p.n} className="move-row">
              <span className="move-n">{p.n}.</span>
              <MoveCell m={p.w} />
              <MoveCell m={p.b} />
            </div>
          ))}
        </div>

        <div className="actions">
          <button className="btn" onClick={() => void ideaHint()} disabled={view.phase !== 'user' || !!view.idea} title="The idea behind the move, not the move (keyboard: H)">
            💡 Idea <small>-10%</small>
          </button>
          <button className="btn" onClick={() => void showMove()} disabled={view.phase !== 'user'} title="Shows the move">
            👁 Show move <small>-25%</small>
          </button>
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

        {view.phase === 'done' && <SlipSummary slips={view.slips} db={view.db} />}

        {chapter && (
          <div className="tips">
            <button className="tips-toggle" onClick={() => setShowPlan((s) => !s)}>
              {showPlan ? '▾' : '▸'} The plan against the {chapter.name}
            </button>
            {showPlan && <ChapterPlan chapter={chapter} />}
          </div>
        )}
      </aside>

      {view.phase === 'done' && view.outcome && modalOpen && (
        <ResultModal
          title={view.outcome.success ? (found ? 'Slip punished!' : 'Round complete!') : view.outcome.reason === 'Stopped early.' ? 'Not this time' : 'Round finished, with misses'}
          outcome={view.outcome}
          result={view.result}
          submitError={view.submitError}
          prevCloves={prevCloves}
          lineName={null}
          surprise={null}
          extra={<SlipSummary slips={view.slips} db={view.db} />}
          unratedNote="Sparring rounds don’t change your opening rating: White’s moves are different every time."
          onNext={next}
          onRetry={again}
          retryLabel="Spar another round"
          onLesson={null}
          onReview={() => setModalOpen(false)}
          onBack={() => go('/train')}
          onDone={() => go('/done')}
          nextLabel="Next exercise ▸"
        />
      )}
    </div>
  );
}

/** White's slips this round, and whether you punished them. */
function SlipSummary({ slips, db }: { slips: SparSlip[]; db: 'club' | 'masters' }) {
  const who = db === 'club' ? 'club players' : 'masters';
  if (!slips.length) return <div className="school-note">🥊 White made no real slips this round: these are moves {who} usually play well.</div>;
  const found = slips.filter((s) => s.found).length;
  return (
    <div className={`school-note ${found === slips.length ? 'pass' : 'warn'} spar-slips`}>
      <b>
        ⚡ White slipped {slips.length === 1 ? 'once' : `${slips.length} times`}: you punished {found === slips.length ? (slips.length === 1 ? 'it' : 'every one') : `${found} of ${slips.length}`}.
      </b>
      <ul>
        {slips.map((s) => (
          <li key={s.ply}>
            {Math.floor(s.ply / 2) + 1}.{s.san}
            {SLIP_SYMBOL[s.grade]} ({s.share < 0.01 ? 'under 1%' : `${Math.round(s.share * 100)}%`} of {who}):{' '}
            {s.found ? (
              <>
                you found {s.answer} ✓
              </>
            ) : (
              <>
                you played {s.answer}
                {s.best && s.best !== s.answer ? `; ${s.best} was the punishment` : ''}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoveCell({ m }: { m?: SparMove }) {
  if (!m) return <span className="move-cell" />;
  return (
    <span className={`move-cell ${m.by} ${m.grade ? `g-${m.grade}` : ''} ${m.slip ? 'g-slip' : ''}`}>
      {m.san}
      {m.slip ?? ''}
    </span>
  );
}
