// Server-side training logic: record exercises, recompute points with the
// shared rules, move lines and deck positions through Opening School, fill
// Garlick cloves, rate attempts and unlock badges. Works against any store
// with the async get/all/run/batch interface (local SQLite or Cloudflare D1).
//
// `store` is this site's database; `authStore` holds the shared accounts.
import { LINES, LINE_BY_ID, CHAPTERS, DECKS } from '../shared/course-index.js';
import { scoreRun, BULB_CLOVES, bulbBonus, addDays, basePoints } from '../shared/scoring.js';
import { pathFor, pathChange } from '../shared/path.js';
import { cloveValue, cloveShortfall, LESSON_CLOVES_PER_DAY } from '../shared/cloves.js';
import { streakInfo, shieldDaysToUse, weaveBraid, rollGolden, goldenBonus, BRAID_SIZE, MAX_SHIELDS, REPAIR_CLOVES } from '../shared/streak.js';
import { runScore, rateAttempt, startingRating, TIMED_BONUS } from '../shared/rating.js';
import { lineAtLevel, advanceLine, advanceDeck, GRADUATE_DAYS } from '../shared/curriculum.js';
import { ACHIEVEMENTS, newlyUnlocked } from '../shared/achievements.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const EPS = 1e-9;
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const SURPRISE_RATING = 1150;
const MODES = ['learn', 'review', 'extra', 'free', 'deck'];
const CHAPTER_LINES = Object.fromEntries(CHAPTERS.map((c) => [c.id, c.lines]));

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export function parseSettings(profile) {
  try {
    return JSON.parse(profile?.settings || '{}');
  } catch {
    return {};
  }
}

/** The personal deck for this player (decks are built from a chess.com username's games). */
export function deckFor(profile) {
  const cc = String(parseSettings(profile).chesscom ?? '').toLowerCase();
  return (cc && DECKS[cc]) || null;
}

/** This site's profile for a shared account, created on first visit (rating starts at the chess rating). */
export async function ensureProfile(store, user) {
  let p = await store.get('SELECT * FROM profiles WHERE user_id = ?', user.id);
  if (!p) {
    await store.run(
      'INSERT OR IGNORE INTO profiles (user_id, op_rating, op_games, settings, created_at) VALUES (?, ?, 0, ?, ?)',
      user.id,
      startingRating(user.rating),
      '{}',
      Date.now(),
    );
    p = await store.get('SELECT * FROM profiles WHERE user_id = ?', user.id);
  }
  return p;
}

export async function getProgress(store, userId) {
  const [rows, deckRows, stats] = await Promise.all([
    store.all('SELECT item_id, status, clean_days, last_day, review_due, review_step FROM progress WHERE user_id = ?', userId),
    store.all('SELECT item_id, status, step, due, last_day FROM deck_progress WHERE user_id = ?', userId),
    store.all(
      `SELECT item_id, COUNT(*) attempts, COALESCE(SUM(success), 0) successes FROM attempts
       WHERE user_id = ? AND lesson_replay = 0 AND surprise IS NULL GROUP BY item_id`,
      userId,
    ),
  ]);
  const s = Object.fromEntries(stats.map((r) => [r.item_id, r]));
  const lines = {};
  for (const r of rows) {
    lines[r.item_id] = {
      status: r.status,
      cleanDays: r.clean_days,
      lastDay: r.last_day,
      reviewDue: r.review_due,
      reviewStep: r.review_step,
      attempts: s[r.item_id]?.attempts ?? 0,
      successes: s[r.item_id]?.successes ?? 0,
    };
  }
  const deck = {};
  for (const r of deckRows) {
    deck[r.item_id] = { status: r.status, step: r.step, due: r.due, lastDay: r.last_day, attempts: s[r.item_id]?.attempts ?? 0, successes: s[r.item_id]?.successes ?? 0 };
  }
  return { lines, deck };
}

