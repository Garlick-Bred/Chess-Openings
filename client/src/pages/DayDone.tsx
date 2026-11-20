import { useEffect, useState } from 'react';
import { useCourse } from '../course';
import { api, localDay } from '../api';
import { formatCloves } from '@shared/cloves.js';
import { go, markDoneToday, useApp } from '../App';
import GarlickBulb from '../components/GarlickBulb';

interface Recent {
  itemId: string;
  kind: string;
  clean?: boolean;
  misses: number;
  success: boolean;
  points: number;
  perfect: boolean;
  day: string;
}

function untilMidnight(now = new Date()): string {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((next.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "Done for today": a wrap-up of the day after the player chooses to stop. */
export default function DayDonePage() {
  const { me } = useApp();
  const today = localDay();
  const [rows, setRows] = useState<Recent[] | null>(null);
  const [countdown, setCountdown] = useState(untilMidnight);

  useEffect(() => {
    markDoneToday(me.user.username);
    api
      .get<{ recent: Recent[] }>(`/api/stats?day=${today}`)
      .then((s) => setRows(s.recent.filter((r) => r.day === today)))
      .catch(() => setRows([]));
    const t = setInterval(() => setCountdown(untilMidnight()), 30000);
    return () => clearInterval(t);
  }, [me.user.username, today]);

  const solved = (rows ?? []).filter((r) => r.success);
  const points = (rows ?? []).reduce((a, r) => a + (r.points ?? 0), 0) + (me.today.bonus ?? 0);
  const perfects = solved.filter((r) => r.misses === 0).length;
  const course = useCourse();
  const byDrill = new Map<string, number>();
  for (const r of solved) {
    const name = r.kind === 'line' ? course?.lineById[r.itemId]?.name ?? r.itemId : r.kind === 'punish' ? 'Punish (your games)' : 'Your mistakes';
    byDrill.set(name, (byDrill.get(name) ?? 0) + 1);
  }
  const full = me.today.bulbDone;

  return (
    <div className="page day-done">
      <section className="card day-done-card">
        <GarlickBulb filled={Math.min(5, me.today.cloves)} from={0} size={160} />
        <div className="eyebrow">{full ? 'Bulb complete' : 'Done for today'}</div>
        <h1>That's a wrap, {me.user.displayName}!</h1>
        <p className="muted">
          {full ? 'Your bulb is full' : 'Nice session'}
          {me.totals.streak > 0 ? (
            <>
              {' '}
              and your <b className="flame">🔥 {me.totals.streak}-day streak</b> is safe
            </>
          ) : null}
          . A fresh bulb starts in <b>{countdown}</b>.
        </p>
        {full && (
          <p className="small muted">
            🛡️ {me.totals.shields}/{me.totals.maxShields} streak shields
            {me.totals.shields < me.totals.maxShields ? ` · braid ${formatCloves(me.totals.braid)}/${me.totals.braidSize} toward the next` : ''}
          </p>
        )}

        <div className="tiles day-tiles">
          <div className="card tile">
            <div className="tile-value">{rows ? solved.length : '…'}</div>
            <div className="tile-label">{solved.length === 1 ? 'exercise done' : 'exercises done'}</div>
          </div>
          <div className="card tile">
            <div className="tile-value">{rows ? `+${points}` : '…'}</div>
            <div className="tile-label">points today</div>
          </div>
          <div className="card tile">
            <div className="tile-value">{rows ? perfects : '…'}</div>
            <div className="tile-label">clean</div>
          </div>
        </div>

        {byDrill.size > 0 && (
          <div className="day-drills">
            {[...byDrill.entries()].map(([id, n]) => (
              <span key={id} className="chip">
                {id}
                {n > 1 ? ` ×${n}` : ''}
              </span>
            ))}
          </div>
        )}

        <div className="row gap wrap center">
          <button className="btn primary big" onClick={() => go('/')}>
            Home
          </button>
          <button className="btn big" onClick={() => go('/family')}>
            👪 Family board
          </button>
        </div>
        <button className="btn ghost" onClick={() => go('/train')}>
          Actually, one more ▸
        </button>
      </section>
    </div>
  );
}
