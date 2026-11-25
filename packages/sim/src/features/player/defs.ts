/**
 * How the stick man moves. Game feel lives here: change a number, never the
 * logic. Metres and seconds, y pointing down. The numbers a dev build can
 * change while the game runs are read through `MOVEMENT_PRESETS.current`
 * below, which is made from these.
 */
export const PLAYER = {
  /** How fast he walks, on the floor and in a jump. Falling off an edge it is the fastest the keys can make him go sideways. */
  walkSpeed: 2.2,
  /**
   * How much the keys steer him once he has walked off an edge: the most his sideways speed changes, in metres per
   * second squared. On the floor and in a jump he is at walk speed at once; falling off an edge he keeps the speed
   * he walked off with, and a held key only changes it this fast. With no key held he drifts on as he was.
   */
  airSteering: 6,
  /** How high his feet get in a jump. A small jump: well under his own height. */
  jumpHeight: 0.7,
  /** How high his feet get in a jump with something held over his head: his hands are full, so it is a shorter one. The same as `jumpHeight` for a jump that carrying does not change. */
  jumpHeightCarrying: 0.45,
  /** How fast he falls faster, in metres per second squared. */
  gravity: 22,
  /** Forgiveness: a jump asked for this long before he lands still happens when he does. */
  jumpAskedEarlyWindow: 0.1,
  /** Forgiveness: a jump asked for this long after he walked off an edge still happens. */
  jumpAskedLateWindow: 0.1,
  /** How far below the level's lowest floor he falls before the level starts again. */
  fallBelowFloor: 6,
  /**
   * How far above his feet he is as wide as `STICK_MAN_WIDTH`, for the end of a floor line he drops past. Below it he
   * narrows to a point at his feet, which is all that stands on the line, so the end pushes him aside a little at a time.
   */
  fullWidthAbove: 0.5,
} as const;

/**
 * The numbers of how he walks, jumps and falls that can be changed while the game runs: the sim keeps them in the
 * `movementTuning` slice, so that a snapshot carries them and a recorded game replays with them (ADR 0006). Only dev
 * builds change them, with `'player/tuneMovement'`; a game nobody tunes plays `current`, which is `PLAYER` as it is.
 */
export interface MovementTuning {
  /** How fast he walks, on the floor and in a jump, in metres per second. */
  readonly walkSpeed: number;
  /** How high his feet get in a jump, in metres. */
  readonly jumpHeight: number;
  /** How high his feet get in a jump with something held over his head, in metres. */
  readonly jumpHeightCarrying: number;
  /** How fast his rise slows, in metres per second squared: with `jumpHeight` it says how soon he is at the top. */
  readonly riseGravity: number;
  /** How fast he falls faster once he is going down, in metres per second squared. */
  readonly fallGravity: number;
  /** The fastest he falls, in metres per second. */
  readonly fastestFall: number;
  /** The share of his upward speed he loses when the jump key is let go while he rises: 0 keeps it all, 1 ends the rise there and then. */
  readonly letGoCut: number;
  /** In a fall off an edge, how fast a held key changes his sideways speed, in metres per second squared (`PLAYER.airSteering`). */
  readonly airSteering: number;
  /** In a fall off an edge, how fast he slows down sideways with no key held, in metres per second squared: 0 drifts on. */
  readonly airBraking: number;
}

/** What the knobs move between: the sim ignores a value outside them. */
export const MOVEMENT_TUNING_LIMITS: { readonly [Name in keyof MovementTuning]: { readonly least: number; readonly most: number } } = {
  walkSpeed: { least: 0.5, most: 12 },
  jumpHeight: { least: 0.1, most: 8 },
  jumpHeightCarrying: { least: 0.1, most: 8 },
  riseGravity: { least: 2, most: 200 },
  fallGravity: { least: 2, most: 200 },
  fastestFall: { least: 1, most: 1000 },
  letGoCut: { least: 0, most: 1 },
  airSteering: { least: 0, most: 1000 },
  airBraking: { least: 0, most: 1000 },
};

/**
 * Ways to move that can be tried whole. `current` is the game as it is played. `ninetiesPlatformer` is a jump like
 * the platformers of the nineties: about twice his height, its height chosen by how long the key is held, a fast rise
 * and a faster fall, and steering in the air that turns and stops him at once. It is only tried, not played: its jump
 * crosses the gaps of levels 2 and 3 on foot.
 */
export const MOVEMENT_PRESETS = {
  current: {
    walkSpeed: PLAYER.walkSpeed,
    jumpHeight: PLAYER.jumpHeight,
    jumpHeightCarrying: PLAYER.jumpHeightCarrying,
    riseGravity: PLAYER.gravity,
    fallGravity: PLAYER.gravity,
    // Far faster than he ever falls before the level starts again: the current game has no fastest fall.
    fastestFall: 1000,
    letGoCut: 0,
    airSteering: PLAYER.airSteering,
    airBraking: 0,
  },
  ninetiesPlatformer: {
    walkSpeed: 5,
    jumpHeight: 3.6,
    jumpHeightCarrying: 2.4,
    riseGravity: 68,
    fallGravity: 80,
    fastestFall: 25,
    letGoCut: 1,
    airSteering: 1000,
    airBraking: 1000,
  },
} as const satisfies Record<string, MovementTuning>;

export type MovementPresetName = keyof typeof MOVEMENT_PRESETS;
