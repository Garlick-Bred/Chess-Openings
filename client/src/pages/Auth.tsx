import { useEffect, useState } from 'react';
import { api, type Config } from '../api';
import RatingField, { DEFAULT_SOURCES } from '../components/RatingField';
import { recentAccounts } from '../App';
import GarlickBulb from '../components/GarlickBulb';

export default function AuthPage({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>(recentAccounts().length ? 'login' : 'register');
  const [username, setUsername] = useState(recentAccounts()[0]?.username ?? '');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [rating, setRating] = useState('');
  const [ratingSource, setRatingSource] = useState('chesscom-rapid');
  const [sources, setSources] = useState<Record<string, string>>(DEFAULT_SOURCES);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const accounts = recentAccounts();

  useEffect(() => {
    api
      .get<Config>('/api/config')
      .then((c) => {
        setInviteRequired(c.inviteRequired);
        if (c.ratingSources) setSources(c.ratingSources);
      })
      .catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await api.post('/api/auth/login', { username, password });
      else
        await api.post('/api/auth/register', {
          username,
          password,
          displayName,
          inviteCode: invite,
          rating: rating.trim() ? Number(rating) : null,
          ratingSource,
        });
      await onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-hero">
          <GarlickBulb filled={3} size={92} celebrate={false} />
          <h1>
            Garlick <b>Openings</b>
          </h1>
          <p className="muted">Your King’s Indian, learned for good: spaced repetition, surprise mistakes to punish, and the reason behind every move.</p>
          <p className="small muted">Already playing Garlick Endgames? Log in with the same username and password.</p>
        </div>

        {mode === 'login' && accounts.length > 0 && (
          <div className="account-chips">
            {accounts.map((a) => (
              <button key={a.username} type="button" className={`account-chip ${a.username === username ? 'on' : ''}`} onClick={() => setUsername(a.username)}>
                <span>{a.avatar}</span>
                {a.displayName}
              </button>
            ))}
          </div>
        )}

        <div className="tabs">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            Log in
          </button>
          <button className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
            New account
          </button>
        </div>

        <form onSubmit={submit} className="form">
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
          </label>
          {mode === 'register' && (
            <label>
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="What the family sees" maxLength={24} />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 8 : 1}
            />
          </label>
          {mode === 'register' && (
            <RatingField
              rating={rating}
              source={ratingSource}
              sources={sources}
              onChange={(r, s) => {
                setRating(r);
                setRatingSource(s);
              }}
            />
          )}
          {mode === 'register' && inviteRequired && (
            <label>
              Family invite code
              <input value={invite} onChange={(e) => setInvite(e.target.value)} required />
            </label>
          )}
          {error && <div className="form-error">{error}</div>}
          <button className="btn primary big" disabled={busy}>
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
