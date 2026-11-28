import { describe, expect, it } from 'vitest';
import { clubYard } from '../../content/levels/clubYard';
import { STICK_MAN_WIDTH } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { createSim, restoreSim } from '../../core/create';
import { Sim, type SimHandle } from '../../core/sim';
import { features } from '..';
import { hashSnapshot } from '../../core/snapshot';
import { SPEAR_RECIPE_ID } from '../crafting/defs';
import { getCrafting } from '../crafting/view';
import { clubEnemyDef } from '../enemy/clubEnemy/defs';
import { ENEMY } from '../enemy/defs';
import { getEnemies } from '../enemy/view';
import { getFlag } from '../flag/view';
import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID, SPEAR_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { getItemSlots } from '../inventory/view';
import { getItemUse } from '../item/view';
import { findLetterPlacedIn } from '../letter';
import { getLetter } from '../letter/view';
import { PLAYER } from '../player/defs';
import { getStickMan } from '../player/view';
import { SPEAR } from './defs';
import { getSpear } from './view';

describe('the paper and the spear', () => {
  it('is a sheet of paper first: reading the letter puts it in the hand of the stick man, who can roll it and has nothing to thrust', () => {
    const sim = createSim({ level: clubYard.id });
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: null, isSelected: false }]);
    readLetter(sim);
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, isSelected: true }]);
    expect(getCrafting(sim).canMake).toEqual({ defId: SPEAR_RECIPE_ID, name: 'spear' });
    // While the stick man reads, its hands are full.
    expect(getItemUse(sim)).toBeNull();
    sim.step([INTERACT]);
    expect(getItemUse(sim)).toBe('craft');
    expect(getSpear(sim)).toBeUndefined();
  });

  it('is made of the paper with one press, in the same slot, and the next press is a thrust', () => {
    const sim = createSim({ level: clubYard.id });
    readLetter(sim);
    sim.step([INTERACT]);
    sim.step([USE]);
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: SPEAR_ITEM_ID, isSelected: true }]);
    expect(getCrafting(sim).canMake).toBeNull();
    expect(getItemUse(sim)).toBe('thrust');
    expect(getSpear(sim)).toMatchObject({ action: 'ready', progress: 0, direction: 1 });
  });
});

