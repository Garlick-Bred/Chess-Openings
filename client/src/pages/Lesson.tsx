import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { posKey } from '@shared/pgn.js';
import { formatEval } from '@shared/judge.js';
import { go, useApp } from '../App';
import { api, type ExplorerData } from '../api';
import Board, { type Arrow } from '../components/Board';
import { ChapterPlan, PrincipleChip } from '../components/ui';
import { useCourse, moveLabel, type Course, type Line } from '../course';
import { sfx } from '../sound';

/** Step through a line: every move with its explanation, the principle behind it, and master statistics. */
export default function LessonPage({ lineId, school = false }: { lineId: string; school?: boolean }) {
  const course = useCourse();
  if (!course) return <div className="page">Loading…</div>;
  const line = course.lineById[lineId];
  if (!line) {
    return (
      <div className="page">
        <p>Unknown line.</p>
        <a href="#/lines">Back to your repertoire</a>
      </div>
    );
  }
  return <Lesson course={course} line={line} school={school} />;
}

function Lesson({ course, line, school }: { course: Course; line: Line; school: boolean }) {
  const { me } = useApp();
  const [shown, setShown] = useState(0); // number of plies played
  const [auto, setAuto] = useState(false);
  const [explorer, setExplorer] = useState<ExplorerData | null>(null);
  const [showMasters, setShowMasters] = useState(false);
  const [db, setDb] = useState<'masters' | 'club'>('masters');
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const fens = course.lineFens[line.id];
  const chapter = course.chapterById[line.chapter];
  const fen = fens[shown];
  const lastMove = useMemo<[string, string] | null>(() => {
    if (shown === 0) return null;
    const m = new Chess(fens[shown - 1]).move(line.sans[shown - 1]);
    return [m.from, m.to];
  }, [shown, fens, line.sans]);
  const upcoming = shown < line.sans.length ? line.sans[shown] : null;
  const arrows = useMemo<Arrow[]>(() => {
    if (!upcoming) return [];
    const m = new Chess(fen).move(upcoming);
    return [{ from: m.from, to: m.to, color: shown % 2 === 1 ? 'rgba(129, 182, 76, 0.9)' : 'rgba(80, 150, 255, 0.75)' }];
  }, [fen, upcoming, shown]);
  // The explanation of the move just played.
  const current = shown > 0 ? line.sans[shown - 1] : null;
  const pos = shown > 0 ? course.positions[posKey(fens[shown - 1])] : null;
  const note = current ? pos?.notes?.[current] : null;
  const alts = shown > 0 && shown % 2 === 0 ? Object.entries(pos?.alts ?? {}) : [];
  const masters = pos?.m;
  const yours = pos?.yours;
  const evalCp = pos?.e && current ? pos.e[current] : null;

  useEffect(() => {
    if (!auto) return;
    if (!upcoming) {
      setAuto(false);
      return;
    }
    const t = setTimeout(() => step(1), 1800);
    return () => clearTimeout(t);
  });
  useEffect(() => {
    if (!showMasters) return;
    let live = true;
    setExplorer(null);
    setExplorerError(null);
    api
      .get<ExplorerData>(`/api/explorer?fen=${encodeURIComponent(fen)}&db=${db}`)
      .then((d) => live && setExplorer(d))
      .catch((e) => live && setExplorerError(e.message));
    return () => {
      live = false;
    };
  }, [fen, showMasters, db]);

  const step = (d: number) => {
    const n = Math.max(0, Math.min(line.sans.length, shown + d));
    if (n > shown) {
      const m = new Chess(fens[shown]).move(line.sans[shown]);
      if (m.captured) sfx.capture();
      else sfx.move();
    }
    setShown(n);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const replay = () => go(`/line/${line.id}?mode=${me.progress.lines[line.id]?.status === 'graduated' ? 'free' : 'learn'}&lesson=1${school ? '&school=1' : ''}`);
  const atEnd = shown >= line.sans.length;

  return (
    <div className="lesson-page">
      <div className="lesson-bar">
        <span className="lesson-bar-title">
          📖 Lesson<span className="lesson-bar-name"> · {line.name}</span>
        </span>
        <button className="btn back-btn" onClick={replay} title="Play Black’s moves yourself">
          ▶ Play it yourself
        </button>
      </div>
      <div className="play lesson">
        <div className="board-col">
          <div className="board-wrap">
            <Board
              fen={fen}
              orientation="b"
              userColor="b"
              interactive={false}
              dests={new Map()}
              lastMove={lastMove}
              arrows={arrows}
              coordinates={me.user.settings.coordinates}
              onMove={() => undefined}
            />
          </div>
        </div>
        <aside className="panel">
          <div className="panel-head">
            <div className="eyebrow">{chapter?.name}</div>
            <h2>{line.name}</h2>
          </div>

          <div className="lesson-explain" key={shown}>
            {current ? (
              <>
                <div className="row gap">
                  <span className={`who ${shown % 2 === 0 ? 'you' : 'opponent'}`}>{shown % 2 === 0 ? 'You' : 'White'}</span>
                  <b>{moveLabel(shown - 1, current)}</b>
                  {evalCp != null && shown % 2 === 0 && <span className="small muted">Stockfish {formatEval(evalCp)}</span>}
                </div>
                <p>{note?.t ?? (shown % 2 === 1 ? 'White continues with its set-up.' : 'Part of your set-up.')}</p>
                {note?.p?.[0] && <PrincipleChip course={course} id={note.p[0]} />}
                {alts.map(([san, a]) => (
                  <div key={san} className="alt-note small">
                    <b>Not {san}?</b> {a.t}
                  </div>
                ))}
                <div className="small muted stats-line">
                  {masters && masters.t > 0 && masters.mv[current] != null && (
                    <span>
                      Played in {masters.mv[current].toLocaleString()} master game{masters.mv[current] === 1 ? '' : 's'}.{' '}
                    </span>
                  )}
                  {yours?.[current] && shown % 2 === 1 && <span>Your opponents played this {yours[current] === 1 ? 'once' : `${yours[current]} times`}.</span>}
                </div>
              </>
            ) : (
              <>
                <p>{course.course.intro}</p>
                <p className="small muted">
                  {school ? 'A new line for your rotation. ' : ''}Step through the line: every move is explained. Blue arrows show White’s next move, green arrows yours.
                  Then play it yourself from memory.
                </p>
              </>
            )}
            {upcoming && <div className="small muted">Next: {shown % 2 === 1 ? 'you play' : 'White plays'} {moveLabel(shown, upcoming)}</div>}
          </div>

          <div className="lesson-controls">
            <button className="btn" onClick={() => setShown(0)} disabled={shown === 0} aria-label="Restart">
              ⏮
            </button>
            <button className="btn" onClick={() => step(-1)} disabled={shown === 0} aria-label="Back">
              ◀
            </button>
            <button className="btn primary grow" onClick={() => step(1)} disabled={atEnd}>
              Next move ▶
            </button>
            <button className="btn" onClick={() => setAuto((a) => !a)} disabled={atEnd} aria-label={auto ? 'Pause' : 'Auto-play'}>
              {auto ? '⏸' : '⏵'}
            </button>
          </div>

          {atEnd && (
            <div className="lesson-done">
              <b>🧭 {line.plan.q}</b>
              <p className="small">
                <b>{line.plan.options[line.plan.answer]}.</b> {line.plan.why}
              </p>
              <button className="btn primary big full" onClick={replay}>
                ▶ Play it yourself <small>(a full clove, twice a day)</small>
              </button>
            </div>
          )}

          <div className="moves">
            <div className="lesson-moves">
              {line.sans.map((s, i) => (
                <button key={i} className={`lesson-move ${i % 2 === 1 ? 'you' : 'opponent'} ${i === shown - 1 ? 'on' : ''}`} onClick={() => setShown(i + 1)}>
                  <span className="move-n">{i % 2 === 0 ? `${i / 2 + 1}.` : ''}</span> {s}
                </button>
              ))}
            </div>
          </div>

          <div className="tips">
            <button className="tips-toggle" onClick={() => setShowMasters((v) => !v)}>
              {showMasters ? '▾' : '▸'} Games from this position
            </button>
            {showMasters && (
              <div className="segmented small explorer-db">
                <button type="button" className={db === 'masters' ? 'on' : ''} onClick={() => setDb('masters')}>
                  Masters
                </button>
                <button type="button" className={db === 'club' ? 'on' : ''} onClick={() => setDb('club')}>
                  Club players 1000–1600
                </button>
              </div>
            )}
            {showMasters &&
              (explorerError ? (
                <div className="small muted">{explorerError}</div>
              ) : explorer ? (
                <table className="explorer">
                  <tbody>
                    {explorer.moves.slice(0, 6).map((m) => {
                      const n = m.white + m.draws + m.black;
                      const black = n ? Math.round(((m.black + m.draws / 2) / n) * 100) : 0;
                      return (
                        <tr key={m.san}>
                          <td>
                            <b>{m.san}</b>
                          </td>
                          <td className="muted">{n.toLocaleString()}</td>
                          <td className="muted">Black {black}%</td>
                        </tr>
                      );
                    })}
                    {explorer.moves.length === 0 && (
                      <tr>
                        <td className="muted small">No {db === 'club' ? 'club' : 'master'} games reach this position.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <div className="small muted">Loading from the Lichess opening explorer…</div>
              ))}
          </div>
          <div className="tips">
            <details>
              <summary className="tips-toggle">The plan against the {chapter?.name}</summary>
              {chapter && <ChapterPlan chapter={chapter} />}
            </details>
          </div>
        </aside>
      </div>
    </div>
  );
}
