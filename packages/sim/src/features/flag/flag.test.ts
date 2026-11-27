import { describe, expect, it } from 'vitest';
import { getDef } from '../../content/defs';
import { getLevelById, levels } from '../../content/levels';
import type { Level } from '../../content/levels/types';
import { FIXED_DT } from '../../content/tuning';
import { createSim } from '../../core/create';
import { getStickMan } from '../player/view';
import { FLAG_DEF_ID, flagDef, LEVEL_END } from './defs';
import { __testing__, findFlagPlacedIn } from './index';
import { getFlag } from './view';

describe('the flag', () => {
  it('stands where the level places it, not reached', () => {
    const placed = LEVEL.placements.find((placement) => placement.defId === FLAG_DEF_ID)!;
    expect(getDef(FLAG_DEF_ID)).toBe(flagDef);
    expect(getFlag(createSim({ level: 1 }))).toEqual({ position: placed.position, height: flagDef.height, isReached: false, upFor: 0, raised: 0, isFinalFlag: false });
  });

  it('ends the game on the last level only', () => {
    expect(levels.map((level) => getFlag(createSim({ level: level.id }))!.isFinalFlag)).toEqual(levels.map((_, index) => index === levels.length - 1));
  });

  it('is reached the moment the stick man comes within reach of the stick, and then goes up it', () => {
    const sim = createSim({ level: 1 });
    sim.step([{ type: 'player/walk', direction: 1 }]);
    while (!getFlag(sim)!.isReached) sim.step();
    const flag = getFlag(sim)!;
    expect(flag.position.x - getStickMan(sim).feet.x).toBeCloseTo(flagDef.reach, 1);
    expect(flag.raised).toBeLessThan(0.1);

    const halfway = Math.round(flagDef.raiseSeconds / 2 / sim.dt);
    for (let tick = 0; tick < halfway; tick += 1) sim.step();
    expect(getFlag(sim)!.raised).toBeCloseTo(0.5, 1);
    for (let tick = 0; tick < halfway * 2; tick += 1) sim.step();
    expect(getFlag(sim)!.raised).toBe(1);
  });

  it("is reached by jumping into it: it is taller than the stick man's jump", () => {
    const sim = createSim({ level: 1 });
    sim.step([{ type: 'player/walk', direction: 1 }]);
    while (getFlag(sim)!.position.x - getStickMan(sim).feet.x > 0.6) sim.step();
    sim.step([{ type: 'player/jump' }]);
    for (let tick = 0; tick < 30; tick += 1) sim.step();
    expect(getFlag(sim)!.isReached).toBe(true);
  });
});

describe('every flag', () => {
  it("stands over floor that goes on for its reach on both sides, so the stick man cannot finish a level on the stick man's way off the paper", () => {
    for (const level of levels) {
      const placed = findFlagPlacedIn(level);
      if (!placed) continue;
      const isOverFloor = level.floor.some((segment) => segment.start.x <= placed.position.x - flagDef.reach && placed.position.x + flagDef.reach <= segment.end.x);
      expect(isOverFloor, `level ${level.id}`).toBe(true);
    }
  });
});

describe('after the flag', () => {
  it('the next level starts once the pause is over, not a tick before', () => {
    const finished = { levels: TWO_LEVELS, level: 1, dt: FIXED_DT };
    expect(findLevelToStartNow({ ...finished, ticksSinceReached: 0 })).toBeUndefined();
    expect(findLevelToStartNow({ ...finished, ticksSinceReached: PAUSE_TICKS - 1 })).toBeUndefined();
    expect(findLevelToStartNow({ ...finished, ticksSinceReached: PAUSE_TICKS })).toBe(TWO_LEVELS[1]);
  });

  it('the last level stays finished however long the stick man waits', () => {
    expect(findLevelToStartNow({ levels: TWO_LEVELS, level: 2, dt: FIXED_DT, ticksSinceReached: PAUSE_TICKS * 100 })).toBeUndefined();
  });
});

// ---- Helpers ----

const { findLevelToStartNow } = __testing__;
const PAUSE_TICKS = Math.round(LEVEL_END.pauseBeforeNextLevel / FIXED_DT);
const TWO_LEVELS: readonly Level[] = [getLevelById(1), { ...getLevelById(1), id: 2, name: 'The one after' }];

const LEVEL = getLevelById(1);
