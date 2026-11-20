// A small parser for the course's annotated movetext (see course/kings-indian.js):
//   1.d4 Nf6 {#develop comment} 2.Bf4 g6 (2...d5 {alternative}) ...
// Returns the main line (SAN moves, each with an optional note) and, for each
// main-line ply, the alternatives given as variations right after it.
import { Chess } from 'chess.js';

/** Position key: the first four FEN fields (placement, side, castling, en passant). */
export function posKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

function tokenize(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === '{') {
      const j = text.indexOf('}', i);
      if (j < 0) throw new Error('Unclosed comment');
      out.push({ type: 'comment', value: text.slice(i + 1, j).replace(/\s+/g, ' ').trim() });
      i = j + 1;
    } else if (c === '(' || c === ')') {
      out.push({ type: c });
      i++;
    } else {
      let j = i;
      while (j < text.length && !/[\s{}()]/.test(text[j])) j++;
      const word = text.slice(i, j);
      i = j;
      // Strip move numbers ("12." / "12...") and annotation glyphs.
      const san = word.replace(/^\d+\.(\.\.)?/, '').replace(/[?!]+$/, '');
      if (san) out.push({ type: 'move', value: san });
    }
  }
  return out;
}

/** Split "#tag #tag text" into tags and text. */
export function parseNote(raw) {
  const tags = [];
  let text = raw.trim();
  for (;;) {
    const m = /^#([a-z0-9-]+)\s*/i.exec(text);
    if (!m) break;
    tags.push(m[1]);
    text = text.slice(m[0].length);
  }
  return { text, tags };
}

/**
 * Parse movetext into
 *   { moves: [{ san, fenBefore, fenAfter, note }], alternatives: { [ply]: [{ san, line: string[], note }] } }
 * Throws on illegal moves (with the ply and move).
 */
export function parseLine(pgn) {
  const tokens = tokenize(pgn);
  const game = new Chess();
  const moves = [];
  const alternatives = {};
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === 'move') {
      const fenBefore = game.fen();
      let mv;
      try {
        mv = game.move(t.value);
      } catch {
        mv = null;
      }
      if (!mv) throw new Error(`Illegal move ${t.value} at ply ${moves.length + 1}`);
      moves.push({ san: mv.san, uci: mv.from + mv.to + (mv.promotion ?? ''), fenBefore, fenAfter: game.fen(), note: null });
      i++;
    } else if (t.type === 'comment') {
      if (!moves.length) throw new Error('Comment before the first move');
      moves[moves.length - 1].note = parseNote(t.value);
      i++;
    } else if (t.type === '(') {
      // An alternative to the last main-line move, played from the same position.
      const ply = moves.length - 1;
      if (ply < 0) throw new Error('Variation before the first move');
      const alt = new Chess(moves[ply].fenBefore);
      const line = [];
      let note = null;
      i++;
      while (i < tokens.length && tokens[i].type !== ')') {
        const v = tokens[i];
        if (v.type === 'move') {
          let mv;
          try {
            mv = alt.move(v.value);
          } catch {
            mv = null;
          }
          if (!mv) throw new Error(`Illegal move ${v.value} in a variation at ply ${ply + 1}`);
          line.push(mv.san);
        } else if (v.type === 'comment') {
          if (!note) note = parseNote(v.value);
          else note.text += ' ' + parseNote(v.value).text;
        } else if (v.type === '(') {
          throw new Error('Nested variations are not supported');
        }
        i++;
      }
      if (tokens[i]?.type !== ')') throw new Error('Unclosed variation');
      i++;
      if (!line.length) throw new Error(`Empty variation at ply ${ply + 1}`);
      (alternatives[ply] ??= []).push({ san: line[0], line, note });
    } else {
      throw new Error(`Unexpected ${t.type}`);
    }
  }
  return { moves, alternatives };
}
