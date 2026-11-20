import { useEffect, useId, useState } from 'react';

// The daily Garlick bulb, drawn cartoon-style: a thick dark outline, beige
// cloves with tan shading and light streaks, a tall neck with green stalks and
// a soft ground shadow. Empty cloves are a dim taupe. Each solve "colours in"
// one clove (centre first) with a rising wave; completing the bulb makes the
// stalks shoot up while it bounces, glows and sparkles.

type Pt = [number, number];

// Clove boundaries from the neck top down to the base, as chains of cubic
// Bezier segments [start, c1, c2, end, c1, c2, end, ...]. Boundaries 0 and 5
// are the left and right edges of the bulb.
const B: Pt[][] = [
  [[86, 62], [86, 84], [84, 96], [66, 108], [34, 128], [14, 142], [15, 166], [16, 180], [18, 186], [22, 192]],
  [[92, 62], [92, 86], [89, 100], [74, 114], [40, 136], [24, 166], [40, 204]],
  [[97, 62], [97, 88], [95, 106], [88, 122], [72, 152], [62, 186], [72, 214]],
  [[103, 62], [103, 88], [105, 106], [112, 122], [128, 152], [138, 186], [128, 214]],
  [[108, 62], [108, 86], [111, 100], [126, 114], [160, 136], [176, 166], [160, 204]],
  [[114, 62], [114, 84], [116, 96], [134, 108], [166, 128], [186, 142], [185, 166], [184, 180], [182, 186], [178, 192]],
];
// The rounded bottom of clove k runs from the end of boundary k to the end of
// boundary k+1; these are its two control points.
const SCALLOPS: Pt[][] = [
  [[24, 204], [32, 210]],
  [[44, 220], [64, 224]],
  [[78, 230], [122, 230]],
  [[136, 224], [156, 220]],
  [[168, 210], [176, 204]],
];

const f = (p: Pt) => `${p[0]} ${p[1]}`;
const end = (b: Pt[]) => b[b.length - 1];
function forward(b: Pt[]) {
  let s = '';
  for (let i = 1; i < b.length; i += 3) s += ` C ${f(b[i])}, ${f(b[i + 1])}, ${f(b[i + 2])}`;
  return s;
}
function backward(b: Pt[]) {
  let s = '';
  for (let i = b.length - 1; i > 0; i -= 3) s += ` C ${f(b[i - 1])}, ${f(b[i - 2])}, ${f(b[i - 3])}`;
  return s;
}
const scallop = (k: number) => ` C ${f(SCALLOPS[k][0])}, ${f(SCALLOPS[k][1])}, ${f(end(B[k + 1]))}`;

const CLOVES = [0, 1, 2, 3, 4].map((k) => `M ${f(B[k][0])}${forward(B[k])}${scallop(k)}${backward(B[k + 1])} Z`);
const SILHOUETTE = `M ${f(B[0][0])}${forward(B[0])}${[0, 1, 2, 3, 4].map(scallop).join('')}${backward(B[5])} Z`;

// Short ink strokes and light streaks inside each clove (left to right).
const DETAILS = [
  ['M30 160 C 28 172, 30 182, 34 192'],
  ['M58 150 C 52 170, 52 190, 58 205'],
  ['M86 150 C 83 170, 85 190, 91 210', 'M114 150 C 117 170, 115 190, 109 210'],
  ['M142 150 C 148 170, 148 190, 142 205'],
  ['M170 160 C 172 172, 170 182, 166 192'],
];
const SHINES = [
  'M24 150 C 21 162, 21 172, 24 182',
  'M60 124 C 48 140, 42 160, 44 178',
  'M95 112 C 86 134, 82 160, 84 186',
  'M122 128 C 128 144, 130 160, 130 176',
  'M150 124 C 160 136, 168 150, 172 166',
];
const STALKS = ['M95 63 C 93 48, 87 34, 80 22', 'M99 63 C 99 44, 98 26, 96 6', 'M104 63 C 105 46, 107 32, 108 14', 'M108 63 C 112 52, 117 42, 124 32'];

/** Fill order: centre, the two inner cloves, then the outer two. */
export const FILL_ORDER = [2, 1, 3, 0, 4];
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const ang = (i / 12) * Math.PI * 2;
  return { dx: Math.cos(ang) * 112, dy: Math.sin(ang) * 112, delay: (i % 4) * 0.06 };
});
const LIQUID =
  'M-100 0 Q -87 -7 -75 0 T -50 0 T -25 0 T 0 0 T 25 0 T 50 0 T 75 0 T 100 0 T 125 0 T 150 0 T 175 0 T 200 0 T 225 0 T 250 0 T 275 0 T 300 0 V 260 H -100 Z';

export interface GarlickBulbProps {
  /** Cloves filled, 0-5. Fractions fill a clove part of the way. */
  filled: number;
  /** Start from this many cloves and animate up to `filled`. */
  from?: number;
  size?: number;
  celebrate?: boolean;
  /** Called at each animation step with the new total and whether a clove completed. */
  onClove?: (count: number, completed: boolean) => void;
}

