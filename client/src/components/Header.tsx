import { useState } from 'react';
import { go, useApp, type Route } from '../App';
import GarlickBulb from './GarlickBulb';

const NAV = [
  { page: 'home', label: 'Home', icon: '⌂', also: ['done', 'path'] },
  { page: 'train', label: 'Train', icon: '🎯', also: ['line', 'deck'] },
  { page: 'lines', label: 'Lines', icon: '📖', also: ['lesson', 'principles'] },
  { page: 'games', label: 'Games', icon: '♟' },
  { page: 'stats', label: 'Stats', icon: '📈', also: ['badges'] },
  { page: 'family', label: 'Family', icon: '👪' },
];

export default function Header({ route }: { route: Route }) {
  const { me, logout } = useApp();
  const [menu, setMenu] = useState(false);
  return (
    <header className="topbar">
      <a className="brand" href="#/">
        <span className="brand-mark">
          <GarlickBulb filled={5} size={24} celebrate={false} />
        </span>
        <span className="brand-name">
          Garlick <b>Openings</b>
        </span>
      </a>
      <nav className="nav">
        {NAV.map((n) => (
          <a key={n.page} href={`#/${n.page === 'home' ? '' : n.page}`} className={route.page === n.page || n.also?.includes(route.page) ? 'active' : ''} title={n.label}>
            <span className="nav-icon">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </a>
        ))}
      </nav>
      <div className="topbar-right">
        <div className="mini-bulb" title={`${me.today.cloves}/5 cloves today`}>
          <GarlickBulb filled={me.today.cloves} size={26} celebrate={false} />
        </div>
        <a className="points-pill stage-pill" href="#/path" title={`${me.totals.points.toLocaleString()} points · ${me.totals.path.info.name}`} style={{ borderColor: me.totals.path.info.accent }}>
          <span aria-hidden="true">{me.totals.path.info.icon}</span>
          {me.totals.path.label}
        </a>
        <button className="avatar-btn" style={{ background: me.user.color }} onClick={() => setMenu((m) => !m)} aria-label="Account menu">
          {me.user.avatar}
        </button>
        {menu && (
          <div className="menu" onMouseLeave={() => setMenu(false)}>
            <div className="menu-head">
              <b>{me.user.displayName}</b>
              <small>
                @{me.user.username} · stage {me.totals.path.label} · {me.totals.points.toLocaleString()} pts
                {me.user.openingRating ? ` · rating ${me.user.openingRating}` : ''}
              </small>
            </div>
            <button
              onClick={() => {
                setMenu(false);
                go('/settings');
              }}
            >
              Settings
            </button>
            <button
              onClick={() => {
                setMenu(false);
                void logout();
              }}
            >
              Switch account / Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
