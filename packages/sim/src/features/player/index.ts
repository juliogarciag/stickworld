import type { FloorSegment } from '../../content/levels/types';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { isFlagReached } from '../flag';
import { isPlayingAgainOffered } from '../game';
import type { WalkDirection } from './commands';
import { MOVEMENT_TUNING_LIMITS, PLAYER, type MovementTuning } from './defs';
import {
  findClearOfFloorEnds,
  getFloorHeightAt,
  keepOverLine,
  getLowestFloorHeight,
} from './floor';
import { movementTuningSlice, playerSlice, type PlayerState } from './state';

/**
 * The stick man: walking, a jump a little over the stick man's height with forgiveness on
 * both sides of it, and falling off the paper, which starts the level again. A blow
 * that strikes the stick man down (`strikePlayerWith`, ADR 0008) leaves it lying where it
 * falls, deaf to every key, and the level starts again a moment later.
 * Walking off an edge the stick man starts with the sideways speed the stick man had, and the keys
 * steer it, or with none held the stick man slows down (`airSteering`, `airBraking`):
 * almost at once in the game as it is. In a jump they move the stick man as they do on
 * the floor. The end of a floor line pushes the stick man aside as the stick man drops past it.
 * Seated in the airplane the stick man does none of that until a jump takes the stick man out of
 * it. Under a flag the stick man has reached it stands and cheers; once the game is over
 * and the stick man is done cheering it walks and jumps again, but not off the line it is
 * on. Letting go of the jump while the stick man rises cuts the rise short by `letGoCut`,
 * which in the game as it is ends the rise there and then: a jump is as high
 * as the key is held. How fast the stick man walks, how it jumps and falls is
 * `movementTuningSlice`, which only a dev build changes (ADR 0006). Plain
 * arithmetic on the level's floor segments; no physics library.
 */
export const playerFeature: Feature = {
  name: 'player',
  slices: [playerSlice, movementTuningSlice],

  handleCommand(sim, command) {
    const { type, direction, tuning } = command as {
      type: string;
      direction?: unknown;
      tuning?: unknown;
    };
    const player = sim.getStateOf(playerSlice);
    const isWalkCommand = type === 'player/walk' && isWalkDirection(direction);
    if (isWalkCommand) {
      player.walkDirection = direction;
    }
    if (type === 'player/jump') {
      player.ticksSinceJumpAsked = 0;
      player.isJumpHeld = true;
    }
    if (type === 'player/letGoOfJump') {
      player.isJumpHeld = false;
    }
    if (type === 'player/tuneMovement') {
      sim.setStateOf(movementTuningSlice, {
        ...sim.getStateOf(movementTuningSlice),
        ...getValidTuningIn(tuning),
      });
    }
  },

  update(sim) {
    const player = sim.getStateOf(playerSlice);
    const tuning = sim.getStateOf(movementTuningSlice);
    if (player.ticksSinceStruck !== null) {
      updateStruckPlayer(sim, player);
      return;
    }
    if (player.isSeated) {
      // Seated the stick man neither walks nor falls: what the stick man sits in moves it. A jump
      // stands the stick man up in its seat, which is floor enough to take off from. A jump that
      // arrived on the tick the stick man sat down was asked for before the player could see the
      // stick man seated: it is dropped, not a way out of the seat.
      if (player.seatedAtTick === sim.tick) {
        player.ticksSinceJumpAsked = null;
      }
      // Under a floor line there is no room to stand up: the stick man cannot jump up through it,
      // so the jump is dropped too.
      const floorHeightAtPlayer = getFloorHeightAt(sim.levelDef.floor, player.x);
      const isUnderFloor = floorHeightAtPlayer !== undefined && player.y > floorHeightAtPlayer;
      if (isUnderFloor) {
        player.ticksSinceJumpAsked = null;
      }
      if (player.ticksSinceJumpAsked === null) {
        return;
      }
      player.isSeated = false;
      player.seatedAtTick = null;
      player.isOnFloor = true;
    }
    const direction = getWalkDirectionNow(sim);
    if (direction !== 0) {
      player.facing = direction;
    }
    if (isStandingCheering(sim)) {
      player.ticksSinceJumpAsked = null;
    }
    // Only a fall that began by walking off an edge has momentum: on the floor and in a jump the
    // keys move the stick man at once. A jump from the floor takes off with the speed the floor
    // gives the stick man this tick, so the speed comes first.
    player.horizontalSpeed = isFallingOffEdge(player)
      ? getSpeedAfterSteering(player.horizontalSpeed, { direction, tuning, dt: sim.dt })
      : direction * tuning.walkSpeed;
    // The cut comes before the take-off: a jump let go of in the tick it takes off in still rises
    // for that one tick, the shortest hop.
    cutRiseIfLetGo(player, tuning);
    jumpIfAskedAndAble(sim, player);

    const { floor } = sim.levelDef;
    const wantedX = player.x + player.horizontalSpeed * sim.dt;
    // After the end there is nothing left to lose: the ends of the stick man's line stop it.
    const x = isPlayingAgainOffered(sim)
      ? keepOverLine(floor, { start: player.x, end: wantedX })
      : wantedX;
    if (player.isOnFloor) {
      walkTo(player, { x, floorHeight: getFloorHeightAt(floor, x), isWalking: direction !== 0 });
    } else {
      fallTo(player, { x, floorHeight: getFloorHeightAt(floor, x), tuning, dt: sim.dt });
    }
    if (!player.isOnFloor) {
      slideOffFloorEnds(player, floor);
    }

    if (player.y > getLowestFloorHeight(floor) + PLAYER.fallBelowFloor) {
      sim.startLevelAfterThisTick(sim.level);
    }
  },
};

