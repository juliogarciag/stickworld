import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import type { SteerDirection } from './commands';
import { AIRPLANE, FLIGHT } from './defs';
import { hasYetToReachEdge, isReadyToBoard, isSittingOnEdge } from './index';
import { airplaneSlice } from './state';

/** The airplane in the world as a view needs it. How it is folded and how it gets from the floor to the stick man's hands are the view's business. */
export interface AirplaneView {
  /** The middle of its underside, in metres. */
  readonly position: Point;
  /** Which way its nose points: 1 right, -1 left. */
  readonly facing: 1 | -1;
  /** From nose to tail, in metres. */
  readonly length: number;
  /** From its underside to the top of its tail, in metres. */
  readonly height: number;
  /**
   * `resting` on the floor, `carried` over the stick man's head, `flying` while it glides with the stick man seated in it, `falling` with the stick man
   * or without the stick man, which over a gap ends with it lost, or `landing` while it slides along the floor it came down on.
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
  readonly isOnEdge: boolean;
}

/** The airplane in the world, or undefined while there is none: it is an item in the stick man's slot, or lost, or not made yet. */
export function getAirplane(handle: SimHandle): AirplaneView | undefined {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const airplane = handle.getStateOf(airplaneSlice);
  if (!airplane.isInWorld) return undefined;
  return {
    position: { x: airplane.x, y: airplane.y },
    facing: airplane.facing,
    length: AIRPLANE.length,
    height: AIRPLANE.height,
    state: airplane.isCarried ? 'carried' : airplane.isFlying ? 'flying' : airplane.isFalling ? 'falling' : airplane.isSliding ? 'landing' : 'resting',
    verticalSpeed: airplane.isFalling ? airplane.verticalSpeed : 0,
    speed: airplane.speed,
    pitch: airplane.pitch,
    stallSpeed: FLIGHT.stallSpeed,
    isOnEdge: isSittingOnEdge(handle),
  };
}

/** Which way the sim believes the player wants to steer the airplane, whether or not the stick man is flying one right now. */
export function getSteeringAsked(handle: SimHandle): SteerDirection {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return handle.getStateOf(airplaneSlice).steering;
}

/**
 * What the stick man is told about the airplane the stick man has before the stick man has flown it, for a view that says so beside the keys:
 * `takeToEdge` until it sits on an edge, then `createSimReadyToBoard` while it sits there, where the key boards it.
 */
export type FlyingHint = 'takeToEdge' | 'readyToBoard';

/**
 * What the stick man has still to be told about flying the airplane it has, or null when there is nothing to tell: that it has
 * to be taken to an edge, and once it sits on one that it is ready, until the stick man has boarded one since the level started.
 */
export function getFlyingHint(handle: SimHandle): FlyingHint | null {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  if (hasYetToReachEdge(handle)) return 'takeToEdge';
  if (isReadyToBoard(handle)) return 'readyToBoard';
  return null;
}
