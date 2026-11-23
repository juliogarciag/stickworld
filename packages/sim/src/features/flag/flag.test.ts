import { describe, expect, it } from 'vitest';
import { getDef } from '../../content/defs';
import { levelById, levels } from '../../content/levels';
import type { Level } from '../../content/levels/types';
import { FIXED_DT } from '../../content/tuning';
import { createSim } from '../../core/create';
import { stickManOf } from '../player/view';
import { FLAG_DEF_ID, flagDef, LEVEL_END } from './defs';
import { __testing__, flagPlacedIn } from './index';
import { flagOf } from './view';

describe('the flag', () => {
  it('stands where the level places it, not reached', () => {
    const placed = LEVEL.placements.find((placement) => placement.defId === FLAG_DEF_ID)!;
    expect(getDef(FLAG_DEF_ID)).toBe(flagDef);
    expect(flagOf(createSim({ level: 1 }))).toEqual({ at: placed.at, height: flagDef.height, reached: false, raised: 0, endsTheGame: false });
  });

  it('ends the game on the last level only', () => {
    expect(levels.map((level) => flagOf(createSim({ level: level.id }))!.endsTheGame)).toEqual(levels.map((_, index) => index === levels.length - 1));
  });

  it('is reached the moment he comes within reach of the stick, and then goes up it', () => {
    const sim = createSim({ level: 1 });
    sim.step([{ type: 'player/walk', direction: 1 }]);
    while (!flagOf(sim)!.reached) sim.step();
    const flag = flagOf(sim)!;
    expect(flag.at.x - stickManOf(sim).feet.x).toBeCloseTo(flagDef.reach, 1);
    expect(flag.raised).toBeLessThan(0.1);

    const halfway = Math.round(flagDef.raiseSeconds / 2 / sim.dt);
    for (let tick = 0; tick < halfway; tick += 1) sim.step();
    expect(flagOf(sim)!.raised).toBeCloseTo(0.5, 1);
    for (let tick = 0; tick < halfway * 2; tick += 1) sim.step();
    expect(flagOf(sim)!.raised).toBe(1);
  });

  it('is reached by jumping into it: it is taller than his jump', () => {
    const sim = createSim({ level: 1 });
    sim.step([{ type: 'player/walk', direction: 1 }]);
    while (flagOf(sim)!.at.x - stickManOf(sim).feet.x > 0.6) sim.step();
    sim.step([{ type: 'player/jump' }]);
    for (let tick = 0; tick < 30; tick += 1) sim.step();
    expect(flagOf(sim)!.reached).toBe(true);
  });
});

describe('every flag', () => {
  it('stands over floor that goes on for its reach on both sides, so he cannot finish a level on his way off the paper', () => {
    for (const level of levels) {
      const placed = flagPlacedIn(level);
      if (!placed) continue;
      const overFloor = level.floor.some((segment) => segment.from.x <= placed.at.x - flagDef.reach && placed.at.x + flagDef.reach <= segment.to.x);
      expect(overFloor, `level ${level.id}`).toBe(true);
    }
  });
});

describe('after the flag', () => {
  it('the next level starts once the pause is over, not a tick before', () => {
    const finished = { levels: TWO_LEVELS, level: 1, dt: FIXED_DT };
    expect(levelToStartNow({ ...finished, ticksSinceReached: 0 })).toBeUndefined();
    expect(levelToStartNow({ ...finished, ticksSinceReached: PAUSE_TICKS - 1 })).toBeUndefined();
    expect(levelToStartNow({ ...finished, ticksSinceReached: PAUSE_TICKS })).toBe(TWO_LEVELS[1]);
  });

  it('the last level stays finished however long he waits', () => {
    expect(levelToStartNow({ levels: TWO_LEVELS, level: 2, dt: FIXED_DT, ticksSinceReached: PAUSE_TICKS * 100 })).toBeUndefined();
  });
});

// ---- Helpers ----

const { levelToStartNow } = __testing__;
const PAUSE_TICKS = Math.round(LEVEL_END.pauseBeforeNextLevel / FIXED_DT);
const TWO_LEVELS: readonly Level[] = [levelById(1), { ...levelById(1), id: 2, name: 'The one after' }];

const LEVEL = levelById(1);
