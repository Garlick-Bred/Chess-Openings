import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, localDay, type Me } from './api';
import { setSoundEnabled } from './sound';
import Header from './components/Header';
import GarlickBulb from './components/GarlickBulb';
import AuthPage from './pages/Auth';
import HomePage from './pages/Home';
import TrainPage from './pages/Train';
import DrillPage from './pages/Drill';
import LinesPage from './pages/Lines';
import LessonPage from './pages/Lesson';
import PrinciplesPage from './pages/Principles';
import GamesPage from './pages/Games';
import StatsPage from './pages/Stats';
import AchievementsPage from './pages/Achievements';
import LeaderboardPage from './pages/Leaderboard';
import SettingsPage from './pages/Settings';
import DayDonePage from './pages/DayDone';

interface AppCtx {
  me: Me;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => useContext(Ctx)!;

export interface Route {
  page: string;
  arg?: string;
  query: URLSearchParams;
}

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const [page, arg] = path.split('/');
  return { page: page || 'home', arg, query: new URLSearchParams(qs ?? '') };
}

/** The hashed name of the app's main script, which changes with every deploy. */
function scriptName(doc: Document): string | null {
  return doc.querySelector('script[type="module"][src]')?.getAttribute('src') ?? null;
}

export function go(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
}

const RECENT_ACCOUNTS = 'go_accounts';
export function rememberAccount(me: Me) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_ACCOUNTS) ?? '[]') as { username: string; displayName: string; avatar: string }[];
    const next = [{ username: me.user.username, displayName: me.user.displayName, avatar: me.user.avatar }, ...list.filter((a) => a.username !== me.user.username)].slice(0, 8);
    localStorage.setItem(RECENT_ACCOUNTS, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}
/** "Done for today" is remembered per account and day in this browser only. */
const doneKey = (username: string) => `go_done_${username}`;
export function markDoneToday(username: string) {
  try {
    localStorage.setItem(doneKey(username), localDay());
  } catch {
    /* storage unavailable */
  }
}
export function isDoneToday(username: string): boolean {
  try {
    return localStorage.getItem(doneKey(username)) === localDay();
  } catch {
    return false;
  }
}
export function recentAccounts(): { username: string; displayName: string; avatar: string }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ACCOUNTS) ?? '[]');
  } catch {
    return [];
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading');

  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0); // new page starts at the top (matters on phones)
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const m = await api.get<Me>(`/api/me?day=${localDay()}`);
      setMe(m);
      setSoundEnabled(m.user.settings.sound);
      rememberAccount(m);
      setState('in');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setState('out');
      else setState((s) => (s === 'loading' ? 'out' : s));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Pick up new deploys in tabs that stay open for days (phones keep them).
  useEffect(() => {
    const own = scriptName(document);
    let stale = false;
    const check = async () => {
      try {
        const html = await (await fetch('/', { cache: 'no-store' })).text();
        const live = scriptName(new DOMParser().parseFromString(html, 'text/html'));
        stale = !!own && !!live && live !== own;
      } catch {
        /* offline: try again later */
      }
      // Reload right away unless a puzzle or lesson is in progress.
      if (stale && !/^#\/(line|deck|lesson)\b/.test(window.location.hash)) window.location.reload();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    // Moving to another page is a safe moment to load the new version.
    const onHash = () => {
      if (stale) window.location.reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('hashchange', onHash);
    const timer = setInterval(() => void check(), 15 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('hashchange', onHash);
      clearInterval(timer);
    };
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    setMe(null);
    setState('out');
    go('/');
  }, []);

  if (state === 'loading')
    return (
      <div className="splash">
        <GarlickBulb filled={5} size={80} celebrate={false} />
      </div>
    );
  if (state === 'out' || !me) return <AuthPage onDone={refresh} />;

  let page;
  switch (route.page) {
    case 'train':
      page = <TrainPage />;
      break;
    case 'line':
    case 'deck':
      page = <DrillPage key={window.location.hash} route={route} />;
      break;
    case 'lines':
      page = <LinesPage open={route.arg} />;
      break;
    case 'lesson':
      page = <LessonPage key={window.location.hash} lineId={route.arg ?? ''} school={route.query.get('school') === '1'} />;
      break;
    case 'principles':
      page = <PrinciplesPage open={route.arg} />;
      break;
    case 'games':
      page = <GamesPage />;
      break;
    case 'done':
      page = <DayDonePage />;
      break;
    case 'stats':
      page = <StatsPage />;
      break;
    case 'badges':
      page = <AchievementsPage />;
      break;
    case 'family':
      page = <LeaderboardPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    default:
      page = <HomePage />;
  }

  return (
    <Ctx.Provider value={{ me, refresh, logout }}>
      <div className={`app page-${route.page}`}>
        <Header route={route} />
        <main>{page}</main>
      </div>
    </Ctx.Provider>
  );
}
