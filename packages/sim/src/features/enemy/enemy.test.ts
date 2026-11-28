import { describe, expect, it } from 'vitest';
import { clubYard } from '../../content/levels/clubYard';
import { STICK_MAN_HEIGHT, STICK_MAN_WIDTH } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { createSim, restoreSim } from '../../core/create';
import type { SimHandle } from '../../core/sim';
import { hashSnapshot } from '../../core/snapshot';
import { getFlag } from '../flag/view';
import { getInteraction } from '../world/view';
import { getItemUse } from '../item/view';
import { PLAYER } from '../player/defs';
import { getStickMan } from '../player/view';
import { clubEnemyDef } from './defs';
import { getEnemies, type EnemyView } from './view';

describe('the club enemy at its post', () => {
  it('floats over the floor where the level put it, waiting, while the stick man is out of sight', () => {
    const sim = createSim({ level: clubYard.id });
    stepFor(sim, 120);
    expect(getEnemy(sim)).toMatchObject({
      defId: clubEnemyDef.id,
      position: { x: POST.x, y: -clubEnemyDef.floatHeight },
      action: 'waiting',
      progress: 0,
    });
    expect(POST.x - clubYard.start.x).toBeGreaterThan(clubEnemyDef.sightDistance);
  });

  it('is found by the id of its def, like everything a level places', () => {
    expect(clubYard.enemies).toEqual([{ defId: clubEnemyDef.id, position: POST }]);
  });
});

describe('the club enemy that sees the stick man', () => {
  it('turns to the stick man and comes towards it, slower than the stick man walks', () => {
    const sim = createSim({ level: clubYard.id });
    walkUntil(sim, () => getEnemy(sim).action === 'approaching');
    const seenFrom = getStickMan(sim).feet.x;
    expect(POST.x - seenFrom).toBeCloseTo(clubEnemyDef.sightDistance, 1);
    expect(getEnemy(sim).facing).toBe(-1);
    stepFor(sim, 30, [STOP]);
    expect(getEnemy(sim).position.x).toBeCloseTo(POST.x - (31 * clubEnemyDef.speed) / TICKS, 6);
    expect(clubEnemyDef.speed).toBeLessThan(PLAYER.walkSpeed);
  });

  it('stops where the stick man is within the distance it swings from, takes the club back and swings it, each for as long as its def says, and then lifts it again', () => {
    const sim = createSim({ level: clubYard.id });
    walkUntil(sim, () => getStickMan(sim).feet.x >= POST.x - 4);
    stepFor(sim, 1, [STOP]);
    stepUntil(sim, () => getEnemy(sim).action === 'windingUp');
    const distance = getEnemy(sim).position.x - getStickMan(sim).feet.x;
    expect(distance).toBeLessThanOrEqual(clubEnemyDef.swingDistance);
    expect(distance).toBeGreaterThan(clubEnemyDef.swingDistance - 0.05);

    const stoodAt = getEnemy(sim).position.x;
    const windUp = recordAsLongAs(sim, () => getEnemy(sim).action === 'windingUp');
    expect(windUp.length).toBe(Math.round(clubEnemyDef.windUpSeconds * TICKS));
    expect(getEnemy(sim)).toMatchObject({ action: 'swinging', progress: 0 });
    const swing = recordAsLongAs(sim, () => getEnemy(sim).action === 'swinging');
    expect(swing.length).toBe(Math.round(clubEnemyDef.swingSeconds * TICKS));
    expect(getEnemy(sim)).toMatchObject({ action: 'recovering', position: { x: stoodAt } });
    const progress = [...windUp, ...swing].map((enemy) => enemy.progress);
    expect(Math.max(...progress)).toBeLessThanOrEqual(1);
  });

  it('holds the club up in front while it waits, behind it at the end of the wind-up, and down at the floor in front at the end of the swing', () => {
    const sim = createSim({ level: clubYard.id });
    const atRest = getEnemy(sim).club;
    expect(atRest.tip.y).toBeLessThan(atRest.shoulder.y);
    expect((atRest.tip.x - atRest.shoulder.x) * getEnemy(sim).facing).toBeGreaterThan(0);

    walkUntil(sim, () => getEnemy(sim).action === 'windingUp');
    stepFor(sim, 1, [WALK_LEFT]);
    const swings = recordAsLongAs(sim, () => getEnemy(sim).action !== 'recovering');
    const raised = swings.find((enemy) => enemy.action === 'swinging')!.club;
    expect((raised.tip.x - raised.shoulder.x) * getEnemy(sim).facing).toBeLessThan(0);
    expect(raised.tip.y).toBeLessThan(raised.shoulder.y);
    const highest = Math.min(...swings.map((enemy) => enemy.club.tip.y));
    // Higher than the stick man's feet get in a jump: nothing jumps over a swing.
    expect(-highest).toBeGreaterThan(PLAYER.jumpHeight + 0.2);
    const down = getEnemy(sim).club;
    expect(down.tip.y).toBeCloseTo(0, 1);
    expect((down.tip.x - down.shoulder.x) * getEnemy(sim).facing).toBeGreaterThan(1);
  });

  it('stays in the stretch it guards: the stick man waiting just past the end of it is not followed, and is not swung at', () => {
    const sim = createSim({ level: clubYard.id });
    const stretch = getEnemy(sim).guardedStretch;
    expect(stretch).toEqual({
      start: POST.x - clubEnemyDef.guardedStretch,
      end: POST.x + clubEnemyDef.guardedStretch,
    });
    const standAt = stretch.start - clubEnemyDef.swingDistance - 0.3;
    walkUntil(sim, () => getStickMan(sim).feet.x >= standAt);
    stepFor(sim, 1, [STOP]);
    const seen = recordFor(sim, 600);
    expect(Math.min(...seen.map((enemy) => enemy.position.x))).toBe(stretch.start);
    expect(seen[seen.length - 1]).toMatchObject({ action: 'waiting', facing: -1 });
    expect(seen.some((enemy) => enemy.action === 'windingUp')).toBe(false);
    expect(getStickMan(sim).action).toBe('standing');
  });

  it('does not leave its floor line: a post near the end of a line guards only as far as the line goes', () => {
    const stretch = getEnemy(createSim({ level: clubYard.id })).guardedStretch;
    const floorEnd = clubYard.floor[0]!.end.x;
    expect(stretch.end).toBeLessThanOrEqual(floorEnd - clubEnemyDef.width / 2);
  });
});

