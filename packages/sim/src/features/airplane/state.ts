import { defineSlice } from '../../core/slice';
import type { SteerDirection } from './commands';

export interface AirplaneState {
  /**
   * True while there is an airplane in the level: on the floor, over the stick man's head, flying,
   * sliding or falling. False while it is an item in the stick man's slot, or lost, or not made
   * yet.
   */
  isInWorld: boolean;
  /** The middle of its underside, in metres. Only read while it is in the world. */
  x: number;
  y: number;
  /** Which way its nose points: 1 right, -1 left. */
  facing: 1 | -1;
  /** True while the stick man holds it over the stick man's head. */
  isCarried: boolean;
  /**
   * True while it falls, with the stick man seated in it or without the stick man. Over a gap it is
   * lost; over a floor line it comes down on it.
   */
  isFalling: boolean;
  /** Metres per second, positive when it falls. Only read while it falls. */
  verticalSpeed: number;
  /** True while it glides with the stick man seated in it: `speed` and `pitch` say how. */
  isFlying: boolean;
  /** True while it slides along the floor it came down on, until it has lost its speed. */
  isSliding: boolean;
  /**
   * Metres per second. Gliding, along the way its nose points; falling and sliding, sideways the
   * way it faces. 0 resting and carried.
   */
  speed: number;
  /**
   * How far its nose points up while it glides, in radians; negative when it points down. 0
   * otherwise.
   */
  pitch: number;
  /** Which way the player last asked to steer it: 1 nose up, -1 nose down, 0 neither. */
  steering: SteerDirection;
}

/**
 * It starts each level out of the world: an airplane left on the floor is gone when the level
 * starts again.
 */
export const airplaneSlice = defineSlice<AirplaneState>(
  'airplane',
  () => ({
    isInWorld: false,
    x: 0,
    y: 0,
    facing: 1,
    isCarried: false,
    isFalling: false,
    verticalSpeed: 0,
    isFlying: false,
    isSliding: false,
    speed: 0,
    pitch: 0,
    steering: 0,
  }),
  { isCarriedAcrossLevels: false },
);

/**
 * True once the stick man has boarded an airplane since the level started: the stick man has found
 * where one is boarded from, and is not told. It is false again when the level starts again, as a
 * note is there again: one who fell may need telling a second time.
 */
export const hasBoardedSlice = defineSlice<boolean>('hasBoarded', () => false, {
  isCarriedAcrossLevels: false,
});
