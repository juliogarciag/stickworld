import { STICK_MAN_HEIGHT, STICK_MAN_WIDTH } from '../../content/tuning';
import { doesBlowTouchBox, type Blow, type Box } from '../../core/blow';
import type { Sim } from '../../core/sim';
import { isFlagReached } from '../flag';
import { PLAYER } from './defs';
import { playerSlice, type PlayerState } from './state';

/**
 * The stick man, for the other features: where the stick man is, and what they may do to
 * it. Another feature never reads or changes the player's slice itself
 * (lint rejects the import); what it does to the stick man has a name here, and this
 * file decides which parts of the stick man's state that touches.
 */

/**
 * Where the stick man is and how: on the floor or in the air, seated or on the stick man's feet.
 * Read-only, and live: it is the stick man's state itself, so it changes as the stick man does. Ask
 * again after changing the stick man rather than keeping it.
 */
export type PlayerBody = Readonly<
  Pick<PlayerState, 'x' | 'y' | 'facing' | 'isOnFloor' | 'isSeated' | 'isCarrying'>
>;

export function getPlayerBody(sim: Sim): PlayerBody {
  return sim.getStateOf(playerSlice);
}

/**
 * The stick man sits down in something that moves the stick man from now on (the airplane), at
 * `seat` and looking the way it does. The stick man stops where it was: no speed, no walk under
 * way, and a jump asked for a moment before the stick man sat down was for the floor, so it is
 * forgotten and cannot throw the stick man out of the stick man's seat.
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

/**
 * Seated, the stick man is where its seat is: its underside is what the sim calls the stick man's
 * feet. Nothing changes for the stick man on its feet.
 */
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

/**
 * What the stick man sat in has come to rest on the floor: the stick man gets up and stands where
 * it is, still. Nothing changes for the stick man on its feet.
 */
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
 * The stick man holds something over its head with both hands from now on: the stick man's jump is
 * the lower one and its arms are up. What it is belongs to the feature that says so.
 */
export function startCarrying(sim: Sim): void {
  sim.getStateOf(playerSlice).isCarrying = true;
}

/** The stick man's hands are free again. */
export function stopCarrying(sim: Sim): void {
  sim.getStateOf(playerSlice).isCarrying = false;
}

/** True from the tick a blow struck the stick man down until the level starts again. */
export function isPlayerStruck(sim: Sim): boolean {
  return sim.getStateOf(playerSlice).ticksSinceStruck !== null;
}

/**
 * The stick man's outline for a blow: as wide as the stick man is and as tall, standing on its
 * feet. Seated, the same box on the underside of its seat.
 */
export function getPlayerBox(sim: Sim): Box {
  const player = sim.getStateOf(playerSlice);
  return {
    left: player.x - STICK_MAN_WIDTH / 2,
    right: player.x + STICK_MAN_WIDTH / 2,
    top: player.y - STICK_MAN_HEIGHT,
    bottom: player.y,
  };
}

/**
 * Something strikes at the stick man: the one way anything hurts it (ADR 0008). True when `blow`
 * touches the stick man and struck it down: it is knocked out of a seat and out of a jump, loses
 * its speed, and from now on only falls and lies there until the level starts again
 * (`PLAYER.struckPause`). False, and nothing happens, when the blow misses, when the stick man is
 * struck down already, and under a flag it has reached: a finished level is not taken back.
 */
export function strikePlayerWith(sim: Sim, blow: Blow): boolean {
  const player = sim.getStateOf(playerSlice);
  const canBeStruck = player.ticksSinceStruck === null && !isFlagReached(sim);
  const isStruckNow = canBeStruck && doesBlowTouchBox(blow, getPlayerBox(sim));
  if (!isStruckNow) {
    return false;
  }
  player.ticksSinceStruck = 0;
  player.struckDirection = blow.direction;
  player.isSeated = false;
  player.seatedAtTick = null;
  player.horizontalSpeed = 0;
  // A rise ends there: the stick man only goes down from here.
  player.verticalSpeed = Math.max(0, player.verticalSpeed);
  player.distanceWalked = 0;
  player.ticksSinceWalkedOff = null;
  player.ticksSinceJumpAsked = null;
  return true;
}

/**
 * If the stick man overlaps `box`, slides it sideways until it is just outside it: to the side its
 * middle is on, and stopped if it was drifting in. Called every tick with a thing's body (an
 * enemy's), that is what stops the stick man from passing through the thing: it can never end a
 * tick inside it. It never hurts.
 *
 * The stick man's outline is the one the end of a floor line pushes: a point at its feet, widening
 * to its full width `PLAYER.fullWidthAbove` higher. So on the floor the box stops it half its
 * width away, and in a jump its feet clear the top of the box and nothing happens. Nothing happens
 * to the stick man in a seat either: what it sits in moves it.
 */
export function keepPlayerOutOfBox(sim: Sim, box: Box): void {
  const player = sim.getStateOf(playerSlice);
  const depthBelowTop = player.y - box.top;
  const isLevelWithBox = depthBelowTop > 0 && player.y - STICK_MAN_HEIGHT < box.bottom;
  const canBePushed = isLevelWithBox && !player.isSeated;
  if (!canBePushed) {
    return;
  }
  const reach = (STICK_MAN_WIDTH / 2) * Math.min(1, depthBelowTop / PLAYER.fullWidthAbove);
  const side = player.x < (box.left + box.right) / 2 ? -1 : 1;
  const clearX = side === -1 ? box.left - reach : box.right + reach;
  const isInsideBox = (clearX - player.x) * side > 0;
  if (!isInsideBox) {
    return;
  }
  player.x = clearX;
  if (player.horizontalSpeed * side < 0) {
    player.horizontalSpeed = 0;
  }
}
