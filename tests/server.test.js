import { describe, it, expect } from 'vitest';
import { createNodeStore } from '../server/store-node.js';
import { ensureSchema, USERS_TABLE, SESSIONS_TABLE } from '../server/schema.js';
import { recordAttempt, getTotals, getProgress, getLeaderboard, ensureProfile } from '../server/game.js';
import { hashPassword, createSession } from '../server/auth.js';
import { createApi } from '../server/api.js';
import { LINES, DECKS } from '../shared/course-index.js';

const DAY = '2026-11-20';
const LINE = LINES[0];

/** An "endgame site" account database plus this site's own database. */
async function setupShared() {
  const authStore = createNodeStore(':memory:');
  await authStore.run(USERS_TABLE);
  await authStore.run(SESSIONS_TABLE);
  const store = createNodeStore(':memory:');
  await ensureSchema(store);
  const r = await authStore.run(
    'INSERT INTO users (username, display_name, password_hash, rating, rating_source, created_at) VALUES (?,?,?,?,?,?)',
    'mitch',
    'Mitch',
    await hashPassword('correct horse'),
    1250,
    'chesscom-rapid',
    0,
  );
  return { store, authStore, user: { id: r.lastId, rating: 1250 } };
}

const run = (over = {}) => ({ kind: 'line', itemId: LINE.id, mode: 'learn', success: true, misses: 0, durationMs: 30000, userMoves: LINE.blackMoves, day: DAY, ...over });

