import { useId } from 'react';

/** A single golden garlic clove with a shine sweep (golden-clove bonus). */
export default function GoldenClove({ size = 48, shine = true }: { size?: number; shine?: boolean }) {
  const uid = useId().replace(/:/g, '');
  return (
    <span className={`golden-clove ${shine ? 'shine' : ''}`} style={{ width: size, height: size * 1.25 }} aria-hidden="true">
      <svg viewBox="0 0 80 100" width="100%" height="100%">
        <defs>
          <linearGradient id={`gold-${uid}`} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#fff3b0" />
            <stop offset="0.45" stopColor="#f7c631" />
            <stop offset="1" stopColor="#b8860b" />
          </linearGradient>
          <clipPath id={`clip-${uid}`}>
            <path d="M40 6 C 44 20, 66 38, 68 64 C 70 86, 56 96, 40 96 C 24 96, 10 86, 12 64 C 14 38, 36 20, 40 6 Z" />
          </clipPath>
        </defs>
        <path
          d="M40 6 C 44 20, 66 38, 68 64 C 70 86, 56 96, 40 96 C 24 96, 10 86, 12 64 C 14 38, 36 20, 40 6 Z"
          fill={`url(#gold-${uid})`}
          stroke="#3b2a08"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M40 18 C 38 40, 36 66, 40 90" fill="none" stroke="#a87a0a" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        <path d="M28 40 C 22 54, 22 70, 26 82" fill="none" stroke="#fff8d6" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        <g clipPath={`url(#clip-${uid})`}>
          <rect className="golden-sweep" x="-60" y="-10" width="26" height="130" fill="#fffbe6" opacity="0.65" transform="rotate(20)" />
        </g>
      </svg>
    </span>
  );
}
