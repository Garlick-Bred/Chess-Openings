import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const IMAGES = import.meta.glob('../assets/pieces/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const PIECE_IMG: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGES).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]),
);

const FILES = 'abcdefgh';

export interface Arrow {
  from: string;
  to: string;
  color: string;
}

export interface BoardProps {
  fen: string;
  orientation: 'w' | 'b';
  userColor: 'w' | 'b';
  interactive: boolean;
  dests: Map<string, string[]>;
  lastMove?: [string, string] | null;
  check?: string | null;
  hintFrom?: string | null;
  arrows?: Arrow[];
  badge?: { square: string; symbol: string; color: string; key: number } | null;
  coordinates?: boolean;
  autoQueen?: boolean;
  onMove: (from: string, to: string, promotion?: string) => void;
  /** Allow queuing a move while it is not your turn. */
  premovable?: boolean;
  premoveDests?: Map<string, string[]>;
  premove?: { from: string; to: string } | null;
  onPremove?: (from: string, to: string, promotion?: string) => void;
  onCancelPremove?: () => void;
  /** Called when the player picks up one of their pieces. */
  onSelect?: (square: string) => void;
  /** Squares to shade (a lesson's "king box"). */
  region?: Set<string> | null;
}

interface PieceOnBoard {
  id: number;
  piece: string; // e.g. "wK"
  square: string;
}

function parseFen(fen: string): { piece: string; square: string }[] {
  const out: { piece: string; square: string }[] = [];
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        out.push({ piece: color + ch.toUpperCase(), square: FILES[f] + (8 - i) });
        f++;
      }
    }
  });
  return out;
}

const sqXY = (sq: string) => [FILES.indexOf(sq[0]), Number(sq[1]) - 1] as const;
const dist = (a: string, b: string) => {
  const [ax, ay] = sqXY(a);
  const [bx, by] = sqXY(b);
  return Math.abs(ax - bx) + Math.abs(ay - by);
};

/** Keep stable ids for pieces between positions so moves animate as slides. */
function matchPieces(prev: PieceOnBoard[], next: { piece: string; square: string }[], nextId: { current: number }): PieceOnBoard[] {
  const unused = [...prev];
  const out: (PieceOnBoard | null)[] = next.map(() => null);
  next.forEach((n, i) => {
    const j = unused.findIndex((p) => p.piece === n.piece && p.square === n.square);
    if (j >= 0) {
      out[i] = { ...unused[j] };
      unused.splice(j, 1);
    }
  });
  next.forEach((n, i) => {
    if (out[i]) return;
    let best = -1;
    let bestD = Infinity;
    unused.forEach((p, j) => {
      if (p.piece === n.piece && dist(p.square, n.square) < bestD) {
        best = j;
        bestD = dist(p.square, n.square);
      }
    });
    if (best >= 0) {
      out[i] = { id: unused[best].id, piece: n.piece, square: n.square };
      unused.splice(best, 1);
    } else {
      out[i] = { id: nextId.current++, piece: n.piece, square: n.square };
    }
  });
  return out as PieceOnBoard[];
}

