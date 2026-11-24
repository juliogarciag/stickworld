import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import type { SteerDirection } from './commands';
import { AIRPLANE, FLIGHT } from './defs';
import { hasYetToTakeItToAnEdge, sitsOnAnEdge } from './index';
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
  /**
   * `resting` on the floor, `carried` over his head, `flying` while it glides with him seated in it, `falling` with him
   * or without him, which over a gap ends with it lost, or `landing` while it slides along the floor it came down on.
   */
  readonly state: 'resting' | 'carried' | 'flying' | 'falling' | 'landing';
  /** Metres per second, positive when it falls. Only other than 0 while it falls. */
  readonly verticalSpeed: number;
  /** Metres per second: along the way its nose points while it flies, sideways the way it faces while it falls or lands. 0 resting and carried. */
  readonly speed: number;
  /** How far its nose points up while it flies, in radians; negative when it points down. 0 otherwise. */
  readonly pitch: number;
  /** The speed below which it stops flying and falls, in metres per second. */
  readonly stallSpeed: number;
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
    state: airplane.carried ? 'carried' : airplane.flying ? 'flying' : airplane.falling ? 'falling' : airplane.sliding ? 'landing' : 'resting',
    verticalSpeed: airplane.falling ? airplane.verticalSpeed : 0,
    speed: airplane.speed,
    pitch: airplane.pitch,
    stallSpeed: FLIGHT.stallSpeed,
    onAnEdge: sitsOnAnEdge(handle),
  };
}

/** Which way the sim believes the player wants to steer the airplane, whether or not he is flying one right now. */
export function steeringAskedOf(handle: SimHandle): SteerDirection {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return handle.stateOf(airplaneSlice).steering;
}

/**
 * What he has still to be told about flying the airplane he has, or null when there is nothing to tell: that it has
 * to be taken to an edge, until he has boarded one once. For a view that says so beside the keys.
 */
export function flyingHintOf(handle: SimHandle): 'takeItToAnEdge' | null {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return hasYetToTakeItToAnEdge(handle) ? 'takeItToAnEdge' : null;
}
