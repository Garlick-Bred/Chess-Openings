#!/usr/bin/env node
// Builds shared/course.json from the annotated course (course/*.js):
//   1. parses and validates every line (legal moves, known principle tags),
//   2. merges notes per position, so transpositions share explanations,
//   3. adds Lichess masters statistics for every position (cached),
//   4. has Stockfish evaluate every legal Black move in every position you
//      have to play from, so the site can judge any move without an engine,
//   5. finds realistic White mistakes ("surprises") along each line and the
//      moves that punish them.
// Engine results are cached in scripts/.cache, so re-running after editing a
// note is quick.
//
//   node scripts/build-course.mjs [--no-engine] [--no-masters] [--depth=18]
//   STOCKFISH=/path/to/stockfish (default /usr/games/stockfish)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { COURSE } from '../course/kings-indian.js';
import { PRINCIPLES } from '../course/principles.js';
import { parseLine, posKey } from '../shared/pgn.js';
import { EnginePool, uciToSan } from './lib/uci.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE_DIR = path.join(ROOT, 'scripts/.cache');
const OUT = path.join(ROOT, 'shared/course.json');
const args = new Set(process.argv.slice(2));
const argVal = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : dflt;
};
const DEPTH_ALL = Number(argVal('depth-all', 12)); // every legal move
const DEPTH = Number(argVal('depth', 16)); // the moves that matter
const WORKERS = Number(argVal('workers', 4));
const STOCKFISH = process.env.STOCKFISH ?? '/usr/games/stockfish';
// Thresholds in centipawns (side to move's view).
const PV_LOSS = 50; // keep a refutation line for moves losing at least this much
const BOOK_WARN = 45; // warn when a repertoire move loses more than this
const SURPRISE_DROP = 130; // a White mistake must hand Black at least this much
const SURPRISE_MIN = 90; // ...and leave Black at least this well off
const PUNISH_MARGIN = 60; // punishing moves: within this of Black's best

fs.mkdirSync(CACHE_DIR, { recursive: true });
const loadJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const mastersCacheFile = path.join(CACHE_DIR, 'masters.json');
const engineCacheFile = path.join(CACHE_DIR, 'engine.json');
const mastersCache = loadJson(mastersCacheFile, {});
const engineCache = loadJson(engineCacheFile, {});
const opponentMoves = loadJson(path.join(ROOT, 'course/opponent-moves.json'), {});

const TAGS = new Set(PRINCIPLES.map((p) => p.id));
const CHAPTER_RATING = { tricks: 800, london: 1000, colle: 1000, flank: 1050, c4quiet: 1100, bg5: 1100, jobava: 1150, mainline: 1250 };

// ---------------------------------------------------------------------------
// 1-2. Parse lines and merge notes per position
const positions = {}; // key -> { fen, notes, alts, book: Set, lines: Set }
const lines = [];
const problems = [];
const pos = (fen) => (positions[posKey(fen)] ??= { fen, notes: {}, alts: {}, book: new Set(), lines: new Set() });
const checkTags = (note, where) => {
  for (const t of note?.tags ?? []) if (!TAGS.has(t)) problems.push(`${where}: unknown principle #${t}`);
};

