// End-to-end walkthrough with Playwright: registers an account, plays a
// repertoire line from memory (with one deliberate mistake to see the
// explanation), answers the plan question, plays a surprise run and a
// position from the personal deck, and screenshots every page on desktop and
// phone. Fails on console errors or sideways scrolling on phones.
//   node scripts/e2e-openings.cjs <outDir> [baseUrl]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');

const OUT = process.argv[2] || 'docs/screenshots';
const BASE = process.argv[3] || 'http://localhost:8787';
const course = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shared', 'course.json'), 'utf8'));
const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
fs.mkdirSync(OUT, { recursive: true });
const problems = [];

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
async function boardState(page) {
  return page.evaluate(() => ({
    interactive: !!document.querySelector('.board.interactive'),
    fen: document.querySelector('.board')?.dataset.fen,
    done: !!document.querySelector('.modal.result'),
    plan: !!document.querySelector('.plan-quiz:not(.answered)'),
  }));
}
async function waitTurn(page) {
  for (let i = 0; i < 100; i++) {
    const s = await boardState(page);
    if (s.interactive || s.done || s.plan) return s;
    await page.waitForTimeout(80);
  }
  throw new Error('board never became interactive');
}
async function noOverflow(page, label) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  if (o.sw > o.w + 1) problems.push(`${label}: page scrolls sideways (${o.sw} > ${o.w})`);
}
async function shot(page, name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82 });
}

