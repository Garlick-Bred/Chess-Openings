import { useEffect, useState } from 'react';
import { addDays } from '@shared/scoring.js';
import { formatCloves } from '@shared/cloves.js';
import { api, localDay } from '../api';
import { useApp } from '../App';
import { Sparkline, pct } from '../components/ui';
import GarlickBulb from '../components/GarlickBulb';
import { useCourse } from '../course';
import { myRating } from '../school';

interface Stats {
  perChapter: { chapter: string; runs: number; successes: number; clean: number; secondsPerMove: number | null }[];
  principles: { principle: string; n: number }[];
  recent: { kind: string; itemId: string; chapter: string; success: boolean; misses: number; surprise: { found: boolean } | null; day: string }[];
  days: { day: string; cloves: number; bulb_done: number; protected?: number }[];
  ratingHistory: { day: string; rating: number }[];
}

export default function StatsPage() {
  const { me } = useApp();
  const course = useCourse();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    api.get<Stats>(`/api/stats?day=${localDay()}`).then(setS).catch(() => undefined);
  }, []);
  if (!s || !course) return <div className="page">Loading…</div>;
  const today = localDay();
  const dayMap = new Map(s.days.map((d) => [d.day, d]));
  const calendar = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const surprises = s.recent.filter((r) => r.surprise);
  const t = me.totals;

  return (
    <div className="page stats">
      <h1>Your stats</h1>
      <div className="tiles">
        <Tile label="Opening rating" value={myRating(me)} />
        <Tile label="Points" value={t.points.toLocaleString()} />
        <Tile label="Lines graduated" value={`${t.graduated}/${t.lineCount}`} />
        <Tile label="Clean runs" value={t.cleanRuns} />
        <Tile label="Mistakes punished" value={`⚔️ ${t.punished}`} />
        <Tile label="Own mistakes fixed" value={`🩹 ${t.mistakesFixed}`} />
        <Tile label="Bulb streak" value={`🔥 ${t.streak}`} />
        <Tile label="Streak shields" value={`🛡️ ${t.shields}/${t.maxShields}`} />
        <Tile label="Golden cloves" value={`✨ ${t.golden}`} />
      </div>
      <p className="small">
        <a href="#/badges">🏅 Badges ▸</a>
      </p>

      <section className="card">
        <h3>Opening rating</h3>
        <Sparkline values={s.ratingHistory.map((r) => r.rating)} width={300} height={60} />
        <p className="small muted">Elo-style, on the chess rating scale. It starts at your chess rating; clean runs of harder lines raise it most.</p>
      </section>

      <section className="card">
        <h3>The principles behind your misses</h3>
        {s.principles.length === 0 ? (
          <p className="small muted">No misses yet. When a move goes wrong, the principle it broke is counted here.</p>
        ) : (
          <ul className="principle-bars">
            {s.principles.slice(0, 6).map((p) => {
              const pr = course.principleById[p.principle];
              const max = s.principles[0].n;
              return (
                <li key={p.principle}>
                  <a href={`#/principles/${p.principle}`}>{pr?.title ?? p.principle}</a>
                  <span className="bar thin">
                    <span style={{ width: `${(p.n / max) * 100}%` }} />
                  </span>
                  <b>{p.n}</b>
                </li>
              );
            })}
          </ul>
        )}
        {surprises.length > 0 && (
          <p className="small muted">
            Surprise mistakes: you punished {surprises.filter((r) => r.surprise?.found).length} of the last {surprises.length}.
          </p>
        )}
      </section>

      <section className="card">
        <h3>Last 30 days</h3>
        <div className="calendar">
          {calendar.map((d) => {
            const c = dayMap.get(d)?.cloves ?? 0;
            return (
              <div key={d} className={`cal-day c${Math.min(5, Math.ceil(c - 1e-9))} ${dayMap.get(d)?.bulb_done ? 'full' : ''}`} title={`${d}: ${formatCloves(c)} clove${c === 1 ? '' : 's'}`}>
                {dayMap.get(d)?.bulb_done ? (
                  <GarlickBulb filled={5} size={14} celebrate={false} />
                ) : dayMap.get(d)?.protected ? (
                  <span title="Covered by a streak shield or repair">🛡️</span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="small muted">Darker = more cloves. A Garlick bulb means the full five cloves.</div>
      </section>

      <section className="card">
        <h3>By chapter</h3>
        <div className="table-wrap">
          <table className="sys-table">
            <thead>
              <tr>
                <th>Chapter</th>
                <th>Graduated</th>
                <th>Runs</th>
                <th>Clean</th>
                <th>Sec/move</th>
              </tr>
            </thead>
            <tbody>
              {course.chapters.map((ch) => {
                const row = s.perChapter.find((r) => r.chapter === ch.id);
                return (
                  <tr key={ch.id}>
                    <td>
                      <a href={`#/lines/${ch.id}`}>{ch.name}</a>
                    </td>
                    <td>
                      {t.graduatedByChapter[ch.id] ?? 0}/{ch.lines.length}
                    </td>
                    <td>{row?.runs ?? 0}</td>
                    <td>{row ? pct(row.clean / row.runs) : '–'}</td>
                    <td>{row?.secondsPerMove != null ? row.secondsPerMove.toFixed(1) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">Seconds per move matter: in your 5-minute games you used 29% of your clock by move 15, against 18% for your opponents.</p>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card tile">
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}
