import { useEffect, useState } from 'react';
import { api } from '../api';
import { AchIcon } from '../components/ui';

interface Ach {
  id: string;
  name: string;
  icon: string;
  desc: string;
  unlockedAt: number | null;
}

export default function AchievementsPage() {
  const [list, setList] = useState<Ach[] | null>(null);
  useEffect(() => {
    api.get<Ach[]>('/api/achievements').then(setList).catch(() => undefined);
  }, []);
  if (!list) return <div className="page">Loading…</div>;
  const got = list.filter((a) => a.unlockedAt).length;
  return (
    <div className="page badges">
      <h1>Badges</h1>
      <p className="muted">
        {got} of {list.length} unlocked
      </p>
      <div className="bar wide">
        <div style={{ width: `${(got / list.length) * 100}%` }} />
      </div>
      <div className="badge-grid">
        {list.map((a) => (
          <div key={a.id} className={`card badge-card ${a.unlockedAt ? 'got' : 'locked'}`}>
            <div className="badge-icon">
              <AchIcon icon={a.icon} size={44} />
            </div>
            <b>{a.name}</b>
            <small className="muted">{a.desc}</small>
            {a.unlockedAt && <small className="badge-date">{new Date(a.unlockedAt).toLocaleDateString()}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}
