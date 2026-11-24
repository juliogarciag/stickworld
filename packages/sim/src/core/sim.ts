import { levelById, levels } from '../content/levels';
import type { Level } from '../content/levels/types';
import { FIXED_DT } from '../content/tuning';
import { isCommandShaped, type Command } from './commands';
import type { Feature } from './feature';
import { createRng, type Rng } from './rng';
import type { StateSlice } from './slice';
import { copyOfJson, type SimSnapshot } from './snapshot';

/**
 * What views get from `createSim`. It can advance the sim and read it; it
 * cannot reach the state, the features or the rng. Everything that changes
 * the game goes through `step(commands)`.
 */
export interface SimHandle {
  readonly tick: number;
  /** Length of one tick in seconds. */
  readonly dt: number;
  readonly seed: number;
  /** The id of the level being played. */
  readonly level: number;
  /** Advances the sim by exactly one fixed tick, applying `commands` first. */
  step(commands?: readonly Command[]): void;
  /** Full serializable state. */
  snapshot(): SimSnapshot;
}

export interface SimOptions {
  readonly features: readonly Feature[];
  /** A fresh start: the seed and the level to start on. */
  readonly start?: { readonly seed: number; readonly level: number };
  /** Or the state to continue from. */
  readonly snapshot?: SimSnapshot;
}

/**
 * The single source of truth for the game. Holds every feature's state, the
 * rng and the tick counter, and advances them one fixed step at a time
 * through `step`. Internal to packages/sim: features and core see the class,
 * everyone else gets a SimHandle from `createSim`.
 */
export class Sim implements SimHandle {
  readonly dt: number = FIXED_DT;
  readonly seed: number;
  readonly features: readonly Feature[];
  tick: number;
  readonly rng: Rng;
  private levelId: number;
  private slices: Record<string, unknown>;

  constructor({ features, start, snapshot }: SimOptions) {
    this.features = features;
    assertUniqueSliceKeys(features);
    if (snapshot) {
      this.seed = snapshot.seed;
      this.tick = snapshot.tick;
      this.levelId = levelById(snapshot.level).id;
      this.rng = createRng(snapshot.rngState);
      this.slices = copyOfJson({ ...snapshot.slices });
      return;
    }
    if (!start) throw new TypeError('a sim needs either a start or a snapshot');
    this.seed = start.seed;
    this.tick = 0;
    this.rng = createRng(start.seed);
    this.levelId = levelById(start.level).id;
    this.slices = {};
    this.startLevel(start.level);
  }

  get level(): number {
    return this.levelId;
  }

  /** The level being played, as its data file has it. */
  get levelDef(): Level {
    return levelById(this.levelId);
  }

  /** The live value of a slice. Features read and change their state through this. */
  stateOf<T>(slice: StateSlice<T>): T {
    if (!(slice.key in this.slices)) throw new Error(`no slice "${slice.key}": is its feature registered in features/index.ts?`);
    return this.slices[slice.key] as T;
  }

  /** Replaces a slice's value, for slices that are a plain number or that a feature rebuilds whole. */
  setStateOf<T>(slice: StateSlice<T>, value: T): void {
    this.slices[slice.key] = value;
  }

  /**
   * Starts level `id`: every slice goes back to its initial value for that
   * level, except slices declared to carry across levels, then every
   * feature's `init` runs. Restarting a level after a death is
   * `startLevel(sim.level)`.
   */
  startLevel(id: number): void {
    const level = levelById(id);
    const previous = this.slices;
    this.levelId = level.id;
    this.slices = {};
    for (const feature of this.features) {
      for (const slice of feature.slices ?? []) {
        const carried = slice.carriesAcrossLevels && slice.key in previous;
        this.slices[slice.key] = carried ? previous[slice.key] : slice.initialFor(level);
      }
    }
    for (const feature of this.features) feature.init?.(this);
  }

  /**
   * Starts the game again from its first level with nothing kept: the slices that carry across levels go back to
   * their initial values too. The seed, the rng and the tick count go on, so a recorded game still replays.
   */
  startOver(): void {
    this.slices = {};
    this.startLevel(levels[0]!.id);
  }

  step(commands: readonly Command[] = []): void {
    const received: readonly unknown[] = Array.isArray(commands) ? commands : [];
    for (const command of received) {
      if (!isCommandShaped(command)) continue;
      for (const feature of this.features) feature.handleCommand?.(this, command);
    }
    for (const feature of this.features) feature.update?.(this);
    this.tick += 1;
  }

  snapshot(): SimSnapshot {
    return copyOfJson({ seed: this.seed, tick: this.tick, level: this.levelId, rngState: this.rng.state(), slices: this.slices });
  }
}

// ---- Helpers ----

function assertUniqueSliceKeys(features: readonly Feature[]): void {
  const seen = new Set<string>();
  for (const feature of features) {
    for (const slice of feature.slices ?? []) {
      if (seen.has(slice.key)) throw new Error(`two features claim the slice "${slice.key}"`);
      seen.add(slice.key);
    }
  }
}
