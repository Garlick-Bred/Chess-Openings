// A minimal UCI driver for Stockfish, with a small pool so positions can be
// analysed in parallel (one single-threaded engine per worker keeps results
// reproducible).
import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';

const MATE = 10000;

class Engine {
  constructor(path) {
    this.proc = spawn(path, [], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.buf = '';
    this.waiters = [];
    this.lines = [];
    this.proc.stdout.on('data', (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.lines.push(line);
        for (const w of [...this.waiters]) if (w.test(line)) {
          this.waiters.splice(this.waiters.indexOf(w), 1);
          w.resolve(this.lines.splice(0));
        }
      }
    });
  }
  send(cmd) {
    this.proc.stdin.write(cmd + '\n');
  }
  until(re) {
    return new Promise((resolve) => this.waiters.push({ test: (l) => re.test(l), resolve }));
  }
  async init() {
    this.send('uci');
    await this.until(/^uciok/);
    this.send('setoption name Threads value 1');
    this.send('setoption name Hash value 128');
    this.send('isready');
    await this.until(/^readyok/);
  }
  /**
   * Analyse a position. Returns [{ uci, cp, pv: [uci...] }] for each root move
   * searched, best first; cp is from the side to move's point of view (mate = ±10000 minus distance).
   */
  async analyse(fen, { depth = 14, multipv = 1, moves = null } = {}) {
    this.send('ucinewgame');
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}${moves ? ' searchmoves ' + moves.join(' ') : ''}`);
    const lines = await this.until(/^bestmove/);
    const byPv = new Map();
    for (const l of lines) {
      if (!l.startsWith('info ') || !l.includes(' pv ') || !l.includes(' multipv ')) continue;
      const d = Number(/ depth (\d+)/.exec(l)?.[1]);
      if (d !== depth) continue;
      const k = Number(/ multipv (\d+)/.exec(l)[1]);
      let cp;
      const m = / score (cp|mate) (-?\d+)/.exec(l);
      if (!m) continue;
      if (m[1] === 'cp') cp = Number(m[2]);
      else {
        const n = Number(m[2]);
        cp = n > 0 ? MATE - n : -MATE - n;
      }
      if (/ (lowerbound|upperbound)/.test(l)) continue;
      const pv = l.split(' pv ')[1].trim().split(/\s+/);
      byPv.set(k, { uci: pv[0], cp, pv });
    }
    return [...byPv.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  }
  quit() {
    this.send('quit');
  }
}

export class EnginePool {
  constructor(path, size) {
    this.path = path;
    this.size = size;
    this.free = [];
    this.queue = [];
  }
  async start() {
    for (let i = 0; i < this.size; i++) {
      const e = new Engine(this.path);
      await e.init();
      this.free.push(e);
    }
  }
  async run(fn) {
    const e = this.free.pop() ?? (await new Promise((r) => this.queue.push(r)));
    try {
      return await fn(e);
    } finally {
      const next = this.queue.shift();
      if (next) next(e);
      else this.free.push(e);
    }
  }
  stop() {
    for (const e of this.free) e.quit();
  }
}

/** UCI moves to SAN from a starting FEN (stops at the first illegal move). */
export function uciToSan(fen, ucis) {
  const g = new Chess(fen);
  const out = [];
  for (const u of ucis) {
    try {
      const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out;
}