/** Play a line; at Black move number `missAt` (0-based) first try a wrong move. */
async function playLine(page, line, { missAt = -1, onMiss } = {}) {
  const g = new Chess();
  let blackIdx = 0;
  for (let ply = 0; ply < line.sans.length; ply++) {
    const san = line.sans[ply];
    if (ply % 2 === 0) {
      g.move(san);
      continue;
    }
    const s = await waitTurn(page);
    if (s.done) return;
    if (blackIdx === missAt) {
      const pos = course.positions[key(g.fen())];
      const evals = pos.e;
      const best = Math.max(...Object.values(evals));
      const wrong = Object.keys(evals).find((m) => m !== san && best - evals[m] >= 120);
      const mv = new Chess(g.fen()).move(wrong);
      await tap(page, mv.from, mv.to);
      await page.waitForSelector('.feedback.tone-bad, .feedback.tone-warn');
      if (onMiss) await onMiss(wrong);
      await waitTurn(page);
    }
    const mv = g.move(san);
    await tap(page, mv.from, mv.to);
    blackIdx++;
    await page.waitForTimeout(120);
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  // 401 = the login check before signing in; net:: errors are reported below
  // per URL, so third-party scripts (Cloudflare's analytics beacon) don't count.
  page.on('console', (m) => m.type() === 'error' && !/status of 401|Failed to load resource: net::/.test(m.text()) && problems.push(`console: ${m.text()}`));
  page.on('requestfailed', (r) => r.url().startsWith(BASE) && !/ERR_ABORTED/.test(r.failure()?.errorText ?? '') && problems.push(`request failed: ${r.url()}`));
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

  // Register
  await page.goto(BASE);
  await page.waitForSelector('.auth-card');
  await shot(page, 'login');
  await page.click('button:has-text("New account")');
  const user = process.env.E2E_USER || `e2e${Date.now() % 100000}`;
  await page.fill('input[autocomplete=username]', user);
  await page.fill('input[placeholder="What the family sees"]', 'Mitch');
  await page.fill('input[type=password]', 'e2e-password');
  const rating = await page.$('input[inputmode=numeric], input[type=number]');
  if (rating) await rating.fill('1250');
  await page.click('button:has-text("Create account")');
  await page.waitForSelector('.hero');

  // chess.com username -> personal deck + games
  await page.goto(`${BASE}/#/settings`);
  await page.fill('input[placeholder="e.g. ham_sandmitch"]', 'ham_sandmitch');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('.form-ok');
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector('.today-plan');
  await shot(page, 'home');

  // Opening School: first exercise is the first London line
  // A new line starts with its lesson, then you play it yourself
  await page.click('button:has-text("Start training")');
  await page.waitForSelector('.lesson-explain');
  await page.click('button:has-text("Next move")');
  await shot(page, 'lesson-new');
  await page.click('.lesson-bar button:has-text("Play it yourself")');
  await page.waitForSelector('.board[data-fen]');
  const lineId = (await page.evaluate(() => location.hash)).match(/line\/([^?]+)/)[1];
  const line = course.lines.find((l) => l.id === lineId);
  await playLine(page, line, {
    missAt: 4,
    onMiss: async () => shot(page, 'drill-mistake'),
  });
  await page.waitForSelector('.plan-quiz');
  await shot(page, 'drill-plan');
  await page.click('.plan-option >> nth=0');
  await page.waitForSelector('.modal.result');
  await page.waitForSelector('.rating-line');
  await shot(page, 'drill-result');

  // A clean run of a fresh line from the Lines page
  const line2 = course.lines[1];
  await page.goto(`${BASE}/#/line/${line2.id}?mode=learn`);
  await page.waitForSelector('.board[data-fen]');
  await playLine(page, line2);
  await page.click('.plan-option >> nth=0');
  await page.waitForSelector('.result-points');
  await shot(page, 'drill-clean');

  // Surprise: force one on a line with surprises
  const withSurprise = course.lines.find((l) => {
    const g = new Chess();
    return l.sans.some((s, i) => {
      const p = course.positions[key(g.fen())];
      g.move(s);
      return i % 2 === 0 && i >= 2 && p?.s?.length;
    });
  });
  await page.goto(`${BASE}/#/line/${withSurprise.id}?mode=free&surprise=1`);
  await page.waitForSelector('.board[data-fen]');
  {
    const g = new Chess();
    for (let ply = 0; ply < withSurprise.sans.length; ply++) {
      const s = await waitTurn(page);
      if (await page.$('.surprise-banner')) break;
      if (ply % 2 === 0) {
        g.move(withSurprise.sans[ply]);
        continue;
      }
      const mv = g.move(withSurprise.sans[ply]);
      await tap(page, mv.from, mv.to);
      await page.waitForTimeout(150);
    }
    await page.waitForSelector('.surprise-banner');
    await shot(page, 'surprise');
    const fen = (await boardState(page)).fen;
    const pos = course.positions[key(fen)];
    const mv = new Chess(fen).move(pos.punish.best);
    await tap(page, mv.from, mv.to);
    await page.waitForSelector('.modal.result');
    await shot(page, 'surprise-result');
  }

  // A position from the personal deck
  await page.goto(`${BASE}/#/train`);
  await page.waitForSelector('.hero-train');
  await shot(page, 'train');
  await page.click('button:has-text("An opponent’s mistake from your games")');
  await page.waitForSelector('.board[data-fen]');
  await waitTurn(page);
  await shot(page, 'deck-punish');

  // Lesson, lines, principles, games, stats, family, badges
  await page.goto(`${BASE}/#/lesson/job-e5`);
  await page.waitForSelector('.lesson-explain');
  for (let i = 0; i < 9; i++) await page.click('button:has-text("Next move")');
  await shot(page, 'lesson');
  await page.goto(`${BASE}/#/lines/london`);
  await page.waitForSelector('.chapter.open');
  await shot(page, 'lines');
  await page.goto(`${BASE}/#/principles/shield`);
  await page.waitForSelector('.principle');
  await shot(page, 'principles');
  await page.goto(`${BASE}/#/games`);
  await page.waitForSelector('.sys-table');
  await page.waitForSelector('.line-row, .warn', { timeout: 30000 }).catch(() => problems.push('games: no recent games loaded'));
  await shot(page, 'games');
  await page.goto(`${BASE}/#/path`);
  await page.waitForSelector('.path-map');
  await shot(page, 'path');
  for (const p of ['stats', 'family', 'badges']) {
    await page.goto(`${BASE}/#/${p}`);
    await page.waitForSelector('main .page h1, main h1');
    await shot(page, p);
  }

  // Phone
  const phone = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const pp = await phone.newPage();
  pp.on('pageerror', (e) => problems.push(`phone pageerror: ${e.message}`));
  for (const [name, route, sel] of [
    ['phone-home', '/#/', '.hero'],
    ['phone-train', '/#/train', '.hero-train'],
    ['phone-lines', '/#/lines/jobava', '.chapter.open'],
    ['phone-lesson', '/#/lesson/lon-castle', '.lesson-explain'],
    ['phone-games', '/#/games', '.sys-table'],
    ['phone-stats', '/#/stats', '.tiles'],
    ['phone-path', '/#/path', '.path-map'],
  ]) {
    await pp.goto(BASE + route);
    await pp.waitForSelector(sel);
    await noOverflow(pp, name);
    await pp.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82 });
  }
  // A line with a miss on the phone
  await pp.goto(`${BASE}/#/line/${course.lines[2].id}?mode=learn`);
  await pp.waitForSelector('.board[data-fen]');
  await playLine(pp, course.lines[2], {
    missAt: 2,
    onMiss: async () => {
      await noOverflow(pp, 'phone-drill');
      await pp.screenshot({ path: path.join(OUT, 'phone-drill.jpg'), type: 'jpeg', quality: 82 });
    },
  });
  for (const w of [320, 375, 414]) {
    await pp.setViewportSize({ width: w, height: 800 });
    for (const route of ['/#/', '/#/train', '/#/lines/london', `/#/lesson/${course.lines[0].id}`, '/#/games', '/#/stats', '/#/family', '/#/principles', '/#/path']) {
      await pp.goto(BASE + route);
      await pp.waitForTimeout(500);
      await noOverflow(pp, `${w}px ${route}`);
    }
  }

  await browser.close();
  if (problems.length) {
    console.error('Problems:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  console.log(`e2e ok, screenshots in ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
