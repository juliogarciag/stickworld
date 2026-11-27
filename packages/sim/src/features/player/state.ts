import { defineSlice } from '../../core/slice';
import type { WalkDirection } from './commands';
import { MOVEMENT_PRESETS, type MovementTuning } from './defs';

export interface PlayerState {
  /** Where his feet are, in metres. */
  x: number;
  y: number;
  /** Metres per second, positive when he falls. 0 on the floor. */
  verticalSpeed: number;
  /** Metres per second, positive to the right. Falling off an edge it is his own: he keeps it when the key is let go. */
  horizontalSpeed: number;
  /** 1 when he looks right, -1 when he looks left. */
  facing: 1 | -1;
  /** Which way the player last asked him to walk. */
  walkDirection: WalkDirection;
  isOnFloor: boolean;
  /** Metres walked on the floor since he last stood still or landed: how far along his walk he is. */
  distanceWalked: number;
  /** Ticks since he walked off an edge, or null when he is on the floor or left it by jumping. */
  ticksSinceWalkedOff: number | null;
  /** Ticks since a jump was asked for that has not happened yet, or null when none is waiting. */
  ticksSinceJumpAsked: number | null;
  /** True from a `player/jump` until a `player/letGoOfJump`: whether the player still holds the jump. */
  isJumpHeld: boolean;
  /** True once letting go of the jump has cut this jump's rise short, so that it is cut once; false again when he takes off. */
  isRiseCut: boolean;
  /** True while he holds something over his head with both hands. What it is belongs to the feature that put it there (the airplane). */
  isCarrying: boolean;
  /** True while he sits in something that moves him (the airplane): he neither walks nor falls, and where he is belongs to the feature that seated him. */
  isSeated: boolean;
  /** The tick he sat down on, or null while he is not seated: a jump asked for on that very tick was meant for the floor. */
  seatedAtTick: number | null;
}

export const playerSlice = defineSlice<PlayerState>('player', (level) => ({
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
}), { isCarriedAcrossLevels: false });

/**
 * How he walks, jumps and falls right now: `MOVEMENT_PRESETS.current` unless a dev build tuned it. It is kept when a
 * level starts or starts again, and goes back to `current` when the game starts over.
 */
export const movementTuningSlice = defineSlice<MovementTuning>('movementTuning', () => ({ ...MOVEMENT_PRESETS.current }), { isCarriedAcrossLevels: true });
