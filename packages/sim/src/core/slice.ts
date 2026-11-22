import type { Level } from '../content/levels/types';

/**
 * A feature's part of the sim state, stored under `key` in every snapshot.
 *
 * The value must be plain JSON data: numbers, ids, booleans, strings, arrays
 * and plain objects. No class instances, functions, Maps or references to
 * defs; a def is referenced by its numeric id. `core/snapshot.test.ts` fails
 * for a slice that does not survive a JSON round trip.
 */
export interface StateSlice<T> {
  readonly key: string;
  /** The value this slice holds when a level starts. */
  initialFor(level: Level): T;
  /** True when starting or restarting a level keeps this slice's value instead of resetting it (the paper the player keeps from level 2). */
  readonly carriesAcrossLevels: boolean;
}

export interface SliceOptions {
  /** Keep the value when a level starts or restarts. Default false. */
  readonly carriesAcrossLevels?: boolean;
}

/** Declares a slice of state. `key` must be unique across features; use the feature's name. */
export function defineSlice<T>(key: string, initialFor: (level: Level) => T, { carriesAcrossLevels = false }: SliceOptions = {}): StateSlice<T> {
  return { key, initialFor, carriesAcrossLevels };
}
