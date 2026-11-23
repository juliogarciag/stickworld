import { describe, expect, it } from 'vitest';
import type { Command } from '../../core/commands';
import { createSim } from '../../core/create';
import type { SimHandle } from '../../core/sim';
import { LEVEL_END } from '../../features/flag/defs';
import { flagOf } from '../../features/flag/view';
import { stickManOf } from '../../features/player/view';
import { level1 } from './level1';
import { level2 } from './level2';

describe('level 1', () => {
  it('is finished by walking right to the flag, with a jump on the way', () => {
    const sim = createSim({ level: 1 });
    play(sim, WALK_TO_THE_FLAG);
    const flag = flagOf(sim)!;
    expect(flag.reached).toBe(true);
    expect(flag.raised).toBe(1);
    expect(stickManOf(sim).action).toBe('cheering');
    expect(Math.abs(stickManOf(sim).feet.x - flag.at.x)).toBeLessThan(0.5);
  });

  it('is not finished by stopping short of the flag', () => {
    const sim = createSim({ level: 1 });
    play(sim, STOP_SHORT);
    const flag = flagOf(sim)!;
    expect(flag.reached).toBe(false);
    expect(flag.raised).toBe(0);
    expect(stickManOf(sim).action).toBe('standing');
    expect(stickManOf(sim).feet.x).toBeGreaterThan(level1.start.x + 3);
    expect(stickManOf(sim).feet.x).toBeLessThan(flag.at.x - 1);
  });

  it('is not finished by walking the wrong way and falling off the paper', () => {
    const sim = createSim({ level: 1 });
    play(sim, { commands: [{ atTick: 0, command: { type: 'player/walk', direction: -1 } }], ticks: 600 });
    expect(flagOf(sim)!.reached).toBe(false);
  });

  it('stays finished, and he stays put, whatever is pressed before the next level starts', () => {
    const sim = createSim({ level: 1 });
    walkUntilTheFlagIsReached(sim);
    const stoodAt = stickManOf(sim).feet;
    play(sim, { commands: [{ atTick: 0, command: { type: 'player/walk', direction: -1 } }, { atTick: 5, command: { type: 'player/jump' } }], ticks: PAUSE_TICKS - 2 });
    expect(sim.level).toBe(1);
    expect(flagOf(sim)!.reached).toBe(true);
    expect(stickManOf(sim)).toMatchObject({ feet: stoodAt, action: 'cheering' });
  });

  it('is followed by level 2, a short pause after the flag is reached', () => {
    const sim = createSim({ level: 1 });
    walkUntilTheFlagIsReached(sim);
    play(sim, { commands: [], ticks: PAUSE_TICKS - 2 });
    expect(sim.level).toBe(1);
    play(sim, { commands: [], ticks: 4 });
    expect(sim.level).toBe(2);
    expect(stickManOf(sim)).toMatchObject({ feet: level2.start, action: 'standing' });
    expect(flagOf(sim)!.reached).toBe(false);
  });
});

// ---- Helpers ----

/** Commands as a player gave them, each with the tick it arrived on, and how long the recording runs. */
interface Recording {
  readonly commands: readonly { readonly atTick: number; readonly command: Command }[];
  readonly ticks: number;
}

/** Walk right, jump once on the way, keep walking: he reaches the flag after about four seconds. */
const WALK_TO_THE_FLAG: Recording = {
  commands: [
    { atTick: 10, command: { type: 'player/walk', direction: 1 } },
    { atTick: 90, command: { type: 'player/jump' } },
  ],
  ticks: 360,
};

/** Walk right for two seconds and let go, more than a metre before the flag. */
const STOP_SHORT: Recording = {
  commands: [
    { atTick: 10, command: { type: 'player/walk', direction: 1 } },
    { atTick: 130, command: { type: 'player/walk', direction: 0 } },
  ],
  ticks: 360,
};

/** How many ticks a finished level stays before the next one starts. */
const PAUSE_TICKS = Math.round(LEVEL_END.pauseBeforeNextLevel * 60);

/** Walks him right from where he is until the tick the flag is reached. */
function walkUntilTheFlagIsReached(sim: SimHandle): void {
  sim.step([{ type: 'player/walk', direction: 1 }]);
  for (let tick = 0; tick < 600 && !flagOf(sim)!.reached; tick += 1) sim.step();
  expect(flagOf(sim)!.reached).toBe(true);
}

function play(sim: SimHandle, { commands, ticks }: Recording): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    sim.step(commands.filter(({ atTick }) => atTick === tick).map(({ command }) => command));
  }
}
