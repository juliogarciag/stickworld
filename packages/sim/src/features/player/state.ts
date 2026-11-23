import { defineSlice } from '../../core/slice';
import type { WalkDirection } from './commands';

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
  onFloor: boolean;
  /** Metres walked on the floor since he last stood still or landed: how far along his walk he is. */
  distanceWalked: number;
  /** Ticks since he walked off an edge, or null when he is on the floor or left it by jumping. */
  ticksSinceWalkedOff: number | null;
  /** Ticks since a jump was asked for that has not happened yet, or null when none is waiting. */
  ticksSinceJumpAsked: number | null;
  /** True while he holds something over his head with both hands. What it is belongs to the feature that put it there (the airplane). */
  carrying: boolean;
  /** True while he sits in something that moves him (the airplane): he neither walks nor falls, and where he is belongs to the feature that seated him. */
  seated: boolean;
}

export const playerSlice = defineSlice<PlayerState>('player', (level) => ({
  x: level.start.x,
  y: level.start.y,
  verticalSpeed: 0,
  horizontalSpeed: 0,
  facing: 1,
  walkDirection: 0,
  onFloor: true,
  distanceWalked: 0,
  ticksSinceWalkedOff: null,
  ticksSinceJumpAsked: null,
  carrying: false,
  seated: false,
}));
