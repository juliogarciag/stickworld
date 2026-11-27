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
  /** True while `step` runs the features: a level is not started then, only asked for. */
  private inATick = false;
  /** What a feature asked for during the tick being run, or null. Always null between two ticks, so it is not game state. */
  private askedDuringTick: LevelStartAsked | null = null;
  /** True while a level is being started: until every feature's `init` has run, another start cannot begin. */
  private startingALevel = false;

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

  /** True while a level is being started: its slices hold their first values and the features' `init` are running. */
  get isStartingALevel(): boolean {
    return this.startingALevel;
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
   * Starts level `id` now: every slice goes back to its initial value for
   * that level, except slices declared to carry across levels, then every
   * feature's `init` runs. For what sets a sim up between two ticks (a test,
   * `createSim`). A feature asks with `startLevelAfterThisTick` instead: in
   * the middle of a tick this throws, because the features later in the list
   * would run the rest of the tick on a level that has only just begun.
   */
  startLevel(id: number): void {
    if (this.inATick) throw new Error('a level cannot start in the middle of a tick: ask with startLevelAfterThisTick');
    this.refuseWhileALevelStarts();
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
    this.startingALevel = true;
    try {
      for (const feature of this.features) feature.init?.(this);
    } finally {
      this.startingALevel = false;
    }
  }

  /**
   * Starts the game again from its first level with nothing kept: the slices that carry across levels go back to
   * their initial values too. The seed, the rng and the tick count go on, so a recorded game still replays.
   */
  startOver(): void {
    if (this.inATick) throw new Error('the game cannot start over in the middle of a tick: ask with startOverAfterThisTick');
    this.refuseWhileALevelStarts();
    this.slices = {};
    this.startLevel(levels[0]!.id);
  }

  /**
   * Asks for level `id` to start once every feature has had this tick: how a feature restarts the level after a death
   * (`sim.level`) or moves on to the next one. Until the tick ends every feature still sees the level as it was. When
   * more than one thing is asked for in a tick, starting over beats another level, which beats the level being played
   * again; of two different other levels the first asked for is kept. Asked for between two ticks (a test), it starts at
   * once. A feature's `init` cannot ask: a level that is being started is not started again half way, and this throws.
   */
  startLevelAfterThisTick(id: number): void {
    this.refuseWhileALevelStarts();
    const asked: LevelStartAsked = { level: levelById(id).id, withNothingKept: false };
    if (this.askedDuringTick === null || comesBefore(asked, this.askedDuringTick, this.levelId)) this.askedDuringTick = asked;
    if (!this.inATick) this.startWhatWasAsked();
  }

  /**
   * Asks for the game to start again from its first level with nothing kept, once every feature has had this tick; at
   * once when asked for between two ticks. The commands that come after it in the same tick are still handled on the
   * game that is ending, and are gone with it.
   */
  startOverAfterThisTick(): void {
    this.refuseWhileALevelStarts();
    this.askedDuringTick = { level: levels[0]!.id, withNothingKept: true };
    if (!this.inATick) this.startWhatWasAsked();
  }

  step(commands: readonly Command[] = []): void {
    const received: readonly unknown[] = Array.isArray(commands) ? commands : [];
    this.inATick = true;
    let finished = false;
    try {
      for (const command of received) {
        if (!isCommandShaped(command)) continue;
        for (const feature of this.features) feature.handleCommand?.(this, command);
      }
      for (const feature of this.features) feature.update?.(this);
      finished = true;
    } finally {
      this.inATick = false;
      // Nothing is left over from a tick that threw after a feature had asked.
      if (!finished) this.askedDuringTick = null;
    }
    this.startWhatWasAsked();
    this.tick += 1;
  }

  private refuseWhileALevelStarts(): void {
    if (this.startingALevel) throw new Error('a level is being started: a feature\'s init cannot start another, or ask for one');
  }

  private startWhatWasAsked(): void {
    const asked = this.askedDuringTick;
    this.askedDuringTick = null;
    if (asked === null) return;
    if (asked.withNothingKept) this.startOver();
    else this.startLevel(asked.level);
  }

  snapshot(): SimSnapshot {
    return copyOfJson({ seed: this.seed, tick: this.tick, level: this.levelId, rngState: this.rng.state(), slices: this.slices });
  }
}

// ---- Helpers ----

/** A level to start when the tick is over: `withNothingKept` is the game starting over, which resets the slices that carry too. */
interface LevelStartAsked {
  readonly level: number;
  readonly withNothingKept: boolean;
}

/** True when `asked` is to be done instead of `other`, asked for earlier in the same tick on level `playing`. */
function comesBefore(asked: LevelStartAsked, other: LevelStartAsked, playing: number): boolean {
  if (other.withNothingKept) return false;
  return asked.level !== playing && other.level === playing;
}

function assertUniqueSliceKeys(features: readonly Feature[]): void {
  const seen = new Set<string>();
  for (const feature of features) {
    for (const slice of feature.slices ?? []) {
      if (seen.has(slice.key)) throw new Error(`two features claim the slice "${slice.key}"`);
      seen.add(slice.key);
    }
  }
}
