import type { FloorSegment } from '../../content/levels/types';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { flagSlice } from '../flag/state';
import { playingAgainIsOffered } from '../game';
import type { WalkDirection } from './commands';
import { MOVEMENT_TUNING_LIMITS, PLAYER, type MovementTuning } from './defs';
import { clearOfFloorEnds, floorHeightAt, keptOverTheLine, lowestFloorHeight } from './floor';
import { movementTuningSlice, playerSlice, type PlayerState } from './state';

/**
 * The stick man: walking, a small jump with forgiveness on both sides of it,
 * and falling off the paper, which starts the level again. Walking off an
 * edge he keeps the sideways speed he had and the keys only steer it; in a
 * jump they move him as they do on the floor. The end of a floor line pushes
 * him aside as he drops past it. Seated in the airplane he does none of
 * that until a jump takes him out of it. Under a flag he has reached he
 * stands and cheers; once the game is over and he is done cheering he walks
 * and jumps again, but not off the line he is on. Letting go of the jump
 * while he rises cuts the rise short by `letGoCut`, which the game as it is
 * leaves at 0. How fast he walks, how he jumps and falls is
 * `movementTuningSlice`, which only a dev build changes (ADR 0006). Plain
 * arithmetic on the level's floor segments; no physics library.
 */
export const playerFeature: Feature = {
  name: 'player',
  slices: [playerSlice, movementTuningSlice],

  handleCommand(sim, command) {
    const { type, direction, tuning } = command as { type: string; direction?: unknown; tuning?: unknown };
    const player = sim.stateOf(playerSlice);
    if (type === 'player/walk' && isWalkDirection(direction)) player.walkDirection = direction;
    if (type === 'player/jump') {
      player.ticksSinceJumpAsked = 0;
      player.jumpHeld = true;
    }
    if (type === 'player/letGoOfJump') player.jumpHeld = false;
    if (type === 'player/tuneMovement') sim.setStateOf(movementTuningSlice, { ...sim.stateOf(movementTuningSlice), ...validTuningIn(tuning) });
  },

  update(sim) {
    const player = sim.stateOf(playerSlice);
    const tuning = sim.stateOf(movementTuningSlice);
    if (player.seated) {
      // Seated he neither walks nor falls: what he sits in moves him. A jump stands him up in his seat, which is floor enough to take off from.
      // A jump that arrived on the tick he sat down was asked for before the player could see him seated: it is dropped, not a way out of the seat.
      if (player.seatedAtTick === sim.tick) player.ticksSinceJumpAsked = null;
      // Under a floor line there is no room to stand up: he cannot jump up through it, so the jump is dropped too.
      const floorOverHim = floorHeightAt(sim.levelDef.floor, player.x);
      if (floorOverHim !== undefined && player.y > floorOverHim) player.ticksSinceJumpAsked = null;
      if (player.ticksSinceJumpAsked === null) return;
      player.seated = false;
      player.seatedAtTick = null;
      player.onFloor = true;
    }
    const direction = walkDirectionNow(sim);
    if (direction !== 0) player.facing = direction;
    if (standsCheering(sim)) player.ticksSinceJumpAsked = null;
    // Only a fall that began by walking off an edge has momentum: on the floor and in a jump the keys move him at once.
    // A jump from the floor takes off with the speed the floor gives him this tick, so the speed comes first.
    player.horizontalSpeed = isFallingOffAnEdge(player) ? speedAfterSteering(player.horizontalSpeed, { direction, tuning, dt: sim.dt }) : direction * tuning.walkSpeed;
    // The cut comes before the take-off: a jump let go of in the tick it takes off in still rises for that one tick, the shortest hop.
    cutRiseIfLetGo(player, tuning);
    jumpIfAskedAndAble(sim, player);

    const { floor } = sim.levelDef;
    const wantedX = player.x + player.horizontalSpeed * sim.dt;
    // After the end there is nothing left to lose: the ends of his line stop him.
    const x = playingAgainIsOffered(sim) ? keptOverTheLine(floor, { from: player.x, to: wantedX }) : wantedX;
    if (player.onFloor) walkTo(player, { x, floorHeight: floorHeightAt(floor, x), walking: direction !== 0 });
    else fallTo(player, { x, floorHeight: floorHeightAt(floor, x), tuning, dt: sim.dt });
    if (!player.onFloor) slideOffFloorEnds(player, floor);

    if (player.y > lowestFloorHeight(floor) + PLAYER.fallBelowFloor) sim.startLevel(sim.level);
  },
};

/** Which way he walks this tick: the way the player asked, or nowhere while he cheers under the flag. */
export function walkDirectionNow(sim: Sim): WalkDirection {
  return standsCheering(sim) ? 0 : sim.stateOf(playerSlice).walkDirection;
}

/**
 * True while he stands under the flag he reached and the keys do not move him: until the next level starts, or on the
 * last level until playing again is offered.
 */
export function standsCheering(sim: Sim): boolean {
  return hasFinishedLevel(sim) && !playingAgainIsOffered(sim);
}

/** True while he is in the air because he walked off an edge, and not because he jumped. */
export function isFallingOffAnEdge(player: PlayerState): boolean {
  return !player.onFloor && player.ticksSinceWalkedOff !== null;
}

