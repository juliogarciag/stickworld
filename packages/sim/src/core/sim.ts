import { getLevelById, levels } from '../content/levels';
import type { Level } from '../content/levels/types';
import { FIXED_DT } from '../content/tuning';
import { isCommandShaped, type Command } from './commands';
import type { Feature } from './feature';
import { createRng, type Rng } from './rng';
import type { StateSlice } from './slice';
import { copyJson, type SimSnapshot } from './snapshot';

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
  takeSnapshot(): SimSnapshot;
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
  /** True while `step` runs the features: a level is not started then, only asked for. */
  private isInTick = false;
  /**
   * What a feature asked for during the tick being run, or null. Always null between two ticks, so
   * it is not game state.
   */
  private requestedDuringTick: LevelStartRequest | null = null;
  /**
   * True while a level is being started: until every feature's `init` has run, another start cannot
   * begin.
   */
  private isLevelStartInProgress = false;

  constructor(options: SimOptions) {
    this.features = options.features;
    assertUniqueSliceKeys(options.features);
    if (options.snapshot) {
      this.seed = options.snapshot.seed;
      this.tick = options.snapshot.tick;
      this.levelId = getLevelById(options.snapshot.level).id;
      this.rng = createRng(options.snapshot.rngState);
      this.slices = copyJson({ ...options.snapshot.slices });
      return;
    }
    if (!options.start) {
      throw new TypeError('a sim needs either a start or a snapshot');
    }
    this.seed = options.start.seed;
    this.tick = 0;
    this.rng = createRng(options.start.seed);
    this.levelId = getLevelById(options.start.level).id;
    this.slices = {};
    this.startLevel(options.start.level);
  }

  get level(): number {
    return this.levelId;
  }

  /** The level being played, as its data file has it. */
  get levelDef(): Level {
    return getLevelById(this.levelId);
  }

  /** The live value of a slice. Features read and change their state through this. */
  getStateOf<T>(slice: StateSlice<T>): T {
    if (!(slice.key in this.slices)) {
      throw new Error(`no slice "${slice.key}": is its feature registered in features/index.ts?`);
    }
    return this.slices[slice.key] as T;
  }

  /**
   * Replaces a slice's value, for slices that are a plain number or that a feature rebuilds whole.
   */
  setStateOf<T>(slice: StateSlice<T>, value: T): void {
    this.slices[slice.key] = value;
  }

  /**
   * Starts level `id` now: every slice goes back to its initial value for
   * that level, except slices declared to carry across levels, then every
   * feature's `init` runs. For what sets a sim up between two ticks (a test,
   * `createSim`). A feature asks with `startLevelAfterThisTick` instead: in
   * the middle of a tick this throws, because the features later in the list
   * would run the rest of the tick on a level that has only just begun.
   */
  startLevel(id: number): void {
    if (this.isInTick) {
      throw new Error(
        'a level cannot start in the middle of a tick: ask with startLevelAfterThisTick',
      );
    }
    this.refuseDuringLevelStart();
    const level = getLevelById(id);
    const previous = this.slices;
    this.levelId = level.id;
    this.slices = {};
    for (const feature of this.features) {
      for (const slice of feature.slices ?? []) {
        const isCarried = slice.isCarriedAcrossLevels && slice.key in previous;
        this.slices[slice.key] = isCarried ? previous[slice.key] : slice.getInitialFor(level);
      }
    }
    this.isLevelStartInProgress = true;
    try {
      for (const feature of this.features) {
        feature.init?.(this);
      }
    } finally {
      this.isLevelStartInProgress = false;
    }
  }

  /**
   * Starts the game again from its first level with nothing kept: the slices that carry across
   * levels go back to their initial values too. The seed, the rng and the tick count go on, so a
   * recorded game still replays.
   */
  startOver(): void {
    if (this.isInTick) {
      throw new Error(
        'the game cannot start over in the middle of a tick: ask with startOverAfterThisTick',
      );
    }
    this.refuseDuringLevelStart();
    this.slices = {};
    this.startLevel(levels[0]!.id);
  }

  /**
   * Asks for level `id` to start once every feature has had this tick: how a feature restarts the
   * level after a death (`sim.level`) or moves on to the next one. Until the tick ends every
   * feature still sees the level as it was. When more than one thing is asked for in a tick,
   * starting over beats another level, which beats the level being played again; of two different
   * other levels the first asked for is kept. Asked for between two ticks (a test), it starts at
   * once. A feature's `init` cannot ask: a level that is being started is not started again half
   * way, and this throws.
   */
  startLevelAfterThisTick(id: number): void {
    this.refuseDuringLevelStart();
    const asked: LevelStartRequest = { level: getLevelById(id).id, shouldKeepNothing: false };
    const shouldReplaceRequest =
      this.requestedDuringTick === null ||
      shouldComeBefore(asked, this.requestedDuringTick, this.levelId);
    if (shouldReplaceRequest) {
      this.requestedDuringTick = asked;
    }
    if (!this.isInTick) {
      this.startRequestedLevel();
    }
  }

  /**
   * Asks for the game to start again from its first level with nothing kept, once every feature has
   * had this tick; at once when asked for between two ticks. The commands that come after it in the
   * same tick are still handled on the game that is ending, and are gone with it.
   */
  startOverAfterThisTick(): void {
    this.refuseDuringLevelStart();
    this.requestedDuringTick = { level: levels[0]!.id, shouldKeepNothing: true };
    if (!this.isInTick) {
      this.startRequestedLevel();
    }
  }

  step(commands: readonly Command[] = []): void {
    const received: readonly unknown[] = Array.isArray(commands) ? commands : [];
    this.isInTick = true;
    let isFinished = false;
    try {
      for (const command of received) {
        if (!isCommandShaped(command)) {
          continue;
        }
        for (const feature of this.features) {
          feature.handleCommand?.(this, command);
        }
      }
      for (const feature of this.features) {
        feature.update?.(this);
      }
      isFinished = true;
    } finally {
      this.isInTick = false;
      // Nothing is left over from a tick that threw after a feature had asked.
      if (!isFinished) {
        this.requestedDuringTick = null;
      }
    }
    this.startRequestedLevel();
    this.tick += 1;
  }

  private refuseDuringLevelStart(): void {
    if (this.isLevelStartInProgress) {
      throw new Error(
        "a level is being started: a feature's init cannot start another, or ask for one",
      );
    }
  }

  private startRequestedLevel(): void {
    const asked = this.requestedDuringTick;
    this.requestedDuringTick = null;
    if (asked === null) {
      return;
    }
    if (asked.shouldKeepNothing) {
      this.startOver();
    } else {
      this.startLevel(asked.level);
    }
  }

  takeSnapshot(): SimSnapshot {
    return copyJson({
      seed: this.seed,
      tick: this.tick,
      level: this.levelId,
      rngState: this.rng.getState(),
      slices: this.slices,
    });
  }
}

// ---- Helpers ----

/**
 * A level to start when the tick is over: `shouldKeepNothing` is the game starting over, which
 * resets the slices that carry too.
 */
interface LevelStartRequest {
  readonly level: number;
  readonly shouldKeepNothing: boolean;
}

/**
 * True when `asked` is to be done instead of `other`, asked for earlier in the same tick on level
 * `playing`.
 */
function shouldComeBefore(
  asked: LevelStartRequest,
  other: LevelStartRequest,
  playing: number,
): boolean {
  if (other.shouldKeepNothing) {
    return false;
  }
  return asked.level !== playing && other.level === playing;
}

function assertUniqueSliceKeys(features: readonly Feature[]): void {
  const seen = new Set<string>();
  for (const feature of features) {
    for (const slice of feature.slices ?? []) {
      if (seen.has(slice.key)) {
        throw new Error(`two features claim the slice "${slice.key}"`);
      }
      seen.add(slice.key);
    }
  }
}
