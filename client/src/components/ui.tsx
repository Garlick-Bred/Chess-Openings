import { useEffect, useState } from 'react';
import GarlickBulb from './GarlickBulb';
import type { Chapter, Course } from '../course';
import type { LineProgress } from '../api';

/** What finishing this exercise is worth today, e.g. "Your level · 1 clove". */
export function CloveChip({ mode, atLevel, lessonReplay = false }: { mode: string; atLevel: boolean; lessonReplay?: boolean }) {
  let label: string;
  let fit = 'core';
  if (lessonReplay) label = 'After the lesson · 1 clove';
  else if (mode === 'deck') label = 'From your games · 1 clove';
  else if (atLevel && (mode === 'learn' || mode === 'review')) label = mode === 'review' ? 'Check-up · 1 clove' : 'Today’s test · 1 clove';
  else {
    label = 'Practice · ½ clove';
    fit = 'easy';
  }
  return (
    <span className={`clove-chip fit-${fit}`} title="Clove value when you finish without a miss (halved if the move is shown)">
      <GarlickBulb filled={5} size={12} celebrate={false} />
      {label}
    </span>
  );
}

export function PrincipleChip({ course, id }: { course: Course; id: string }) {
  const p = course.principleById[id];
  if (!p) return null;
  return (
    <a className="principle-chip" href={`#/principles/${p.id}`} title={p.short}>
      🧭 {p.title}
    </a>
  );
}

export function ChapterPlan({ chapter }: { chapter: Chapter }) {
  return (
    <div className="chapter-plan">
      <p className="small">
        <b>Structure:</b> {chapter.plan.structure}
      </p>
      <ul>
        {chapter.plan.ideas.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <p className="small muted">
        <b>In your games:</b> {chapter.plan.yourGames}
      </p>
    </div>
  );
}

/** A per-move countdown for timed check-ups. */
export function MoveTimer({ deadline, seconds }: { deadline: number; seconds: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, deadline - now);
  const pct = Math.min(100, (left / (seconds * 1000)) * 100);
  return (
    <div className={`move-timer ${left === 0 ? 'over' : left < 1500 ? 'low' : ''}`} aria-label={`${(left / 1000).toFixed(1)} seconds left for this move`}>
      <i style={{ width: `${pct}%` }} />
      <span>{left === 0 ? 'Over the clock' : `${(left / 1000).toFixed(1)}s`}</span>
    </div>
  );
}

export function StatusPill({ p, today }: { p?: LineProgress; today: string }) {
  if (!p || p.status === 'new') return <span className="status-pill new">New</span>;
  if (p.status === 'graduated') {
    const due = p.reviewDue && p.reviewDue <= today;
    return <span className={`status-pill grad ${due ? 'due' : ''}`}>{due ? '🩺 Check-up due' : '🎓 Graduated'}</span>;
  }
  return (
    <span className="status-pill learning" title={`${p.cleanDays}/3 days from memory`}>
      <span className="streak-dots">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i < p.cleanDays ? 'on' : ''} />
        ))}
      </span>{' '}
      Learning
    </span>
  );
}

/** Badge icon: 'garlick-N' draws a Garlick bulb with N cloves, otherwise an emoji. */
export function AchIcon({ icon, size = 40 }: { icon: string; size?: number }) {
  const m = /^garlick-(\d)$/.exec(icon);
  if (m) return <GarlickBulb filled={Number(m[1])} size={size * 0.85} celebrate={false} />;
  return <>{icon}</>;
}

export function niceDate(epochSeconds: number) {
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function niceDay(day: string | null): string {
  if (!day) return '';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(ms: number) {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export function pct(x: number | null | undefined) {
  return x == null ? '–' : `${Math.round(x * 100)}%`;
}

export function Sparkline({ values, width = 120, height = 32, color = '#81b64c' }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <span className="muted small">not enough data</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 2 - ((v - min) / span) * (height - 4)}`);
  return (
    <svg width={width} height={height} className="sparkline" role="img" aria-label="trend">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="3" fill={color} />
    </svg>
  );
}
