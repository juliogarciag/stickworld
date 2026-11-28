import type { EnemyDef } from '../defs';

/**
 * The club enemy's own numbers, on top of what every enemy has (`EnemyDef`): how it winds up,
 * swings and lifts its club again, and the club itself. Metres, seconds and radians. An angle is
 * measured at its shoulder from straight ahead, the way it faces: positive is up, a quarter turn
 * is straight up, more than that is behind it.
 */
export interface ClubEnemyDef extends EnemyDef {
  /**
   * How near the stick man has to be, middle to middle, for it to stop and wind up, in metres:
   * well inside the reach of its club.
   */
  readonly swingDistance: number;
  /**
   * How long the club takes to go back before a swing, in seconds: what the player sees coming and
   * has this long to get away from.
   */
  readonly windUpSeconds: number;
  /** How long the club takes from behind it, over the top and down in front, in seconds. */
  readonly swingSeconds: number;
  /**
   * How long it takes to lift the club again after a swing, in seconds. It neither moves nor
   * strikes meanwhile: the time the player has to get past it.
   */
  readonly recoverSeconds: number;
  readonly club: ClubDef;
}

/**
 * What a club enemy is doing: `waiting` where it is, `approaching` the stick man it sees,
 * `windingUp` with its club going back, `swinging` it over the top and down, `recovering` while it
 * lifts the club again.
 */
export type ClubEnemyAction = 'waiting' | 'approaching' | 'windingUp' | 'swinging' | 'recovering';

/** The club a club enemy holds, and the arc it swings it through. */
export interface ClubDef {
  /** How high above its underside its shoulder is, in metres. The shoulder is over its middle. */
  readonly shoulderHeight: number;
  /** From its shoulder to its hand, in metres. The arm does not hurt. */
  readonly armLength: number;
  /** From its hand to the end of the club, in metres: the part that hurts. */
  readonly length: number;
  /** How thick the club is, in metres. */
  readonly thickness: number;
  /** Where it holds the club while it waits and moves: up in front of it. */
  readonly restAngle: number;
  /** Where the wind-up takes the club: up behind it. */
  readonly raisedAngle: number;
  /** Where the swing ends: down in front of it, the end of the club at the floor. */
  readonly downAngle: number;
  /**
   * How many places along the tick's part of the arc the club is tested at, each tick of a swing:
   * the end of the club moves most of a stick man's width in one tick, and must not skip it.
   */
  readonly stepsPerTick: number;
}

export const CLUB_ENEMY_ID = 500;

/**
 * The club enemy: a box that floats just above the floor with a club in its hand. It is slower
 * than the stick man and slow to lift its club again, and what it guards is got past by making it
 * swing at nothing and jumping over it before the club is up. The numbers are tuned together,
 * and `clubEnemy.test.ts` holds what they must add up to:
 * - walking away the moment the club goes back gets the stick man out of its reach
 *   (`swingDistance`, `windUpSeconds` and the club's length against the stick man's walk speed);
 * - a jump over it during a swing is caught, because the arc reaches higher than the stick man
 *   jumps (`shoulderHeight`, `armLength` and `length` against the 2 m jump);
 * - its body is low and narrow enough to jump over (`height`, `floatHeight`, `width`);
 * - the time from the end of a swing to the next one is long enough to run in, jump over it and
 *   get out of reach on the far side (`recoverSeconds` and `windUpSeconds`).
 */
export const clubEnemyDef: ClubEnemyDef = {
  id: CLUB_ENEMY_ID,
  name: 'club enemy',
  width: 0.8,
  height: 1.2,
  floatHeight: 0.1,
  sightDistance: 5,
  sightHeight: 3,
  speed: 1.4,
  guardedStretch: 3,
  swingDistance: 1.2,
  windUpSeconds: 0.7,
  swingSeconds: 0.18,
  recoverSeconds: 2,
  club: {
    shoulderHeight: 0.75,
    armLength: 0.55,
    length: 0.95,
    thickness: 0.26,
    restAngle: 1.1,
    raisedAngle: 2.6,
    downAngle: -0.6,
    stepsPerTick: 4,
  },
};

/** The club enemy's def when `defId` is a club enemy's, or undefined for any other kind. */
export function findClubEnemyDef(defId: number): ClubEnemyDef | undefined {
  return defId === CLUB_ENEMY_ID ? clubEnemyDef : undefined;
}