/** Full-bulb days and days covered by a shield (protected = 1) or a repair (protected = 2). */
async function streakDays(store, userId) {
  const rows = await store.all('SELECT day, bulb_done, protected FROM days WHERE user_id = ? AND (bulb_done = 1 OR protected > 0)', userId);
  return {
    doneDays: rows.filter((r) => r.bulb_done).map((r) => r.day),
    protectedDays: rows.filter((r) => r.protected > 0).map((r) => r.day),
    shieldDays: rows.filter((r) => r.protected === 1).map((r) => r.day),
  };
}

/** Use streak shields for missed days, if there are enough to cover them all. */
export async function applyShields(store, userId, today) {
  if (!DAY_RE.test(today ?? '')) return [];
  const p = await store.get('SELECT shields FROM profiles WHERE user_id = ?', userId);
  if (!p?.shields) return [];
  const days = shieldDaysToUse({ ...(await streakDays(store, userId)), today, shields: p.shields });
  if (!days.length) return [];
  await store.batch([
    ...days.map((d) => [
      `INSERT INTO days (user_id, day, cloves, bulb_done, bonus, protected) VALUES (?,?,0,0,0,1)
       ON CONFLICT(user_id, day) DO UPDATE SET protected = 1`,
      [userId, d],
    ]),
    ['UPDATE profiles SET shields = MAX(0, shields - ?) WHERE user_id = ?', [days.length, userId]],
  ]);
  return days;
}

export async function getTotals(store, userId, today) {
  const [a, b, sd, p, grads] = await Promise.all([
    store.get(
      `SELECT COALESCE(SUM(points),0) pts, COALESCE(SUM(success),0) runs,
              COALESCE(SUM(CASE WHEN success AND misses = 0 AND idea_hints = 0 AND move_hints = 0 THEN 1 ELSE 0 END),0) clean,
              COALESCE(SUM(golden),0) golden,
              COALESCE(SUM(CASE WHEN success AND kind = 'punish' THEN 1 ELSE 0 END),0) + COALESCE(SUM(CASE WHEN surprise_found = 1 THEN 1 ELSE 0 END),0) punished,
              COALESCE(SUM(CASE WHEN surprise_found = 1 THEN 1 ELSE 0 END),0) surprises,
              COALESCE(SUM(CASE WHEN success AND kind = 'mistake' THEN 1 ELSE 0 END),0) fixed,
              COALESCE(SUM(CASE WHEN success AND timed = 1 AND slow_moves = 0 THEN 1 ELSE 0 END),0) timed_clean,
              COALESCE(SUM(CASE WHEN stars = 3 THEN 1 ELSE 0 END),0) three_stars
       FROM attempts WHERE user_id = ?`,
      userId,
    ),
    store.get('SELECT COALESCE(SUM(bonus),0) bonus, COALESCE(SUM(bulb_done),0) bulbs FROM days WHERE user_id = ?', userId),
    streakDays(store, userId),
    store.get('SELECT shields, braid FROM profiles WHERE user_id = ?', userId),
    store.all("SELECT item_id FROM progress WHERE user_id = ? AND status = 'graduated'", userId),
  ]);
  const prof = p ?? { shields: 0, braid: 0 };
  const streak = today ? streakInfo({ ...sd, today, shields: prof.shields }) : { streak: 0, repairable: null };
  const recentShield = today ? sd.shieldDays.filter((d) => d >= addDays(today, -3)).sort().pop() ?? null : null;
  const graduatedByChapter = {};
  for (const r of grads) {
    const ch = LINE_BY_ID[r.item_id]?.chapter;
    if (ch) graduatedByChapter[ch] = (graduatedByChapter[ch] ?? 0) + 1;
  }
  const points = a.pts + b.bonus;
  return {
    points,
    runs: a.runs,
    cleanRuns: a.clean,
    golden: a.golden,
    punished: a.punished,
    surprisesFound: a.surprises,
    mistakesFixed: a.fixed,
    timedClean: a.timed_clean,
    threeStars: a.three_stars,
    bulbs: b.bulbs,
    streak: streak.streak,
    shields: prof.shields,
    maxShields: MAX_SHIELDS,
    braid: prof.braid,
    braidSize: BRAID_SIZE,
    repair: streak.repairable ? { streak: streak.repairable.streak, cloves: REPAIR_CLOVES } : null,
    shieldUsedOn: recentShield,
    graduated: grads.length,
    graduatedByChapter,
    chapterLines: CHAPTER_LINES,
    lineCount: LINES.length,
    path: pathFor(points),
  };
}