describe('recording runs', () => {
  it('a clean first run is day 1 of 3 and fills a clove', async () => {
    const { store, user } = await setupShared();
    const r = await recordAttempt(store, user, run());
    expect(r.school.cleanDays).toBe(1);
    expect(r.school.events.learnedDay).toBe(true);
    expect(r.cloveGain).toBe(1);
    expect(r.points).toBeGreaterThan(0);
    expect(r.rating.after).toBeGreaterThanOrEqual(r.rating.before);
  });
  it('graduates a line after three days and schedules a check-up', async () => {
    const { store, user } = await setupShared();
    await recordAttempt(store, user, run({ day: '2026-11-18' }));
    await recordAttempt(store, user, run({ day: '2026-11-19' }));
    const r = await recordAttempt(store, user, run({ day: DAY }));
    expect(r.school.events.graduated).toBe(true);
    expect((await getProgress(store, user.id)).lines[LINE.id].reviewDue).toBe('2026-11-23');
    expect((await getTotals(store, user.id, DAY)).graduated).toBe(1);
    expect(r.newAchievements.map((a) => a.id)).toContain('grad-1');
  });
  it('a miss earns nothing and is not a success', async () => {
    const { store, user } = await setupShared();
    const r = await recordAttempt(store, user, run({ success: false, misses: 2, principle: 'shield' }));
    expect(r.points).toBe(0);
    expect(r.cloveGain).toBe(0);
    await expect(recordAttempt(store, user, run({ success: true, misses: 1 }))).rejects.toThrow(/misses/);
  });
  it('extra practice fills half a clove; surprise runs never use up the day’s test', async () => {
    const { store, user } = await setupShared();
    await recordAttempt(store, user, run());
    const extra = await recordAttempt(store, user, run({ mode: 'extra' }));
    expect(extra.cloveGain).toBe(0.5);
    const s = await recordAttempt(store, user, run({ mode: 'learn', surprise: { san: 'Bxg6', found: true, grade: 'found' }, day: '2026-11-21' }));
    expect(s.school.events.tested).toBeUndefined();
    expect(s.breakdown.some((b) => /Punished/.test(b.label))).toBe(true);
    const t = await getTotals(store, user.id, '2026-11-21');
    expect(t.punished).toBe(1);
    expect(t.surprisesFound).toBe(1);
  });
  it('fills the bulb once and builds the streak', async () => {
    const { store, user } = await setupShared();
    let last;
    for (let i = 0; i < 5; i++) last = await recordAttempt(store, user, run({ itemId: LINES[i].id, userMoves: LINES[i].blackMoves }));
    expect(last.day.bulbCompletedNow).toBe(true);
    expect((await getTotals(store, user.id, DAY)).streak).toBe(1);
  });
  it('deck positions need the matching chess.com username', async () => {
    const { store, user } = await setupShared();
    const deckUser = Object.keys(DECKS)[0];
    const item = DECKS[deckUser][0];
    await expect(recordAttempt(store, user, { kind: item.kind, itemId: item.id, success: true, day: DAY })).rejects.toThrow(/Unknown deck/);
    await ensureProfile(store, user);
    await store.run('UPDATE profiles SET settings = ? WHERE user_id = ?', JSON.stringify({ chesscom: deckUser }), user.id);
    const r = await recordAttempt(store, user, { kind: item.kind, itemId: item.id, success: true, day: DAY });
    expect(r.deck.due).toBe('2026-11-23');
    expect(r.cloveGain).toBe(1);
  });
  it('points: combos for clean runs in a row, stars, path progress and a streak-sized bulb bonus', async () => {
    const { store, user } = await setupShared();
    const first = await recordAttempt(store, user, run({ thinkMs: 6000 }));
    expect(first.stars).toBe(3);
    expect(first.path.before.label).toBe('1-1');
    const second = await recordAttempt(store, user, run({ itemId: LINES[1].id, userMoves: LINES[1].blackMoves }));
    expect(second.breakdown.some((b) => /Combo ×2/.test(b.label))).toBe(true);
    expect(second.combo).toBe(2);
    const missed = await recordAttempt(store, user, run({ itemId: LINES[2].id, success: false, finished: true, misses: 1, userMoves: LINES[2].blackMoves }));
    expect(missed.stars).toBe(1);
    expect(missed.points).toBeGreaterThan(0);
    const t = await getTotals(store, user.id, DAY);
    expect(t.path.label).toBe(t.points >= 100 ? '1-2' : '1-1');
    expect(t.threeStars).toBe(1);
  });
  it('sparring rounds: points per slip punished, two full cloves a day, no rating change, their own badges', async () => {
    const { store, user } = await setupShared();
    const spar = (over = {}) => ({
      kind: 'spar',
      itemId: 'spar',
      mode: 'spar',
      chapter: 'london',
      success: true,
      misses: 0,
      blackMoves: 12,
      userMoves: 12,
      finished: true,
      durationMs: 120000,
      thinkMs: 100000,
      moves: 'd4 Nf6 Bf4 g6',
      slips: [{ ply: 8, san: 'Bd3', grade: 'inaccuracy', found: true }, { ply: 14, san: 'h3', grade: 'mistake', found: false }],
      day: DAY,
      ...over,
    });
    const r1 = await recordAttempt(store, user, spar());
    expect(r1.cloveGain).toBe(1);
    expect(r1.rating.rated).toBe(false);
    expect(r1.rating.after).toBe(r1.rating.before);
    expect(r1.school).toBeNull();
    expect(r1.breakdown.map((b) => b.label).join(' | ')).toMatch(/Sparring round \(12 moves\).*Punished White’s slip/);
    expect(r1.newAchievements.map((a) => a.id)).toEqual(expect.arrayContaining(['spar-1', 'punish-1']));
    expect(r1.day.spar).toBe(1);
    expect(r1.day.deck).toBe(0);
    const r2 = await recordAttempt(store, user, spar());
    expect(r2.cloveGain).toBe(1);
    const r3 = await recordAttempt(store, user, spar());
    expect(r3.cloveGain).toBe(0.5);
    expect(r3.cloveNote).toMatch(/already sparred 2 rounds/);
    const t = await getTotals(store, user.id, DAY);
    expect(t.sparRounds).toBe(3);
    expect(t.sparPunished).toBe(3);
    expect(t.punished).toBe(3);
    const row = await store.get("SELECT chapter, mode, punished, detail FROM attempts WHERE kind = 'spar' LIMIT 1");
    expect(row).toMatchObject({ chapter: 'london', mode: 'spar', punished: 1 });
    expect(JSON.parse(row.detail).slips).toHaveLength(2);
    // Stopped early: nothing earned; finished with misses: 40% plus the slip bonus.
    expect((await recordAttempt(store, user, spar({ success: false, finished: false, misses: 0, slips: [] }))).points).toBe(0);
    const miss = await recordAttempt(store, user, spar({ success: false, misses: 2 }));
    expect(miss.points).toBeGreaterThan(0);
    expect(miss.cloveGain).toBe(0);
    // Unknown chapters are dropped.
    await recordAttempt(store, user, spar({ chapter: 'nonsense' }));
    expect((await store.get("SELECT chapter FROM attempts WHERE kind = 'spar' ORDER BY id DESC LIMIT 1")).chapter).toBeNull();
  });
  it('rejects unknown lines', async () => {
    const { store, user } = await setupShared();
    await expect(recordAttempt(store, user, run({ itemId: 'nope' }))).rejects.toThrow(/Unknown line/);
  });
});

