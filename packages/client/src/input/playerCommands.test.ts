import { getAirplane, createSim, getLetter, getLevelById, getSteeringAsked, getStickMan, type SimHandle } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { createKeysToCommands, getSteerDirectionHeld, getWalkDirectionHeld, type HeldKeys } from './playerCommands';

describe('keys to commands', () => {
  it('reads left and right as a direction, and both or neither as none', () => {
    expect(getWalkDirectionHeld(NOTHING)).toBe(0);
    expect(getWalkDirectionHeld(RIGHT)).toBe(1);
    expect(getWalkDirectionHeld(LEFT)).toBe(-1);
    expect(getWalkDirectionHeld({ ...NOTHING, isLeftHeld: true, isRightHeld: true })).toBe(0);
  });

  it('says nothing while the keys and the sim agree', () => {
    expect(createKeysToCommands()({ keys: NOTHING, sim: createSim({ level: 1 }) })).toEqual([]);
  });

  it('asks to walk once when a key goes down, however many frames pass before the sim ticks', () => {
    const sim = createSim({ level: 1 });
    const commandsFor = createKeysToCommands();
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([{ type: 'player/walk', direction: 1 }]);
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([]);
    sim.step([{ type: 'player/walk', direction: 1 }]);
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([{ type: 'player/walk', direction: 0 }]);
  });

  it('takes back a walk that is still waiting when the key is let go before the sim ticks', () => {
    const sim = createSim({ level: 1 });
    sim.step([{ type: 'player/walk', direction: 1 }]);
    const commandsFor = createKeysToCommands();
    const waiting = [...commandsFor({ keys: NOTHING, sim }), ...commandsFor({ keys: RIGHT, sim })];
    expect(waiting).toEqual([
      { type: 'player/walk', direction: 0 },
      { type: 'player/walk', direction: 1 },
    ]);
    sim.step(waiting);
    expect(getStickMan(sim)).toMatchObject({ walkDirectionAsked: 1, action: 'walking' });
    expect(commandsFor({ keys: RIGHT, sim })).toEqual([]);
  });

  it('asks again when the key is still held and the sim has forgotten: the level started again', () => {
    const commandsFor = createKeysToCommands();
    const sim = createSim({ level: 1 });
    sim.step(commandsFor({ keys: LEFT, sim }));
    walkOffPaper(sim);
    expect(getStickMan(sim).walkDirectionAsked).toBe(0);
    expect(commandsFor({ keys: LEFT, sim })).toEqual([{ type: 'player/walk', direction: -1 }]);
  });

  it('asks again on a new sim, even on the same tick number', () => {
    const commandsFor = createKeysToCommands();
    expect(commandsFor({ keys: RIGHT, sim: createSim({ level: 1 }) })).toHaveLength(1);
    expect(commandsFor({ keys: RIGHT, sim: createSim({ level: 1 }) })).toHaveLength(1);
  });

  it('asks for a jump on the frame the key went down', () => {
    const sim = createSim({ level: 1 });
    expect(createKeysToCommands()({ keys: JUMP_DOWN, sim })).toEqual([{ type: 'player/jump' }]);
    expect(createKeysToCommands()({ keys: { ...RIGHT, isJumpHeld: true, isJumpPressed: true }, sim })).toEqual([{ type: 'player/walk', direction: 1 }, { type: 'player/jump' }]);
  });

  it('says the jump was let go of once, when the last key that was jumping goes up', () => {
    const sim = createSim({ level: 1 });
    const commandsFor = createKeysToCommands();
    expect(commandsFor({ keys: JUMP_DOWN, sim })).toEqual([{ type: 'player/jump' }]);
    expect(commandsFor({ keys: { ...NOTHING, isJumpHeld: true }, sim })).toEqual([]);
    expect(commandsFor({ keys: { ...UP, isJumpHeld: true }, sim })).toEqual([]);
    expect(commandsFor({ keys: UP, sim })).toEqual([]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([{ type: 'player/letGoOfJump' }]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([]);
  });

  it('asks for a jump and lets go of it on the same frame for a tap that was down and up between two frames', () => {
    const sim = createSim({ level: 1 });
    expect(createKeysToCommands()({ keys: { ...NOTHING, isJumpPressed: true }, sim })).toEqual([{ type: 'player/jump' }, { type: 'player/letGoOfJump' }]);
  });

  it("takes an up key for a jump too while the stick man is on the stick man's feet, and never steers then", () => {
    const sim = createSim({ level: 1 });
    expect(createKeysToCommands()({ keys: { ...UP, isUpPressed: true }, sim })).toEqual([{ type: 'player/jump' }]);
    expect(createKeysToCommands()({ keys: UP, sim })).toEqual([]);
    expect(createKeysToCommands()({ keys: DOWN, sim })).toEqual([]);
  });

  it('lets go of a jump made with an up key when that key goes up, and of a tap of it on the same frame', () => {
    const sim = createSim({ level: 1 });
    const commandsFor = createKeysToCommands();
    expect(commandsFor({ keys: { ...UP, isUpPressed: true }, sim })).toEqual([{ type: 'player/jump' }]);
    expect(commandsFor({ keys: UP, sim })).toEqual([]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([{ type: 'player/letGoOfJump' }]);
    expect(createKeysToCommands()({ keys: { ...NOTHING, isUpPressed: true }, sim })).toEqual([{ type: 'player/jump' }, { type: 'player/letGoOfJump' }]);
  });

  it('lets go of a held jump when every key reads up at once, as when the window loses focus and Phaser forgets held keys', () => {
    const sim = createSim({ level: 1 });
    const commandsFor = createKeysToCommands();
    commandsFor({ keys: { ...RIGHT, isUpPressed: true, isUpHeld: true, isJumpHeld: true, isJumpPressed: true }, sim });
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([{ type: 'player/walk', direction: 0 }, { type: 'player/letGoOfJump' }]);
  });
});

describe('keys to commands, seated in the airplane', () => {
  it('reads up and down as a direction to steer, and both or neither as none', () => {
    expect(getSteerDirectionHeld(NOTHING)).toBe(0);
    expect(getSteerDirectionHeld(UP)).toBe(1);
    expect(getSteerDirectionHeld(DOWN)).toBe(-1);
    expect(getSteerDirectionHeld({ ...NOTHING, isUpHeld: true, isDownHeld: true })).toBe(0);
  });

  it('steers with the up and down keys, once for each change, and an up key is no jump', () => {
    const sim = createSimSeatedInAirplane();
    const commandsFor = createKeysToCommands();
    expect(commandsFor({ keys: { ...UP, isUpPressed: true }, sim })).toEqual([{ type: 'airplane/steer', direction: 1 }]);
    expect(commandsFor({ keys: UP, sim })).toEqual([]);
    sim.step([{ type: 'airplane/steer', direction: 1 }]);
    expect(commandsFor({ keys: UP, sim })).toEqual([]);
    expect(commandsFor({ keys: DOWN, sim })).toEqual([{ type: 'airplane/steer', direction: -1 }]);
    sim.step([{ type: 'airplane/steer', direction: -1 }]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([{ type: 'airplane/steer', direction: 0 }]);
    expect(getStickMan(sim).action).toBe('seated');
  });

  it('takes both steer keys held at once for neither, and the jump key with an up key held for one jump', () => {
    const sim = createSimSeatedInAirplane();
    const commandsFor = createKeysToCommands();
    sim.step(commandsFor({ keys: UP, sim }));
    expect(commandsFor({ keys: { ...UP, isDownHeld: true }, sim })).toEqual([{ type: 'airplane/steer', direction: 0 }]);
    expect(createKeysToCommands()({ keys: { ...UP, isUpPressed: true, isJumpHeld: true, isJumpPressed: true }, sim })).toEqual([{ type: 'player/jump' }]);
  });

  it('jumps the stick man out with the jump key, and stops steering once the stick man is out with the key still held', () => {
    const sim = createSimSeatedInAirplane();
    const commandsFor = createKeysToCommands();
    sim.step(commandsFor({ keys: UP, sim }));
    expect(getSteeringAsked(sim)).toBe(1);
    const jumpingOut = commandsFor({ keys: { ...UP, isJumpHeld: true, isJumpPressed: true }, sim });
    expect(jumpingOut).toEqual([{ type: 'player/jump' }]);
    sim.step(jumpingOut);
    expect(getStickMan(sim).action).toBe('jumping');
    expect(commandsFor({ keys: UP, sim })).toEqual([{ type: 'airplane/steer', direction: 0 }, { type: 'player/letGoOfJump' }]);
  });

  it('does not take an up key held for steering as a jump held once the stick man jumped out with the jump key', () => {
    const sim = createSimSeatedInAirplane();
    const commandsFor = createKeysToCommands();
    sim.step(commandsFor({ keys: UP, sim }));
    const jumpingOut = commandsFor({ keys: { ...UP, isJumpPressed: true }, sim });
    expect(jumpingOut).toEqual([{ type: 'player/jump' }, { type: 'player/letGoOfJump' }]);
    sim.step(jumpingOut);
    expect(getStickMan(sim).action).toBe('jumping');
    // Up still held, now on the stick man's feet: no jump is held, so nothing more is let go of; let go and pressed again, it is a jump.
    expect(commandsFor({ keys: UP, sim })).toEqual([{ type: 'airplane/steer', direction: 0 }]);
    expect(commandsFor({ keys: NOTHING, sim })).toEqual([]);
    expect(commandsFor({ keys: { ...UP, isUpPressed: true }, sim })).toEqual([{ type: 'player/jump' }]);
  });
});

// ---- Helpers ----

const NOTHING: HeldKeys = { isLeftHeld: false, isRightHeld: false, isUpHeld: false, isDownHeld: false, isJumpHeld: false, isJumpPressed: false, isUpPressed: false };
const UP: HeldKeys = { ...NOTHING, isUpHeld: true };
const JUMP_DOWN: HeldKeys = { ...NOTHING, isJumpHeld: true, isJumpPressed: true };
const DOWN: HeldKeys = { ...NOTHING, isDownHeld: true };
const RIGHT: HeldKeys = { ...NOTHING, isRightHeld: true };
const LEFT: HeldKeys = { ...NOTHING, isLeftHeld: true };

/** On level 3 with the airplane the letter teaches, boarded on the edge: the sim is one tick into the flight. */
function createSimSeatedInAirplane(): SimHandle {
  const sim = createSim({ level: 3 });
  const interact = { type: 'world/interact' } as const;
  const useItem = { type: 'item/use' } as const;
  const walkTo = (x: number): void => {
    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 3000 && getStickMan(sim).feet.x < x; tick += 1) sim.step();
    sim.step([{ type: 'player/walk', direction: 0 }]);
  };
  walkTo(getLetter(sim)!.position.x);
  // Read the letter, put it away, select the paper, open the recipes, fold, set down, lift.
  for (const command of [interact, interact, useItem, useItem, interact]) sim.step([command]);
  // Carried to where putting it down leaves it on the edge with its nose out, then put down and boarded.
  const edge = getLevelById(3).floor[0]!.end.x;
  for (let x = edge - 2; getAirplane(sim)?.isOnEdge !== true && x < edge; x += 0.1) {
    walkTo(x);
    sim.step([interact]);
    if (getAirplane(sim)?.isOnEdge !== true) sim.step([interact]);
  }
  sim.step([interact]);
  expect(getStickMan(sim).action).toBe('seated');
  return sim;
}

/** Steps until the stick man has fallen off the start of the floor and the level has started again. */
function walkOffPaper(sim: SimHandle): void {
  let hasFallen = false;
  for (let tick = 0; tick < 1200; tick += 1) {
    sim.step();
    if (getStickMan(sim).action === 'jumping') hasFallen = true;
    else if (hasFallen) return;
  }
  throw new Error('the stick man never fell off the paper');
}