describe('a thrust', () => {
  it('sends the point straight out in front of the stick man, from drawn back to its full reach, for as long as the def says', () => {
    const sim = createSimWithSpear();
    const feet = getStickMan(sim).feet;
    sim.step([USE]);
    const thrusting = recordAsLongAs(sim, () => getSpear(sim)!.action === 'thrusting');
    expect(thrusting.length).toBe(THRUST_TICKS - 1);
    expect(thrusting[0]!.tip.x).toBeGreaterThan(feet.x + SPEAR.reachDrawnBack);
    const tips = [...thrusting.map((spear) => spear.tip.x), getSpear(sim)!.tip.x];
    expect(tips).toEqual([...tips].sort((one, other) => one - other));
    expect(getSpear(sim)).toMatchObject({ action: 'recovering', progress: 0 });
    expect(getSpear(sim)!.tip).toEqual({
      x: feet.x + SPEAR.reach,
      y: feet.y - SPEAR.thrustHeight,
    });
    expect(getSpear(sim)!.tip.x - getSpear(sim)!.butt.x).toBeCloseTo(SPEAR.length);
  });

  it('goes the way the stick man faces, and keeps that way when the stick man turns', () => {
    const sim = createSimWithSpear();
    const startX = getStickMan(sim).feet.x;
    sim.step([WALK_LEFT]);
    sim.step([STOP]);
    sim.step([USE]);
    sim.step([WALK_RIGHT]);
    stepFor(sim, THRUST_TICKS - 1);
    expect(getStickMan(sim).facing).toBe(1);
    expect(getSpear(sim)).toMatchObject({ action: 'recovering', direction: -1 });
    expect(getSpear(sim)!.tip.x).toBeLessThan(startX - SPEAR.reach + 1);
  });

  it('cannot be made again while the spear is drawn back: a press does nothing, and no key is offered', () => {
    const sim = createSimWithSpear();
    sim.step([USE]);
    expect(getItemUse(sim)).toBeNull();
    stepFor(sim, THRUST_TICKS);
    expect(getSpear(sim)!.action).toBe('recovering');
    const before = getSpear(sim)!.progress;
    sim.step([USE]);
    expect(getSpear(sim)!.action).toBe('recovering');
    expect(getSpear(sim)!.progress).toBeGreaterThan(before);
    expect(getItemUse(sim)).toBeNull();
    stepUntil(sim, () => getSpear(sim)!.action === 'ready');
    expect(sim.tick - TICK_OF_FIRST_PRESS).toBe(THRUST_TICKS + RECOVER_TICKS);
    expect(getItemUse(sim)).toBe('thrust');
    sim.step([USE]);
    expect(getSpear(sim)!.action).toBe('thrusting');
  });

  it('is not had sooner by putting the spear out of its hand and taking it up again: the drawing back runs on, and the point strikes nothing meanwhile', () => {
    const sim = createSimWithSpear();
    sim.step([USE]);
    sim.step([SELECT_FIRST]);
    expect(getSpear(sim)).toBeUndefined();
    expect(getItemUse(sim)).toBeNull();
    sim.step([SELECT_FIRST, USE]);
    expect(getSpear(sim)!.action).toBe('thrusting');
    stepUntil(sim, () => getSpear(sim)!.action === 'recovering');
    sim.step([SELECT_FIRST]);
    sim.step([SELECT_FIRST, USE]);
    expect(getSpear(sim)!.action).toBe('recovering');
    stepUntil(sim, () => getSpear(sim)!.action === 'ready');
    expect(sim.tick - TICK_OF_FIRST_PRESS).toBe(THRUST_TICKS + RECOVER_TICKS);
  });

  it('strikes nothing while the spear is out of its hand', () => {
    const sim = createSimWithSpear();
    standInFrontOfEnemy(sim, SPEAR_HITS_FROM - 0.1);
    sim.step([USE, SELECT_FIRST]);
    stepFor(sim, THRUST_TICKS + RECOVER_TICKS);
    expect(getEnemies(sim)[0]!.torn).toBeNull();
  });

  it('goes to the left as well as to the right: the enemy behind which the stick man has got is torn by a thrust back at it', () => {
    const sim = createSimWithSpear();
    standInFrontOfEnemy(sim, SPEAR_HITS_FROM - 0.1);
    sim.step([USE]);
    stepUntil(sim, () => getEnemies(sim).length === 0);
    stepUntil(sim, () => getSpear(sim)!.action === 'ready');
    sim.step([WALK_LEFT]);
    sim.step([STOP, USE]);
    stepFor(sim, THRUST_TICKS - 1);
    expect(getSpear(sim)!.tip.x).toBeCloseTo(getStickMan(sim).feet.x - SPEAR.reach);
  });

  it('is not made with both hands on an airplane over its head: no J is offered until the airplane is put down', () => {
    const sim = new Sim({ features, start: { seed: 1, level: clubYard.id } });
    giveItem(sim, AIRPLANE_ITEM_ID);
    sim.step([SELECT_FIRST]);
    sim.step([USE]);
    // The slot the airplane left is still the selected one.
    giveItem(sim, SPEAR_ITEM_ID);
    expect(getItemUse(sim)).toBe('thrust');
    sim.step([INTERACT]);
    expect(getStickMan(sim).isCarrying).toBe(true);
    expect(getItemUse(sim)).toBeNull();
    sim.step([USE]);
    expect(getSpear(sim)!.action).toBe('ready');
    sim.step([INTERACT]);
    expect(getItemUse(sim)).toBe('thrust');
  });

  it('costs a miss more than a moment: the stick man is without a thrust for longer than the enemy takes to cover the ground the spear outreaches its club by', () => {
    const secondsToCloseIn = SPEAR_OUTREACHES_CLUB_BY / clubEnemyDef.speed;
    expect(SPEAR.thrustSeconds + SPEAR.recoverSeconds).toBeGreaterThan(secondsToCloseIn);
  });

  it('never loses the spear: after any number of thrusts it is still in the hand of the stick man', () => {
    const sim = createSimWithSpear();
    for (let thrust = 0; thrust < 5; thrust += 1) {
      sim.step([USE]);
      stepUntil(sim, () => getSpear(sim)!.action === 'ready');
    }
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: SPEAR_ITEM_ID, isSelected: true }]);
  });

  it('continues from a snapshot taken in the middle of it exactly as the sim it was taken from', () => {
    const sim = createSimWithSpear();
    sim.step([USE]);
    stepFor(sim, 2);
    const restored = restoreSim(sim.takeSnapshot());
    stepFor(sim, THRUST_TICKS + RECOVER_TICKS);
    stepFor(restored, THRUST_TICKS + RECOVER_TICKS);
    expect(hashSnapshot(restored.takeSnapshot())).toBe(hashSnapshot(sim.takeSnapshot()));
  });
});

