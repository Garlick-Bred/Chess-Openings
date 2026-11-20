// Stockfish in the browser, for sparring rounds: positions off the course
// have no precomputed evaluations, so the site analyses them on your device.
//
// The engine is Stockfish 19 "lite" (single-threaded WebAssembly, GPLv3),
// served by this site from /engine/. One Web Worker, created on first use;
// searches run one at a time in the order they were asked for.
//
// Scores are centipawns from the side to move's point of view. Mate in n is
// reported as ±(10000 − n), so anything beyond ±9000 means mate (as in
// shared/judge.js and shared/explain.js).

export const ENGINE_URL = '/engine/stockfish-19-lite-single.js';

export interface EngineLine {
  /** First move, in UCI notation (e7e5). */
  uci: string;
  cp: number;
  depth: number;
  /** Principal variation in UCI notation, starting with `uci`. */
  pv: string[];
}

export interface SearchOptions {
  multipv?: number;
  depth?: number;
  movetime?: number;
  /** Restrict the search to these root moves (UCI). */
  searchmoves?: string[];
}

interface Job {
  fen: string;
  opts: SearchOptions;
  resolve: (lines: EngineLine[]) => void;
  reject: (e: Error) => void;
}

export function engineSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
}

/** Parse one "info ... score ... pv ..." line. Bounds (lowerbound/upperbound) are skipped. */
export function parseInfo(line: string): { multipv: number; line: EngineLine } | null {
  if (!line.startsWith('info ') || !line.includes(' pv ') || !line.includes(' score ')) return null;
  const t = line.split(' ');
  let depth = 0;
  let multipv = 1;
  let cp: number | null = null;
  let pv: string[] = [];
  for (let i = 1; i < t.length; i++) {
    const k = t[i];
    if (k === 'depth') depth = Number(t[++i]);
    else if (k === 'multipv') multipv = Number(t[++i]);
    else if (k === 'score') {
      const kind = t[++i];
      const v = Number(t[++i]);
      if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null;
      cp = kind === 'mate' ? (v > 0 ? 10000 - v : -10000 - v) : v;
    } else if (k === 'pv') {
      pv = t.slice(i + 1);
      break;
    }
  }
  if (cp == null || !pv.length) return null;
  return { multipv, line: { uci: pv[0], cp, depth, pv } };
}

class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private current: { job: Job; lines: Map<number, EngineLine> } | null = null;
  private listeners: ((line: string) => void)[] = [];
  private failed: Error | null = null;

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let w: Worker;
      try {
        w = new Worker(ENGINE_URL);
      } catch (e) {
        reject(e as Error);
        return;
      }
      this.worker = w;
      const timer = window.setTimeout(() => fail(new Error('The engine took too long to start.')), 20000);
      const fail = (e: Error) => {
        clearTimeout(timer);
        this.failed = e;
        this.current?.job.reject(e);
        this.current = null;
        for (const j of this.queue.splice(0)) j.reject(e);
        reject(e);
      };
      w.onerror = (ev) => fail(new Error(ev.message || 'The engine could not be loaded.'));
      w.onmessage = (ev) => {
        const text = typeof ev.data === 'string' ? ev.data : String(ev.data);
        for (const line of text.split('\n')) this.onLine(line.trim());
      };
      const boot = (line: string) => {
        if (line === 'uciok') {
          this.send('setoption name Hash value 16');
          this.send('isready');
        } else if (line === 'readyok') {
          clearTimeout(timer);
          this.listeners = this.listeners.filter((l) => l !== boot);
          resolve();
        }
      };
      this.listeners.push(boot);
      this.send('uci');
    });
    this.ready.catch(() => undefined);
    return this.ready;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private onLine(line: string) {
    if (!line) return;
    for (const l of [...this.listeners]) l(line);
    const cur = this.current;
    if (!cur) return;
    const info = parseInfo(line);
    if (info) {
      const prev = cur.lines.get(info.multipv);
      if (!prev || info.line.depth >= prev.depth) cur.lines.set(info.multipv, info.line);
      return;
    }
    if (line.startsWith('bestmove')) {
      this.current = null;
      const lines = [...cur.lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
      // Keep only lines from the deepest completed iteration where possible.
      cur.job.resolve(lines);
      this.next();
    }
  }

  private next() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift()!;
    this.current = { job, lines: new Map() };
    const { multipv = 1, depth, movetime, searchmoves } = job.opts;
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${job.fen}`);
    let go = 'go';
    if (depth) go += ` depth ${depth}`;
    if (movetime) go += ` movetime ${movetime}`;
    if (!depth && !movetime) go += ' depth 12';
    if (searchmoves?.length) go += ` searchmoves ${searchmoves.join(' ')}`;
    this.send(go);
  }

  async analyse(fen: string, opts: SearchOptions = {}): Promise<EngineLine[]> {
    if (this.failed) throw this.failed;
    await this.start();
    return new Promise<EngineLine[]>((resolve, reject) => {
      this.queue.push({ fen, opts, resolve, reject });
      this.next();
    });
  }

  /** Load the engine ahead of time (it's about 2 MB). */
  warmUp(): Promise<void> {
    return this.start();
  }
}

let shared: Engine | null = null;
export function engine(): Engine {
  shared ??= new Engine();
  return shared;
}
