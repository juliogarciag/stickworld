import type { FloorSegment, Point } from '../../content/levels/types';
import type { Blow, Box } from '../../core/blow';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { isFlagReached } from '../flag';
import {
  getPlayerBody,
  isPlayerStruck,
  keepPlayerOutOfBox,
  strikePlayerWith,
} from '../player/body';
import { getFloorHeightAt } from '../player/floor';
import { findEnemyDef, type EnemyDef } from './defs';
import { enemiesSlice, type EnemyAction, type EnemyState } from './state';

/**
 * The enemies of a level (`enemies` in its data), the first things in the game
 * that act by themselves. Each waits at its post until it sees the stick man,
 * comes towards it along its floor line without leaving the stretch it
 * guards, and when the stick man is near enough stops, takes its club back,
 * swings it over the top and down in front, and then needs a while to lift it
 * again. Only the club hurts, and only during the swing: every place the club
 * passes through is a `Blow` shown to the stick man (`strikePlayerWith`, ADR
 * 0008). Its body is solid: the stick man is kept out of it, and gets past by
 * jumping over. Plain arithmetic, no physics.
 */
export const enemyFeature: Feature = {
  name: 'enemy',
  slices: [enemiesSlice],

  init(sim) {
    const { floor, enemies } = sim.levelDef;
    const placed: EnemyState[] = [];
    for (const placement of enemies ?? []) {
      const def = findEnemyDef(placement.defId);
      if (!def) {
        continue;
      }
      const floorHeight = getFloorHeightAt(floor, placement.position.x) ?? placement.position.y;
      placed.push({
        defId: def.id,
        x: placement.position.x,
        y: floorHeight - def.floatHeight,
        facing: -1,
        action: 'waiting',
        ticksInAction: 0,
        postX: placement.position.x,
      });
    }
    sim.setStateOf(enemiesSlice, placed);
  },

  update(sim) {
    for (const enemy of sim.getStateOf(enemiesSlice)) {
      const def = findEnemyDef(enemy.defId);
      if (!def) {
        continue;
      }
      // The stick man has moved this tick already: it is put back outside the body it walked or
      // fell into before the club looks for it.
      keepPlayerOutOfBox(sim, getEnemyBox(enemy, def));
      updateEnemy(sim, enemy, def);
    }
  },
};

/** The enemy's body: what the stick man cannot walk through. */
export function getEnemyBox(enemy: EnemyState, def: EnemyDef): Box {
  return {
    left: enemy.x - def.width / 2,
    right: enemy.x + def.width / 2,
    top: enemy.y - def.height,
    bottom: enemy.y,
  };
}

/**
 * How far along what it is doing the enemy is, from 0 to 1. 0 while it waits or approaches, which
 * have no end.
 */
export function getProgress(sim: Sim, enemy: EnemyState, def: EnemyDef): number {
  const ticks = countTicksOf(enemy.action, def, sim.dt);
  return ticks === undefined ? 0 : Math.min(1, enemy.ticksInAction / ticks);
}

/** The stretch of floor the enemy guards: as far as its middle goes to either side. */
export function getGuardedStretch(
  floor: readonly FloorSegment[],
  enemy: EnemyState,
  def: EnemyDef,
): { start: number; end: number } {
  const line = floor.find(
    (segment) => segment.start.x <= enemy.postX && enemy.postX <= segment.end.x,
  );
  const lineStart = line ? line.start.x + def.width / 2 : enemy.postX;
  const lineEnd = line ? line.end.x - def.width / 2 : enemy.postX;
  return {
    start: Math.min(enemy.postX, Math.max(lineStart, enemy.postX - def.guardedStretch)),
    end: Math.max(enemy.postX, Math.min(lineEnd, enemy.postX + def.guardedStretch)),
  };
}

/**
 * Where the enemy's arm and club are when it is `progress` of the way through what it is doing:
 * its shoulder, its hand, and the end of the club. From its hand to the end is what strikes.
 */
export function getClub(
  enemy: EnemyState,
  def: EnemyDef,
  progress: number,
): { shoulder: Point; grip: Point; tip: Point; angle: number } {
  const angle = getClubAngle(enemy.action, def, progress);
  const shoulder = { x: enemy.x, y: enemy.y - def.club.shoulderHeight };
  const getPointAlongArm = (distance: number): Point => ({
    x: shoulder.x + Math.cos(angle) * distance * enemy.facing,
    y: shoulder.y - Math.sin(angle) * distance,
  });
  return {
    shoulder,
    grip: getPointAlongArm(def.club.armLength),
    tip: getPointAlongArm(def.club.armLength + def.club.length),
    angle,
  };
}

// ---- Helpers ----

/**
 * One tick of what the enemy does: it goes on with a wind-up, a swing or a recovery until that is
 * over, the club striking at every place a swing takes it through, and otherwise looks for the
 * stick man.
 */
