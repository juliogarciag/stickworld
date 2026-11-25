import { airplaneOf, createSim, letterOf, levelById, steeringAskedOf, stickManOf, type SimHandle } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { keysToCommands, steerDirectionHeld, walkDirectionHeld, type KeysNow } from './playerCommands';

describe('keys to commands', () => {
  it('reads left and right as a direction, and both or neither as none', () => {
    expect(walkDirectionHeld(NOTHING)).toBe(0);
    expect(walkDirectionHeld(RIGHT)).toBe(1);
    expect(walkDirectionHeld(LEFT)).toBe(-1);
    expect(walkDirectionHeld({ ...NOTHING, leftHeld: true, rightHeld: true })).toBe(0);
  });

  it('says nothing while the keys and the sim agree', () => {
    expect(keysToCommands()({ keys: NOTHING, sim: createSim({ level: 1 }) })).toEqual([]);
  });

  it('asks to walk once when a key goes down, however many frames pass before the sim ticks', () => {
    const sim = createSim({ level: 1 });
    const commandsFor = keysToCommands();
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([{ type: 'player/walk', direction: 1 }]);
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([]);
    sim.step([{ type: 'player/walk', direction: 1 }]);
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([{ type: 'player/walk', direction: 0 }]);
  });

  it('takes back a walk that is still waiting when the key is let go before the sim ticks', () => {
    const sim = createSim({ level: 1 });
    sim.step([{ type: 'player/walk', direction: 1 }]);
    const commandsFor = keysToCommands();
    const waiting = [...commandsFor({ keys: NOTHING, sim }), ...commandsFor({ keys: RIGHT, sim })];
    expect(waiting).toEqual([
      { type: 'player/walk', direction: 0 },
      { type: 'player/walk', direction: 1 },
    ]);
    sim.step(waiting);
    expect(stickManOf(sim)).toMatchObject({ walkDirectionAsked: 1, action: 'walking' });
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([]);
  });

  it('asks again when the key is still held and the sim has forgotten: the level started again', () => {
    const commandsFor = keysToCommands();
    const sim = createSim({ level: 1 });
    sim.step(commandsFor({ keys: LEFT, sim }));
    walkOffThePaper(sim);
    expect(stickManOf(sim).walkDirectionAsked).toBe(0);
    expect(commandsFor({ keys: LEFT, sim })).toEqual([{ type: 'player/walk', direction: -1 }]);
  });

  it('asks again on a new sim, even on the same tick number', () => {
    const commandsFor = keysToCommands();
    expect(commandsFor({ keys: RIGHT, sim: createSim({ level: 1 }) })).toHaveLength(1);
    expect(commandsFor({ keys: RIGHT, sim: createSim({ level: 1 }) })).toHaveLength(1);
  });

  it('asks for a jump on the frame the key went down', () => {
    const sim = createSim({ level: 1 });
    expect(keysToCommands()({ keys: JUMP_DOWN, sim })).toEqual([{ type: 'player/jump' }]);
    expect(keysToCommands()({ keys: { ...RIGHT, jumpHeld: true, jumpPressed: true }, sim })).toEqual([{ type: 'player/walk', direction: 1 }, { type: 'player/jump' }]);
  });

  it('says the jump was let go of once, when the last key that was jumping goes up', () => {
    const sim = createSim({ level: 1 });
    const commandsFor = keysToCommands();
    expect(commandsFor({ keys: JUMP_DOWN, sim })).toEqual([{ type: 'player/jump' }]);
    expect(commandsFor({ keys: { ...NOTHING, jumpHeld: true }, sim })).toEqual([]);
    expect(commandsFor({ keys: { ...UP, jumpHeld: true }, sim })).toEqual([]);
    expect(commandsFor({ keys: UP, sim })).toEqual([]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([{ type: 'player/letGoOfJump' }]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([]);
  });

  it('asks for a jump and lets go of it on the same frame for a tap that was down and up between two frames', () => {
    const sim = createSim({ level: 1 });
    expect(keysToCommands()({ keys: { ...NOTHING, jumpPressed: true }, sim })).toEqual([{ type: 'player/jump' }, { type: 'player/letGoOfJump' }]);
  });

  it('takes an up key for a jump too while he is on his feet, and never steers then', () => {
    const sim = createSim({ level: 1 });
    expect(keysToCommands()({ keys: { ...UP, upPressed: true }, sim })).toEqual([{ type: 'player/jump' }]);
    expect(keysToCommands()({ keys: UP, sim })).toEqual([]);
    expect(keysToCommands()({ keys: DOWN, sim })).toEqual([]);
  });
});

describe('keys to commands, seated in the airplane', () => {
  it('reads up and down as a direction to steer, and both or neither as none', () => {
    expect(steerDirectionHeld(NOTHING)).toBe(0);
    expect(steerDirectionHeld(UP)).toBe(1);
    expect(steerDirectionHeld(DOWN)).toBe(-1);
    expect(steerDirectionHeld({ ...NOTHING, upHeld: true, downHeld: true })).toBe(0);
  });

  it('steers with the up and down keys, once for each change, and an up key is no jump', () => {
    const sim = seatedInTheAirplane();
    const commandsFor = keysToCommands();
    expect(commandsFor({ keys: { ...UP, upPressed: true }, sim })).toEqual([{ type: 'airplane/steer', direction: 1 }]);
    expect(commandsFor({ keys: UP, sim })).toEqual([]);
    sim.step([{ type: 'airplane/steer', direction: 1 }]);
    expect(commandsFor({ keys: UP, sim })).toEqual([]);
    expect(commandsFor({ keys: DOWN, sim })).toEqual([{ type: 'airplane/steer', direction: -1 }]);
    sim.step([{ type: 'airplane/steer', direction: -1 }]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([{ type: 'airplane/steer', direction: 0 }]);
    expect(stickManOf(sim).action).toBe('seated');
  });

  it('takes both steer keys held at once for neither, and the jump key with an up key held for one jump', () => {
    const sim = seatedInTheAirplane();
    const commandsFor = keysToCommands();
    sim.step(commandsFor({ keys: UP, sim }));
    expect(commandsFor({ keys: { ...UP, downHeld: true }, sim })).toEqual([{ type: 'airplane/steer', direction: 0 }]);
    expect(keysToCommands()({ keys: { ...UP, upPressed: true, jumpHeld: true, jumpPressed: true }, sim })).toEqual([{ type: 'player/jump' }]);
  });

  it('jumps him out with the jump key, and stops steering once he is out with the key still held', () => {
    const sim = seatedInTheAirplane();
    const commandsFor = keysToCommands();
    sim.step(commandsFor({ keys: UP, sim }));
    expect(steeringAskedOf(sim)).toBe(1);
    const jumpingOut = commandsFor({ keys: { ...UP, jumpHeld: true, jumpPressed: true }, sim });
    expect(jumpingOut).toEqual([{ type: 'player/jump' }]);
    sim.step(jumpingOut);
    expect(stickManOf(sim).action).toBe('jumping');
    expect(commandsFor({ keys: UP, sim })).toEqual([{ type: 'airplane/steer', direction: 0 }, { type: 'player/letGoOfJump' }]);
  });

  it('does not take an up key held for steering as a jump held once he jumped out with the jump key', () => {
    const sim = seatedInTheAirplane();
    const commandsFor = keysToCommands();
    sim.step(commandsFor({ keys: UP, sim }));
    const jumpingOut = commandsFor({ keys: { ...UP, jumpPressed: true }, sim });
    expect(jumpingOut).toEqual([{ type: 'player/jump' }, { type: 'player/letGoOfJump' }]);
    sim.step(jumpingOut);
    expect(stickManOf(sim).action).toBe('jumping');
    // Up still held, now on his feet: no jump is held, so nothing more is let go of; let go and pressed again, it is a jump.
    expect(commandsFor({ keys: UP, sim })).toEqual([{ type: 'airplane/steer', direction: 0 }]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([]);
    expect(commandsFor({ keys: { ...UP, upPressed: true }, sim })).toEqual([{ type: 'player/jump' }]);
  });
});

// ---- Helpers ----

const NOTHING: KeysNow = { leftHeld: false, rightHeld: false, upHeld: false, downHeld: false, jumpHeld: false, jumpPressed: false, upPressed: false };
const UP: KeysNow = { ...NOTHING, upHeld: true };
const JUMP_DOWN: KeysNow = { ...NOTHING, jumpHeld: true, jumpPressed: true };
const DOWN: KeysNow = { ...NOTHING, downHeld: true };
const RIGHT: KeysNow = { ...NOTHING, rightHeld: true };
const LEFT: KeysNow = { ...NOTHING, leftHeld: true };

/** On level 3 with the airplane the letter teaches, boarded on the edge: the sim is one tick into the flight. */
function seatedInTheAirplane(): SimHandle {
  const sim = createSim({ level: 3 });
  const interact = { type: 'world/interact' } as const;
  const useItem = { type: 'item/use' } as const;
  const walkTo = (x: number): void => {
    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 3000 && stickManOf(sim).feet.x < x; tick += 1) sim.step();
    sim.step([{ type: 'player/walk', direction: 0 }]);
  };
  walkTo(letterOf(sim)!.at.x);
  // Read the letter, put it away, select the paper, open the recipes, fold, set down, lift.
  for (const command of [interact, interact, useItem, useItem, interact]) sim.step([command]);
  // Carried to where putting it down leaves it on the edge with its nose out, then put down and boarded.
  const edge = levelById(3).floor[0]!.to.x;
  for (let x = edge - 2; airplaneOf(sim)?.onAnEdge !== true && x < edge; x += 0.1) {
    walkTo(x);
    sim.step([interact]);
    if (airplaneOf(sim)?.onAnEdge !== true) sim.step([interact]);
  }
  sim.step([interact]);
  expect(stickManOf(sim).action).toBe('seated');
  return sim;
}

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
