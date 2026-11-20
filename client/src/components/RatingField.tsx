// Chess rating input used at sign-up and in Settings: a number, where it comes
// from, and quick picks for anyone who doesn't know their rating.
const PRESETS = [
  { label: 'New to chess', rating: 400 },
  { label: 'Casual', rating: 800 },
  { label: 'Club player', rating: 1200 },
  { label: 'Strong club', rating: 1600 },
  { label: 'Expert', rating: 2000 },
];

export const DEFAULT_SOURCES: Record<string, string> = {
  'chesscom-rapid': 'chess.com rapid',
  'chesscom-blitz': 'chess.com blitz',
  'chesscom-daily': 'chess.com daily',
  lichess: 'Lichess',
  fide: 'FIDE',
  cfc: 'CFC (Canada)',
  uscf: 'US Chess',
  guess: 'Best guess',
};

export default function RatingField({
  rating,
  source,
  sources = DEFAULT_SOURCES,
  onChange,
}: {
  rating: string;
  source: string;
  sources?: Record<string, string>;
  onChange: (rating: string, source: string) => void;
}) {
  return (
    <div className="field rating-field">
      <span>Chess rating</span>
      <div className="row gap">
        <input
          type="number"
          inputMode="numeric"
          min={100}
          max={3000}
          step={1}
          placeholder="e.g. 1300"
          value={rating}
          onChange={(e) => onChange(e.target.value, source)}
          aria-label="Chess rating"
        />
        <select value={source} onChange={(e) => onChange(rating, e.target.value)} aria-label="Where the rating is from">
          {Object.entries(sources).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.rating} type="button" className={`preset ${Number(rating) === p.rating && source === 'guess' ? 'on' : ''}`} onClick={() => onChange(String(p.rating), 'guess')}>
            {p.label} <small>~{p.rating}</small>
          </button>
        ))}
      </div>
      <small className="muted">
        Your opening rating starts at your chess rating and moves with your results.
      </small>
    </div>
  );
}
