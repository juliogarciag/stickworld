import { createSim, stickManOf, type SimHandle } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { commandsFromKeys, walkDirectionHeld, type KeysNow } from './playerCommands';

describe('keys to commands', () => {
  it('reads left and right as a direction, and both or neither as none', () => {
    expect(walkDirectionHeld(NOTHING)).toBe(0);
    expect(walkDirectionHeld(RIGHT)).toBe(1);
    expect(walkDirectionHeld(LEFT)).toBe(-1);
    expect(walkDirectionHeld({ ...NOTHING, leftHeld: true, rightHeld: true })).toBe(0);
  });

  it('says nothing while the keys and the sim agree', () => {
    expect(commandsFromKeys()({ keys: NOTHING, sim: createSim({ level: 1 }) })).toEqual([]);
  });

  it('asks to walk once when a key goes down, however many frames pass before the sim ticks', () => {
    const sim = createSim({ level: 1 });
    const commandsFor = commandsFromKeys();
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([{ type: 'player/walk', direction: 1 }]);
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([]);
    sim.step([{ type: 'player/walk', direction: 1 }]);
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([{ type: 'player/walk', direction: 0 }]);
  });

  it('asks again when the key is still held and the sim has forgotten: the level started again', () => {
    const commandsFor = commandsFromKeys();
    const sim = createSim({ level: 1 });
    sim.step(commandsFor({ keys: LEFT, sim }));
    walkOffThePaper(sim);
    expect(stickManOf(sim).walkDirectionAsked).toBe(0);
    expect(commandsFor({ keys: LEFT, sim })).toEqual([{ type: 'player/walk', direction: -1 }]);
  });

  it('asks again on a new sim, even on the same tick number', () => {
    const commandsFor = commandsFromKeys();
    expect(commandsFor({ keys: RIGHT, sim: createSim({ level: 1 }) })).toHaveLength(1);
    expect(commandsFor({ keys: RIGHT, sim: createSim({ level: 1 }) })).toHaveLength(1);
  });

  it('asks for a jump on the frame the key went down', () => {
    const sim = createSim({ level: 1 });
    expect(commandsFromKeys()({ keys: { ...NOTHING, jumpPressed: true }, sim })).toEqual([{ type: 'player/jump' }]);
    expect(commandsFromKeys()({ keys: { ...RIGHT, jumpPressed: true }, sim })).toEqual([{ type: 'player/walk', direction: 1 }, { type: 'player/jump' }]);
  });
});

// ---- Helpers ----

const NOTHING: KeysNow = { leftHeld: false, rightHeld: false, jumpPressed: false };
const RIGHT: KeysNow = { ...NOTHING, rightHeld: true };
const LEFT: KeysNow = { ...NOTHING, leftHeld: true };

/** Steps until he has fallen off the start of the floor and the level has started again. */
function walkOffThePaper(sim: SimHandle): void {
  let fell = false;
  for (let tick = 0; tick < 1200; tick += 1) {
    sim.step();
    if (stickManOf(sim).action === 'jumping') fell = true;
    else if (fell) return;
  }
  throw new Error('he never fell off the paper');
}