describe('a thrust at the club enemy', () => {
  it('tears the enemy in two when it reaches it: the enemy stops, tears, lies and leaves for as long as its def says, and is gone', () => {
    const sim = createSimWithSpear();
    const distance = standInFrontOfEnemy(sim, SPEAR_HITS_FROM - 0.1);
    expect(distance).toBeGreaterThan(CLUB_HITS_FROM);
    sim.step([USE]);
    stepUntil(sim, () => getEnemies(sim)[0]!.torn !== null);
    expect(getSpear(sim)!.action).not.toBe('ready');
    const struckPosition = getEnemies(sim)[0]!.position;
    const torn = recordEnemyAsLongAs(sim, () => getEnemies(sim).length > 0);
    expect(torn.length).toBe(TORN_TICKS - 1);
    expect(torn.every((enemy) => enemy.position.x === struckPosition.x)).toBe(true);
    const actions = torn.map((enemy) => enemy.torn!.action);
    expect([...new Set(actions)]).toEqual(['tearing', 'lying', 'leaving']);
    expect(torn.at(-1)!.torn!.progress).toBeLessThan(1);
    expect(getEnemies(sim)).toEqual([]);
    expect(getStickMan(sim).action).toBe('standing');
  });

  it('does nothing to the enemy it does not reach', () => {
    const sim = createSimWithSpear();
    const distance = standInFrontOfEnemy(sim, SPEAR_HITS_FROM + 0.12);
    expect(distance).toBeGreaterThan(SPEAR_HITS_FROM);
    sim.step([USE]);
    stepUntil(sim, () => getSpear(sim)!.action === 'ready');
    expect(getEnemies(sim)[0]!.torn).toBeNull();
  });

  it('reaches further than the club by a margin: from where the club cannot reach the stick man, the spear still reaches the enemy', () => {
    expect(SPEAR_HITS_FROM - CLUB_HITS_FROM).toBeGreaterThanOrEqual(SPEAR_OUTREACHES_CLUB_BY);
    // The club is as long as it is taken to be here: no swing puts its end further out.
    const sim = createSim({ level: clubYard.id });
    sim.step([WALK_RIGHT]);
    stepUntil(sim, () => getEnemies(sim)[0]!.action === 'windingUp');
    sim.step([WALK_LEFT]);
    const swing = recordEnemyAsLongAs(sim, () => getEnemies(sim)[0]!.action !== 'recovering');
    const farthestClubEnd = Math.max(
      ...swing.map((enemy) => enemy.position.x - enemy.club.tip.x + enemy.club.thickness / 2),
    );
    expect(farthestClubEnd).toBeLessThanOrEqual(CLUB_HITS_FROM - STICK_MAN_WIDTH / 2);
    expect(farthestClubEnd).toBeGreaterThan(CLUB_HITS_FROM - STICK_MAN_WIDTH / 2 - 0.05);
  });

  it('hits the enemy without being hit, from just outside the reach of its club: the enemy at the end of its stretch never swings', () => {
    const sim = createSimWithSpear();
    const distance = standInFrontOfEnemy(sim, CLUB_HITS_FROM + 0.1);
    expect(distance).toBeGreaterThan(CLUB_HITS_FROM);
    expect(distance).toBeLessThan(SPEAR_HITS_FROM);
    // The enemy has all the time it wants, and does not strike from there.
    const waitUntilTick = sim.tick + 5 * TICKS;
    const waited = recordEnemyAsLongAs(sim, () => sim.tick < waitUntilTick);
    expect(waited.every((enemy) => enemy.action === 'waiting')).toBe(true);
    sim.step([USE]);
    stepUntil(sim, () => getEnemies(sim).length === 0);
    expect(getStickMan(sim).action).toBe('standing');
  });

  it('stops a swing that has begun: struck with its club going back, the enemy never brings it down', () => {
    const sim = createSimWithSpear();
    sim.step([WALK_RIGHT]);
    stepUntil(sim, () => getEnemies(sim)[0]!.action === 'windingUp');
    sim.step([STOP]);
    sim.step([USE]);
    stepUntil(sim, () => getEnemies(sim).length === 0);
    stepFor(sim, 3 * TICKS);
    expect(getStickMan(sim).action).toBe('standing');
  });

  it('wins a tie: a thrust that reaches the enemy on the tick its club would have reached the stick man tears it, and the stick man stands', () => {
    const sim = createSimWithSpear();
    sim.step([WALK_RIGHT]);
    // As far as the last tick before the club reaches the stick man that does nothing about it.
    stepUntil(sim, () => {
      const withoutThrust = restoreSim(sim.takeSnapshot());
      withoutThrust.step();
      return getStickMan(withoutThrust).action === 'struck';
    });
    expect(getStickMan(sim).action).not.toBe('struck');
    expect(getEnemies(sim)[0]!.action).toBe('swinging');
    // The press and the club arrive on the same tick.
    sim.step([USE]);
    expect(getStickMan(sim).action).not.toBe('struck');
    expect(getEnemies(sim)[0]!.torn).not.toBeNull();
    stepFor(sim, 3 * TICKS);
    expect(getStickMan(sim).action).not.toBe('struck');
  });

  it("lets the stick man through where the enemy stood, at once: a torn enemy is in nobody's way", () => {
    const sim = createSimWithSpear();
    standInFrontOfEnemy(sim, SPEAR_HITS_FROM - 0.1);
    const enemyX = getEnemies(sim)[0]!.position.x;
    sim.step([USE, WALK_RIGHT]);
    stepUntil(sim, () => getStickMan(sim).feet.x > enemyX + clubEnemyDef.width);
    expect(getStickMan(sim).action).toBe('walking');
    stepUntil(sim, () => getFlag(sim)!.isReached);
  });

  it('is not made by the stick man that is struck down: a press does nothing, and a thrust under way ends', () => {
    const sim = createSimWithSpear();
    sim.step([WALK_RIGHT]);
    stepUntil(sim, () => getEnemies(sim)[0]!.action === 'swinging');
    // Too late, and the wrong way: the thrust goes away from the enemy.
    sim.step([WALK_LEFT]);
    sim.step([USE]);
    stepUntil(sim, () => getStickMan(sim).action === 'struck');
    sim.step();
    expect(getSpear(sim)!.action).toBe('ready');
    expect(getItemUse(sim)).toBeNull();
    sim.step([USE]);
    expect(getSpear(sim)!.action).toBe('ready');
  });
});

