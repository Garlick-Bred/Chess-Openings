import { describe, it, expect } from 'vitest';
import { pathFor, pathChange, stageStep, worldStart, worldInfo, STAGES_PER_WORLD } from '../shared/path.js';

describe('the Garlick Path', () => {
  it('starts at 1-1 and reaches 1-2 at 100 points', () => {
    expect(pathFor(0).label).toBe('1-1');
    expect(pathFor(99).label).toBe('1-1');
    expect(pathFor(100).label).toBe('1-2');
    expect(pathFor(150).into).toBe(50);
    expect(pathFor(150).toNext).toBe(50);
  });
  it('world 2 starts after ten stages and needs more per stage', () => {
    expect(worldStart(2)).toBe(1000);
    expect(pathFor(999).label).toBe('1-10');
    expect(pathFor(999).nextLabel).toBe('2-1');
    expect(pathFor(1000).label).toBe('2-1');
    expect(stageStep(2)).toBe(150);
    expect(pathFor(1150).label).toBe('2-2');
  });
  it('each world has its own theme; after the last they repeat with numerals', () => {
    expect(worldInfo(1).name).toBe('Garden Gate');
    expect(worldInfo(2).name).not.toBe(worldInfo(1).name);
    expect(worldInfo(11).name).toBe('Garden Gate II');
    expect(pathFor(worldStart(12)).world).toBe(12);
  });
  it('reports stages cleared and new worlds', () => {
    const c = pathChange(950, 1010);
    expect(c.stagesUp).toBe(1);
    expect(c.newWorld.name).toBe('Sprout Meadow');
    expect(pathChange(10, 40).stagesUp).toBe(0);
    expect(STAGES_PER_WORLD).toBe(10);
  });
});
