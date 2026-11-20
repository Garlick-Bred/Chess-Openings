// End-to-end check of a sparring round with Playwright: registers an
// account (or uses E2E_USER / E2E_PASS), opens /spar and plays Black's moves
// until the round ends. In repertoire positions it plays the course move;
// elsewhere it asks the local Stockfish (/usr/games/stockfish) for one. One
// deliberate bad move checks the explanation. Fails on console errors.
//
// E2E_SLIP_AT=n makes White's n-th move a real mistake (the opening database
// answer is replaced with one bad move chosen by the local Stockfish), and
// checks that the round notices it and that answering with the best move
// counts as punishing it.
//   node scripts/e2e-spar.cjs <outDir> [baseUrl]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');

const OUT = process.argv[2] || '/tmp/spar-shots';
const BASE = process.argv[3] || 'http://localhost:8787';
const PHONE = process.env.E2E_PHONE === '1';
const course = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shared', 'course.json'), 'utf8'));
const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
fs.mkdirSync(OUT, { recursive: true });
const problems = [];

// Repertoire moves by position (Black to move).
const book = new Map();
for (const l of course.lines) {
  const g = new Chess();
  for (const s of l.sans) {
    if (g.turn() === 'b' && !book.has(key(g.fen()))) book.set(key(g.fen()), s);
    g.move(s);
  }
}

function stockfish() {
  const p = spawn(process.env.STOCKFISH || '/usr/games/stockfish');
  let buf = '';
  let waiter = null;
  p.stdout.on('data', (d) => {
    buf += d;
    if (waiter && buf.includes(waiter.token)) {
      const w = waiter;
      waiter = null;
      w.resolve(buf);
      buf = '';
    }
  });
  const ask = (cmd, token) =>
    new Promise((resolve) => {
      waiter = { token, resolve };
      p.stdin.write(cmd + '\n');
    });
  return {
    async bestmove(fen) {
      const out = await ask(`setoption name MultiPV value 1\nposition fen ${fen}\ngo depth 12`, 'bestmove');
      return /bestmove (\S+)/.exec(out)[1];
    },
    /** Every legal move with its score (side to move's view), best first. */
    async all(fen) {
      const out = await ask(`setoption name MultiPV value 80\nposition fen ${fen}\ngo depth 10`, 'bestmove');
      const last = new Map();
      for (const line of out.split('\n')) {
        const m = / depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+).* pv (\S+)/.exec(line);
        if (m) last.set(m[5], m[3] === 'mate' ? (Number(m[4]) > 0 ? 10000 : -10000) : Number(m[4]));
      }
      return [...last.entries()].map(([uci, cp]) => ({ uci, cp })).sort((a, b) => b.cp - a.cp);
    },
    quit: () => p.kill(),
  };
}

async function center(page, sq) {
  const el = await page.$(`[data-square="${sq}"]`);
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function tap(page, from, to) {
  const a = await center(page, from);
  await page.mouse.click(a.x, a.y);
  const b = await center(page, to);
  await page.mouse.click(b.x, b.y);
}
async function state(page) {
  return page.evaluate(() => ({
    interactive: !!document.querySelector('.board.interactive'),
    fen: document.querySelector('.board')?.dataset.fen,
    done: !!document.querySelector('.modal.result'),
  }));
}
async function waitTurn(page, prevFen) {
  for (let i = 0; i < 400; i++) {
    const s = await state(page);
    if (s.done || (s.interactive && s.fen !== prevFen)) return s;
    await page.waitForTimeout(100);
  }
  throw new Error('board never became interactive');
}
async function shot(page, name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82 });
}