function updateEnemy(sim: Sim, enemy: EnemyState, def: EnemyDef): void {
  const ticks = countTicksOf(enemy.action, def, sim.dt);
  if (ticks === undefined) {
    watchForPlayer(sim, enemy, def);
    return;
  }
  const progressBefore = getProgress(sim, enemy, def);
  enemy.ticksInAction += 1;
  if (enemy.action === 'swinging') {
    swingClubThrough(sim, { enemy, def, progressBefore });
  }
  if (enemy.ticksInAction < ticks) {
    return;
  }
  beginAction(enemy, getActionAfter(enemy.action));
}

/**
 * Waiting or approaching: it turns to the stick man it sees, winds up when the stick man is near
 * enough, and otherwise comes closer as far as the stretch it guards lets it. With nobody to see
 * it waits where it is.
 */
function watchForPlayer(sim: Sim, enemy: EnemyState, def: EnemyDef): void {
  const player = getPlayerBody(sim);
  const distance = player.x - enemy.x;
  // The stick man it has struck down, and one under a flag it has reached, are left alone.
  const canSeePlayer =
    Math.abs(distance) <= def.sightDistance && !isPlayerStruck(sim) && !isFlagReached(sim);
  if (!canSeePlayer) {
    beginActionIfNew(enemy, 'waiting');
    return;
  }
  if (distance !== 0) {
    enemy.facing = distance > 0 ? 1 : -1;
  }
  if (Math.abs(distance) <= def.swingDistance) {
    beginAction(enemy, 'windingUp');
    return;
  }
  const stretch = getGuardedStretch(sim.levelDef.floor, enemy, def);
  // It stops where the stick man comes within the distance it swings from, not on top of it.
  const wantedX = player.x - enemy.facing * def.swingDistance;
  const step = Math.max(-def.speed * sim.dt, Math.min(def.speed * sim.dt, wantedX - enemy.x));
  const x = Math.max(stretch.start, Math.min(stretch.end, enemy.x + step));
  beginActionIfNew(enemy, x === enemy.x ? 'waiting' : 'approaching');
  enemy.x = x;
}

/**
 * The club is shown to the stick man at every place it passed through this tick, from
 * `progressBefore` of the swing to where it is now, until one of them strikes.
 */
function swingClubThrough(
  sim: Sim,
  swing: { enemy: EnemyState; def: EnemyDef; progressBefore: number },
): void {
  const progressNow = getProgress(sim, swing.enemy, swing.def);
  const steps = swing.def.club.stepsPerTick;
  // The stick man is knocked away from the enemy, whichever side of it the club met the stick man.
  const direction = getPlayerBody(sim).x < swing.enemy.x ? -1 : 1;
  for (let step = 1; step <= steps; step += 1) {
    const progress = swing.progressBefore + ((progressNow - swing.progressBefore) * step) / steps;
    const club = getClub(swing.enemy, swing.def, progress);
    const blow: Blow = {
      start: club.grip,
      end: club.tip,
      thickness: swing.def.club.thickness,
      direction,
    };
    if (strikePlayerWith(sim, blow)) {
      return;
    }
  }
}

function beginAction(enemy: EnemyState, action: EnemyAction): void {
  enemy.action = action;
  enemy.ticksInAction = 0;
}

/** Goes on counting when it is already doing `action`. */
function beginActionIfNew(enemy: EnemyState, action: EnemyAction): void {
  if (enemy.action === action) {
    enemy.ticksInAction += 1;
    return;
  }
  beginAction(enemy, action);
}

/** How many ticks `action` lasts, or undefined for one that goes on until something happens. */
function countTicksOf(action: EnemyAction, def: EnemyDef, dt: number): number | undefined {
  if (action === 'windingUp') {
    return Math.round(def.windUpSeconds / dt);
  }
  if (action === 'swinging') {
    return Math.round(def.swingSeconds / dt);
  }
  if (action === 'recovering') {
    return Math.round(def.recoverSeconds / dt);
  }
  return undefined;
}

/** What follows `action` once its time is over. */
function getActionAfter(action: EnemyAction): EnemyAction {
  if (action === 'windingUp') {
    return 'swinging';
  }
  if (action === 'swinging') {
    return 'recovering';
  }
  return 'waiting';
}

/**
 * Where the club points `progress` of the way through `action`: back in a wind-up, over the top
 * and down in a swing, up again in a recovery, and at rest otherwise.
 */
function getClubAngle(action: EnemyAction, def: EnemyDef, progress: number): number {
  const { restAngle, raisedAngle, downAngle } = def.club;
  if (action === 'windingUp') {
    return restAngle + (raisedAngle - restAngle) * progress;
  }
  if (action === 'swinging') {
    return raisedAngle + (downAngle - raisedAngle) * progress;
  }
  if (action === 'recovering') {
    return downAngle + (restAngle - downAngle) * progress;
  }
  return restAngle;
}
