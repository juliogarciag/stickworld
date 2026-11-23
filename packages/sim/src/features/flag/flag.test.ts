import { describe, expect, it } from 'vitest';
import { getDef } from '../../content/defs';
import { levelById } from '../../content/levels';
import { createSim } from '../../core/create';
import { stickManOf } from '../player/view';
import { FLAG_DEF_ID, flagDef } from './defs';
import { flagOf } from './view';

describe('the flag', () => {
  it('stands where the level places it, not reached', () => {
    const placed = LEVEL.placements.find((placement) => placement.defId === FLAG_DEF_ID)!;
    expect(getDef(FLAG_DEF_ID)).toBe(flagDef);
    expect(flagOf(createSim({ level: 1 }))).toEqual({ at: placed.at, height: flagDef.height, reached: false, raised: 0 });
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

// ---- Helpers ----

const LEVEL = levelById(1);
