import type { Sim } from '../../core/sim';
import { playerSlice, type PlayerState } from './state';

/**
 * The stick man, for the other features: where the stick man is, and what they may do to
 * it. Another feature never reads or changes the player's slice itself
 * (lint rejects the import); what it does to the stick man has a name here, and this
 * file decides which parts of the stick man's state that touches.
 */

/** Where the stick man is and how: on the floor or in the air, seated or on the stick man's feet. Read-only, and live: it is the stick man's state itself, so it changes as the stick man does. Ask again after changing the stick man rather than keeping it. */
export type PlayerBody = Readonly<
  Pick<PlayerState, 'x' | 'y' | 'facing' | 'isOnFloor' | 'isSeated'>
>;

export function getPlayerBody(sim: Sim): PlayerBody {
  return sim.getStateOf(playerSlice);
}

/**
 * The stick man sits down in something that moves the stick man from now on (the airplane), at `seat` and looking the way it does. The stick man stops
 * where it was: no speed, no walk under way, and a jump asked for a moment before the stick man sat down was for the floor, so it
 * is forgotten and cannot throw the stick man out of the stick man's seat.
 */
export function seatPlayer(
  sim: Sim,
  seat: { readonly x: number; readonly y: number; readonly facing: 1 | -1 },
): void {
  const player = sim.getStateOf(playerSlice);
  player.isSeated = true;
  player.seatedAtTick = sim.tick;
  player.isOnFloor = false;
  player.facing = seat.facing;
  player.verticalSpeed = 0;
  player.horizontalSpeed = 0;
  player.distanceWalked = 0;
  player.ticksSinceWalkedOff = null;
  player.ticksSinceJumpAsked = null;
  player.x = seat.x;
  player.y = seat.y;
}

/** Seated, the stick man is where its seat is: its underside is what the sim calls the stick man's feet. Nothing changes for the stick man on its feet. */
export function movePlayerWithSeat(
  sim: Sim,
  seat: { readonly x: number; readonly y: number },
): void {
  const player = sim.getStateOf(playerSlice);
  if (!player.isSeated) {
    return;
  }
  player.x = seat.x;
  player.y = seat.y;
}

/** What the stick man sat in has come to rest on the floor: the stick man gets up and stands where it is, still. Nothing changes for the stick man on its feet. */
export function standPlayerUp(sim: Sim): void {
  const player = sim.getStateOf(playerSlice);
  if (!player.isSeated) {
    return;
  }
  player.isSeated = false;
  player.seatedAtTick = null;
  player.isOnFloor = true;
  player.verticalSpeed = 0;
  player.horizontalSpeed = 0;
  player.distanceWalked = 0;
}

/**
 * Starts the level with the stick man standing at `position` instead of at the level's start (used
 * for a passed checkpoint). It may only be called while a level is being started, from a feature's
 * `init`. At that point the stick man has just been set up standing still, so changing the position
 * is all that is needed. In the middle of a level the speed and the seat would be left as they
 * were, so it throws.
 */
export function startPlayerAt(
  sim: Sim,
  position: { readonly x: number; readonly y: number },
): void {
  if (!sim.isStartingLevel) {
    throw new Error(
      "startPlayerAt may only be called from a feature's init, while a level is being started",
    );
  }
  const player = sim.getStateOf(playerSlice);
  player.x = position.x;
  player.y = position.y;
}

/** The stick man holds something over its head with both hands from now on: the stick man's jump is the lower one and its arms are up. What it is belongs to the feature that says so. */
export function startCarrying(sim: Sim): void {
  sim.getStateOf(playerSlice).isCarrying = true;
}

/** The stick man's hands are free again. */
export function stopCarrying(sim: Sim): void {
  sim.getStateOf(playerSlice).isCarrying = false;
}
