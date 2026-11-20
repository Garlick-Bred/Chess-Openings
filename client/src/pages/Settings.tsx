import { useEffect, useState } from 'react';
import { api, type Config } from '../api';
import RatingField, { DEFAULT_SOURCES } from '../components/RatingField';
import { useApp } from '../App';

const COLORS = ['#81b64c', '#e8b33a', '#e07b39', '#d64545', '#9b59b6', '#3d9be9', '#26c2a3', '#8d6e63'];

export default function SettingsPage() {
  const { me, refresh, logout } = useApp();
  const s = me.user.settings;
  const [displayName, setDisplayName] = useState(me.user.displayName);
  const [avatar, setAvatar] = useState(me.user.avatar);
  const [color, setColor] = useState(me.user.color);
  const [moveSeconds, setMoveSeconds] = useState(s.moveSeconds);
  const [surpriseRate, setSurpriseRate] = useState(s.surpriseRate);
  const [sound, setSound] = useState(s.sound);
  const [coordinates, setCoordinates] = useState(s.coordinates);
  const [chesscom, setChesscom] = useState(s.chesscom ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatars, setAvatars] = useState<string[]>([]);
  const [rating, setRating] = useState(me.user.rating != null ? String(me.user.rating) : '');
  const [ratingSource, setRatingSource] = useState(me.user.ratingSource ?? 'chesscom-rapid');
  const [sources, setSources] = useState<Record<string, string>>(DEFAULT_SOURCES);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .get<Config>('/api/config')
      .then((c) => {
        setAvatars(c.avatars);
        if (c.ratingSources) setSources(c.ratingSources);
      })
      .catch(() => undefined);
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      await api.put('/api/me', {
        displayName,
        avatar,
        color,
        moveSeconds,
        surpriseRate,
        sound,
        coordinates,
        chesscom,
        currentPassword,
        newPassword,
        rating: rating.trim() ? Number(rating) : null,
        ratingSource,
      });
      setCurrentPassword('');
      setNewPassword('');
      await refresh();
      setMsg('Saved');
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="page settings">
      <h1>Settings</h1>
      <form className="card form" onSubmit={save}>
        <h3>Profile</h3>
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={24} />
        </label>
        <div className="field">
          <span>Avatar</span>
          <div className="avatar-picker">
            {avatars.map((a) => (
              <button type="button" key={a} className={`avatar ${a === avatar ? 'on' : ''}`} style={{ background: color }} onClick={() => setAvatar(a)}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Colour</span>
          <div className="row gap wrap">
            {COLORS.map((c) => (
              <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </div>

        <h3>Chess strength</h3>
        <RatingField
          rating={rating}
          source={ratingSource}
          sources={sources}
          onChange={(r, s) => {
            setRating(r);
            setRatingSource(s);
          }}
        />
        <small className="muted">Your opening rating starts here. Your account (name, avatar, rating and password) is shared with Garlick Endgames.</small>

        <h3>Training</h3>
        <div className="field">
          <span>Clock on check-ups (seconds per move)</span>
          <div className="segmented">
            {[0, 3, 5, 8, 12].map((n) => (
              <button type="button" key={n} className={moveSeconds === n ? 'on' : ''} onClick={() => setMoveSeconds(n)}>
                {n === 0 ? 'off' : `${n}s`}
              </button>
            ))}
          </div>
          <small className="muted">Graduated lines come back as timed check-ups so the moves become automatic, like in a blitz game.</small>
        </div>
        <div className="field">
          <span>Surprise mistakes from White</span>
          <div className="segmented">
            {[
              [0, 'never'],
              [0.15, 'rarely'],
              [0.25, 'sometimes'],
              [0.4, 'often'],
            ].map(([v, label]) => (
              <button type="button" key={String(v)} className={surpriseRate === v ? 'on' : ''} onClick={() => setSurpriseRate(v as number)}>
                {label}
              </button>
            ))}
          </div>
          <small className="muted">In practice runs of lines you know, White sometimes plays a realistic mistake. Spot it and punish it.</small>
        </div>
        <label className="check">
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /> Sounds
        </label>
        <label className="check">
          <input type="checkbox" checked={coordinates} onChange={(e) => setCoordinates(e.target.checked)} /> Board coordinates
        </label>

        <h3>Chess.com</h3>
        <label>
          Username (for “Your games” and the decks built from your games)
          <input value={chesscom} onChange={(e) => setChesscom(e.target.value)} placeholder="e.g. ham_sandmitch" autoCapitalize="none" />
        </label>

        <h3>Password</h3>
        <label>
          Current password
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <label>
          New password
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" minLength={8} />
        </label>

        {err && <div className="form-error">{err}</div>}
        {msg && <div className="form-ok">{msg}</div>}
        <div className="row gap">
          <button className="btn primary">Save</button>
          <button type="button" className="btn ghost" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </form>
    </div>
  );
}
