import { defineSlice } from '../../core/slice';
import type { SteerDirection } from './commands';

export interface AirplaneState {
  /** True while there is an airplane in the level: on the floor, over his head, flying, sliding or falling. False while it is an item in his slot, or lost, or not made yet. */
  inWorld: boolean;
  /** The middle of its underside, in metres. Only read while it is in the world. */
  x: number;
  y: number;
  /** Which way its nose points: 1 right, -1 left. */
  facing: 1 | -1;
  /** True while he holds it over his head. */
  carried: boolean;
  /** True while it falls, with him seated in it or without him. Over a gap it is lost; over a floor line it comes down on it. */
  falling: boolean;
  /** Metres per second, positive when it falls. Only read while it falls. */
  verticalSpeed: number;
  /** True while it glides with him seated in it: `speed` and `pitch` say how. */
  flying: boolean;
  /** True while it slides along the floor it came down on, until it has lost its speed. */
  sliding: boolean;
  /** Metres per second. Gliding, along the way its nose points; falling and sliding, sideways the way it faces. 0 resting and carried. */
  speed: number;
  /** How far its nose points up while it glides, in radians; negative when it points down. 0 otherwise. */
  pitch: number;
  /** Which way the player last asked to steer it: 1 nose up, -1 nose down, 0 neither. */
  steering: SteerDirection;
}

/** It starts each level out of the world: an airplane left on the floor is gone when the level starts again. */
export const airplaneSlice = defineSlice<AirplaneState>('airplane', () => ({ inWorld: false, x: 0, y: 0, facing: 1, carried: false, falling: false, verticalSpeed: 0, flying: false, sliding: false, speed: 0, pitch: 0, steering: 0 }));

/** True once he has boarded an airplane, on any level: from then on he knows where one is boarded from, and is not shown. It carries across levels and deaths. */
export const hasBoardedSlice = defineSlice<boolean>('hasBoarded', () => false, { carriesAcrossLevels: true });
