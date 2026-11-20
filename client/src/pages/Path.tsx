import { useState } from 'react';
import { WORLDS, worldInfo, worldStart, stageStep, STAGES_PER_WORLD } from '@shared/path.js';
import { DIFFICULTY, SPEED_PAR } from '@shared/scoring.js';
import { useApp } from '../App';
import PathMap from '../components/PathMap';
import { myRating } from '../school';

/** The Garlick Path: points move you through themed worlds of ten stages each. */
export default function PathPage() {
  const { me } = useApp();
  const path = me.totals.path;
  const [world, setWorld] = useState(path.world);
  const info = worldInfo(world);
  const shown = Math.max(WORLDS.length, path.world + 1);
  return (
    <div className="page path-page">
      <section className="card world-head" style={{ background: `linear-gradient(135deg, ${info.bg[0]}, ${info.bg[1]})`, borderColor: info.accent }}>
        <div className="world-icon" aria-hidden="true">
          {info.icon}
        </div>
        <div className="grow">
          <div className="eyebrow">World {world}</div>
          <h1 style={{ color: info.accent }}>{info.name}</h1>
          <p className="small">{info.blurb}</p>
          {world === path.world ? (
            <>
              <div className="stage-line">
                Stage <b>{path.label}</b> · {path.into}/{path.step} points to {path.nextLabel}
              </div>
              <div className="bar">
                <div style={{ width: `${Math.round(path.progress * 100)}%`, background: info.accent }} />
              </div>
            </>
          ) : world < path.world ? (
            <div className="stage-line">✓ Cleared</div>
          ) : (
            <div className="stage-line">Opens at {worldStart(world).toLocaleString()} points ({(worldStart(world) - me.totals.points).toLocaleString()} to go)</div>
          )}
        </div>
      </section>

      <PathMap path={path} world={world} avatar={me.user.avatar} />

      <section className="card">
        <h3>Worlds</h3>
        <div className="world-list">
          {Array.from({ length: shown }, (_, i) => i + 1).map((w) => {
            const wi = worldInfo(w);
            const state = w < path.world ? 'done' : w === path.world ? 'current' : 'locked';
            return (
              <button key={w} className={`world-chip ${state} ${w === world ? 'on' : ''}`} style={{ borderColor: wi.accent }} onClick={() => setWorld(w)}>
                <span className="world-chip-icon">{state === 'locked' ? '🔒' : wi.icon}</span>
                <span className="grow">
                  <b>
                    {w}. {wi.name}
                  </b>
                  <small className="muted">
                    {state === 'done' ? 'cleared' : state === 'current' ? `you are here: ${path.label}` : `${worldStart(w).toLocaleString()} pts · ${stageStep(w)} a stage`}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3>How you move along the path</h3>
        <p className="small muted">
          Every finished exercise earns points; {STAGES_PER_WORLD} stages make a world, and later worlds need more points per stage ({stageStep(1)} in world 1,{' '}
          {stageStep(2)} in world 2, and so on).
        </p>
        <ul className="earn-list small">
          <li>
            <b>Complete it:</b> a line is worth 8 points plus 2 per move you play; a position from your games 12 to 15. Finishing a line with misses still earns 40%.
          </li>
          <li>
            <b>Harder is worth more:</b> {DIFFICULTY.map((d) => `${d.name} ×${d.mult}`).join(' · ')} (by the exercise’s rating; timed check-ups count as harder).
          </li>
          <li>
            <b>Clean:</b> +25% with no misses and no hints. <b>Speed:</b> up to +30% when you think {SPEED_PAR.line / 2} seconds a move or less (lines) or{' '}
            {SPEED_PAR.deck / 2} seconds (positions from your games).
          </li>
          <li>
            <b>Combos:</b> +10% for each clean run in a row today before this one, up to +50%. <b>Surprises:</b> +50% for punishing White’s mistake.
          </li>
          <li>
            <b>Streaks:</b> a full bulb is worth 50 points, plus 10 for every day of your current streak (up to 150), and ✨ golden cloves add a bonus now and then.
          </li>
          <li>
            <b>Stars:</b> ⭐ finished · ⭐⭐ clean · ⭐⭐⭐ clean and fast.
          </li>
        </ul>
        <p className="small muted">
          Your <b>opening rating ({myRating(me)})</b> is separate: it measures how well you know the openings and goes up and down with your results. The path only
          goes forward.
        </p>
      </section>
    </div>
  );
}
