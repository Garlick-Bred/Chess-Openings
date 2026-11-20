// Explanations for a move, built from rules on top of the Stockfish lines in
// the course data, so they are never wrong about the position:
//
//   micro: what concretely happens (White wins a pawn with ..., it allows a
//          fork, a pawn kicks your knight, you missed a free piece, or "no
//          material changes hands but White gets the better game").
//   macro: which King's Indian principle the move goes against (shield,
//          breaks, cct, develop, bishop, e5push...), so a single slip
//          connects to the bigger picture.
//
// An authored note for that exact move (a variation in course/*.js) always
// comes first: it was written for that position.
import { Chess } from 'chess.js';

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const MATE = 9000;

function material(game, color) {
  let s = 0;
  for (const row of game.board()) for (const p of row) if (p && p.color === color) s += VALUE[p.type];
  return s;
}

/** Play a SAN line from a FEN; returns the verbose moves that were legal. */
export function playLine(fen, sans) {
  const g = new Chess(fen);
  const out = [];
  for (const s of sans ?? []) {
    try {
      out.push(g.move(s));
    } catch {
      break;
    }
  }
  return { game: g, moves: out };
}

/**
 * What a line of moves does to the material balance, from `me`'s side.
 * Looks for the point where the balance settles (after recaptures).
 * @returns {{ delta: number, upto: number, lost: string[], won: string[] }}
 */
export function materialSwing(fen, sans, me) {
  const g = new Chess(fen);
  const them = me === 'w' ? 'b' : 'w';
  const start = material(g, me) - material(g, them);
  const deltas = [];
  const lost = [];
  const won = [];
  for (const s of sans ?? []) {
    let m;
    try {
      m = g.move(s);
    } catch {
      break;
    }
    if (m.captured) (m.color === me ? won : lost).push(m.captured);
    deltas.push(material(g, me) - material(g, them) - start);
  }
  if (!deltas.length) return { delta: 0, upto: 0, lost, won };
  // Settled = the balance after the last ply where it changed, but don't
  // count a capture that the line immediately answers.
  let upto = deltas.length;
  let delta = deltas[deltas.length - 1];
  if (deltas.length >= 2) {
    const a = deltas[deltas.length - 1];
    const b = deltas[deltas.length - 2];
    delta = Math.abs(a) < Math.abs(b) ? a : b;
  }
  for (let i = 0; i < deltas.length; i++) {
    if (deltas[i] === delta) {
      upto = i + 1;
      // keep going while it stays the same, so the line shows the recapture
      while (upto < deltas.length && deltas[upto] === delta) upto++;
      break;
    }
  }
  return { delta, upto: Math.min(upto, deltas.length), lost, won };
}

function describeLoss(lost, won, delta) {
  const net = { ...Object.fromEntries(Object.keys(VALUE).map((k) => [k, 0])) };
  for (const p of lost) net[p]++;
  for (const p of won) net[p]--;
  const big = ['q', 'r', 'b', 'n'].find((k) => net[k] > 0);
  const n = Math.abs(delta);
  if (big === 'r' && (net.b < 0 || net.n < 0)) return 'the exchange';
  if (big && VALUE[big] <= n + 1) return `a ${NAME[big]}`;
  if (n >= 9) return 'the queen';
  if (n >= 5) return 'a rook';
  if (n >= 3) return 'a piece';
  if (n === 2) return 'two pawns';
  return 'a pawn';
}

/** Moves in "9.Nxc7+ Kf8 10.Rd8#" style. */
export function formatLine(fen, sans, max = 6) {
  const [, turn, , , , fullmove] = fen.split(' ');
  let n = Number(fullmove) || 1;
  let white = turn === 'w';
  const parts = [];
  sans.slice(0, max).forEach((s, i) => {
    if (white) parts.push(`${n}.${s}`);
    else parts.push(i === 0 ? `${n}...${s}` : s);
    if (!white) n++;
    white = !white;
  });
  return parts.join(' ');
}

