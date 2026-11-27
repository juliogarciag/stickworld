import { describe, expect, it } from 'vitest';
import type { Command } from '../../core/commands';
import { createSim } from '../../core/create';
import type { SimHandle } from '../../core/sim';
import { LEVEL_END } from '../../features/flag/defs';
import { getFlag } from '../../features/flag/view';
import { getStickMan } from '../../features/player/view';
import { TICK_RATE } from '../tuning';
import { level1 } from './level1';
import { level2 } from './level2';

describe('level 1', () => {
  it('is finished by walking right to the flag, with a jump on the way', () => {
    const sim = createSim({ level: 1 });
    play(sim, WALK_TO_FLAG);
    const flag = getFlag(sim)!;
    expect(flag.isReached).toBe(true);
    expect(flag.raised).toBe(1);
    expect(getStickMan(sim).action).toBe('cheering');
    expect(Math.abs(getStickMan(sim).feet.x - flag.position.x)).toBeLessThan(0.5);
  });

  it('is not finished by stopping short of the flag', () => {
    const sim = createSim({ level: 1 });
    play(sim, STOP_SHORT);
    const flag = getFlag(sim)!;
    expect(flag.isReached).toBe(false);
    expect(flag.raised).toBe(0);
    expect(getStickMan(sim).action).toBe('standing');
    expect(getStickMan(sim).feet.x).toBeGreaterThan(level1.start.x + 3);
    expect(getStickMan(sim).feet.x).toBeLessThan(flag.position.x - 1);
  });

  it('is not finished by walking the wrong way and falling off the paper', () => {
    const sim = createSim({ level: 1 });
    play(sim, {
      commands: [{ atTick: 0, command: { type: 'player/walk', direction: -1 } }],
      ticks: 600,
    });
    expect(getFlag(sim)!.isReached).toBe(false);
  });

  it('stays finished, and the stick man stays put, whatever is pressed before the next level starts', () => {
    const sim = createSim({ level: 1 });
    walkUntilFlagIsReached(sim);
    const stoodAt = getStickMan(sim).feet;
    play(sim, {
      commands: [
        { atTick: 0, command: { type: 'player/walk', direction: -1 } },
        { atTick: 5, command: { type: 'player/jump' } },
      ],
      ticks: PAUSE_TICKS - 2,
    });
    expect(sim.level).toBe(1);
    expect(getFlag(sim)!.isReached).toBe(true);
    expect(getStickMan(sim)).toMatchObject({ feet: stoodAt, action: 'cheering' });
  });

  it('is followed by level 2, a short pause after the flag is reached', () => {
    const sim = createSim({ level: 1 });
    walkUntilFlagIsReached(sim);
    play(sim, { commands: [], ticks: PAUSE_TICKS - 2 });
    expect(sim.level).toBe(1);
    play(sim, { commands: [], ticks: 4 });
    expect(sim.level).toBe(2);
    expect(getStickMan(sim)).toMatchObject({ feet: level2.start, action: 'standing' });
    expect(getFlag(sim)!.isReached).toBe(false);
  });
});

// ---- Helpers ----

/**
 * Commands as a player gave them, each with the tick it arrived on, and how long the recording
 * runs.
 */
interface Recording {
  readonly commands: readonly { readonly atTick: number; readonly command: Command }[];
  readonly ticks: number;
}

/**
 * Walk right, jump once on the way, keep walking: the stick man reaches the flag after about four
 * seconds. It ends with the flag up, before the next level starts.
 */
const WALK_TO_FLAG: Recording = {
  commands: [
    { atTick: 10, command: { type: 'player/walk', direction: 1 } },
    { atTick: 90, command: { type: 'player/jump' } },
  ],
  ticks: 290,
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
const PAUSE_TICKS = Math.round(LEVEL_END.pauseBeforeNextLevel * TICK_RATE);

/** Walks the stick man right from where it is until the tick the flag is reached. */
function walkUntilFlagIsReached(sim: SimHandle): void {
  sim.step([{ type: 'player/walk', direction: 1 }]);
  for (let tick = 0; tick < 600 && !getFlag(sim)!.isReached; tick += 1) {
    sim.step();
  }
  expect(getFlag(sim)!.isReached).toBe(true);
}

function play(sim: SimHandle, recording: Recording): void {
  for (let tick = 0; tick < recording.ticks; tick += 1) {
    sim.step(
      recording.commands.filter((entry) => entry.atTick === tick).map((entry) => entry.command),
    );
  }
}