(async () => {
  const sf = stockfish();
  const browser = await chromium.launch();
  const ctx = await browser.newContext(PHONE ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && !/status of 401|Failed to load resource: net::/.test(m.text()) && problems.push(`console: ${m.text()}`));
  page.on('requestfailed', (r) => r.url().startsWith(BASE) && !/ERR_ABORTED/.test(r.failure()?.errorText ?? '') && problems.push(`request failed: ${r.url()}`));
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

  const user = process.env.E2E_USER || `spar${Date.now() % 100000}`;
  const pass = process.env.E2E_PASS || 'e2e-password';
  await page.goto(BASE);
  await page.waitForSelector('.auth-card');
  if (process.env.E2E_USER) {
    await page.fill('input[autocomplete=username]', user);
    await page.fill('input[type=password]', pass);
    await page.click('button:has-text("Log in")');
  } else {
    await page.click('button:has-text("New account")');
    await page.fill('input[autocomplete=username]', user);
    await page.fill('input[placeholder="What the family sees"]', 'Sparring test');
    await page.fill('input[type=password]', pass);
    await page.click('button:has-text("Create account")');
  }
  await page.waitForSelector('.hero');

  // A forced White mistake, to check the slip is noticed and can be punished.
  const SLIP_AT = Number(process.env.E2E_SLIP_AT || 0);
  let forced = null;
  if (SLIP_AT) {
    await page.route('**/api/explorer?*', async (route) => {
      const fen = new URL(route.request().url()).searchParams.get('fen');
      const g = new Chess(fen);
      if (g.turn() !== 'w' || g.moveNumber() !== SLIP_AT || forced) return route.continue();
      const scored = await sf.all(fen);
      const best = scored[0].cp;
      // A clear mistake that still looks like a normal move: loses 1.5 to 4 pawns.
      const pick = scored.find((m) => best - m.cp >= 150 && best - m.cp <= 400) ?? scored[scored.length - 1];
      const mv = g.move({ from: pick.uci.slice(0, 2), to: pick.uci.slice(2, 4), promotion: pick.uci[4] });
      forced = { san: mv.san, loss: best - pick.cp, fen };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total: 5000, white: 2000, draws: 500, black: 2500, opening: null, moves: [{ san: mv.san, uci: pick.uci, white: 2000, draws: 500, black: 2500, rating: 1400 }] }),
      });
    });
  }
  await page.goto(`${BASE}/#/spar`);
  await page.waitForSelector('.board');
  let prev = null;
  let moves = 0;
  let missed = false;
  const log = [];
  for (let i = 0; i < 40; i++) {
    const s = await waitTurn(page, prev);
    if (s.done) break;
    const fen = s.fen;
    const whiteInfo = await page.$eval('.spar-white', (e) => e.textContent).catch(() => '');
    // One deliberate bad move, on the 4th turn, to see the explanation.
    if (moves === 3 && !missed && !SLIP_AT) {
      const g = new Chess(fen);
      const all = g.moves({ verbose: true });
      const bad = all.find((m) => m.san === 'h5' || m.san === 'a5') ?? all.find((m) => m.piece === 'p' && ['a', 'h'].includes(m.from[0])) ?? all[all.length - 1];
      await tap(page, bad.from, bad.to);
      await page.waitForSelector('.feedback.tone-bad, .feedback.tone-warn, .feedback.tone-ok, .feedback.tone-good', { timeout: 15000 });
      const fb = await page.$eval('.feedback', (e) => e.textContent);
      log.push(`  tried ${bad.san}: ${fb.slice(0, 220)}`);
      await shot(page, `spar-miss${PHONE ? '-phone' : ''}`);
      missed = true;
      const after = await state(page);
      if (after.fen !== fen) {
        // it was accepted after all
        prev = after.fen;
        moves++;
        continue;
      }
    }
    const bk = book.get(key(fen));
    const atSlip = forced && !forced.answered;
    let san;
    if (bk && !atSlip) san = bk;
    else {
      const uci = await sf.bestmove(fen);
      san = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
    }
    const mv = new Chess(fen).move(san);
    log.push(`${Math.ceil((new Chess(fen).moveNumber()))}. White: ${whiteInfo.trim().slice(0, 110)} | Black plays ${san}${bk ? ' (book)' : ' (sf)'}`);
    await tap(page, mv.from, mv.to);
    if (atSlip) {
      forced.answered = true;
      await page.waitForSelector('.feedback.tone-good, .feedback.tone-ok, .feedback.tone-bad, .feedback.tone-warn', { timeout: 20000 });
      forced.feedback = await page.$eval('.feedback', (e) => e.innerText);
      log.push(`  forced White slip ${forced.san} (-${forced.loss} cp), answered ${san}: ${forced.feedback.replace(/\n/g, ' ').slice(0, 260)}`);
      await shot(page, `spar-punished${PHONE ? '-phone' : ''}`);
      if (!/punished it/i.test(forced.feedback)) problems.push(`the forced slip ${forced.san} wasn't counted as punished: ${forced.feedback}`);
    }
    prev = fen;
    moves++;
    if (moves === 6) await shot(page, `spar-mid${PHONE ? '-phone' : ''}`);
  }
  await page.waitForSelector('.modal.result', { timeout: 30000 });
  await page.waitForSelector('.result-next, .modal.result .btn.primary', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await shot(page, `spar-result${PHONE ? '-phone' : ''}`);
  const result = await page.$eval('.modal.result', (e) => e.innerText);
  console.log(log.join('\n'));
  console.log('--- result ---\n' + result.slice(0, 900));
  if (SLIP_AT && !/slipped once/.test(result)) problems.push('the result screen does not list the slip');
  // Close the dialog to see the summary under the board.
  await page.click('.modal-backdrop', { position: { x: 5, y: 5 } }).catch(() => undefined);
  await shot(page, `spar-review${PHONE ? '-phone' : ''}`);
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  if (o.sw > o.w + 1) problems.push(`page scrolls sideways (${o.sw} > ${o.w})`);
  sf.quit();
  await browser.close();
  if (problems.length) {
    console.log('PROBLEMS:\n' + problems.join('\n'));
    process.exit(1);
  }
  console.log(`✓ sparring round played as ${user}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