function attackedPieces(game, square) {
  // Squares attacked by the piece on `square` that hold enemy pieces worth >= 3 (or the king).
  const piece = game.get(square);
  if (!piece) return [];
  const fen = game.fen().split(' ');
  fen[1] = piece.color; // let the attacker "move" to list its captures
  fen[3] = '-';
  let g;
  try {
    g = new Chess(fen.join(' '));
  } catch {
    return [];
  }
  const hits = new Set();
  for (const m of g.moves({ square, verbose: true })) {
    if (m.captured && (VALUE[m.captured] >= 3)) hits.add(m.to);
  }
  // The king can't be "captured" by chess.js moves; check gives it away.
  if (g.inCheck?.() === false) {
    // attacking the king shows as check in the real position
  }
  return [...hits];
}

const isKingsideShieldMove = (m, game) => {
  if (m.piece === 'k' && !m.flags.includes('k') && !m.flags.includes('q')) return true;
  if (m.piece !== 'p') return false;
  if (!['f', 'g', 'h'].includes(m.from[0])) return false;
  // Only when your king lives on the kingside (castled or about to).
  const kingSq = findKing(game, m.color);
  return kingSq && ['f', 'g', 'h'].includes(kingSq[0]);
};

function findKing(game, color) {
  for (const row of game.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return null;
}

const isBreak = (m) =>
  m &&
  m.piece === 'p' &&
  ['c', 'd', 'e', 'f'].includes(m.from[0]) &&
  (m.captured || (m.color === 'b' ? Number(m.to[1]) <= 5 : Number(m.to[1]) >= 4));

/**
 * Explain a move.
 * @param {{ fen: string, san: string, pos: any, book?: string|null, judged: { grade: string, cp: number|null, best: string|null, bestCp: number|null },
 *           context?: 'line' | 'chance' | 'deck', chapter?: string|null }} a
 * @returns {{ author: string|null, micro: string, line: string[], bestLine: string[], principle: string, bookNote: string|null }}
 */
export function explainMove({ fen, san, pos, book = null, judged, context = 'line', chapter = null }) {
  const me = fen.split(' ')[1];
  const game = new Chess(fen);
  let mv = null;
  try {
    mv = new Chess(fen).move(san);
  } catch {
    mv = null;
  }
  const author = pos?.alts?.[san]?.t || null;
  const authorTag = pos?.alts?.[san]?.p?.[0] ?? null;
  const pv = pos?.pv?.[san] ?? null; // starts with san
  const best = judged?.best ?? null;
  const bestPv = best ? pos?.pv?.[best] ?? [best] : [];
  const bookNote = book ? pos?.notes?.[book]?.t ?? null : null;
  const bookTag = book ? pos?.notes?.[book]?.p?.[0] ?? null : null;
  const cp = judged?.cp;
  const parts = [];
  let principle = null;
  let line = [];

  // What your move allows.
  if (pv && pv.length > 1) {
    const reply = pv.slice(1);
    const after = new Chess(fen);
    after.move(san);
    if (cp != null && cp <= -MATE) {
      parts.push(`It allows mate: ${formatLine(after.fen(), reply, 7)}.`);
      line = reply;
      principle = 'cct';
    } else {
      const sw = materialSwing(after.fen(), reply.slice(0, 6), me);
      if (sw.delta <= -1) {
        const what = describeLoss(sw.lost, sw.won, sw.delta);
        line = reply.slice(0, Math.max(1, sw.upto));
        parts.push(`White wins ${what}: ${formatLine(after.fen(), line)}.`);
        principle = 'cct';
      } else {
        // Forks and kicks on White's first reply.
        let first = null;
        try {
          first = new Chess(after.fen()).move(reply[0]);
        } catch {
          first = null;
        }
        if (first) {
          const g2 = new Chess(after.fen());
          g2.move(reply[0]);
          const hits = attackedPieces(g2, first.to);
          if (first.piece === 'p' && hits.length >= 1 && !first.captured) {
            const target = g2.get(hits[0]);
            parts.push(`${formatLine(after.fen(), [reply[0]], 1)} kicks your ${NAME[target.type]}${hits.length > 1 ? ' and hits another piece' : ''}, gaining time.`);
            if (target.type === 'n' && hits[0] === (me === 'b' ? 'f6' : 'f3')) principle = 'e5push';
          } else if (hits.length >= 2 || (hits.length >= 1 && g2.inCheck())) {
            parts.push(`${formatLine(after.fen(), [reply[0]], 1)} attacks two things at once.`);
            principle = 'cct';
          }
        }
        line = reply.slice(0, 5);
      }
    }
  }

  // No Stockfish line stored for this move: look for a piece or pawn it leaves hanging.
  if (!parts.length && !(pv && pv.length > 1) && mv) {
    const hang = hangingAfter(fen, san);
    if (hang) {
      parts.push(`It leaves ${hang.what} loose: ${formatLine(hang.fen, [hang.capture], 1)} wins it.`);
      principle = 'cct';
    }
  }

  // What you missed.
  if (best && best !== san && bestPv.length) {
    const sw = materialSwing(fen, bestPv.slice(0, 6), me);
    if (sw.delta >= 1 && (context !== 'line' || judged.grade !== 'alternative')) {
      const what = describeLoss(sw.won, sw.lost, sw.delta);
      parts.push(`You could have won ${what}: ${formatLine(fen, bestPv.slice(0, Math.max(1, sw.upto)))}.`);
      // Missing free material outweighs whatever else the move allowed.
      principle = 'cct';
    }
  }

  if (!parts.length && judged && judged.grade !== 'book' && judged.grade !== 'alternative' && judged.grade !== 'found') {
    if (judged.bestCp != null && cp != null) {
      const diff = (judged.bestCp - cp) / 100;
      const size = diff >= 1 ? `about ${diff.toFixed(1)} pawns` : 'clearly';
      // In a repertoire drill, don't give the answer away before the second try.
      const than = context === 'line' ? 'the best move here' : best;
      // Only claim "no material changes hands" when Stockfish's line was checked.
      parts.push(
        pv && pv.length > 1
          ? `No material changes hands in Stockfish's line, but it rates the move ${size} worse than ${than}: White gets the easier game.`
          : `Stockfish rates it ${size} worse than ${than}.`,
      );
    }
  }

  // The principle behind it.
  if (!principle && mv && isKingsideShieldMove(mv, game)) principle = 'shield';
  const bookMove = book ? safeMove(fen, book) : null;
  const bestMove = best ? safeMove(fen, best) : null;
  if (!principle && mv && !isBreak(mv) && (isBreak(bookMove) || isBreak(bestMove))) {
    principle = chapter === 'london' || chapter === 'colle' || chapter === 'c4quiet' ? 'quiet' : 'breaks';
  }
  if (!principle && mv && mv.piece === 'q' && Number(fen.split(' ')[5]) <= 8) principle = 'develop';
  if (!principle && mv && mv.piece === 'b' && mv.from === (me === 'b' ? 'g7' : 'g2')) principle = 'bishop';
  if (!principle && mv && mv.piece !== 'p' && mv.piece !== 'k' && !mv.captured) {
    const home = me === 'b' ? '8' : '1';
    if (mv.to[1] === home) principle = 'develop';
  }
  principle ??= authorTag ?? bookTag ?? (context === 'chance' ? 'cct' : 'centre');
  if (authorTag) principle = authorTag;

  return { author, micro: parts.join(' '), line, bestLine: bestPv.slice(0, 6), principle, bookNote };
}

function safeMove(fen, san) {
  try {
    return new Chess(fen).move(san);
  } catch {
    return null;
  }
}

/**
 * After your move, can the opponent simply take something? A capture of an
 * undefended piece or pawn, or of a piece worth more than the capturer.
 */
export function hangingAfter(fen, san) {
  let g;
  try {
    g = new Chess(fen);
    g.move(san);
  } catch {
    return null;
  }
  const me = fen.split(' ')[1];
  let best = null;
  for (const m of g.moves({ verbose: true })) {
    if (!m.captured || m.captured === 'k') continue;
    const after = new Chess(g.fen());
    after.move(m.san);
    const defended = after.isAttacked(m.to, me);
    const gain = defended ? VALUE[m.captured] - VALUE[m.piece] : VALUE[m.captured];
    if (gain >= 1 && (!best || gain > best.gain)) best = { gain, capture: m.san, what: m.captured === 'p' ? 'a pawn' : `your ${NAME[m.captured]}` };
  }
  return best ? { ...best, fen: g.fen() } : null;
}
