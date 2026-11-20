import { STAGES_PER_WORLD, stageStep, worldInfo, worldStart } from '@shared/path.js';
import type { PathPos } from '../api';

const ROW = 78;
const W = 320;
const TOP = 46;

/** x position of stage i (0-based): a winding trail down the map. */
const xAt = (i: number) => W / 2 + 92 * Math.sin(i * 0.95 + 0.4);

/**
 * One world of the Garlick Path: ten stages on a winding trail, top to
 * bottom. Stages you've cleared are filled, your current stage shows how far
 * through it you are, the rest are still ahead.
 */
export default function PathMap({ path, world = path.world, avatar }: { path: PathPos; world?: number; avatar?: string }) {
  const info = worldInfo(world);
  const pts = Array.from({ length: STAGES_PER_WORLD }, (_, i) => ({ x: xAt(i), y: TOP + i * ROW }));
  const height = TOP + (STAGES_PER_WORLD - 1) * ROW + 56;
  const d = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const q = pts[i - 1];
    const my = (q.y + p.y) / 2;
    return `${acc} C ${q.x} ${my}, ${p.x} ${my}, ${p.x} ${p.y}`;
  }, '');
  // How far along this world's trail you are (in stages, fractional).
  const along = world < path.world ? STAGES_PER_WORLD : world > path.world ? 0 : path.stage - 1 + path.progress;
  const doneUpTo = Math.min(STAGES_PER_WORLD - 1, Math.floor(along));
  const doneD = pts.slice(0, doneUpTo + 1).reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const q = arr[i - 1];
    const my = (q.y + p.y) / 2;
    return `${acc} C ${q.x} ${my}, ${p.x} ${my}, ${p.x} ${p.y}`;
  }, '');
  const r = 24;
  const circ = 2 * Math.PI * (r + 5);
  return (
    <svg
      className="path-map"
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label={`${info.name}: stage ${path.world === world ? path.label : `${world}-1`}`}
      style={{ ['--accent' as any]: info.accent }}
    >
      <defs>
        <linearGradient id={`bg${world}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={info.bg[0]} />
          <stop offset="1" stopColor={info.bg[1]} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={height} rx="16" fill={`url(#bg${world})`} />
      {/* Scenery on the far side of each bend */}
      {pts.map((p, i) => (
        <text key={`s${i}`} x={p.x > W / 2 ? p.x - 118 : p.x + 118} y={p.y + 12 + (i % 2) * 14} fontSize="26" textAnchor="middle" opacity="0.75" aria-hidden="true">
          {info.scenery[i % info.scenery.length]}
        </text>
      ))}
      <path d={d} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="10" strokeLinecap="round" strokeDasharray="2 14" />
      {along > 0 && <path d={doneD} fill="none" stroke={info.accent} strokeWidth="8" strokeLinecap="round" opacity="0.9" />}
      {pts.map((p, i) => {
        const stage = i + 1;
        const done = along >= stage;
        const current = world === path.world && path.stage === stage;
        const points = worldStart(world) + i * stageStep(world);
        return (
          <g key={i} className={`path-node ${done ? 'done' : current ? 'current' : 'ahead'}`}>
            {current && (
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 5}
                fill="none"
                stroke={info.accent}
                strokeWidth="5"
                strokeDasharray={`${circ * path.progress} ${circ}`}
                transform={`rotate(-90 ${p.x} ${p.y})`}
                strokeLinecap="round"
              />
            )}
            <circle cx={p.x} cy={p.y} r={r} fill={done ? info.accent : current ? '#f1ece6' : 'rgba(0,0,0,0.45)'} stroke={done || current ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill={done ? '#1d1a17' : current ? '#1d1a17' : 'rgba(255,255,255,0.55)'}>
              {done && !current ? '✓' : `${world}-${stage}`}
            </text>
            {current && avatar && (
              <text x={p.x} y={p.y - r - 12} textAnchor="middle" fontSize="24" className="path-avatar">
                {avatar}
              </text>
            )}
            {!done && !current && (
              <text x={p.x} y={p.y + r + 15} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)">
                {points.toLocaleString()} pts
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