export async function getDay(store, userId, day) {
  const [row, counts] = await Promise.all([
    store.get('SELECT cloves, bulb_done, bonus FROM days WHERE user_id = ? AND day = ?', userId, day),
    store.get(
      `SELECT COALESCE(SUM(CASE WHEN mode = 'review' THEN 1 ELSE 0 END),0) reviews,
              COALESCE(SUM(CASE WHEN kind != 'line' THEN 1 ELSE 0 END),0) deck,
              COUNT(*) runs, COALESCE(SUM(points),0) points, COALESCE(SUM(success),0) successes
       FROM attempts WHERE user_id = ? AND day = ?`,
      userId,
      day,
    ),
  ]);
  return {
    day,
    cloves: row?.cloves ?? 0,
    bulbDone: !!row?.bulb_done,
    bonus: row?.bonus ?? 0,
    size: BULB_CLOVES,
    reviews: counts?.reviews ?? 0,
    deck: counts?.deck ?? 0,
    runs: counts?.runs ?? 0,
    points: (counts?.points ?? 0) + (row?.bonus ?? 0),
    successes: counts?.successes ?? 0,
  };
}

/**
 * Validate, score and store a finished exercise. Returns everything the
 * result screen needs.
 */
export async function recordAttempt(store, user, body, opts = {}) {
  const kind = ['line', 'mistake', 'punish'].includes(body.kind) ? body.kind : null;
  if (!kind) throw httpError(400, 'Unknown exercise kind');
  const day = DAY_RE.test(body.day ?? '') ? body.day : new Date().toISOString().slice(0, 10);
  const profile0 = await ensureProfile(store, user);
  let item;
  if (kind === 'line') {
    item = LINE_BY_ID[body.itemId];
    if (!item) throw httpError(400, 'Unknown line');
  } else {
    item = (deckFor(profile0) ?? []).find((d) => d.id === body.itemId && d.kind === kind);
    if (!item) throw httpError(400, 'Unknown deck position');
  }
  await applyShields(store, user.id, day);
  const [progressBefore, prow, drow, dayRow0, profile, alreadyRows, recentToday, sdBefore] = await Promise.all([
    getProgress(store, user.id),
    kind === 'line'
      ? store.get('SELECT status, clean_days, last_day, review_due, review_step FROM progress WHERE user_id = ? AND item_id = ?', user.id, item.id)
      : null,
    kind !== 'line' ? store.get('SELECT status, step, due, last_day FROM deck_progress WHERE user_id = ? AND item_id = ?', user.id, item.id) : null,
    store.get('SELECT cloves, bulb_done, bonus FROM days WHERE user_id = ? AND day = ?', user.id, day),
    store.get('SELECT * FROM profiles WHERE user_id = ?', user.id),
    store.all('SELECT achievement_id FROM achievements WHERE user_id = ?', user.id),
    store.all('SELECT success, misses, idea_hints, move_hints FROM attempts WHERE user_id = ? AND day = ? ORDER BY id DESC LIMIT 6', user.id, day),
    streakDays(store, user.id),
  ]);

  const success = !!body.success;
  const lessonReplay = kind === 'line' && !!body.lessonReplay;
  const surprise =
    kind === 'line' && body.surprise && typeof body.surprise === 'object'
      ? { san: String(body.surprise.san ?? '').slice(0, 10), found: !!body.surprise.found, grade: String(body.surprise.grade ?? '').slice(0, 12) }
      : null;
  let mode = MODES.includes(body.mode) ? body.mode : kind === 'line' ? 'free' : 'deck';
  if (kind !== 'line') mode = 'deck';
  const run = {
    kind,
    // A surprise run stops early: score the moves actually played.
    blackMoves: kind === 'line' ? (body.surprise ? Math.max(1, Math.min(item.blackMoves, int(body.userMoves, 1, 100))) : item.blackMoves) : 1,
    success,
    misses: int(body.misses, 0, 100),
    ideaHints: int(body.ideaHints, 0, 100),
    moveHints: int(body.moveHints, 0, 100),
    timed: !!body.timed && kind === 'line',
    slowMoves: int(body.slowMoves, 0, 100),
    surprise,
    lessonReplay,
  };
  if (success && run.misses > 0) throw httpError(400, 'A run with misses is not a success');
  // Points: harder challenges (by the exercise's rating), speed (thinking
  // time per move) and the clean-run combo today.
  const durationMs = int(body.durationMs, 0, 3600e3);
  const puzzle = surprise ? SURPRISE_RATING : item.rating + (run.timed ? TIMED_BONUS : 0);
  let combo = 0;
  for (const r of recentToday) {
    if (r.success && !r.misses && !r.idea_hints && !r.move_hints) combo++;
    else break;
  }
  const score = scoreRun({
    ...run,
    rating: puzzle,
    finished: !!body.finished,
    thinkMs: body.thinkMs != null ? Math.min(durationMs, int(body.thinkMs, 0, 3600e3)) : null,
    userMoves: int(body.userMoves, 0, 200),
    combo,
  });
  const breakdown = [...score.breakdown];
  let points = score.total;

  // Opening School: where this exercise stood, and the update.
  const atLevel = kind === 'line' ? lineAtLevel(progressBefore.lines[item.id], day) && !surprise : true;
  let school = null;
  let deckState = null;
  if (kind === 'line') {
    const prev = prow ? { status: prow.status, cleanDays: prow.clean_days, lastDay: prow.last_day, reviewDue: prow.review_due, reviewStep: prow.review_step } : null;
    // A replay right after the lesson is from memory, so it counts as the day's
    // test; a surprise run stops early and never does.
    school = advanceLine(prev, { success, slow: run.timed && run.slowMoves > 0, counted: !surprise }, day);
  } else {
    const prev = drow ? { status: drow.status, step: drow.step, due: drow.due, lastDay: drow.last_day } : null;
    deckState = advanceDeck(prev, { success }, day);
  }

  // Opening rating.
  const ratingBefore = profile.op_rating ?? startingRating(user.rating);
  const rated = !lessonReplay;
  const quality = surprise ? (success && surprise.found ? 1 : 0) : runScore(run);
  const rating = rated
    ? rateAttempt({ rating: ratingBefore, games: profile.op_games ?? 0, puzzle, score: quality, anchor: user.rating })
    : { before: ratingBefore, after: ratingBefore, delta: 0, puzzle };

  // Garlick bulb.
  let cloveGain = cloveValue({ success, mode: atLevel || kind !== 'line' ? mode : 'extra', moveHints: run.moveHints, lessonReplay });
  const cloveNote = success && !lessonReplay && cloveGain < 1 - EPS ? cloveShortfall({ mode: atLevel || kind !== 'line' ? mode : 'extra', moveHints: run.moveHints }) : null;
  let lessonCloveCapped = false;
  if (cloveGain > 0 && lessonReplay) {
    const used = await store.get('SELECT COUNT(*) n FROM attempts WHERE user_id = ? AND day = ? AND lesson_replay = 1 AND clove_gain > 0', user.id, day);
    if (used.n >= LESSON_CLOVES_PER_DAY) {
      cloveGain = 0;
      lessonCloveCapped = true;
    }
  }
  const dayRow = dayRow0 ?? { cloves: 0, bulb_done: 0, bonus: 0 };
  const cloves = dayRow.cloves + cloveGain;
  const bulbCompletedNow = !dayRow.bulb_done && cloves >= BULB_CLOVES - EPS;
  // The full-bulb bonus grows with the streak you bring into today.
  const streakBefore = streakInfo({ ...sdBefore, today: day, shields: profile.shields ?? 0 }).streak;
  const bulbBonusNow = bulbCompletedNow ? bulbBonus(streakBefore) : 0;
  const woven = weaveBraid({ braid: profile.braid, shields: profile.shields, cloveBefore: dayRow.cloves, cloveAfter: cloves });
  let repaired = null;
  if (cloves >= REPAIR_CLOVES - EPS && dayRow.cloves < REPAIR_CLOVES - EPS) {
    const info = streakInfo({ ...(await streakDays(store, user.id)), today: day, shields: 0 });
    if (info.repairable) repaired = { streak: info.repairable.streak + 1, day: addDays(day, -1) };
  }

  // Golden clove: an occasional bonus at your level.
  const goldenEligible = success && !lessonReplay && run.moveHints === 0 && (atLevel || !!surprise?.found);
  const golden = rollGolden({ eligible: goldenEligible, sinceLast: profile.golden_since ?? 0, rng: opts.rng });
  let goldenPoints = 0;
  if (golden) {
    goldenPoints = goldenBonus(score.base);
    breakdown.push({ label: '✨ Golden clove', points: goldenPoints });
    points += goldenPoints;
  }
  const goldenSince = !goldenEligible ? (profile.golden_since ?? 0) : golden ? 0 : (profile.golden_since ?? 0) + 1;
  const firstMiss = body.firstMiss && typeof body.firstMiss === 'object' ? JSON.stringify(body.firstMiss).slice(0, 300) : null;
  const principle = typeof body.principle === 'string' ? body.principle.slice(0, 20) : null;

  const writes = [
    [
      `INSERT INTO attempts (user_id, kind, item_id, chapter, mode, success, misses, alternatives, idea_hints, move_hints, timed, slow_moves,
         surprise, surprise_found, first_miss, principle, duration_ms, user_moves, points, clove_gain, lesson_replay, puzzle_rating,
         rating_before, rating_after, golden, stars, breakdown, day, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        user.id,
        kind,
        item.id,
        item.chapter,
        mode,
        success ? 1 : 0,
        run.misses,
        int(body.alternatives, 0, 100),
        run.ideaHints,
        run.moveHints,
        run.timed ? 1 : 0,
        run.slowMoves,
        surprise ? JSON.stringify(surprise) : null,
        surprise ? (surprise.found ? 1 : 0) : null,
        firstMiss,
        principle,
        durationMs,
        int(body.userMoves, 0, 200),
        points,
        cloveGain,
        lessonReplay ? 1 : 0,
        rated ? puzzle : null,
        rated ? rating.before : null,
        rated ? rating.after : null,
        golden ? 1 : 0,
        score.stars,
        JSON.stringify(breakdown),
        day,
        Date.now(),
      ],
    ],
  ];
  if (school) {
    writes.push([
      `INSERT INTO progress (user_id, item_id, status, clean_days, last_day, review_due, review_step) VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(user_id, item_id) DO UPDATE SET status = excluded.status, clean_days = excluded.clean_days, last_day = excluded.last_day,
         review_due = excluded.review_due, review_step = excluded.review_step`,
      [user.id, item.id, school.status, school.cleanDays, school.lastDay, school.reviewDue, school.reviewStep],
    ]);
  }
  if (deckState) {
    writes.push([
      `INSERT INTO deck_progress (user_id, item_id, status, step, due, last_day) VALUES (?,?,?,?,?,?)
       ON CONFLICT(user_id, item_id) DO UPDATE SET status = excluded.status, step = excluded.step, due = excluded.due, last_day = excluded.last_day`,
      [user.id, item.id, deckState.status, deckState.step, deckState.due, deckState.lastDay],
    ]);
  }
  writes.push([
    `UPDATE profiles SET op_rating = ?, op_games = op_games + ?, shields = ?, braid = ?, golden_since = ? WHERE user_id = ?`,
    [rating.after, rated ? 1 : 0, woven.shields, woven.braid, goldenSince, user.id],
  ]);
  if (repaired) {
    writes.push([
      `INSERT INTO days (user_id, day, cloves, bulb_done, bonus, protected) VALUES (?,?,0,0,0,2)
       ON CONFLICT(user_id, day) DO UPDATE SET protected = 2`,
      [user.id, repaired.day],
    ]);
  }
  if (cloveGain > 0) {
    writes.push([
      `INSERT INTO days (user_id, day, cloves, bulb_done, bonus) VALUES (?,?,?,?,?)
       ON CONFLICT(user_id, day) DO UPDATE SET cloves = excluded.cloves, bulb_done = excluded.bulb_done, bonus = excluded.bonus`,
      [user.id, day, cloves, dayRow.bulb_done || bulbCompletedNow ? 1 : 0, bulbCompletedNow ? bulbBonusNow : dayRow.bonus],
    ]);
  }
  await store.batch(writes);

  const [totals, dayAfter] = await Promise.all([getTotals(store, user.id, day), getDay(store, user.id, day)]);
  const ctx = {
    attempt: { kind, itemId: item.id, chapter: item.chapter, success, clean: score.clean, timed: run.timed, slowMoves: run.slowMoves, surprise, mode, stars: score.stars, combo: score.clean ? combo + 1 : 0 },
    totals,
    events: { golden, shieldEarned: woven.earned > 0, repaired: !!repaired, graduated: !!school?.events?.graduated },
  };
  const unlocked = newlyUnlocked(ctx, alreadyRows.map((r) => r.achievement_id));
  const now = Date.now();
  await store.batch(unlocked.map((id) => ['INSERT OR IGNORE INTO achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)', [user.id, id, now]]));

  return {
    points,
    breakdown,
    clean: score.clean,
    cloveGain,
    cloveNote,
    golden: golden ? { points: goldenPoints, total: totals.golden } : null,
    braid: { braid: woven.braid, shields: woven.shields, earned: woven.earned, size: BRAID_SIZE, max: MAX_SHIELDS },
    repaired: repaired ? { streak: repaired.streak } : null,
    lessonReplay,
    lessonCloveCapped,
    rating: { rated, before: Math.round(rating.before), after: Math.round(rating.after), delta: rating.delta, puzzle },
    school: school
      ? { atLevel, mode, status: school.status, cleanDays: school.cleanDays, needed: GRADUATE_DAYS, reviewDue: school.reviewDue, events: school.events }
      : null,
    deck: deckState ? { status: deckState.status, due: deckState.due, events: deckState.events } : null,
    day: { ...dayAfter, bulbCompletedNow, bulbBonus: bulbBonusNow, streakBefore },
    stars: score.stars,
    difficulty: score.difficulty,
    combo: score.clean ? combo + 1 : 0,
    path: pathChange(totals.points - points - bulbBonusNow, totals.points),
    newAchievements: unlocked.map((id) => publicAchievement(ACHIEVEMENTS.find((a) => a.id === id))),
    totals: { points: totals.points, path: totals.path, streak: totals.streak, shields: totals.shields, graduated: totals.graduated },
  };
}

export function publicAchievement(a) {
  return { id: a.id, name: a.name, icon: a.icon, desc: a.desc };
}

export async function getAchievements(store, userId) {
  const rows = await store.all('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?', userId);
  const got = Object.fromEntries(rows.map((r) => [r.achievement_id, r.unlocked_at]));
  return ACHIEVEMENTS.map((a) => ({ ...publicAchievement(a), unlockedAt: got[a.id] ?? null }));
}

export async function getStats(store, userId, today) {
  const from = addDays(today, -29);
  const [perChapter, principles, recent, days, ratingRows] = await Promise.all([
    store.all(
      `SELECT chapter, COUNT(*) runs, COALESCE(SUM(success),0) successes,
              COALESCE(SUM(CASE WHEN success AND misses = 0 AND idea_hints = 0 AND move_hints = 0 THEN 1 ELSE 0 END),0) clean,
              AVG(duration_ms * 1.0 / MAX(user_moves, 1)) avg_ms
       FROM attempts WHERE user_id = ? AND lesson_replay = 0 GROUP BY chapter`,
      userId,
    ),
    store.all(
      `SELECT principle, COUNT(*) n FROM attempts WHERE user_id = ? AND principle IS NOT NULL GROUP BY principle ORDER BY n DESC`,
      userId,
    ),
    store.all(
      `SELECT id, kind, item_id, chapter, mode, success, misses, points, clove_gain, surprise, surprise_found, timed, slow_moves, day, created_at
       FROM attempts WHERE user_id = ? ORDER BY id DESC LIMIT 200`,
      userId,
    ),
    store.all('SELECT day, cloves, bulb_done, protected FROM days WHERE user_id = ? AND day >= ? ORDER BY day', userId, from),
    store.all('SELECT day, rating_after FROM attempts WHERE user_id = ? AND rating_after IS NOT NULL ORDER BY id DESC LIMIT 200', userId),
  ]);
  return {
    perChapter: perChapter.map((r) => ({
      chapter: r.chapter,
      runs: r.runs,
      successes: r.successes,
      clean: r.clean,
      secondsPerMove: r.avg_ms != null ? r.avg_ms / 1000 : null,
    })),
    principles,
    recent: recent.map((r) => ({
      id: r.id,
      kind: r.kind,
      itemId: r.item_id,
      chapter: r.chapter,
      mode: r.mode,
      success: !!r.success,
      misses: r.misses,
      points: r.points,
      cloveGain: r.clove_gain,
      surprise: r.surprise ? JSON.parse(r.surprise) : null,
      timed: !!r.timed,
      slowMoves: r.slow_moves,
      day: r.day,
      createdAt: r.created_at,
    })),
    days,
    ratingHistory: ratingRows.reverse().map((r) => ({ day: r.day, rating: Math.round(r.rating_after) })),
  };
}

/** Everyone who has used the openings site, with their shared account details. */
export async function getLeaderboard(store, authStore, today) {
  const weekFrom = addDays(today, -6);
  const profiles = await store.all('SELECT user_id, op_rating, op_games FROM profiles ORDER BY user_id');
  if (!profiles.length) return { players: [] };
  const ids = profiles.map((p) => p.user_id);
  const users = await authStore.all(
    `SELECT id, display_name, username, avatar, color, rating, rating_source FROM users WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  const players = await Promise.all(
    profiles
      .filter((p) => byId[p.user_id])
      .map(async (p) => {
        const u = byId[p.user_id];
        const [t, w, wb, d] = await Promise.all([
          getTotals(store, u.id, today),
          store.get('SELECT COALESCE(SUM(points),0) p FROM attempts WHERE user_id = ? AND day >= ?', u.id, weekFrom),
          store.get('SELECT COALESCE(SUM(bonus),0) p FROM days WHERE user_id = ? AND day >= ?', u.id, weekFrom),
          getDay(store, u.id, today),
        ]);
        return {
          displayName: u.display_name,
          username: u.username,
          avatar: u.avatar,
          color: u.color,
          rating: u.rating,
          ratingSource: u.rating_source,
          openingRating: p.op_rating != null ? Math.round(p.op_rating) : null,
          openingGames: p.op_games ?? 0,
          points: t.points,
          weekPoints: w.p + wb.p,
          runs: t.runs,
          streak: t.streak,
          bulbs: t.bulbs,
          graduated: t.graduated,
          todayCloves: d.cloves,
          stage: t.path.label,
          world: t.path.info.name,
          worldIcon: t.path.info.icon,
        };
      }),
  );
  return { players, lineCount: LINES.length };
}

export { basePoints };
