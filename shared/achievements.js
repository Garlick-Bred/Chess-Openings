// Badges. An icon of 'garlick-N' is drawn as a Garlick bulb with N cloves
// filled; anything else is an emoji. `check` receives a context built by the
// server after each exercise:
//   ctx.attempt - { kind: 'line'|'mistake'|'punish', itemId, chapter, success, clean, timed, slowMoves, surprise, mode, stars, combo }
//   ctx.totals  - { points, runs, cleanRuns, bulbs, streak, golden, graduated, graduatedByChapter: {id:n},
//                   chapterLines: {id:n}, punished, mistakesFixed, timedClean, surprisesFound }
//   ctx.events  - { golden, shieldEarned, repaired, graduated }

const chapterDone = (c, id) => (c.totals.graduatedByChapter?.[id] ?? 0) >= (c.totals.chapterLines?.[id] ?? Infinity);
const chapterBadge = (id, name, icon, label) => ({
  id: `chapter-${id}`,
  name,
  icon,
  desc: `Graduate every line in ${label}.`,
  check: (c) => chapterDone(c, id),
});

export const ACHIEVEMENTS = [
  { id: 'first-run', name: 'First Clove', icon: 'garlick-1', desc: 'Play your first line from memory.', check: (c) => c.totals.runs >= 1 },
  { id: 'clean-10', name: 'Clean Sheet', icon: '🧼', desc: '10 clean runs: every move right, no hints.', check: (c) => c.totals.cleanRuns >= 10 },
  { id: 'clean-100', name: 'Muscle Memory', icon: '💪', desc: '100 clean runs.', check: (c) => c.totals.cleanRuns >= 100 },
  { id: 'grad-1', name: 'Graduate', icon: '🎓', desc: 'Graduate your first line (three days in a row from memory).', check: (c) => c.totals.graduated >= 1 },
  { id: 'grad-10', name: 'Repertoire Builder', icon: '📚', desc: 'Graduate 10 lines.', check: (c) => c.totals.graduated >= 10 },
  { id: 'grad-all', name: "King's Indian Master", icon: '👑', desc: 'Graduate every line in the course.', check: (c) => c.totals.graduated >= c.totals.lineCount },
  chapterBadge('london', 'London Breaker', '🌉', 'the London System chapter'),
  chapterBadge('colle', 'Colle Crusher', '🔨', 'the Colle and e3 chapter'),
  chapterBadge('jobava', 'Attack Absorber', '🛡️', 'the Jobava and e4 attacks chapter'),
  chapterBadge('mainline', 'Mar del Plata', '🌊', 'the main-line chapter'),
  chapterBadge('c4quiet', 'Quiet Storm', '🌀', 'the quiet c4 systems chapter'),
  chapterBadge('bg5', 'Bishop Pair', '⛪', 'the Trompowsky and Torre chapter'),
  chapterBadge('flank', 'Flank Guard', '🚩', 'the flank openings chapter'),
  chapterBadge('tricks', 'No Free Lunch', '🍽️', 'the early tricks chapter'),
  { id: 'punish-1', name: 'Gotcha', icon: '🎯', desc: 'Punish an opponent’s mistake.', check: (c) => c.totals.punished >= 1 },
  { id: 'punish-10', name: 'Punisher', icon: '⚔️', desc: 'Punish 10 mistakes.', check: (c) => c.totals.punished >= 10 },
  { id: 'punish-50', name: 'No Mercy', icon: '🗡️', desc: 'Punish 50 mistakes.', check: (c) => c.totals.punished >= 50 },
  { id: 'surprise-5', name: 'Wide Awake', icon: '👀', desc: 'Spot 5 surprise mistakes in the middle of your lines.', check: (c) => c.totals.surprisesFound >= 5 },
  { id: 'fix-10', name: 'Lesson Learned', icon: '🩹', desc: 'Find the right move in 10 positions from your own games.', check: (c) => c.totals.mistakesFixed >= 10 },
  { id: 'fix-50', name: 'New Habits', icon: '🔁', desc: 'Find the right move in 50 positions from your own games.', check: (c) => c.totals.mistakesFixed >= 50 },
  { id: 'clock-10', name: 'Blitz Ready', icon: '⏱️', desc: 'Pass 10 timed check-ups without going over the clock.', check: (c) => c.totals.timedClean >= 10 },
  { id: 'bulb-1', name: 'Full Bulb', icon: 'garlick-5', desc: 'Complete a daily Garlick bulb.', check: (c) => c.totals.bulbs >= 1 },
  { id: 'streak-3', name: 'Garlick Streak: 3', icon: '🔥', desc: 'Complete the bulb 3 days in a row.', check: (c) => c.totals.streak >= 3 },
  { id: 'streak-7', name: 'Garlick Streak: 7', icon: '🔥', desc: 'Complete the bulb 7 days in a row.', check: (c) => c.totals.streak >= 7 },
  { id: 'streak-30', name: 'Garlick Streak: 30', icon: '🌋', desc: 'Complete the bulb 30 days in a row.', check: (c) => c.totals.streak >= 30 },
  { id: 'golden-1', name: 'Golden Touch', icon: '✨', desc: 'Find your first golden clove.', check: (c) => (c.totals.golden ?? 0) >= 1 },
  { id: 'golden-10', name: 'Golden Hoard', icon: '🏆', desc: 'Collect 10 golden cloves.', check: (c) => (c.totals.golden ?? 0) >= 10 },
  { id: 'shield-1', name: 'Braided Shield', icon: '🛡️', desc: 'Weave a streak shield from extra cloves.', check: (c) => !!c.events?.shieldEarned },
  { id: 'repair-1', name: 'Second Wind', icon: '💨', desc: 'Repair a broken streak with a double bulb.', check: (c) => !!c.events?.repaired },
  { id: 'world-2', name: 'Out of the Garden', icon: '🌿', desc: 'Reach world 2 on the Garlick Path.', check: (c) => (c.totals.path?.world ?? 1) >= 2 },
  { id: 'world-5', name: 'Kitchen Kingdom', icon: '🍳', desc: 'Reach world 5 on the Garlick Path.', check: (c) => (c.totals.path?.world ?? 1) >= 5 },
  { id: 'world-10', name: 'Garlick Crown', icon: '👑', desc: 'Reach world 10 on the Garlick Path.', check: (c) => (c.totals.path?.world ?? 1) >= 10 },
  { id: 'three-stars-10', name: 'Star Collector', icon: '⭐', desc: 'Earn three stars (clean and fast) 10 times.', check: (c) => (c.totals.threeStars ?? 0) >= 10 },
  { id: 'combo-5', name: 'On a Roll', icon: '🎳', desc: 'Five clean runs in a row in one day.', check: (c) => (c.attempt?.combo ?? 0) >= 5 },
  { id: 'points-1k', name: 'Four Digits', icon: '💯', desc: 'Earn 1,000 points.', check: (c) => c.totals.points >= 1000 },
  { id: 'points-10k', name: 'Garlick Royalty', icon: '🏰', desc: 'Earn 10,000 points.', check: (c) => c.totals.points >= 10000 },
];

export function newlyUnlocked(ctx, already) {
  const have = new Set(already);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(ctx)).map((a) => a.id);
}