describe('the club', () => {
  it('strikes the stick man who walks into its reach and stays: the stick man is knocked down away from the enemy and takes no commands', () => {
    const sim = createSim({ level: clubYard.id });
    walkUntil(sim, () => getStickMan(sim).action === 'struck');
    const struck = getStickMan(sim);
    expect(getEnemy(sim).action).toBe('swinging');
    expect(struck).toMatchObject({ struckFor: 0, struckDirection: -1, horizontalSpeed: 0 });
    expect(getItemUse(sim)).toBeNull();
    expect(getInteraction(sim)).toBeNull();

    stepFor(sim, 20, [WALK_RIGHT, JUMP, USE, INTERACT, SELECT_FIRST]);
    expect(getStickMan(sim)).toMatchObject({ action: 'struck', feet: struck.feet });
    expect(getStickMan(sim).struckFor).toBeCloseTo(20 / TICKS, 6);
  });

  it('starts the level again once the stick man has lain there for the pause, with the enemy back at its post', () => {
    const sim = createSim({ level: clubYard.id });
    walkUntil(sim, () => getStickMan(sim).action === 'struck');
    const pauseTicks = Math.round(PLAYER.struckPause * TICKS);
    stepFor(sim, pauseTicks - 1, [STOP]);
    expect(getStickMan(sim).action).toBe('struck');
    expect(getEnemy(sim).position.x).not.toBe(POST.x);
    sim.step();
    expect(getStickMan(sim)).toMatchObject({
      action: 'standing',
      feet: clubYard.start,
      struckFor: null,
    });
    expect(getEnemy(sim)).toMatchObject({ position: { x: POST.x }, action: 'waiting' });
    expect(sim.level).toBe(clubYard.id);
  });

  it('misses the stick man who walks on towards it for a quarter of a second after the club goes back, and only then walks away', () => {
    const sim = createSim({ level: clubYard.id });
    walkUntil(sim, () => getEnemy(sim).action === 'windingUp');
    stepFor(sim, Math.round(0.25 * TICKS));
    stepFor(sim, 1, [WALK_LEFT]);
    stepUntil(sim, () => getEnemy(sim).action === 'recovering');
    expect(getStickMan(sim).action).toBe('walking');
  });

  it('does not hurt while it goes back, or while it is lifted again: only the swing does', () => {
    const sim = createSim({ level: clubYard.id });
    makeEnemySwing(sim);
    // The club is down in front of the enemy: the stick man walks through where it lies, up
    // against the enemy, and waits there for as long as the club takes to come up.
    stepFor(sim, 1, [WALK_RIGHT]);
    const recovery = recordAsLongAs(sim, () => getEnemy(sim).action === 'recovering');
    expect(recovery.length).toBeGreaterThan(60);
    expect(getStickMan(sim).action).toBe('walking');
    // And through all of the wind-up that follows, right under the club.
    stepUntil(sim, () => getEnemy(sim).action === 'windingUp');
    recordAsLongAs(sim, () => getEnemy(sim).action === 'windingUp');
    expect(getStickMan(sim).action).toBe('walking');
    expect(getEnemy(sim).action).toBe('swinging');
    stepUntil(sim, () => getEnemy(sim).action !== 'swinging');
    expect(getStickMan(sim).action).toBe('struck');
  });
});

