import { useEffect, useState } from 'react';
import { api, localDay } from '../api';
import { useCourse } from '../course';

/** The King's Indian principles: the big picture every explanation links back to. */
export default function PrinciplesPage({ open }: { open?: string }) {
  const course = useCourse();
  const [missed, setMissed] = useState<Record<string, number>>({});
  useEffect(() => {
    api
      .get<any>(`/api/stats?day=${localDay()}`)
      .then((s) => setMissed(Object.fromEntries((s.principles ?? []).map((p: any) => [p.principle, p.n]))))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (open) document.getElementById(`p-${open}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [open, course]);
  if (!course) return <div className="page">Loading…</div>;
  // Which lines use each principle (from the notes on Black's moves).
  const uses: Record<string, Set<string>> = {};
  for (const l of course.lines) {
    const fens = course.lineFens[l.id];
    l.sans.forEach((san, i) => {
      if (i % 2 === 0) return;
      const tag = course.positions[fens[i].split(' ').slice(0, 4).join(' ')]?.notes?.[san]?.p?.[0];
      if (tag) (uses[tag] ??= new Set()).add(l.id);
    });
  }
  return (
    <div className="page principles">
      <section className="card">
        <div className="eyebrow">The big picture</div>
        <h1>King’s Indian principles</h1>
        <p className="muted small">
          Every explanation in the trainer is tagged with one of these. When a move goes wrong, the feedback names the principle it broke, so you can fix the thinking, not
          just the move. The count shows how often each one came up in your own misses.
        </p>
      </section>
      {course.principles.map((p, i) => (
        <section key={p.id} id={`p-${p.id}`} className={`card principle ${open === p.id ? 'open' : ''}`}>
          <div className="row between">
            <h3>
              {i + 1}. {p.title}
            </h3>
            {missed[p.id] ? <span className="status-pill learning">missed {missed[p.id]}×</span> : null}
          </div>
          <p>
            <b>{p.short}</b>
          </p>
          <p className="small">{p.body}</p>
          {uses[p.id] && (
            <div className="small muted">
              In your lines:{' '}
              {[...uses[p.id]].slice(0, 6).map((id, k) => (
                <span key={id}>
                  {k ? ' · ' : ''}
                  <a href={`#/lesson/${id}`}>{course.lineById[id].name}</a>
                </span>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