export function hasFinishedLevel(sim: Sim): boolean {
  return sim.stateOf(flagSlice).reachedAtTick !== null;
}

// ---- Helpers ----

function isWalkDirection(value: unknown): value is WalkDirection {
  return value === -1 || value === 0 || value === 1;
}

/** The numbers in `tuning` that are tuning he knows, each a number within its limits; everything else in it is left out. */
function validTuningIn(tuning: unknown): Partial<MovementTuning> {
  if (typeof tuning !== 'object' || tuning === null || Array.isArray(tuning)) return {};
  const valid: Partial<Record<keyof MovementTuning, number>> = {};
  for (const name of Object.keys(MOVEMENT_TUNING_LIMITS) as (keyof MovementTuning)[]) {
    if (!Object.hasOwn(tuning, name)) continue;
    const value: unknown = (tuning as Record<string, unknown>)[name];
    const { least, most } = MOVEMENT_TUNING_LIMITS[name];
    if (typeof value === 'number' && Number.isFinite(value) && value >= least && value <= most) valid[name] = value;
  }
  return valid;
}

/** Takes off when a jump is waiting and he is on the floor, or left it by an edge a moment ago. A jump that waited too long is forgotten. */
function jumpIfAskedAndAble(sim: Sim, player: PlayerState): void {
  if (player.ticksSinceJumpAsked === null) return;
  const walkedOffJustNow = player.ticksSinceWalkedOff !== null && player.ticksSinceWalkedOff < wholeTicksIn(PLAYER.jumpAskedLateWindow, sim.dt);
  if (player.onFloor || walkedOffJustNow) {
    const tuning = sim.stateOf(movementTuningSlice);
    player.verticalSpeed = -Math.sqrt(2 * tuning.riseGravity * (player.carrying ? tuning.jumpHeightCarrying : tuning.jumpHeight));
    player.riseCut = false;
    player.onFloor = false;
    player.ticksSinceWalkedOff = null;
    player.ticksSinceJumpAsked = null;
  } else if (player.ticksSinceJumpAsked >= wholeTicksIn(PLAYER.jumpAskedEarlyWindow, sim.dt)) {
    player.ticksSinceJumpAsked = null;
  } else {
    player.ticksSinceJumpAsked += 1;
  }
}

/**
 * Rising in a jump the player has let go of: the rise loses `letGoCut` of its speed, once a jump. A jump let go of
 * before it took off (a tap shorter than a tick, or one asked for early) is cut on the tick after: the shortest hop.
 */
function cutRiseIfLetGo(player: PlayerState, tuning: MovementTuning): void {
  const risingFromAJump = !player.onFloor && player.ticksSinceWalkedOff === null && player.verticalSpeed < 0;
  if (!risingFromAJump || player.jumpHeld || player.riseCut) return;
  player.verticalSpeed *= 1 - tuning.letGoCut;
  player.riseCut = true;
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

/**
 * One tick in the air: gravity pulls him towards `x`, and he lands if the floor there is between where he was and where he would be.
 * Rising, `riseGravity` slows him; going down, `fallGravity` speeds him up to no more than `mostFallSpeed`.
 * That is right for flat floors, which is all the levels have: a floor that slopes up towards him could be missed.
 */
function fallTo(player: PlayerState, { x, floorHeight, tuning, dt }: { x: number; floorHeight: number | undefined; tuning: MovementTuning; dt: number }): void {
  const gravity = player.verticalSpeed < 0 ? tuning.riseGravity : tuning.fallGravity;
  const atMostFallSpeed = player.verticalSpeed >= tuning.mostFallSpeed;
  const y = atMostFallSpeed ? player.y + tuning.mostFallSpeed * dt : player.y + player.verticalSpeed * dt + (gravity * dt * dt) / 2;
  player.verticalSpeed = Math.min(player.verticalSpeed + gravity * dt, tuning.mostFallSpeed);
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

/**
 * His sideways speed a tick later in a fall off an edge: a little closer to walking the way a held key says, or with no
 * key held a little closer to still by `airBraking`, which the game as it is leaves at 0: he drifts on as he was.
 */
function speedAfterSteering(speed: number, { direction, tuning, dt }: { direction: WalkDirection; tuning: MovementTuning; dt: number }): number {
  if (direction === 0 && tuning.airBraking === 0) return speed;
  const mostChange = (direction === 0 ? tuning.airBraking : tuning.airSteering) * dt;
  const wanted = direction * tuning.walkSpeed;
  // Close enough to get there this tick: exactly there, not a rounding away from it.
  if (Math.abs(wanted - speed) <= mostChange) return wanted;
  return speed + Math.sign(wanted - speed) * mostChange;
}

/** In the air next to the end of a floor line: the end pushes him aside so his body and head clear it, and stops him if he was drifting into it. */
function slideOffFloorEnds(player: PlayerState, floor: readonly FloorSegment[]): void {
  const clear = clearOfFloorEnds(floor, player);
  if (!clear) return;
  player.x = clear.x;
  if (player.horizontalSpeed * clear.awayFromFloor < 0) player.horizontalSpeed = 0;
}

function wholeTicksIn(seconds: number, dt: number): number {
  return Math.round(seconds / dt);
}
