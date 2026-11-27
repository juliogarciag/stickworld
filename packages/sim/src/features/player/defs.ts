/**
 * How the stick man moves. Game feel lives here: change a number, never the
 * logic. Metres and seconds, y pointing down. The numbers a dev build can
 * change while the game runs are read through `MOVEMENT_PRESETS.current`
 * below, which is made from these: the 2 m jump the owner tuned in the
 * movement panel (#35).
 */
export const PLAYER = {
  /** How fast he walks, on the floor and in a jump. Falling off an edge it is the fastest the keys can make him go sideways. */
  walkSpeed: 2.2,
  /**
   * How fast a held key changes his sideways speed once he has walked off an edge, in metres per second squared. On the
   * floor and in a jump he is at walk speed at once; falling off an edge he starts with the speed he walked off with,
   * and this is high enough that a key turns him almost at once: from walking one way to the other in a tenth of a second.
   */
  airSteering: 100,
  /** How fast he slows down sideways with no key held once he has walked off an edge, in metres per second squared: he stops almost at once. */
  airBraking: 100,
  /** How high his feet get in a jump with the key held: a little over his own height. */
  jumpHeight: 2,
  /** How high his feet get in a jump with something held over his head: his hands are full, so it is a shorter one. The same as `jumpHeight` for a jump that carrying does not change. */
  jumpHeightCarrying: 0.7,
  /** How fast his rise slows, in metres per second squared: with `jumpHeight` it says how soon he is at the top. */
  riseGravity: 20,
  /** How fast he falls faster once he is going down, in metres per second squared. */
  fallGravity: 20,
  /** The fastest he falls, in metres per second. */
  fastestFall: 10,
  /** The share of his upward speed he loses when the jump key is let go while he rises: all of it, so a jump is as high as the key is held and a tap is a hop. */
  letGoCut: 1,
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
  /** In a fall off an edge, how fast a held key changes his sideways speed, in metres per second squared. */
  readonly airSteering: number;
  /** In a fall off an edge, how fast he slows down sideways with no key held, in metres per second squared: 0 drifts on. */
  readonly airBraking: number;
}

/** What the knobs move between: the sim ignores a value outside them. */
export const MOVEMENT_TUNING_LIMITS: { readonly [Name in keyof MovementTuning]: { readonly min: number; readonly max: number } } = {
  walkSpeed: { min: 0.5, max: 12 },
  jumpHeight: { min: 0.1, max: 8 },
  jumpHeightCarrying: { min: 0.1, max: 8 },
  riseGravity: { min: 2, max: 200 },
  fallGravity: { min: 2, max: 200 },
  fastestFall: { min: 1, max: 1000 },
  letGoCut: { min: 0, max: 1 },
  airSteering: { min: 0, max: 1000 },
  airBraking: { min: 0, max: 1000 },
};

/**
 * Ways to move that can be tried whole. `current` is the game as it is played: `PLAYER`, a jump a little over his
 * height, as high as the key is held, an even rise and fall to a fastest fall of 10 m/s, and steering in the air that
 * turns and stops him almost at once (the owner tuned it in the panel as `twoMetreJump`, #35). `smallJump` is the jump
 * the game had before it: well under his height, the same whether the key is held or tapped, and a fall off an edge
 * that keeps the speed he walked off with. `ninetiesPlatformer` is a jump like the platformers of the nineties: about
 * twice his height, a fast rise and a faster fall, and steering in the air that turns and stops him at once. It is
 * only tried, not played: its jump crosses the gaps of levels 2 and 3 on foot.
 */
export const MOVEMENT_PRESETS = {
  current: {
    walkSpeed: PLAYER.walkSpeed,
    jumpHeight: PLAYER.jumpHeight,
    jumpHeightCarrying: PLAYER.jumpHeightCarrying,
    riseGravity: PLAYER.riseGravity,
    fallGravity: PLAYER.fallGravity,
    fastestFall: PLAYER.fastestFall,
    letGoCut: PLAYER.letGoCut,
    airSteering: PLAYER.airSteering,
    airBraking: PLAYER.airBraking,
  },
  smallJump: {
    walkSpeed: 2.2,
    jumpHeight: 0.7,
    jumpHeightCarrying: 0.45,
    riseGravity: 22,
    fallGravity: 22,
    // Far faster than he ever falls before the level starts again: the small jump had no fastest fall.
    fastestFall: 1000,
    letGoCut: 0,
    airSteering: 6,
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
