import { describe, it, expect } from 'vitest';
import { parseLine, parseNote, posKey } from '../shared/pgn.js';

describe('parseLine', () => {
  it('reads moves, notes with principle tags, and alternatives', () => {
    const { moves, alternatives } = parseLine(`1.d4 Nf6 {#develop A knight.} 2.Bf4 g6 (2...h6 {#shield Weakening.}) 3.e3`);
    expect(moves.map((m) => m.san)).toEqual(['d4', 'Nf6', 'Bf4', 'g6', 'e3']);
    expect(moves[1].note).toEqual({ text: 'A knight.', tags: ['develop'] });
    expect(alternatives[3]).toEqual([{ san: 'h6', line: ['h6'], note: { text: 'Weakening.', tags: ['shield'] } }]);
  });
  it('plays variations from the position before the main move', () => {
    const { alternatives } = parseLine(`1.d4 Nf6 2.e4 Nxe4 (2...g6 3.e5 {kicks the knight})`);
    expect(alternatives[3][0].line).toEqual(['g6', 'e5']);
  });
  it('rejects illegal moves with the ply', () => {
    expect(() => parseLine('1.d4 Nf6 2.Bf5')).toThrow(/Illegal move Bf5 at ply 3/);
  });
  it('position keys drop the move counters', () => {
    expect(posKey('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1')).toBe('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -');
    expect(parseNote('#a #b text')).toEqual({ tags: ['a', 'b'], text: 'text' });
  });
});
