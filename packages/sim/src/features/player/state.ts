import { defineSlice } from '../../core/slice';
import type { WalkDirection } from './commands';
import { MOVEMENT_PRESETS, type MovementTuning } from './defs';

export interface PlayerState {
  /** Where the stick man's feet are, in metres. */
  x: number;
  y: number;
  /** Metres per second, positive when the stick man falls. 0 on the floor. */
  verticalSpeed: number;
  /**
   * Metres per second, positive to the right. Falling off an edge it is the stick man's own: the
   * stick man keeps it when the key is let go.
   */
  horizontalSpeed: number;
  /** 1 when the stick man looks right, -1 when it looks left. */
  facing: 1 | -1;
  /** Which way the player last asked the stick man to walk. */
  walkDirection: WalkDirection;
  isOnFloor: boolean;
  /**
   * Metres walked on the floor since the stick man last stood still or landed: how far along the
   * stick man's walk it is.
   */
  distanceWalked: number;
  /**
   * Ticks since the stick man walked off an edge, or null when the stick man is on the floor or
   * left it by jumping.
   */
  ticksSinceWalkedOff: number | null;
  /** Ticks since a jump was asked for that has not happened yet, or null when none is waiting. */
  ticksSinceJumpAsked: number | null;
  /**
   * True from a `player/jump` until a `player/letGoOfJump`: whether the player still holds the
   * jump.
   */
  isJumpHeld: boolean;
  /**
   * True once letting go of the jump has cut this jump's rise short, so that it is cut once; false
   * again when the stick man takes off.
   */
  isRiseCut: boolean;
  /**
   * True while the stick man holds something over its head with both hands. What it is belongs to
   * the feature that put it there (the airplane).
   */
  isCarrying: boolean;
  /**
   * True while the stick man sits in something that moves it (the airplane): the stick man neither
   * walks nor falls, and where it is belongs to the feature that seated it.
   */
  isSeated: boolean;
  /**
   * The tick the stick man sat down on, or null while it is not seated: a jump asked for on that
   * very tick was meant for the floor.
   */
  seatedAtTick: number | null;
  /**
   * Ticks since something struck the stick man down, or null while nothing has: struck, the stick
   * man falls where it is, lies there and takes no commands until the level starts again.
   */
  ticksSinceStruck: number | null;
  /**
   * Which way the blow that struck the stick man knocked it: 1 to the right, -1 to the left. Only
   * read while it is struck.
   */
  struckDirection: 1 | -1;
}

export const playerSlice = defineSlice<PlayerState>(
  'player',
  (level) => ({
    x: level.start.x,
    y: level.start.y,
    verticalSpeed: 0,
    horizontalSpeed: 0,
    facing: 1,
    walkDirection: 0,
    isOnFloor: true,
    distanceWalked: 0,
    ticksSinceWalkedOff: null,
    ticksSinceJumpAsked: null,
    isJumpHeld: false,
    isRiseCut: false,
    isCarrying: false,
    isSeated: false,
    seatedAtTick: null,
    ticksSinceStruck: null,
    struckDirection: 1,
  }),
  { isCarriedAcrossLevels: false },
);

/**
 * How the stick man walks, jumps and falls right now: `MOVEMENT_PRESETS.current` unless a dev build
 * tuned it. It is kept when a level starts or starts again, and goes back to `current` when the
 * game starts over.
 */
export const movementTuningSlice = defineSlice<MovementTuning>(
  'movementTuning',
  () => ({ ...MOVEMENT_PRESETS.current }),
  { isCarriedAcrossLevels: true },
);
