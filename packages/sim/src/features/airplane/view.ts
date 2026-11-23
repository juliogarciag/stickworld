import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { AIRPLANE } from './defs';
import { sitsOnAnEdge } from './index';
import { airplaneSlice } from './state';

/** The airplane in the world as a view needs it. How it is folded and how it gets from the floor to his hands are the view's business. */
export interface AirplaneView {
  /** The middle of its underside, in metres. */
  readonly at: Point;
  /** Which way its nose points: 1 right, -1 left. */
  readonly facing: 1 | -1;
  /** From nose to tail, in metres. */
  readonly length: number;
  /** From its underside to the top of its tail, in metres. */
  readonly height: number;
  /** `resting` on the floor, `carried` over his head, or `falling`, which ends with it lost. */
  readonly state: 'resting' | 'carried' | 'falling';
  /** Metres per second, positive when it falls. 0 resting and carried. */
  readonly verticalSpeed: number;
  /** True while it rests with its nose out over a gap, floor further on: where it is boarded from. */
  readonly onAnEdge: boolean;
}

/** The airplane in the world, or undefined while there is none: it is an item in his slot, or lost, or not made yet. */
export function airplaneOf(handle: SimHandle): AirplaneView | undefined {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const airplane = handle.stateOf(airplaneSlice);
  if (!airplane.inWorld) return undefined;
  return {
    at: { x: airplane.x, y: airplane.y },
    facing: airplane.facing,
    length: AIRPLANE.length,
    height: AIRPLANE.height,
    state: airplane.carried ? 'carried' : airplane.falling ? 'falling' : 'resting',
    verticalSpeed: airplane.verticalSpeed,
    onAnEdge: sitsOnAnEdge(handle),
  };
}