describe("the club enemy's body", () => {
  it('does not hurt, and stops the stick man who walks into it half a stick man away', () => {
    const sim = createSim({ level: clubYard.id });
    makeEnemySwing(sim);
    stepFor(sim, 1, [WALK_RIGHT]);
    stepFor(sim, 70);
    const enemy = getEnemy(sim);
    expect(enemy.action).toBe('recovering');
    expect(getStickMan(sim).feet.x).toBeCloseTo(
      enemy.position.x - enemy.width / 2 - STICK_MAN_WIDTH / 2,
      6,
    );
    expect(getStickMan(sim).action).toBe('walking');
    expect(getStickMan(sim).struckFor).toBeNull();
  });

  it('is jumped over while the enemy lifts its club: the stick man lands on the far side and walks out of its reach', () => {
    const sim = createSim({ level: clubYard.id });
    makeEnemySwing(sim);
    const enemyX = getEnemy(sim).position.x;
    jumpOverFrom(sim, enemyX - JUMP_FROM);
    const highest = stepUntilLanded(sim);
    expect(highest).toBeGreaterThan(clubEnemyDef.height + clubEnemyDef.floatHeight);
    expect(getStickMan(sim).feet.x).toBeGreaterThan(enemyX + clubEnemyDef.width / 2);
    stepFor(sim, 240);
    expect(getStickMan(sim).struckFor).toBeNull();
    expect(getStickMan(sim).feet.x).toBeGreaterThan(enemyX + clubEnemyDef.guardedStretch);
  });

  it.each(JUMPS_OVER.map((jumpFrom) => [jumpFrom]))(
    'is cleared by a jump from %f m in front of its middle, right up against it included',
    (jumpFrom) => {
      const sim = createSim({ level: clubYard.id });
      makeEnemySwing(sim);
      const enemyX = getEnemy(sim).position.x;
      jumpOverFrom(sim, enemyX - jumpFrom);
      stepUntilLanded(sim);
      expect(getStickMan(sim).feet.x).toBeGreaterThan(enemyX + clubEnemyDef.width / 2);
      expect(getStickMan(sim).struckFor).toBeNull();
    },
  );

  it('is not jumped onto: a jump from too far away comes down in front of it again', () => {
    const sim = createSim({ level: clubYard.id });
    makeEnemySwing(sim);
    const enemyX = getEnemy(sim).position.x;
    jumpOverFrom(sim, enemyX - 2.1);
    stepUntilLanded(sim);
    expect(getStickMan(sim).feet.x).toBeLessThan(enemyX - clubEnemyDef.width / 2);
    expect(getStickMan(sim).feet.y).toBe(0);
  });
});

