import type { Sim } from '../../core/sim';
import { movePlayerWithSeat, seatPlayer, standPlayerUp, getPlayerBody } from '../player/body';
import { PLAYER } from '../player/defs';
import { getFloorHeightAt, getLowestFloorHeight } from '../player/floor';
import { AIRPLANE, FLIGHT } from './defs';
import { airplaneSlice, type AirplaneState, hasBoardedSlice } from './state';

/**
 * The airplane once it has left the edge: it glides with him seated in it,
 * falls when it is too slow or he has jumped out of it, and slides to a stop
 * on the floor line it comes down on. The glide is an exchange of speed and
 * height (`FLIGHT`), plain arithmetic, no aerodynamics and no physics.
 */

/** He sits down in the airplane where it rests and it leaves the edge, nose first. */
export function boardAndLaunch(sim: Sim): void {
  const airplane = sim.getStateOf(airplaneSlice);
  sim.setStateOf(hasBoardedSlice, true);
  airplane.isFlying = true;
  airplane.speed = FLIGHT.launchSpeed;
  airplane.pitch = FLIGHT.launchPitch;
  seatPlayer(sim, airplane);
}

/**
 * One tick of an airplane that is off the floor or sliding along it: where it goes, and what follows from where it got
 * to (he stands up, the level starts again, it is lost). Nothing happens to one that rests or is carried.
 */
export function moveOneTick(sim: Sim): void {
  const airplane = sim.getStateOf(airplaneSlice);
  // He has jumped out: with nobody to steer it, it stops gliding and falls.
  if (airplane.isFlying && !getPlayerBody(sim).isSeated) stopGliding(airplane);

  if (airplane.isFlying) glide(sim, airplane);
  else if (airplane.isFalling) fall(sim, airplane);
  else if (airplane.isSliding) slide(sim, airplane);

  movePlayerWithSeat(sim, airplane);
  if (!airplane.isSliding && !airplane.isFlying && !airplane.isFalling) standPlayerUp(sim);

  // Asked again: he may have stood up just now.
  const { isSeated } = getPlayerBody(sim);
  const below = airplane.y - getLowestFloorHeight(sim.levelDef.floor);
  // With him in it, falling out of sight starts the level again, and nothing of the airplane is left. Without him it is only lost.
  if (isSeated && below > FLIGHT.lostBelowFloor) sim.startLevelAfterThisTick(sim.level);
  // As deep as he can fall himself: it is gone when he would be.
  else if (!isSeated && below > PLAYER.fallBelowFloor) sim.setStateOf(airplaneSlice, { ...airplaneSlice.getInitialFor(sim.levelDef), steering: airplane.steering });
}

/** It falls from here on, keeping the sideways and the downward part of the way it was going. Nothing changes for one that is not gliding. */
export function stopGliding(airplane: AirplaneState): void {
  if (!airplane.isFlying) return;
  airplane.isFlying = false;
  airplane.isFalling = true;
  airplane.verticalSpeed = -airplane.speed * Math.sin(airplane.pitch);
  airplane.speed = airplane.speed * Math.cos(airplane.pitch);
  airplane.pitch = 0;
}

// ---- Helpers ----

/** One tick of the glide: the steer keys turn its nose, it goes where its nose points, and what it climbed or dived is paid for or paid back in speed. */
function glide(sim: Sim, airplane: AirplaneState): void {
  airplane.pitch = getPitchAfterSteering(airplane.pitch, { steering: airplane.steering, dt: sim.dt });
  const climbed = airplane.speed * Math.sin(airplane.pitch) * sim.dt;
  const forward = airplane.speed * Math.cos(airplane.pitch) * sim.dt;
  const exchanged = climbed > 0 ? -climbed * FLIGHT.speedLostPerMetreClimbed : -climbed * FLIGHT.speedGainedPerMetreDived;
  airplane.speed = Math.min(FLIGHT.fastestSpeed, airplane.speed + exchanged - FLIGHT.speedLostPerSecond * sim.dt);
  const hasLanded = comeDownOrMoveTo(sim, airplane, { x: airplane.x + airplane.facing * forward, y: airplane.y - climbed });
  if (!hasLanded && airplane.speed < FLIGHT.stallSpeed) stopGliding(airplane);
}

/** One tick of falling: it drifts on sideways as it was going and drops faster and faster. */
function fall(sim: Sim, airplane: AirplaneState): void {
  const y = airplane.y + airplane.verticalSpeed * sim.dt + (AIRPLANE.gravity * sim.dt * sim.dt) / 2;
  airplane.verticalSpeed += AIRPLANE.gravity * sim.dt;
  comeDownOrMoveTo(sim, airplane, { x: airplane.x + airplane.facing * airplane.speed * sim.dt, y });
}

/** One tick of sliding along the floor: it loses its speed and then rests; slid past the end of the line, it falls. */
function slide(sim: Sim, airplane: AirplaneState): void {
  airplane.x += airplane.facing * airplane.speed * sim.dt;
  airplane.speed = Math.max(0, airplane.speed - FLIGHT.landingSlowdown * sim.dt);
  if (getFloorHeightAt(sim.levelDef.floor, airplane.x) === undefined) {
    airplane.isSliding = false;
    airplane.isFalling = true;
    airplane.verticalSpeed = 0;
  } else if (airplane.speed === 0) {
    airplane.isSliding = false;
  }
}

/**
 * Moves it to `to`, or sets it on the floor line when the way there crosses one from above: then it slides on with the
 * sideways speed it had. True when it came down. A floor line is not flown through from below either: under one, it
 * goes no higher than it is, and a glide ends there in a fall. Right for flat floors, which is all the levels have.
 */
function comeDownOrMoveTo(sim: Sim, airplane: AirplaneState, end: { x: number; y: number }): boolean {
  const floorHeight = getFloorHeightAt(sim.levelDef.floor, end.x);
  const isHittingFromBelow = floorHeight !== undefined && airplane.y > floorHeight && end.y <= floorHeight;
  if (isHittingFromBelow) {
    stopGliding(airplane);
    airplane.verticalSpeed = Math.max(0, airplane.verticalSpeed);
    airplane.x = end.x;
    return false;
  }
  const isComingDown = floorHeight !== undefined && airplane.y < floorHeight && end.y >= floorHeight;
  if (!isComingDown) {
    airplane.x = end.x;
    airplane.y = end.y;
    return false;
  }
  const sideways = airplane.isFlying ? airplane.speed * Math.cos(airplane.pitch) : airplane.speed;
  airplane.x = end.x;
  airplane.y = floorHeight;
  airplane.isFlying = false;
  airplane.isFalling = false;
  airplane.isSliding = true;
  airplane.speed = sideways;
  airplane.pitch = 0;
  airplane.verticalSpeed = 0;
  return true;
}

/** Where its nose points a tick later: turned by the steer key that is held, or sinking back to where it rests when none is. */
function getPitchAfterSteering(pitch: number, input: { steering: -1 | 0 | 1; dt: number }): number {
  if (input.steering !== 0) return Math.max(FLIGHT.steepestDive, Math.min(FLIGHT.steepestClimb, pitch + input.steering * FLIGHT.pitchRate * input.dt));
  const mostChange = FLIGHT.noseSinkRate * input.dt;
  if (Math.abs(FLIGHT.restingPitch - pitch) <= mostChange) return FLIGHT.restingPitch;
  return pitch + Math.sign(FLIGHT.restingPitch - pitch) * mostChange;
}
