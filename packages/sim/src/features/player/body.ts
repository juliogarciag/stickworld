import type { Sim } from '../../core/sim';
import { playerSlice, type PlayerState } from './state';

/**
 * The stick man, for the other features: where he is, and what they may do to
 * him. Another feature never reads or changes the player's slice itself
 * (lint rejects the import); what it does to him has a name here, and this
 * file decides which parts of his state that touches.
 */

/** Where he is and how: on the floor or in the air, seated or on his feet. Read-only, and live: it is his state itself, so it changes as he does. Ask again after changing him rather than keeping it. */
export type PlayerBody = Readonly<Pick<PlayerState, 'x' | 'y' | 'facing' | 'isOnFloor' | 'isSeated'>>;

export function getPlayerBody(sim: Sim): PlayerBody {
  return sim.getStateOf(playerSlice);
}

/**
 * He sits down in something that moves him from now on (the airplane), at `seat` and looking the way it does. He stops
 * where he was: no speed, no walk under way, and a jump asked for a moment before he sat down was for the floor, so it
 * is forgotten and cannot throw him out of his seat.
 */
export function seatPlayer(sim: Sim, seat: { readonly x: number; readonly y: number; readonly facing: 1 | -1 }): void {
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

/** Seated, he is where his seat is: its underside is what the sim calls his feet. Nothing changes for him on his feet. */
export function movePlayerWithSeat(sim: Sim, seat: { readonly x: number; readonly y: number }): void {
  const player = sim.getStateOf(playerSlice);
  if (!player.isSeated) return;
  player.x = seat.x;
  player.y = seat.y;
}

/** What he sat in has come to rest on the floor: he gets up and stands where he is, still. Nothing changes for him on his feet. */
export function standPlayerUp(sim: Sim): void {
  const player = sim.getStateOf(playerSlice);
  if (!player.isSeated) return;
  player.isSeated = false;
  player.seatedAtTick = null;
  player.isOnFloor = true;
  player.verticalSpeed = 0;
  player.horizontalSpeed = 0;
  player.distanceWalked = 0;
}

/**
 * The level begins with him standing here instead of where the level's data starts him (a checkpoint he has passed).
 * Only while a level is being started, from a feature's `init`: he has just been set up, standing still, and this
 * moves him and nothing else. In the middle of a level it would leave his speed and his seat as they were, so it throws.
 */
export function startPlayerAt(sim: Sim, position: { readonly x: number; readonly y: number }): void {
  if (!sim.isStartingLevel) throw new Error('startPlayerAt is for a feature\'s init: once the level is under way he is not moved like this');
  const player = sim.getStateOf(playerSlice);
  player.x = position.x;
  player.y = position.y;
}

/** He holds something over his head with both hands from now on: his jump is the lower one and his arms are up. What it is belongs to the feature that says so. */
export function startCarrying(sim: Sim): void {
  sim.getStateOf(playerSlice).isCarrying = true;
}

/** His hands are free again. */
export function stopCarrying(sim: Sim): void {
  sim.getStateOf(playerSlice).isCarrying = false;
}
