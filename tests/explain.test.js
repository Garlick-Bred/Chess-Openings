import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { explainMove, materialSwing, formatLine } from '../shared/explain.js';
import { judgeLineMove } from '../shared/judge.js';

const fenAfter = (sans) => {
  const g = new Chess();
  for (const s of sans) g.move(s);
  return g.fen();
};

describe('explanations', () => {
  it('formats move numbers from any position', () => {
    const fen = fenAfter(['d4', 'Nf6', 'Nc3', 'g6', 'Bf4', 'Bg7', 'e4', 'd6', 'e5', 'dxe5', 'dxe5', 'Qxd1+', 'Rxd1', 'Nh5', 'Nd5']);
    expect(formatLine(fen, ['Nxf4', 'Nxc7+', 'Kf8', 'Rd8#'])).toBe('8...Nxf4 9.Nxc7+ Kf8 10.Rd8#');
  });
  it('spots a move that allows mate (your Jobava trap)', () => {
    const fen = fenAfter(['d4', 'Nf6', 'Nc3', 'g6', 'Bf4', 'Bg7', 'e4', 'd6', 'e5', 'dxe5', 'dxe5', 'Qxd1+', 'Rxd1', 'Nh5', 'Nd5']);
    const pos = { e: { 'O-O': -100, Nxf4: -9997 }, pv: { Nxf4: ['Nxf4', 'Nxc7+', 'Kf8', 'Rd8#'], 'O-O': ['O-O'] } };
    const judged = { grade: 'blunder', cp: -9997, best: 'O-O', bestCp: -100 };
    const ex = explainMove({ fen, san: 'Nxf4', pos, book: 'O-O', judged });
    expect(ex.micro).toMatch(/allows mate: 9\.Nxc7\+ Kf8 10\.Rd8#/);
    expect(ex.principle).toBe('cct');
  });
  it('spots a missed free pawn (1.d4 Nf6 2.e4?!)', () => {
    const fen = fenAfter(['d4', 'Nf6', 'e4']);
    const pos = { e: { Nxe4: 65, g6: -53 }, pv: { Nxe4: ['Nxe4', 'Nf3', 'd5'], g6: ['g6', 'e5', 'Nd5'] } };
    const judged = judgeLineMove({ pos, san: 'g6', book: 'Nxe4' });
    const ex = explainMove({ fen, san: 'g6', pos, book: 'Nxe4', judged });
    expect(ex.micro).toMatch(/could have won a pawn: 2\.\.\.Nxe4/);
    expect(ex.principle).toBe('cct');
  });
  it('a pawn push that kicks the f6 knight is the e5push principle', () => {
    const fen = fenAfter(['d4', 'Nf6', 'Nc3', 'g6', 'e4']);
    const pos = { e: { d6: -70, Bg7: -120 }, pv: { Bg7: ['Bg7', 'e5', 'Ng8'] } };
    const judged = { grade: 'inaccuracy', cp: -120, best: 'd6', bestCp: -70 };
    const ex = explainMove({ fen, san: 'Bg7', pos, book: 'd6', judged });
    expect(ex.micro).toMatch(/4\.e5 kicks your knight/);
    expect(ex.principle).toBe('e5push');
  });
  it('kingside pawn moves are the shield principle', () => {
    const fen = fenAfter(['d4', 'Nf6', 'Bf4', 'g6', 'Nf3', 'Bg7', 'e3', 'd6', 'Bd3', 'O-O', 'O-O']);
    const pos = { e: { c5: 0, h6: -40 }, pv: {} };
    const ex = explainMove({ fen, san: 'h6', pos, book: 'c5', judged: { grade: 'inexact', cp: -40, best: 'c5', bestCp: 0 } });
    expect(ex.principle).toBe('shield');
  });
  it('material swings settle after recaptures', () => {
    const fen = fenAfter(['d4', 'Nf6', 'e4']);
    expect(materialSwing(fen, ['Nxe4', 'Nf3'], 'b').delta).toBe(1);
  });
});

describe('hanging pieces without a Stockfish line', () => {
  it('names the loose pawn', async () => {
    const { hangingAfter } = await import('../shared/explain.js');
    const g = new Chess();
    for (const s of ['d4', 'Nf6', 'Bf4', 'g6', 'Nf3']) g.move(s);
    const h = hangingAfter(g.fen(), 'e5');
    expect(h.what).toBe('a pawn');
    expect(['Bxe5', 'Nxe5', 'dxe5']).toContain(h.capture);
  });
});
