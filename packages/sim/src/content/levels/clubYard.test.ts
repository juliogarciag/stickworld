import { describe, expect, it } from 'vitest';
import type { Command } from '../../core/commands';
import { createSim } from '../../core/create';
import type { SimHandle } from '../../core/sim';
import { clubEnemyDef } from '../../features/enemy/clubEnemy/defs';
import { getEnemies } from '../../features/enemy/view';
import { getFlag } from '../../features/flag/view';
import { PENCIL_ITEM_ID, SPEAR_ITEM_ID } from '../../features/inventory/defs';
import { getItemSlots } from '../../features/inventory/view';
import { getStickMan } from '../../features/player/view';
import { SPEAR } from '../../features/spear/defs';
import { getInteraction } from '../../features/world/view';
import { TICK_RATE } from '../tuning';
import { clubYard } from './clubYard';

describe('the yard with a club in it', () => {
  it('is finished by making the enemy swing at nothing, jumping over it while it lifts its club and walking on to the flag', () => {
    const sim = createSim({ level: clubYard.id });
    const wasStruck = playPastEnemy(sim, { ticksWaitedAfterSwing: 0 });
    expect(wasStruck).toBe(false);
    expect(getFlag(sim)!.isReached).toBe(true);
    expect(getStickMan(sim).action).toBe('cheering');
  });

  it('is finished with the spear: the stick man reads the letter, sharpens the pencil, thrusts at the enemy that comes for it and walks on to the flag', () => {
    const sim = createSim({ level: clubYard.id });
    sim.step([WALK_RIGHT]);
    stepUntil(sim, () => getInteraction(sim) === 'read');
    sim.step([STOP, INTERACT]);
    expect(getItemSlots(sim)[0]!.itemDefId).toBe(PENCIL_ITEM_ID);
    sim.step([INTERACT]);
    sim.step([USE]);
    expect(getItemSlots(sim)[0]!.itemDefId).toBe(SPEAR_ITEM_ID);
    sim.step([WALK_RIGHT]);
    // It thrusts as the enemy comes into the spear's reach, and never stops walking.
    stepUntil(sim, () => getEnemies(sim)[0]!.position.x - getStickMan(sim).feet.x <= SPEAR.reach);
    sim.step([USE]);
    let wasStruck = false;
    stepUntil(sim, () => {
      wasStruck ||= getStickMan(sim).action === 'struck';
      return wasStruck || getFlag(sim)!.isReached;
    });
    expect(wasStruck).toBe(false);
    expect(getEnemies(sim)).toEqual([]);
    expect(getStickMan(sim).action).toBe('cheering');
  });

  it('is not finished with the pencil: unsharpened it does nothing to the enemy, and the stick man is struck down', () => {
    const sim = createSim({ level: clubYard.id });
    sim.step([WALK_RIGHT]);
    stepUntil(sim, () => getInteraction(sim) === 'read');
    sim.step([STOP, INTERACT]);
    sim.step([INTERACT]);
    sim.step([WALK_RIGHT]);
    stepUntil(sim, () => getStickMan(sim).action === 'struck');
    expect(getEnemies(sim)[0]!.rubbedOutProgress).toBeNull();
    expect(getFlag(sim)!.isReached).toBe(false);
  });

  it('is not finished by walking to the flag: the stick man is struck down and starts again', () => {
    const sim = createSim({ level: clubYard.id });
    let wasStruck = false;
    for (let tick = 0; tick < 20 * TICK_RATE; tick += 1) {
      // The key is still held when the level starts again: the client sends the walk again.
      sim.step(getStickMan(sim).walkDirectionAsked === 1 ? [] : [WALK_RIGHT]);
      wasStruck ||= getStickMan(sim).action === 'struck';
    }
    expect(wasStruck).toBe(true);
    expect(getFlag(sim)!.isReached).toBe(false);
    expect(getStickMan(sim).feet.x).toBeLessThan(clubYard.enemies![0]!.position.x);
  });

  it('is not finished by walking into the enemy between two swings: its body is in the way', () => {
    const sim = createSim({ level: clubYard.id });
    makeEnemySwingAtNothing(sim);
    sim.step([WALK_RIGHT]);
    let farthest = 0;
    for (let tick = 0; tick < 4 * TICK_RATE && getStickMan(sim).action !== 'struck'; tick += 1) {
      sim.step();
      farthest = Math.max(farthest, getStickMan(sim).feet.x);
    }
    expect(getStickMan(sim).action).toBe('struck');
    expect(farthest).toBeLessThan(getEnemies(sim)[0]!.position.x - clubEnemyDef.width / 2);
  });

  it('leaves time to spare: the stick man who waits before going back in still gets past, up to a point', () => {
    const waitsThatPass = WAITS.filter((ticksWaitedAfterSwing) => {
      const sim = createSim({ level: clubYard.id });
      return !playPastEnemy(sim, { ticksWaitedAfterSwing }) && getFlag(sim)!.isReached;
    });
    // Tuning the enemy or how the stick man moves changes this window; widen or narrow it on
    // purpose, never by accident. Half a second is the least a player is given.
    expect(waitsThatPass).toEqual(WAITS.filter((ticks) => ticks <= LONGEST_WAIT_THAT_PASSES));
    expect(LONGEST_WAIT_THAT_PASSES / TICK_RATE).toBeGreaterThanOrEqual(0.5);
  });
});

// ---- Helpers ----

const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };
const WALK_LEFT: Command = { type: 'player/walk', direction: -1 };
const STOP: Command = { type: 'player/walk', direction: 0 };
const JUMP: Command = { type: 'player/jump' };
const USE: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };
/** How far in front of the enemy's middle the stick man jumps from, in metres. */
const JUMP_FROM = 1;
/** Every wait tried between the end of the swing and going back in, in ticks. */
const WAITS = Array.from({ length: 61 }, (_, ticks) => ticks);
/**
 * The longest the stick man may stand still after the club has come down, in ticks, and still get
 * past: it has walked away for the whole wind-up and swing, so it has the furthest to come back.
 */
const LONGEST_WAIT_THAT_PASSES = 32;

function stepUntil(sim: SimHandle, isDone: () => boolean): void {
  let ticks = 0;
  while (!isDone()) {
    sim.step();
    ticks += 1;
    if (ticks > 3000) {
      throw new Error('never got there');
    }
  }
}

/**
 * The stick man walks at the enemy until its club goes back, walks away until the club has come
 * down, and stops.
 */
function makeEnemySwingAtNothing(sim: SimHandle): void {
  sim.step([WALK_RIGHT]);
  stepUntil(sim, () => getEnemies(sim)[0]!.action === 'windingUp');
  sim.step([WALK_LEFT]);
  stepUntil(sim, () => getEnemies(sim)[0]!.action === 'recovering');
  sim.step([STOP]);
}

/**
 * The intended way through the yard, with a wait before the stick man goes back in. True when the
 * stick man was struck on the way.
 */
function playPastEnemy(sim: SimHandle, play: { ticksWaitedAfterSwing: number }): boolean {
  makeEnemySwingAtNothing(sim);
  for (let tick = 0; tick < play.ticksWaitedAfterSwing; tick += 1) {
    sim.step();
  }
  const enemyX = getEnemies(sim)[0]!.position.x;
  sim.step([WALK_RIGHT]);
  stepUntil(sim, () => getStickMan(sim).feet.x >= enemyX - JUMP_FROM);
  sim.step([JUMP]);
  let wasStruck = false;
  for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
    sim.step();
    wasStruck ||= getStickMan(sim).action === 'struck';
  }
  return wasStruck;
}
