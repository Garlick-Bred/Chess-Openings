import { useEffect, useState } from 'react';
import { api, localDay } from '../api';
import { useApp } from '../App';
import GarlickBulb from '../components/GarlickBulb';

interface Board {
  players: {
    displayName: string;
    username: string;
    avatar: string;
    color: string;
    rating: number | null;
    openingRating: number | null;
    openingGames: number;
    points: number;
    weekPoints: number;
    runs: number;
    streak: number;
    graduated: number;
    todayCloves: number;
    rank: string;
  }[];
  lineCount: number;
}

export default function LeaderboardPage() {
  const { me } = useApp();
  const [b, setB] = useState<Board | null>(null);
  const [tab, setTab] = useState<'week' | 'all' | 'rating'>('week');
  useEffect(() => {
    api.get<Board>(`/api/leaderboard?day=${localDay()}`).then(setB).catch(() => undefined);
  }, []);
  if (!b) return <div className="page">Loading…</div>;
  const value = (p: Board['players'][number]) => (tab === 'week' ? p.weekPoints : tab === 'all' ? p.points : (p.openingRating ?? 0));
  const players = [...b.players].sort((x, y) => value(y) - value(x));
  return (
    <div className="page family">
      <h1>Family leaderboard</h1>
      <div className="tabs inline">
        <button className={tab === 'week' ? 'on' : ''} onClick={() => setTab('week')}>
          This week
        </button>
        <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
          All time
        </button>
        <button className={tab === 'rating' ? 'on' : ''} onClick={() => setTab('rating')}>
          Opening rating
        </button>
      </div>
      <div className="card list">
        {players.map((p, i) => (
          <div key={p.username} className={`list-row lb-row ${p.username === me.user.username ? 'me' : ''}`}>
            <span className={`lb-pos pos${i + 1}`}>{i + 1}</span>
            <span className="avatar" style={{ background: p.color }}>
              {p.avatar}
            </span>
            <span className="grow">
              <b>{p.displayName}</b>
              <small className="muted">
                {' '}
                · {tab === 'rating' && p.rating ? `chess ${p.rating} · ` : ''}
                {p.rank} · {p.graduated}/{b.lineCount} lines
              </small>
            </span>
            <span title={`${p.todayCloves}/5 cloves today`}>
              <GarlickBulb filled={p.todayCloves} size={22} celebrate={false} />
            </span>
            {p.streak > 0 && <span className="flame small">🔥{p.streak}</span>}
            <b className="pts" title={tab === 'rating' && p.openingGames < 10 ? 'Provisional: fewer than 10 rated runs' : undefined}>
              {tab === 'rating' ? (p.openingRating != null ? `${p.openingRating}${p.openingGames < 10 ? '?' : ''}` : '–') : value(p).toLocaleString()}
            </b>
          </div>
        ))}
        {players.length <= 1 && (
          <div className="muted small pad">Family members show up here once they’ve logged in. Garlick Endgames accounts work here too.</div>
        )}
      </div>
    </div>
  );
}