describe('dying with the spear', () => {
  it('costs no chores: the level starts again with the spear in the hand of the stick man, the letter gone and the enemy back at its post', () => {
    const sim = createSimWithSpear();
    sim.step([WALK_RIGHT]);
    stepUntil(sim, () => getStickMan(sim).action === 'struck');
    stepUntil(sim, () => getStickMan(sim).action !== 'struck');
    expect(getStickMan(sim).feet).toEqual(clubYard.start);
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: SPEAR_ITEM_ID, isSelected: true }]);
    expect(getLetter(sim)).toBeUndefined();
    expect(getItemUse(sim)).toBe('thrust');
    expect(getSpear(sim)!.action).toBe('ready');
    expect(getEnemies(sim)[0]).toMatchObject({
      position: { x: clubYard.enemies![0]!.position.x },
      torn: null,
    });
  });

  it('brings the enemy back too: one torn and gone is at its post again when the level starts again', () => {
    const sim = createSimWithSpear();
    standInFrontOfEnemy(sim, SPEAR_HITS_FROM - 0.1);
    sim.step([USE]);
    stepUntil(sim, () => getEnemies(sim).length === 0);
    sim.step([WALK_LEFT]);
    stepUntil(sim, () => getStickMan(sim).feet.y > 0);
    stepUntil(sim, () => getStickMan(sim).feet.y === 0);
    expect(getEnemies(sim)).toHaveLength(1);
    expect(getItemSlots(sim)[0]).toMatchObject({ itemDefId: SPEAR_ITEM_ID, isSelected: true });
  });

  it('keeps the paper too: the stick man who dies before rolling it has it in its hand again', () => {
    const sim = createSim({ level: clubYard.id });
    readLetter(sim);
    sim.step([WALK_RIGHT]);
    stepUntil(sim, () => getStickMan(sim).action === 'struck');
    stepUntil(sim, () => getStickMan(sim).action !== 'struck');
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, isSelected: true }]);
    expect(getItemUse(sim)).toBe('craft');
  });
});

// ---- Helpers ----

const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };
const WALK_LEFT: Command = { type: 'player/walk', direction: -1 };
const STOP: Command = { type: 'player/walk', direction: 0 };
const USE: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };
const SELECT_FIRST: Command = { type: 'inventory/select', slot: 1 };