const EPS = 1e-6;
// Lowest point of each clove (left to right) and where its body meets the neck:
// a part-filled clove's "liquid" rises between the two.
const CLOVE_BOTTOM = [208, 220, 228, 220, 208];
const BODY_TOP = 96;
const ORDER_OF = FILL_ORDER.reduce<number[]>((acc, clove, idx) => ((acc[clove] = idx), acc), []);

function liquidLevel(clove: number, frac: number) {
  if (frac >= 1 - EPS) return 40; // above the neck: completely full
  if (frac <= EPS) return 240; // below the bottom: empty
  return CLOVE_BOTTOM[clove] - frac * (CLOVE_BOTTOM[clove] - BODY_TOP);
}

export default function GarlickBulb({ filled, from, size = 160, celebrate = true, onClove }: GarlickBulbProps) {
  const uid = useId().replace(/:/g, '');
  const target = Math.max(0, Math.min(5, filled));
  const [shown, setShown] = useState(Math.max(0, Math.min(5, from ?? filled)));
  const [newest, setNewest] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (target < shown - EPS) {
      setShown(target); // e.g. a new day started
      return;
    }
    if (shown >= target - EPS) return;
    // Animate one clove at a time: fill up to the next whole clove, or the target.
    const t = setTimeout(
      () => {
        const next = Math.min(target, Math.floor(shown + EPS) + 1);
        const completed = Math.abs(next - Math.round(next)) < EPS && next > shown + EPS;
        setShown(next);
        if (completed) setNewest(FILL_ORDER[Math.round(next) - 1]);
        onClove?.(next, completed);
        if (next >= 5 - EPS && celebrate) setTimeout(() => setCelebrating(true), 950);
      },
      from != null && Math.abs(shown - from) < EPS ? 450 : 750,
    );
    return () => clearTimeout(t);
  }, [shown, target, from, celebrate, onClove]);

  const frac = (clove: number) => Math.max(0, Math.min(1, shown - ORDER_OF[clove]));
  const cls = ['garlick'];
  if (shown >= 5 - EPS) cls.push('complete');
  if (celebrating) cls.push('celebrating');

  return (
    <div className={cls.join(' ')} style={{ width: size, height: size * 1.2 }} role="img" aria-label={`Garlick bulb: ${Math.round(shown * 100) / 100} of 5 cloves`}>
      <svg viewBox="0 -4 200 240" width="100%" height="100%" overflow="visible">
        <defs>
          <linearGradient id={`shade-${uid}`} x1="0.05" y1="0.1" x2="1" y2="0.9">
            <stop offset="0" stopColor="#fff6e6" stopOpacity="0.55" />
            <stop offset="0.45" stopColor="#ecdcbe" stopOpacity="0" />
            <stop offset="1" stopColor="#a8875f" stopOpacity="0.75" />
          </linearGradient>
          <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffd96a" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffd96a" stopOpacity="0" />
          </radialGradient>
          {CLOVES.map((d, i) => (
            <clipPath id={`clip-${uid}-${i}`} key={i}>
              <path d={d} />
            </clipPath>
          ))}
        </defs>

        <circle className="garlick-halo" cx="100" cy="140" r="116" fill={`url(#glow-${uid})`} />
        <ellipse className="garlick-shadow" cx="108" cy="226" rx="76" ry="9" />

        <g className="garlick-body">
          {[0, 4, 1, 3, 2].map((i) => (
            <g key={i} className={`clove ${frac(i) >= 1 - EPS ? 'filled' : frac(i) > EPS ? 'partial' : ''} ${newest === i ? 'new' : ''}`}>
              <path className="clove-base" d={CLOVES[i]} />
              <g clipPath={`url(#clip-${uid}-${i})`}>
                <g className="clove-level" style={{ transform: `translateY(${liquidLevel(i, frac(i))}px)` }}>
                  <path className="clove-liquid" d={LIQUID} />
                </g>
                <path className="clove-shade" d={CLOVES[i]} fill={`url(#shade-${uid})`} />
                <path className="clove-shine" d={SHINES[i]} />
                {DETAILS[i].map((d, j) => (
                  <path key={j} className="clove-detail" d={d} />
                ))}
              </g>
              <path className="clove-outline" d={CLOVES[i]} />
            </g>
          ))}
          <path className="garlick-silhouette" d={SILHOUETTE} />
          <ellipse className="garlick-hole" cx="100" cy="62" rx="13.4" ry="3.4" />
          <path className="garlick-rim" d="M86.6 62 C 90 57.6, 110 57.6, 113.4 62" />
          <g className="garlick-stalks">
            {STALKS.map((d, i) => (
              <g key={i}>
                <path className="stalk-outline" d={d} />
                <path className="stalk-fill" d={d} />
                <path className="stalk-shine" d={d} />
              </g>
            ))}
          </g>
          <path className="garlick-lip" d="M86 62 C 92 67, 108 67, 114 62" />
        </g>

        <g transform="translate(100 140)">
          {SPARKS.map((s, i) => (
            <path
              key={i}
              className="spark"
              d="M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z"
              style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, animationDelay: `${s.delay}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