/**
 * Which way the stick man walks this tick: the way the player asked, or nowhere while the stick man
 * cheers under the flag or lies struck down.
 */
export function getWalkDirectionNow(sim: Sim): WalkDirection {
  const player = sim.getStateOf(playerSlice);
  const canWalk = !isStandingCheering(sim) && player.ticksSinceStruck === null;
  return canWalk ? player.walkDirection : 0;
}

/**
 * True while the stick man stands under the flag it reached and the keys do not move it: until the
 * next level starts, or on the last level until playing again is offered.
 */
export function isStandingCheering(sim: Sim): boolean {
  return isFlagReached(sim) && !isPlayingAgainOffered(sim);
}

/**
 * True while the stick man is in the air because it walked off an edge, and not because it jumped.
 */
export function isFallingOffEdge(player: PlayerState): boolean {
  return !player.isOnFloor && player.ticksSinceWalkedOff !== null;
}

// ---- Helpers ----

function isWalkDirection(value: unknown): value is WalkDirection {
  return value === -1 || value === 0 || value === 1;
}

/**
 * The numbers in `tuning` that are tuning the stick man knows, each a number within its limits;
 * everything else in it is left out.
 */
function getValidTuningIn(tuning: unknown): Partial<MovementTuning> {
  const isPlainObject = typeof tuning === 'object' && tuning !== null && !Array.isArray(tuning);
  if (!isPlainObject) {
    return {};
  }
  const valid: Partial<Record<keyof MovementTuning, number>> = {};
  for (const name of Object.keys(MOVEMENT_TUNING_LIMITS) as (keyof MovementTuning)[]) {
    if (!Object.hasOwn(tuning, name)) {
      continue;
    }
    const value: unknown = (tuning as Record<string, unknown>)[name];
    const { min, max } = MOVEMENT_TUNING_LIMITS[name];
    const isWithinLimits =
      typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
    if (isWithinLimits) {
      valid[name] = value;
    }
  }
  return valid;
}

/**
 * One tick of the stick man struck down: no key moves it, it falls to the floor if it was in the
 * air, and once it has been down for `PLAYER.struckPause` the level starts again, as it does at
 * once when the stick man falls off the paper instead.
 */
function updateStruckPlayer(sim: Sim, player: PlayerState): void {
  if (player.ticksSinceStruck === null) {
    return;
  }
  const { floor } = sim.levelDef;
  player.ticksSinceJumpAsked = null;
  player.horizontalSpeed = 0;
  if (!player.isOnFloor) {
    fallTo(player, {
      x: player.x,
      floorHeight: getFloorHeightAt(floor, player.x),
      tuning: sim.getStateOf(movementTuningSlice),
      dt: sim.dt,
    });
  }
  if (!player.isOnFloor) {
    slideOffFloorEnds(player, floor);
  }
  player.ticksSinceStruck += 1;
  const isPauseOver = player.ticksSinceStruck >= countWholeTicksIn(PLAYER.struckPause, sim.dt);
  const hasFallenOffPaper = player.y > getLowestFloorHeight(floor) + PLAYER.fallBelowFloor;
  const shouldStartLevelAgain = isPauseOver || hasFallenOffPaper;
  if (shouldStartLevelAgain) {
    sim.startLevelAfterThisTick(sim.level);
  }
}

/**
 * Takes off when a jump is waiting and the stick man is on the floor, or left it by an edge a
 * moment ago. A jump that waited too long is forgotten.
 */
function jumpIfAskedAndAble(sim: Sim, player: PlayerState): void {
  if (player.ticksSinceJumpAsked === null) {
    return;
  }
  const hasJustWalkedOff =
    player.ticksSinceWalkedOff !== null &&
    player.ticksSinceWalkedOff < countWholeTicksIn(PLAYER.jumpAskedLateWindow, sim.dt);
  const canTakeOff = player.isOnFloor || hasJustWalkedOff;
  if (canTakeOff) {
    const tuning = sim.getStateOf(movementTuningSlice);
    player.verticalSpeed = -Math.sqrt(
      2 * tuning.riseGravity * (player.isCarrying ? tuning.jumpHeightCarrying : tuning.jumpHeight),
    );
    player.isRiseCut = false;
    player.isOnFloor = false;
    player.ticksSinceWalkedOff = null;
    player.ticksSinceJumpAsked = null;
  } else if (player.ticksSinceJumpAsked >= countWholeTicksIn(PLAYER.jumpAskedEarlyWindow, sim.dt)) {
    player.ticksSinceJumpAsked = null;
  } else {
    player.ticksSinceJumpAsked += 1;
  }
}