for (const ch of COURSE.chapters) {
  for (const l of ch.lines) {
    let parsed;
    try {
      parsed = parseLine(l.pgn);
    } catch (e) {
      problems.push(`${l.id}: ${e.message}`);
      continue;
    }
    const { moves, alternatives } = parsed;
    moves.forEach((m, ply) => {
      const p = pos(m.fenBefore);
      p.lines.add(l.id);
      p.book.add(m.san);
      if (m.note) {
        checkTags(m.note, `${l.id} ply ${ply + 1}`);
        if (!p.notes[m.san]) p.notes[m.san] = { t: m.note.text, p: m.note.tags };
      }
      for (const alt of alternatives[ply] ?? []) {
        if (alt.san === m.san) problems.push(`${l.id} ply ${ply + 1}: variation repeats the main move ${m.san}`);
        checkTags(alt.note, `${l.id} ply ${ply + 1} (${alt.san})`);
        if (!p.alts[alt.san]) p.alts[alt.san] = { t: alt.note?.text ?? '', p: alt.note?.tags ?? [], v: alt.line };
      }
    });
    if (moves.length % 2 !== 0) problems.push(`${l.id}: should end with a Black move`);
    if (!l.plan || l.plan.options?.[l.plan.answer] == null) problems.push(`${l.id}: plan question missing or answer out of range`);
    const blackMoves = moves.filter((_, i) => i % 2 === 1).length;
    lines.push({
      id: l.id,
      chapter: ch.id,
      name: l.name,
      sans: moves.map((m) => m.san),
      plan: l.plan,
      blackMoves,
      rating: (CHAPTER_RATING[ch.id] ?? 1100) + Math.round(5 * Math.max(0, blackMoves - 5)),
    });
  }
}
const ids = new Set();
for (const l of lines) {
  if (ids.has(l.id)) problems.push(`duplicate line id ${l.id}`);
  ids.add(l.id);
}
// The same position must not have two different repertoire moves for Black.
for (const [k, p] of Object.entries(positions)) {
  if (k.split(' ')[1] === 'b' && p.book.size > 1) problems.push(`two repertoire moves (${[...p.book].join(', ')}) in ${k} (lines ${[...p.lines].join(', ')})`);
}
if (problems.length) {
  console.error('Course problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`${lines.length} lines, ${Object.keys(positions).length} positions`);

// ---------------------------------------------------------------------------
// 3. Masters statistics
async function masters(fen) {
  const k = posKey(fen);
  if (mastersCache[k]) return mastersCache[k];
  const url = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=12&topGames=0`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'garlick-openings-course-build/0.1' } }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      const moves = {};
      for (const m of d.moves) moves[m.san] = m.white + m.draws + m.black;
      mastersCache[k] = { total: d.white + d.draws + d.black, moves };
      await new Promise((res) => setTimeout(res, 400));
      return mastersCache[k];
    }
    await new Promise((res) => setTimeout(res, r?.status === 429 ? 60000 : 3000));
  }
  return null;
}

if (!args.has('--no-masters')) {
  let n = 0;
  for (const p of Object.values(positions)) {
    p.masters = await masters(p.fen);
    if (++n % 25 === 0) fs.writeFileSync(mastersCacheFile, JSON.stringify(mastersCache));
  }
  fs.writeFileSync(mastersCacheFile, JSON.stringify(mastersCache));
  console.log('masters statistics done');
} else {
  for (const p of Object.values(positions)) p.masters = mastersCache[posKey(p.fen)] ?? null;
}

// ---------------------------------------------------------------------------
// 4-5. Engine
const pool = new EnginePool(STOCKFISH, WORKERS);
const sanOf = (fen, uci) => uciToSan(fen, [uci])[0];

async function analyse(fen, opts) {
  const key = `${opts.depth}|${opts.multipv}|${opts.moves?.join(',') ?? ''}|${fen}`;
  if (engineCache[key]) return engineCache[key];
  const res = await pool.run((e) => e.analyse(fen, opts));
  engineCache[key] = res;
  return res;
}

/** Evaluate every legal move (side to move's view), refining the important ones at full depth. */
async function evaluateAll(fen, important = []) {
  const g = new Chess(fen);
  const legal = g.moves({ verbose: true });
  if (!legal.length) return null;
  const all = await analyse(fen, { depth: DEPTH_ALL, multipv: legal.length });
  const e = {};
  const pvs = {};
  for (const r of all) {
    const san = sanOf(fen, r.uci);
    e[san] = r.cp;
    pvs[san] = r.pv;
  }
  const top = await analyse(fen, { depth: DEPTH, multipv: 3 });
  for (const r of top) {
    const san = sanOf(fen, r.uci);
    e[san] = r.cp;
    pvs[san] = r.pv;
  }
  const uciOf = Object.fromEntries(legal.map((m) => [m.san, m.from + m.to + (m.promotion ?? '')]));
  const extra = [...new Set(important)].filter((s) => uciOf[s] && !top.some((r) => sanOf(fen, r.uci) === s));
  for (const s of extra) {
    const [r] = await analyse(fen, { depth: DEPTH, multipv: 1, moves: [uciOf[s]] });
    if (r) {
      e[s] = r.cp;
      pvs[s] = r.pv;
    }
  }
  const best = Math.max(...Object.values(e));
  const bestSan = Object.keys(e).find((s) => e[s] === best);
  const pv = {};
  // Refutation lines for the plausible moves only (the 25 best and the ones
  // the course mentions): enough to explain any realistic miss.
  const ranked = Object.keys(e).sort((a, b) => e[b] - e[a]);
  for (const [s, cp] of Object.entries(e)) {
    if (s === bestSan || important.includes(s) || (best - cp >= PV_LOSS && ranked.indexOf(s) < 25)) {
      // The line after the move, as SAN (the move itself first).
      pv[s] = uciToSan(fen, pvs[s].slice(0, 7));
    }
  }
  return { e, pv, best: bestSan };
}

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** How natural a White move looks to a club player (higher = more natural), or -1 to rule it out. */
function plausibility(fen, san, k) {
  const g = new Chess(fen);
  const mv = g.moves({ verbose: true }).find((m) => m.san === san);
  if (!mv) return -1;
  let s = 0;
  const seen = opponentMoves[k]?.[san] ?? 0;
  if (seen) s += 100 + 10 * seen; // your opponents really played it here
  if (mv.flags.includes('k') || mv.flags.includes('q')) s += 40; // castling
  else if (mv.piece === 'k') return -1;
  if (mv.piece === 'r') s -= 30;
  if ((mv.piece === 'n' || mv.piece === 'b') && mv.to[1] === '1' && !seen) return -1; // undeveloping: rarely played
  if (mv.piece === 'n' || mv.piece === 'b') s += mv.from[1] === '1' ? 35 : 10; // development
  if (mv.piece === 'p' && 'cdef'.includes(mv.from[0])) s += 25;
  if (mv.piece === 'p' && 'ah'.includes(mv.from[0])) s += mv.to[1] === '3' ? 15 : -10;
  if (mv.piece === 'q') s += 5;
  if (mv.captured) s += 10;
  // Ruled out (unless your opponents really played it): a piece simply left
  // hanging on the square it moved to. Those are too obvious to train
  // anything; the interesting mistakes allow a tactic or drop a pawn.
  const after = new Chess(g.fen());
  after.move(san);
  if (mv.piece !== 'p' && mv.piece !== 'k' && !seen) {
    const takers = after.moves({ verbose: true }).filter((m) => m.to === mv.to && m.captured);
    const defended = after.isAttacked(mv.to, 'w');
    if (takers.some((m) => !defended || PIECE_VALUE[m.piece] < PIECE_VALUE[mv.piece])) return -1;
  }
  return s;
}

const output = { e: {}, pv: {}, surprises: {}, punish: {} };
if (!args.has('--no-engine')) {
  await pool.start();
  const keys = Object.keys(positions);
  let done = 0;
  const warn = [];
  await Promise.all(
    keys.map(async (k) => {
      const p = positions[k];
      const black = k.split(' ')[1] === 'b';
      if (black) {
        const important = [...p.book, ...Object.keys(p.alts)];
        const r = await evaluateAll(p.fen, important);
        if (r) {
          output.e[k] = r.e;
          output.pv[k] = r.pv;
          const bestCp = r.e[r.best];
          for (const b of p.book) if (bestCp - r.e[b] > BOOK_WARN) warn.push(`${[...p.lines][0]}: ...${b} loses ${bestCp - r.e[b]} (best ${r.best}) in ${k}`);
        }
      } else if (p.book.size) {
        // White to move in a line: look for natural mistakes.
        const g = new Chess(p.fen);
        const legal = g.moves();
        const all = await analyse(p.fen, { depth: DEPTH_ALL, multipv: legal.length });
        const evals = Object.fromEntries(all.map((r) => [sanOf(p.fen, r.uci), r.cp]));
        const book = [...p.book][0];
        const bookCp = evals[book];
        if (bookCp != null) {
          const cands = Object.entries(evals)
            .filter(([s, cp]) => s !== book && bookCp - cp >= SURPRISE_DROP && -cp >= SURPRISE_MIN)
            .map(([s, cp]) => ({ san: s, cp, score: plausibility(p.fen, s, k) }))
            .filter((c) => c.score >= 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 4);
          const found = [];
          for (const c of cands) {
            const ag = new Chess(p.fen);
            ag.move(c.san);
            const afterFen = ag.fen();
            const r = await evaluateAll(afterFen);
            if (!r) continue;
            const best = r.e[r.best];
            const bookBlack = -bookCp;
            if (best < SURPRISE_MIN || best - bookBlack < SURPRISE_DROP) continue;
            const punish = Object.entries(r.e)
              .filter(([, cp]) => best - cp <= PUNISH_MARGIN && cp >= SURPRISE_MIN)
              .map(([s]) => s);
            const ak = posKey(afterFen);
            output.e[ak] = r.e;
            output.pv[ak] = r.pv;
            output.punish[ak] = { fen: afterFen, best: r.best, moves: punish, gain: best - bookBlack };
            found.push({ san: c.san, after: ak, seen: opponentMoves[k]?.[c.san] ?? 0 });
            if (found.length >= 2) break;
          }
          if (found.length) output.surprises[k] = found;
        }
      }
      if (++done % 10 === 0) {
        fs.writeFileSync(engineCacheFile, JSON.stringify(engineCache));
        console.log(`  engine ${done}/${keys.length}`);
      }
    }),
  );
  pool.stop();
  fs.writeFileSync(engineCacheFile, JSON.stringify(engineCache));
  if (warn.length) console.log('Repertoire moves Stockfish rates lower than the best move:\n  ' + warn.join('\n  '));
  console.log(`surprises at ${Object.keys(output.surprises).length} White moves`);
}

// ---------------------------------------------------------------------------
// Write
const outPositions = {};
for (const [k, p] of Object.entries(positions)) {
  outPositions[k] = {
    fen: p.fen,
    ...(Object.keys(p.notes).length ? { notes: p.notes } : {}),
    ...(Object.keys(p.alts).length ? { alts: p.alts } : {}),
    ...(p.masters ? { m: { t: p.masters.total, mv: Object.fromEntries(Object.entries(p.masters.moves).slice(0, 8)) } } : {}),
    ...(opponentMoves[k] ? { yours: opponentMoves[k] } : {}),
    ...(output.e[k] ? { e: output.e[k], pv: output.pv[k] } : {}),
    ...(output.surprises[k] ? { s: output.surprises[k] } : {}),
  };
}
for (const [k, p] of Object.entries(output.punish)) {
  outPositions[k] ??= { fen: p.fen };
  Object.assign(outPositions[k], { e: output.e[k], pv: output.pv[k], punish: { moves: p.moves, best: p.best, gain: p.gain } });
}
const data = {
  version: 1,
  engine: `Stockfish 16: every legal move at depth ${DEPTH_ALL}, the main candidates at depth ${DEPTH}`,
  course: { id: COURSE.id, name: COURSE.name, side: COURSE.side, intro: COURSE.intro },
  principles: PRINCIPLES,
  chapters: COURSE.chapters.map(({ lines: ls, ...c }) => ({ ...c, lines: ls.map((l) => l.id) })),
  lines,
  positions: outPositions,
};
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(`wrote ${path.relative(ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
