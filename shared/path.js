// The Garlick Path: points move you along a map of worlds and stages, like a
// puzzle game. World 1 has stages 1-1 to 1-10, then world 2 starts at 2-1.
// Each world has its own theme. Later worlds need more points per stage.
// (The opening rating is separate: it measures strength, the path measures
// effort.)

export const STAGES_PER_WORLD = 10;

/** Points needed to clear one stage of a world. */
export function stageStep(world) {
  return 100 + 50 * (world - 1);
}

/** Points needed to reach the start of a world. */
export function worldStart(world) {
  let total = 0;
  for (let w = 1; w < world; w++) total += STAGES_PER_WORLD * stageStep(w);
  return total;
}

export const WORLDS = [
  { name: 'Garden Gate', icon: '🌱', scenery: ['🌱', '🌼', '🪴', '🐝'], accent: '#81b64c', bg: ['#2f3d26', '#1f2a1a'], blurb: 'Where every garlic starts: a seed and a plan.' },
  { name: 'Sprout Meadow', icon: '🌿', scenery: ['🌿', '🦋', '🌷', '🍃'], accent: '#5fc3a0', bg: ['#21403a', '#16302b'], blurb: 'Green shoots everywhere. Your lines are taking root.' },
  { name: 'Bulb Hollow', icon: '🧄', scenery: ['🧄', '🍄', '🪨', '🐌'], accent: '#d8b98a', bg: ['#40342a', '#2b231c'], blurb: 'Underground, where the cloves grow fat.' },
  { name: 'Braid Market', icon: '🧺', scenery: ['🧺', '🥖', '🧅', '🪙'], accent: '#f0a04b', bg: ['#4a3420', '#2f2215'], blurb: 'Braided garlic for sale. Bargain with the London.' },
  { name: 'Kitchen Kingdom', icon: '🍳', scenery: ['🍳', '🔥', '🥘', '🧂'], accent: '#e8604c', bg: ['#4a2420', '#2e1714'], blurb: 'Things heat up: the King’s Indian attack is cooking.' },
  { name: 'Castle Larder', icon: '🏰', scenery: ['🏰', '🛡️', '🗝️', '🕯️'], accent: '#8fa8c8', bg: ['#2a3342', '#1b212c'], blurb: 'Stone walls and safe kings. Castle early.' },
  { name: 'Midnight Grove', icon: '🌙', scenery: ['🌙', '🦉', '✨', '🌲'], accent: '#a98be0', bg: ['#2f2645', '#1d182c'], blurb: 'Quiet, dark and full of tactics.' },
  { name: 'Dragon Peaks', icon: '🐉', scenery: ['🐉', '⛰️', '🔥', '💎'], accent: '#e05a7a', bg: ['#40202f', '#28141d'], blurb: 'The g7 bishop breathes fire down the long diagonal.' },
  { name: 'Golden Harvest', icon: '🌾', scenery: ['🌾', '🏆', '🥇', '🌻'], accent: '#f7c631', bg: ['#4a3d16', '#2e260e'], blurb: 'Everything you planted, brought in.' },
  { name: 'Garlick Crown', icon: '👑', scenery: ['👑', '🧄', '⭐', '♚'], accent: '#ffd76a', bg: ['#3d2f12', '#241b0a'], blurb: 'The top of the path. A crown of garlic.' },
];

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

/** Theme for any world number; after the last one the worlds repeat as "II", "III"… */
export function worldInfo(world) {
  const base = WORLDS[(world - 1) % WORLDS.length];
  const round = Math.floor((world - 1) / WORLDS.length) + 1;
  return { ...base, number: world, name: base.name + (ROMAN[round] ?? ` ${round}`) };
}

/**
 * Where a points total sits on the path.
 * @returns {{ world: number, stage: number, label: string, into: number, step: number, progress: number,
 *   toNext: number, nextLabel: string, stageStart: number, info: object }}
 */
export function pathFor(points) {
  const p = Math.max(0, Math.floor(points || 0));
  let world = 1;
  while (p >= worldStart(world + 1)) world++;
  const step = stageStep(world);
  const intoWorld = p - worldStart(world);
  const stage = Math.min(STAGES_PER_WORLD, Math.floor(intoWorld / step) + 1);
  const stageStart = worldStart(world) + (stage - 1) * step;
  const into = p - stageStart;
  const nextWorld = stage === STAGES_PER_WORLD ? world + 1 : world;
  const nextStage = stage === STAGES_PER_WORLD ? 1 : stage + 1;
  return {
    world,
    stage,
    label: `${world}-${stage}`,
    into,
    step,
    progress: into / step,
    toNext: step - into,
    nextLabel: `${nextWorld}-${nextStage}`,
    stageStart,
    info: worldInfo(world),
  };
}

/** What changed between two points totals: stages cleared, a new world. */
export function pathChange(before, after) {
  const a = pathFor(before);
  const b = pathFor(after);
  const stages = (b.world - a.world) * STAGES_PER_WORLD + (b.stage - a.stage);
  return { before: a, after: b, stagesUp: Math.max(0, stages), newWorld: b.world > a.world ? b.info : null };
}