/**
 * Rising in a jump the player has let go of: the rise loses `letGoCut` of its speed, once a jump. A
 * jump let go of before it took off (a tap shorter than a tick, or one asked for early) is cut on
 * the tick after: the shortest hop.
 */
function cutRiseIfLetGo(player: PlayerState, tuning: MovementTuning): void {
  const isRisingFromJump =
    !player.isOnFloor && player.ticksSinceWalkedOff === null && player.verticalSpeed < 0;
  const shouldCutRise = isRisingFromJump && !player.isJumpHeld && !player.isRiseCut;
  if (!shouldCutRise) {
    return;
  }
  player.verticalSpeed *= 1 - tuning.letGoCut;
  player.isRiseCut = true;
}

/**
 * One tick on the floor: the stick man follows it to `x`, or finds no floor there and starts to
 * fall.
 */
function walkTo(
  player: PlayerState,
  input: { x: number; floorHeight: number | undefined; isWalking: boolean },
): void {
  player.distanceWalked = input.isWalking
    ? player.distanceWalked + Math.abs(input.x - player.x)
    : 0;
  player.x = input.x;
  if (input.floorHeight === undefined) {
    player.isOnFloor = false;
    player.ticksSinceWalkedOff = 0;
    return;
  }
  player.y = input.floorHeight;
}

/**
 * One tick in the air: gravity pulls the stick man towards `x`, and the stick man lands if the
 * floor there is between where it was and where it would be. Rising, `riseGravity` slows the stick
 * man; going down, `fallGravity` speeds the stick man up to no more than `fastestFall`. That is
 * right for flat floors, which is all the levels have: a floor that slopes up towards the stick man
 * could be missed.
 */
function fallTo(
  player: PlayerState,
  input: { x: number; floorHeight: number | undefined; tuning: MovementTuning; dt: number },
): void {
  const gravity = player.verticalSpeed < 0 ? input.tuning.riseGravity : input.tuning.fallGravity;
  const isAtMaxFallSpeed = player.verticalSpeed >= input.tuning.fastestFall;
  const y = isAtMaxFallSpeed
    ? player.y + input.tuning.fastestFall * input.dt
    : player.y + player.verticalSpeed * input.dt + (gravity * input.dt * input.dt) / 2;
  player.verticalSpeed = Math.min(
    player.verticalSpeed + gravity * input.dt,
    input.tuning.fastestFall,
  );
  player.x = input.x;
  const floorHeight = input.floorHeight;
  const isLanding =
    player.verticalSpeed > 0 &&
    floorHeight !== undefined &&
    player.y <= floorHeight &&
    y >= floorHeight;
  if (!isLanding) {
    player.y = y;
    if (player.ticksSinceWalkedOff !== null) {
      player.ticksSinceWalkedOff += 1;
    }
    return;
  }
  player.y = floorHeight;
  player.verticalSpeed = 0;
  player.isOnFloor = true;
  player.distanceWalked = 0;
  player.ticksSinceWalkedOff = null;
}

/**
 * The stick man's sideways speed a tick later in a fall off an edge: a little closer to walking the
 * way a held key says, or with no key held a little closer to still by `airBraking`. With an
 * `airBraking` of 0 the stick man drifts on as it was.
 */
function getSpeedAfterSteering(
  speed: number,
  input: { direction: WalkDirection; tuning: MovementTuning; dt: number },
): number {
  const isDrifting = input.direction === 0 && input.tuning.airBraking === 0;
  if (isDrifting) {
    return speed;
  }
  const mostChange =
    (input.direction === 0 ? input.tuning.airBraking : input.tuning.airSteering) * input.dt;
  const wanted = input.direction * input.tuning.walkSpeed;
  // Close enough to get there this tick: exactly there, not a rounding away from it.
  if (Math.abs(wanted - speed) <= mostChange) {
    return wanted;
  }
  return speed + Math.sign(wanted - speed) * mostChange;
}

/**
 * In the air next to the end of a floor line: the end pushes the stick man aside so the stick man's
 * body and head clear it, and stops the stick man if the stick man was drifting into it.
 */
function slideOffFloorEnds(player: PlayerState, floor: readonly FloorSegment[]): void {
  const clear = findClearOfFloorEnds(floor, player);
  if (!clear) {
    return;
  }
  player.x = clear.x;
  if (player.horizontalSpeed * clear.awayFromFloor < 0) {
    player.horizontalSpeed = 0;
  }
}

function countWholeTicksIn(seconds: number, dt: number): number {
  return Math.round(seconds / dt);
}
