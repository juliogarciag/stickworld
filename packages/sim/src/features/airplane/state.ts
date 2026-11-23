import { defineSlice } from '../../core/slice';

export interface AirplaneState {
  /** True while there is an airplane in the level: on the floor, over his head or falling. False while it is an item in his slot, or lost, or not made yet. */
  inWorld: boolean;
  /** The middle of its underside, in metres. Only read while it is in the world. */
  x: number;
  y: number;
  /** Which way its nose points: 1 right, -1 left. */
  facing: 1 | -1;
  /** True while he holds it over his head. */
  carried: boolean;
  /** True while it falls. A falling airplane does not land: it is lost once it is as far below the floor as he can fall. */
  falling: boolean;
  /** Metres per second, positive when it falls. 0 resting and carried. */
  verticalSpeed: number;
}

/** It starts each level out of the world: an airplane left on the floor is gone when the level starts again. */
export const airplaneSlice = defineSlice<AirplaneState>('airplane', () => ({ inWorld: false, x: 0, y: 0, facing: 1, carried: false, falling: false, verticalSpeed: 0 }));