export default function Board(props: BoardProps) {
  const { fen, orientation, userColor, interactive, lastMove, check, hintFrom, arrows = [], badge, coordinates = true, autoQueen = false, onMove } = props;
  const { premovable = false, premove = null, onPremove, onCancelPremove, onSelect, region = null } = props;
  // While premoving, pieces can go where they could go if it were your move.
  const premoving = !interactive && premovable;
  const dests = premoving ? props.premoveDests ?? new Map<string, string[]>() : props.dests;
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLImageElement>(null);
  const prevPieces = useRef<PieceOnBoard[]>([]);
  const nextId = useRef(1);
  const instantId = useRef<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: number; piece: string; from: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const drag = useRef<{ from: string; id: number; piece: string; x: number; y: number; started: boolean; wasSelected: boolean } | null>(null);

  const pieces = useMemo(() => {
    const next = matchPieces(prevPieces.current, parseFen(fen), nextId);
    prevPieces.current = next;
    return next;
  }, [fen]);
  const bySquare = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces]);

  useEffect(() => {
    setSelected(null);
    setPromo(null);
  }, [fen]);
  useEffect(() => {
    if (!interactive && !premovable) setSelected(null);
  }, [interactive, premovable]);

  // Grid position of a square for the current orientation.
  const pos = useCallback(
    (sq: string) => {
      const [f, r] = sqXY(sq);
      return orientation === 'w' ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
    },
    [orientation],
  );

  const squareAt = (clientX: number, clientY: number): string | null => {
    const rect = boardRef.current!.getBoundingClientRect();
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return orientation === 'w' ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1);
  };

  const attemptMove = (from: string, to: string, instant: boolean) => {
    const p = bySquare.get(from);
    if (!p) return;
    const isPromotion = p.piece[1] === 'P' && (to[1] === '8' || to[1] === '1');
    if (instant) instantId.current = p.id;
    if (premoving) {
      setSelected(null);
      onPremove?.(from, to, isPromotion ? 'q' : undefined);
      return;
    }
    if (isPromotion && !autoQueen) {
      setPromo({ from, to });
      return;
    }
    setSelected(null);
    onMove(from, to, isPromotion ? 'q' : undefined);
  };

  const moveGhost = (clientX: number, clientY: number) => {
    const g = ghostRef.current;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!g || !rect) return;
    const size = rect.width / 8;
    g.style.transform = `translate(${clientX - rect.left - size / 2}px, ${clientY - rect.top - size / 2}px) scale(1.12)`;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || promo) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (!interactive && !premovable) {
      setSelected(null);
      return;
    }
    if (selected && sq !== selected && dests.get(selected)?.includes(sq)) {
      attemptMove(selected, sq, false); // tap-to-move (also captures)
      return;
    }
    const p = bySquare.get(sq);
    if (p && p.piece[0] === userColor) {
      const wasSelected = selected === sq;
      setSelected(sq);
      if (!premoving) onSelect?.(sq);
      drag.current = { from: sq, id: p.id, piece: p.piece, x: e.clientX, y: e.clientY, started: false, wasSelected };
      boardRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else {
      setSelected(null);
      if (premove) onCancelPremove?.(); // tap elsewhere cancels a queued premove
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
      d.started = true;
      setDragging({ id: d.id, piece: d.piece, from: d.from });
    }
    moveGhost(e.clientX, e.clientY);
    const sq = squareAt(e.clientX, e.clientY);
    setHover((h) => (h === sq ? h : sq));
  };

  const endDrag = (e: React.PointerEvent, cancelled = false) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.started) {
      const sq = cancelled ? null : squareAt(e.clientX, e.clientY);
      if (sq && sq !== d.from && dests.get(d.from)?.includes(sq)) attemptMove(d.from, sq, true);
      setDragging(null);
      setHover(null);
    } else if (d.wasSelected) {
      setSelected(null); // tapping the selected piece again deselects it
    }
  };

  useLayoutEffect(() => {
    if (dragging && drag.current) moveGhost(drag.current.x, drag.current.y);
  }, [dragging]);

  // Clear the "no slide" flag after the dropped piece has been painted.
  useEffect(() => {
    if (instantId.current == null) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => (instantId.current = null)));
    return () => cancelAnimationFrame(id);
  }, [fen]);

  const targets = selected ? dests.get(selected) ?? [] : [];
  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = orientation === 'w' ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1);
      const light = (col + row) % 2 === 0;
      const cls = ['sq', light ? 'light' : 'dark'];
      if (lastMove && (lastMove[0] === sq || lastMove[1] === sq)) cls.push('last');
      if (selected === sq) cls.push(premoving ? 'selected premove-sel' : 'selected');
      if (premove && (premove.from === sq || premove.to === sq)) cls.push('premove');
      if (region?.has(sq)) cls.push('region');
      if (check === sq) cls.push('check');
      if (hintFrom === sq) cls.push('hint');
      if (dragging && hover === sq) cls.push('hover');
      const isTarget = targets.includes(sq);
      squares.push(
        <div key={sq} className={cls.join(' ')} data-square={sq}>
          {isTarget && <span className={bySquare.has(sq) ? 'capture-ring' : 'move-dot'} />}
          {coordinates && col === 0 && <span className="coord rank">{sq[1]}</span>}
          {coordinates && row === 7 && <span className="coord file">{sq[0]}</span>}
        </div>,
      );
    }
  }

  const promoColor = promo ? bySquare.get(promo.from)?.piece[0] ?? 'w' : 'w';

  return (
    <div
      ref={boardRef}
      className={`board ${interactive ? 'interactive' : ''}`}
      data-fen={fen}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e)}
      onPointerCancel={(e) => endDrag(e, true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="squares">{squares}</div>
      <div className="pieces">
        {pieces.map((p) => {
          const { col, row } = pos(p.square);
          const cls = ['piece'];
          if (selected === p.square) cls.push('lifted');
          if (dragging?.id === p.id) cls.push('drag-origin');
          if (interactive && p.piece[0] === userColor) cls.push('mine');
          return (
            <img
              key={p.id}
              src={PIECE_IMG[p.piece]}
              alt={p.piece}
              className={cls.join(' ')}
              draggable={false}
              style={{
                transform: `translate(${col * 100}%, ${row * 100}%)`,
                transition: instantId.current === p.id ? 'none' : undefined,
              }}
            />
          );
        })}
      </div>
      {arrows.length > 0 && (
        <svg className="arrows" viewBox="0 0 8 8">
          <defs>
            {arrows.map((a, i) => (
              <marker key={i} id={`ah${i}`} markerWidth="3" markerHeight="3" refX="1.6" refY="1.5" orient="auto">
                <path d="M0,0 L3,1.5 L0,3 Z" fill={a.color} />
              </marker>
            ))}
          </defs>
          {arrows.map((a, i) => {
            const f = pos(a.from);
            const t = pos(a.to);
            const x1 = f.col + 0.5;
            const y1 = f.row + 0.5;
            const x2 = t.col + 0.5;
            const y2 = t.row + 0.5;
            const len = Math.hypot(x2 - x1, y2 - y1);
            const k = (len - 0.32) / len;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x1 + (x2 - x1) * k}
                y2={y1 + (y2 - y1) * k}
                stroke={a.color}
                strokeWidth="0.17"
                strokeLinecap="round"
                opacity="0.85"
                markerEnd={`url(#ah${i})`}
              />
            );
          })}
        </svg>
      )}
      {badge &&
        (() => {
          const { col, row } = pos(badge.square);
          return (
            <div key={badge.key} className="badge-anchor" style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}>
              <span className="move-badge" style={{ background: badge.color }}>
                {badge.symbol}
              </span>
            </div>
          );
        })()}
      {dragging && <img ref={ghostRef} className="drag-ghost" src={PIECE_IMG[dragging.piece]} alt="" draggable={false} />}
      {promo && (
        <div className="promo-backdrop" onPointerDown={(e) => (e.stopPropagation(), setPromo(null))}>
          <div
            className="promo-picker"
            style={{
              left: `${pos(promo.to).col * 12.5}%`,
              top: pos(promo.to).row === 0 ? 0 : undefined,
              bottom: pos(promo.to).row === 7 ? 0 : undefined,
            }}
          >
            {['Q', 'N', 'R', 'B'].map((t) => (
              <button
                key={t}
                className="promo-choice"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const { from, to } = promo;
                  setPromo(null);
                  setSelected(null);
                  onMove(from, to, t.toLowerCase());
                }}
              >
                <img src={PIECE_IMG[promoColor + t]} alt={t} draggable={false} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