describe('getting past the club enemy without making it swing first', () => {
  it('never works by running at it and jumping, whenever the jump is pressed', () => {
    const passed: number[] = [];
    for (let jumpAtTick = 0; jumpAtTick < RUN_UP_TICKS; jumpAtTick += 1) {
      const sim = createSim({ level: clubYard.id });
      sim.step([WALK_RIGHT]);
      let hasPassed = false;
      for (let tick = 0; tick < RUN_UP_TICKS + 240; tick += 1) {
        sim.step(tick === jumpAtTick ? [JUMP] : []);
        const stickMan = getStickMan(sim);
        hasPassed ||=
          stickMan.struckFor === null && stickMan.feet.x > POST.x + clubEnemyDef.guardedStretch + 3;
      }
      if (hasPassed) {
        passed.push(jumpAtTick);
      }
    }
    expect(passed).toEqual([]);
  });

  it('never works by running at it and jumping again and again', () => {
    for (const everyTicks of [20, 35, 54, 60, 75]) {
      const sim = createSim({ level: clubYard.id });
      sim.step([WALK_RIGHT]);
      let wasStruck = false;
      for (let tick = 0; tick < RUN_UP_TICKS + 120 && !wasStruck; tick += 1) {
        sim.step(tick % everyTicks === 0 ? [JUMP] : []);
        wasStruck = getStickMan(sim).action === 'struck';
      }
      expect(wasStruck, `jumping every ${everyTicks} ticks`).toBe(true);
    }
  });

  it('is caught in the air: a jump over it during the swing is struck above it and falls to the floor', () => {
    const sim = createSim({ level: clubYard.id });
    walkUntil(sim, () => getEnemy(sim).action === 'windingUp');
    stepFor(sim, 1, [JUMP]);
    stepUntil(sim, () => getStickMan(sim).action === 'struck');
    const struck = getStickMan(sim);
    expect(-struck.feet.y).toBeGreaterThan(clubEnemyDef.height);
    expect(Math.abs(struck.feet.x - getEnemy(sim).position.x)).toBeLessThan(clubEnemyDef.width);
    stepFor(sim, Math.round(PLAYER.struckPause * TICKS) - 2);
    // It fell beside the enemy, not into it.
    const fallen = getStickMan(sim);
    expect(fallen).toMatchObject({ action: 'struck', feet: { y: 0 }, verticalSpeed: 0 });
    expect(Math.abs(fallen.feet.x - getEnemy(sim).position.x)).toBeGreaterThanOrEqual(
      clubEnemyDef.width / 2 + STICK_MAN_WIDTH / 2 - 1e-9,
    );
  });
});

describe('the club enemy and the rest of the game', () => {
  it('leaves the stick man alone under the flag the stick man has reached', () => {
    const sim = createSim({ level: clubYard.id });
    playPastEnemyToFlag(sim);
    expect(getFlag(sim)!.isReached).toBe(true);
    const seen = recordFor(sim, 600);
    expect(seen.every((enemy) => enemy.action === 'waiting' || enemy.action === 'recovering')).toBe(
      true,
    );
    expect(getStickMan(sim).action).toBe('cheering');
  });

  it('continues from a snapshot taken in the middle of a swing exactly as the sim it was taken from', () => {
    const original = createSim({ level: clubYard.id });
    walkUntil(original, () => getEnemy(original).action === 'swinging');
    original.step();
    const restored = restoreSim(original.takeSnapshot());
    expect(getEnemy(restored)).toEqual(getEnemy(original));
    for (let tick = 0; tick < 300; tick += 1) {
      original.step(tick === 150 ? [WALK_RIGHT] : []);
      restored.step(tick === 150 ? [WALK_RIGHT] : []);
    }
    expect(hashSnapshot(restored.takeSnapshot())).toBe(hashSnapshot(original.takeSnapshot()));
  });

  it('keeps only plain numbers and ids in its state', () => {
    const sim = createSim({ level: clubYard.id });
    walkUntil(sim, () => getEnemy(sim).action === 'swinging');
    const snapshot = sim.takeSnapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot.slices.enemies).toEqual([
      expect.objectContaining({ defId: clubEnemyDef.id, action: 'swinging', postX: POST.x }),
    ]);
  });

  it('is as tall as the stick man can jump over with room to spare, and not as tall as the stick man', () => {
    const top = clubEnemyDef.height + clubEnemyDef.floatHeight;
    expect(top).toBeLessThan(PLAYER.jumpHeight - 0.5);
    expect(top).toBeLessThan(STICK_MAN_HEIGHT);
  });
});

