import type { Sim } from '../../core/sim';
import { PLAYER } from '../player/defs';
import { floorHeightAt, lowestFloorHeight } from '../player/floor';
import { playerSlice, type PlayerState } from '../player/state';
import { AIRPLANE, FLIGHT } from './defs';
import { airplaneSlice, type AirplaneState } from './state';

/**
 * The airplane once it has left the edge: it glides with him seated in it,
 * falls when it is too slow or he has jumped out of it, and slides to a stop
 * on the floor line it comes down on. The glide is an exchange of speed and
 * height (`FLIGHT`), plain arithmetic, no aerodynamics and no physics.
 */

/** He sits down in the airplane where it rests and it leaves the edge, nose first. */
export function boardAndLaunch(sim: Sim): void {
  const airplane = sim.stateOf(airplaneSlice);
  const player = sim.stateOf(playerSlice);
  airplane.flying = true;
  airplane.speed = FLIGHT.launchSpeed;
  airplane.pitch = FLIGHT.launchPitch;
  player.seated = true;
  player.onFloor = false;
  player.facing = airplane.facing;
  player.verticalSpeed = 0;
  player.horizontalSpeed = 0;
  player.distanceWalked = 0;
  player.ticksSinceWalkedOff = null;
  // A jump asked for a moment before he sat down was for the floor: it must not throw him out of his seat.
  player.ticksSinceJumpAsked = null;
  seatHim(player, airplane);
}

/** One tick of an airplane that is off the floor or sliding along it. Nothing happens to one that rests or is carried. */
export function moveOneTick(sim: Sim): void {
  const airplane = sim.stateOf(airplaneSlice);
  const player = sim.stateOf(playerSlice);
  // He has jumped out: with nobody to steer it, it stops gliding and falls.
  if (airplane.flying && !player.seated) stopGliding(airplane);

  if (airplane.flying) glide(sim, airplane);
  else if (airplane.falling) fall(sim, airplane);
  else if (airplane.sliding) slide(sim, airplane);

  if (player.seated) seatHim(player, airplane);
  if (!airplane.sliding && !airplane.flying && !airplane.falling && player.seated) standHimUp(player);

  const below = airplane.y - lowestFloorHeight(sim.levelDef.floor);
  // With him in it, falling out of sight starts the level again, and nothing of the airplane is left. Without him it is only lost.
  if (player.seated && below > FLIGHT.lostBelowFloor) sim.startLevel(sim.level);
  else if (!player.seated && below > PLAYER.fallBelowFloor) sim.setStateOf(airplaneSlice, { ...airplaneSlice.initialFor(sim.levelDef), steering: airplane.steering });
}

/** It falls from here on, keeping the sideways and the downward part of the way it was going. Nothing changes for one that is not gliding. */
export function stopGliding(airplane: AirplaneState): void {
  if (!airplane.flying) return;
  airplane.flying = false;
  airplane.falling = true;
  airplane.verticalSpeed = -airplane.speed * Math.sin(airplane.pitch);
  airplane.speed = airplane.speed * Math.cos(airplane.pitch);
  airplane.pitch = 0;
}

// ---- Helpers ----

/** One tick of the glide: the steer keys turn its nose, it goes where its nose points, and what it climbed or dived is paid for or paid back in speed. */
function glide(sim: Sim, airplane: AirplaneState): void {
  airplane.pitch = pitchAfterSteering(airplane.pitch, { steering: airplane.steering, dt: sim.dt });
  const climbed = airplane.speed * Math.sin(airplane.pitch) * sim.dt;
  const forward = airplane.speed * Math.cos(airplane.pitch) * sim.dt;
  const exchanged = climbed > 0 ? -climbed * FLIGHT.speedLostPerMetreClimbed : -climbed * FLIGHT.speedGainedPerMetreDived;
  airplane.speed = Math.min(FLIGHT.fastestSpeed, airplane.speed + exchanged - FLIGHT.speedLostPerSecond * sim.dt);
  const landed = comeDownOrMoveTo(sim, airplane, { x: airplane.x + airplane.facing * forward, y: airplane.y - climbed });
  if (!landed && airplane.speed < FLIGHT.stallSpeed) stopGliding(airplane);
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
  if (floorHeightAt(sim.levelDef.floor, airplane.x) === undefined) {
    airplane.sliding = false;
    airplane.falling = true;
    airplane.verticalSpeed = 0;
  } else if (airplane.speed === 0) {
    airplane.sliding = false;
  }
}

/**
 * Moves it to `to`, or sets it on the floor line when the way there crosses one from above: then it slides on with the
 * sideways speed it had. True when it came down. Right for flat floors, which is all the levels have.
 */
function comeDownOrMoveTo(sim: Sim, airplane: AirplaneState, to: { x: number; y: number }): boolean {
  const floorHeight = floorHeightAt(sim.levelDef.floor, to.x);
  const comesDown = floorHeight !== undefined && airplane.y < floorHeight && to.y >= floorHeight;
  if (!comesDown) {
    airplane.x = to.x;
    airplane.y = to.y;
    return false;
  }
  const sideways = airplane.flying ? airplane.speed * Math.cos(airplane.pitch) : airplane.speed;
  airplane.x = to.x;
  airplane.y = floorHeight;
  airplane.flying = false;
  airplane.falling = false;
  airplane.sliding = true;
  airplane.speed = sideways;
  airplane.pitch = 0;
  airplane.verticalSpeed = 0;
  return true;
}

/** Where its nose points a tick later: turned by the steer key that is held, or sinking back to where it rests when none is. */
function pitchAfterSteering(pitch: number, { steering, dt }: { steering: -1 | 0 | 1; dt: number }): number {
  if (steering !== 0) return Math.max(FLIGHT.steepestDive, Math.min(FLIGHT.steepestClimb, pitch + steering * FLIGHT.pitchRate * dt));
  const mostChange = FLIGHT.noseSinkRate * dt;
  if (Math.abs(FLIGHT.restingPitch - pitch) <= mostChange) return FLIGHT.restingPitch;
  return pitch + Math.sign(FLIGHT.restingPitch - pitch) * mostChange;
}

/** Seated, he is where the airplane is: its underside is what the sim calls his feet. */
function seatHim(player: PlayerState, airplane: AirplaneState): void {
  player.x = airplane.x;
  player.y = airplane.y;
}

/** The airplane has come to rest on the floor: he gets up and stands where it lies. */
function standHimUp(player: PlayerState): void {
  player.seated = false;
  player.onFloor = true;
  player.verticalSpeed = 0;
  player.horizontalSpeed = 0;
  player.distanceWalked = 0;
}