describe('HTTP API with shared accounts', () => {
  const req = (path, opts = {}) => new Request(`http://localhost${path}`, opts);
  const post = (path, body, cookie) => req(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) } });

  it('logs in with an existing endgame-site account and keeps openings data separate', async () => {
    const { store, authStore } = await setupShared();
    const api = createApi({ store, authStore });
    const bad = await api(post('/api/auth/login', { username: 'mitch', password: 'wrong' }));
    expect(bad.status).toBe(401);
    const res = await api(post('/api/auth/login', { username: 'mitch', password: 'correct horse' }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie').split(';')[0];
    expect(cookie).toMatch(/^garlick_session=/);
    const me = await (await api(req('/api/me?day=' + DAY, { headers: { cookie } }))).json();
    expect(me.user.displayName).toBe('Mitch');
    expect(me.user.openingRating).toBe(1250);
    // One sign-in: sessions live in the shared account database.
    expect((await authStore.get('SELECT COUNT(*) n FROM sessions')).n).toBe(1);
    expect((await store.get('SELECT COUNT(*) n FROM sessions')).n).toBe(0);
  });

  it('one sign-in: a session started on the endgame site works here, and logging out ends it everywhere', async () => {
    const { store, authStore, user } = await setupShared();
    const api = createApi({ store, authStore, env: { COOKIE_DOMAIN: 'garlick.ca' } });
    const token = await createSession(authStore, user.id); // as if signed in on endgames.garlick.ca
    const get = (path, cookie) => api(new Request(`https://openings.garlick.ca${path}`, { headers: { cookie } }));
    const me = await (await get('/api/me?day=' + DAY, `garlick_session=${token}`)).json();
    expect(me.user.displayName).toBe('Mitch');
    const login = await api(new Request('https://openings.garlick.ca/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'mitch', password: 'correct horse' }) }));
    expect(login.headers.getSetCookie()[0]).toMatch(/^garlick_session=.+; Domain=garlick\.ca; Secure/);
    const dev = await api(new Request('https://garlick-openings.x.workers.dev/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'mitch', password: 'correct horse' }) }));
    expect(dev.headers.getSetCookie()[0]).not.toMatch(/Domain=/);
    const out = await api(new Request('https://openings.garlick.ca/api/auth/logout', { method: 'POST', headers: { cookie: `garlick_session=${token}` } }));
    expect(out.headers.getSetCookie()[0]).toMatch(/^garlick_session=; .*Max-Age=0; Domain=garlick\.ca/);
    expect((await get('/api/me', `garlick_session=${token}`)).status).toBe(401);
    expect(await authStore.get('SELECT 1 x FROM sessions WHERE token = ?', token)).toBeNull();
  });

  it('new accounts are created in the shared account database with the endgame columns', async () => {
    const { store, authStore } = await setupShared();
    const api = createApi({ store, authStore });
    const res = await api(post('/api/auth/register', { username: 'cousin', password: 'longenough', rating: 900, ratingSource: 'guess' }));
    expect(res.status).toBe(200);
    const u = await authStore.get("SELECT * FROM users WHERE username = 'cousin'");
    expect(u.rating).toBe(900);
    expect(u.eg_games).toBe(0);
    const dup = await api(post('/api/auth/register', { username: 'mitch', password: 'longenough' }));
    expect(dup.status).toBe(409);
  });

  it('settings: shared fields go to the account database, training settings stay here', async () => {
    const { store, authStore } = await setupShared();
    const api = createApi({ store, authStore });
    const login = await api(post('/api/auth/login', { username: 'mitch', password: 'correct horse' }));
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const res = await api(req('/api/me', { method: 'PUT', body: JSON.stringify({ displayName: 'Mitchell', chesscom: 'ham_sandmitch', moveSeconds: 3 }), headers: { cookie, 'content-type': 'application/json' } }));
    const body = await res.json();
    expect(body.user.displayName).toBe('Mitchell');
    expect(body.user.settings.moveSeconds).toBe(3);
    expect(body.user.hasDeck).toBe(true);
    expect((await authStore.get('SELECT display_name, settings FROM users')).display_name).toBe('Mitchell');
    expect((await authStore.get('SELECT settings FROM users')).settings).toBe('{}'); // endgame settings untouched
  });

  it('attempts, leaderboard and stats over HTTP', async () => {
    const { store, authStore } = await setupShared();
    const api = createApi({ store, authStore });
    const login = await api(post('/api/auth/login', { username: 'mitch', password: 'correct horse' }));
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const a = await api(post('/api/attempts', run(), cookie));
    expect(a.status).toBe(200);
    const lb = await (await api(req('/api/leaderboard?day=' + DAY, { headers: { cookie } }))).json();
    expect(lb.players[0].displayName).toBe('Mitch');
    expect(lb.players[0].weekPoints).toBeGreaterThan(0);
    const stats = await (await api(req('/api/stats?day=' + DAY, { headers: { cookie } }))).json();
    expect(stats.perChapter[0].runs).toBe(1);
    expect((await getLeaderboard(store, authStore, DAY)).players.length).toBe(1);
  });

  it('single-database mode creates its own users table', async () => {
    const store = createNodeStore(':memory:');
    const api = createApi({ store });
    const res = await api(post('/api/auth/register', { username: 'solo', password: 'longenough' }));
    expect(res.status).toBe(200);
    const cfg = await (await api(req('/api/config'))).json();
    expect(cfg.sharedAccounts).toBe(false);
  });

  it('needs a login and validates input', async () => {
    const { store, authStore } = await setupShared();
    const api = createApi({ store, authStore });
    expect((await api(req('/api/me'))).status).toBe(401);
    expect((await api(req('/api/nope'))).status).toBe(404);
    expect(await api(req('/'))).toBeNull();
  });
});