// ---- Helpers ----

const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };
const WALK_LEFT: Command = { type: 'player/walk', direction: -1 };
const STOP: Command = { type: 'player/walk', direction: 0 };
const JUMP: Command = { type: 'player/jump' };
const USE: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };
const SELECT_FIRST: Command = { type: 'inventory/select', slot: 1 };
const POST = clubYard.enemies![0]!.position;
const TICKS = Math.round(1 / createSim({ level: clubYard.id }).dt);
/** Ticks from the start of the yard to well past the enemy at a walk. */
const RUN_UP_TICKS = Math.round(((POST.x - clubYard.start.x + 2) / PLAYER.walkSpeed) * TICKS);
/** How far in front of the enemy's middle a jump over it starts in these tests, in metres. */
const JUMP_FROM = 1;
/**
 * Every distance in front of its middle that a jump has to clear it from: from right up against
 * its body to a long step back.
 */
const JUMPS_OVER = [clubEnemyDef.width / 2 + STICK_MAN_WIDTH / 2, 0.8, 1, 1.2, 1.4];

function getEnemy(sim: SimHandle): EnemyView {
  return getEnemies(sim)[0]!;
}

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

function walkUntil(sim: SimHandle, isDone: () => boolean): void {
  sim.step([WALK_RIGHT]);
  stepUntil(sim, isDone);
}

/** The enemy as it is after each tick, for as long as `isGoingOn`. */
function recordAsLongAs(sim: SimHandle, isGoingOn: () => boolean): EnemyView[] {
  const seen: EnemyView[] = [];
  while (isGoingOn()) {
    sim.step();
    seen.push(getEnemy(sim));
    if (seen.length > 3000) {
      throw new Error('never ended');
    }
  }
  return seen;
}

function recordFor(sim: SimHandle, ticks: number): EnemyView[] {
  let left = ticks;
  return recordAsLongAs(sim, () => (left -= 1) >= 0);
}

/**
 * Makes the enemy swing at nothing: the stick man walks into its sight until the club goes back,
 * walks away, and stands still out of reach when the club has come down.
 */
function makeEnemySwing(sim: SimHandle): void {
  walkUntil(sim, () => getEnemy(sim).action === 'windingUp');
  stepFor(sim, 1, [WALK_LEFT]);
  stepUntil(sim, () => getEnemy(sim).action === 'recovering');
  stepFor(sim, 1, [STOP]);
  expect(getStickMan(sim).action).toBe('standing');
}

/** Walks right to `x` and jumps there, holding the jump and still walking. */
function jumpOverFrom(sim: SimHandle, x: number): void {
  sim.step([WALK_RIGHT]);
  stepUntil(sim, () => getStickMan(sim).feet.x >= x - 1e-9);
  sim.step([JUMP]);
}

/** Steps until the stick man is back on the floor, and says how high its feet got, in metres. */
function stepUntilLanded(sim: SimHandle): number {
  let highest = 0;
  stepUntil(sim, () => {
    highest = Math.max(highest, -getStickMan(sim).feet.y);
    return getStickMan(sim).action !== 'jumping';
  });
  return highest;
}

/** The way past: make it swing at nothing, jump over it while it lifts its club, walk on. */
function playPastEnemyToFlag(sim: SimHandle): void {
  makeEnemySwing(sim);
  jumpOverFrom(sim, getEnemy(sim).position.x - JUMP_FROM);
  stepUntil(sim, () => getFlag(sim)!.isReached || getStickMan(sim).action === 'struck');
}
