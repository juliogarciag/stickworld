import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { flagSlice } from '../flag/state';
import type { WalkDirection } from './commands';
import { PLAYER } from './defs';
import { floorHeightAt, lowestFloorHeight } from './floor';
import { playerSlice, type PlayerState } from './state';

/**
 * The stick man: walking, a small jump with forgiveness on both sides of it,
 * and falling off the paper, which starts the level again. Plain arithmetic
 * on the level's floor segments; no physics library.
 */
export const playerFeature: Feature = {
  name: 'player',
  slices: [playerSlice],

  handleCommand(sim, command) {
    const { type, direction } = command as { type: string; direction?: unknown };
    const player = sim.stateOf(playerSlice);
    if (type === 'player/walk' && isWalkDirection(direction)) player.walkDirection = direction;
    if (type === 'player/jump') player.ticksSinceJumpAsked = 0;
  },

  update(sim) {
    const player = sim.stateOf(playerSlice);
    const direction = walkDirectionNow(sim);
    if (direction !== 0) player.facing = direction;
    if (hasFinishedLevel(sim)) player.ticksSinceJumpAsked = null;
    jumpIfAskedAndAble(sim, player);

    const { floor } = sim.levelDef;
    const x = player.x + direction * PLAYER.walkSpeed * sim.dt;
    if (player.onFloor) walkTo(player, { x, floorHeight: floorHeightAt(floor, x), walking: direction !== 0 });
    else fallTo(player, { x, floorHeight: floorHeightAt(floor, x), dt: sim.dt });

    if (player.y > lowestFloorHeight(floor) + PLAYER.fallBelowFloor) sim.startLevel(sim.level);
  },
};

/** Which way he walks this tick: the way the player asked, or nowhere once the level is finished. */
export function walkDirectionNow(sim: Sim): WalkDirection {
  return hasFinishedLevel(sim) ? 0 : sim.stateOf(playerSlice).walkDirection;
}

export function hasFinishedLevel(sim: Sim): boolean {
  return sim.stateOf(flagSlice).reachedAtTick !== null;
}

// ---- Helpers ----

function isWalkDirection(value: unknown): value is WalkDirection {
  return value === -1 || value === 0 || value === 1;
}

/** Takes off when a jump is waiting and he is on the floor, or left it by an edge a moment ago. A jump that waited too long is forgotten. */
function jumpIfAskedAndAble(sim: Sim, player: PlayerState): void {
  if (player.ticksSinceJumpAsked === null) return;
  const walkedOffJustNow = player.ticksSinceWalkedOff !== null && player.ticksSinceWalkedOff <= wholeTicksIn(PLAYER.jumpAskedLateWindow, sim.dt);
  if (player.onFloor || walkedOffJustNow) {
    player.verticalSpeed = -Math.sqrt(2 * PLAYER.gravity * PLAYER.jumpHeight);
    player.onFloor = false;
    player.ticksSinceWalkedOff = null;
    player.ticksSinceJumpAsked = null;
  } else if (player.ticksSinceJumpAsked >= wholeTicksIn(PLAYER.jumpAskedEarlyWindow, sim.dt)) {
    player.ticksSinceJumpAsked = null;
  } else {
    player.ticksSinceJumpAsked += 1;
  }
}

/** One tick on the floor: he follows it to `x`, or finds no floor there and starts to fall. */
function walkTo(player: PlayerState, { x, floorHeight, walking }: { x: number; floorHeight: number | undefined; walking: boolean }): void {
  player.distanceWalked = walking ? player.distanceWalked + Math.abs(x - player.x) : 0;
  player.x = x;
  if (floorHeight === undefined) {
    player.onFloor = false;
    player.ticksSinceWalkedOff = 0;
    return;
  }
  player.y = floorHeight;
}

/** One tick in the air: gravity pulls him towards `x`, and he lands if the floor there is between where he was and where he would be. */
function fallTo(player: PlayerState, { x, floorHeight, dt }: { x: number; floorHeight: number | undefined; dt: number }): void {
  const y = player.y + player.verticalSpeed * dt + (PLAYER.gravity * dt * dt) / 2;
  player.verticalSpeed += PLAYER.gravity * dt;
  player.x = x;
  const lands = player.verticalSpeed > 0 && floorHeight !== undefined && player.y <= floorHeight && y >= floorHeight;
  if (!lands) {
    player.y = y;
    if (player.ticksSinceWalkedOff !== null) player.ticksSinceWalkedOff += 1;
    return;
  }
  player.y = floorHeight;
  player.verticalSpeed = 0;
  player.onFloor = true;
  player.distanceWalked = 0;
  player.ticksSinceWalkedOff = null;
}

function wholeTicksIn(seconds: number, dt: number): number {
  return Math.round(seconds / dt);
}
