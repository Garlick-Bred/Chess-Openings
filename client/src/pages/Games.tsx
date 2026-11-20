import { useEffect, useState } from 'react';
import { judgeLineMove, GRADE_INFO } from '@shared/judge.js';
import { posKey } from '@shared/pgn.js';
import insights from '@shared/insights.json';
import { api, ApiError, type RecentGame } from '../api';
import { useApp } from '../App';
import { compareWithRepertoire, moveLabel, useCourse, type Course } from '../course';
import { niceDate, pct } from '../components/ui';

/** Your recent chess.com games against the repertoire, plus the analysis of all your King's Indian games. */
export default function GamesPage() {
  const { me } = useApp();
  const course = useCourse();
  const [games, setGames] = useState<RecentGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cc = me.user.settings.chesscom;
  useEffect(() => {
    if (!cc) return;
    api
      .get<{ games: RecentGame[] }>(`/api/games`)
      .then((d) => setGames(d.games))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not reach chess.com'));
  }, [cc]);
  const ins = insights as any;
  const mine = cc?.toLowerCase() === ins.user;
  return (
    <div className="page games">
      <section className="card">
        <div className="eyebrow">Your games</div>
        <h1>Where your games leave the repertoire</h1>
        {!cc ? (
          <p className="muted">
            Add your chess.com username in <a href="#/settings">Settings</a> and your recent games show up here, each one checked against your King’s Indian
            repertoire.
          </p>
        ) : (
          <p className="muted small">Your last games as Black against anything but 1.e4, from chess.com ({cc}). Refreshed every 10 minutes.</p>
        )}
      </section>

      {cc && !games && !error && <p className="muted">Fetching your games from chess.com…</p>}
      {error && <p className="warn">{error}</p>}
      {course && games && <RecentList course={course} games={games} />}

      {mine && (
        <section className="card">
          <h3>All {ins.games} King’s Indian games, analysed</h3>
          <p className="small muted">
            Stockfish checked the first 20 moves of every game. You score {pct(ins.score)}. Your first real mistake comes at a median of move {ins.firstMistakeMedian}; your
            opponents leave master theory first in {pct(ins.opponentLeftFirst)} of games.
          </p>
          <div className="table-wrap">
            <table className="sys-table">
              <thead>
                <tr>
                  <th>White’s system</th>
                  <th>Games</th>
                  <th>Score</th>
                  <th>Mistake by move 10</th>
                  <th>After move 10</th>
                </tr>
              </thead>
              <tbody>
                {ins.systems.map((s: any) => (
                  <tr key={s.name}>
                    <td>
                      <a href={`#/lines/${s.chapter}`}>{s.name}</a>
                    </td>
                    <td>{s.games}</td>
                    <td>{pct(s.score)}</td>
                    <td>{pct(s.mistakeBy10)}</td>
                    <td>{s.evalAfter10 != null ? (s.evalAfter10 > 0 ? '+' : '') + s.evalAfter10.toFixed(1) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">“After move 10” is Stockfish’s evaluation from your side (negative = White is better).</p>
        </section>
      )}
    </div>
  );
}

function RecentList({ course, games }: { course: Course; games: RecentGame[] }) {
  const black = games.filter((g) => g.color === 'b' && g.moves[0] !== 'e4');
  if (!black.length) return <p className="muted">No recent games as Black against 1.d4, 1.c4, 1.Nf3 or the like.</p>;
  const rows = black.map((g) => {
    const cmp = compareWithRepertoire(course, g.moves);
    let grade: string | null = null;
    if (cmp.who === 'you' && cmp.san && cmp.book.length) {
      const pos = course.positions[posKey(cmp.fen)];
      grade = judgeLineMove({ pos, san: cmp.san, book: cmp.book[0] }).grade;
    }
    return { g, cmp, grade };
  });
  const reached = rows.filter((r) => r.cmp.lastIn >= 6).length;
  const yourDeviations = rows.filter((r) => r.cmp.who === 'you' && r.grade && r.grade !== 'alternative').length;
  return (
    <section>
      <p className="small muted">
        {rows.length} recent games as Black. {reached} reached your repertoire (by any move order) for at least three moves; in {yourDeviations} you were the one who
        left it with a worse move.
      </p>
      <div className="line-list">
        {rows.map(({ g, cmp, grade }) => {
          const lineFor = cmp.lastIn > 0 ? course.lines.find((l) => course.lineFens[l.id].some((f) => posKey(f) === posKey(cmp.fen))) : null;
          const firstMoves = g.moves.slice(0, 4).join(' ');
          return (
            <div key={g.url} className="line-row card">
              <div className="grow">
                <div className="small muted">
                  {niceDate(g.end)} · {g.tc} · vs {g.opponent} ({g.oppRating}) · {g.result === 'win' ? 'won' : ['checkmated', 'resigned', 'timeout', 'abandoned', 'lose'].includes(g.result) ? 'lost' : 'draw'}
                </div>
                <div>
                  {cmp.lastIn <= 1 ? (
                    <span>
                      Not in the course: {firstMoves}…{g.moves[1] && g.moves[1] !== 'Nf6' ? ` (your repertoire starts 1...Nf6)` : ''}
                    </span>
                  ) : cmp.lineEnd ? (
                    <span>
                      {cmp.transposed ? 'Reached your repertoire by a different move order and followed' : 'Followed'} it to the end of the line (move {Math.ceil(cmp.lastIn / 2)}).
                    </span>
                  ) : cmp.who === 'you' ? (
                    <span>
                      {cmp.transposed ? 'Transposed into your repertoire; ' : 'In your repertoire '}until <b>{moveLabel(cmp.lastIn, cmp.san!)}</b>, where it plays <b>{cmp.book[0]}</b>.{' '}
                      {grade && <span className={`tone-${GRADE_INFO[grade as keyof typeof GRADE_INFO]?.tone}`}>({GRADE_INFO[grade as keyof typeof GRADE_INFO]?.label})</span>}
                    </span>
                  ) : cmp.who === 'them' ? (
                    <span>
                      {cmp.transposed ? 'Transposed into your repertoire; ' : 'Repertoire '}until <b>{moveLabel(cmp.lastIn, cmp.san!)}</b>: White left the course here.
                    </span>
                  ) : (
                    <span>Still in your repertoire when the game data ends.</span>
                  )}
                </div>
              </div>
              <div className="row gap">
                {lineFor && cmp.lastIn > 1 && (
                  <a className="btn" href={`#/line/${lineFor.id}?mode=free`}>
                    ▶ Drill
                  </a>
                )}
                <a className="btn ghost" href={g.url} target="_blank" rel="noreferrer">
                  ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