const LETTER_X = findLetterPlacedIn(clubYard)!.position.x;
const TICKS = Math.round(1 / createSim({ level: clubYard.id }).dt);
const THRUST_TICKS = Math.round(SPEAR.thrustSeconds * TICKS);
const RECOVER_TICKS = Math.round(SPEAR.recoverSeconds * TICKS);
const TORN_TICKS =
  Math.round(ENEMY.tearSeconds * TICKS) +
  Math.round(ENEMY.lieSeconds * TICKS) +
  Math.round(ENEMY.leaveSeconds * TICKS);
/** The tick on which `createSimWithSpear` hands the sim over: the stick man has the spear. */
const TICK_OF_FIRST_PRESS = createSimWithSpear().tick;

/**
 * The furthest the stick man's middle can be from the middle of the club enemy and still be
 * touched by its club: the arm and the club straight out, half the club's thickness past its end,
 * and half the stick man's width.
 */
const CLUB_HITS_FROM =
  clubEnemyDef.club.armLength +
  clubEnemyDef.club.length +
  clubEnemyDef.club.thickness / 2 +
  STICK_MAN_WIDTH / 2;
/**
 * The furthest the stick man's middle can be from the middle of the club enemy for a thrust to
 * touch it: the spear's reach, half its thickness past its point, and half the enemy's width.
 */
const SPEAR_HITS_FROM = SPEAR.reach + SPEAR.thickness / 2 + clubEnemyDef.width / 2;
/**
 * How much further away than the club reaches the spear must reach, in metres: the room the
 * player has to stand in. Tuning the spear or the club changes it on purpose, never by accident.
 */
const SPEAR_OUTREACHES_CLUB_BY = 0.5;

function stepFor(sim: SimHandle, ticks: number, commands: readonly Command[] = []): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    sim.step(tick === 0 ? commands : []);
  }
}

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

function walkTo(sim: SimHandle, x: number): void {
  const direction = x > getStickMan(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  stepUntil(sim, () => (x - getStickMan(sim).feet.x) * direction <= 0);
  sim.step([STOP]);
}

/** The stick man walks to the letter and reads it. It is still reading afterwards. */
function readLetter(sim: SimHandle): void {
  walkTo(sim, LETTER_X - 0.2);
  sim.step([INTERACT]);
  expect(getLetter(sim)!.isBeingRead).toBe(true);
}

/**
 * A sim in the yard with the stick man standing by where the letter lay, the letter read and put
 * away and the paper rolled: the spear is in its hand, and the enemy has not seen it yet.
 */
function createSimWithSpear(): SimHandle {
  const sim = createSim({ level: clubYard.id });
  walkTo(sim, LETTER_X - 0.2);
  sim.step([INTERACT]);
  sim.step([INTERACT]);
  sim.step([USE]);
  // Walking is at walk speed at once, so the stick man stands still here.
  expect(getStickMan(sim).horizontalSpeed).toBe(0);
  expect(PLAYER.walkSpeed).toBeGreaterThan(clubEnemyDef.speed);
  return sim;
}

/**
 * The stick man walks into the enemy's sight, out of the club's reach, waits for the enemy to come
 * to the near end of the stretch it guards, which is as far as it goes, and then stands in front
 * of it, facing it, no nearer than `distance`. Gives the distance between their middles then.
 */
function standInFrontOfEnemy(sim: SimHandle, distance: number): number {
  const enemy = getEnemies(sim)[0]!;
  const stretchStart = enemy.guardedStretch.start;
  // A step is the most the stick man overshoots by.
  const step = PLAYER.walkSpeed / TICKS;
  walkTo(sim, enemy.position.x - clubEnemyDef.sightDistance);
  expect(stretchStart - getStickMan(sim).feet.x).toBeGreaterThan(CLUB_HITS_FROM);
  stepUntil(sim, () => getEnemies(sim)[0]!.position.x === stretchStart);
  // It backs off and comes forward again, so that it faces the enemy.
  walkTo(sim, stretchStart - distance - 0.5);
  walkTo(sim, stretchStart - distance - step);
  stepUntil(sim, () => getEnemies(sim)[0]!.action === 'waiting');
  return getEnemies(sim)[0]!.position.x - getStickMan(sim).feet.x;
}

function recordAsLongAs(sim: SimHandle, isGoingOn: () => boolean) {
  const seen = [];
  while (isGoingOn()) {
    seen.push(getSpear(sim)!);
    sim.step();
  }
  return seen;
}

function recordEnemyAsLongAs(sim: SimHandle, isGoingOn: () => boolean) {
  const seen = [];
  while (isGoingOn()) {
    seen.push(getEnemies(sim)[0]!);
    sim.step();
  }
  return seen;
}
