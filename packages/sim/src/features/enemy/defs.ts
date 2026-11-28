import type { Def } from '../../content/defs';

/**
 * The enemies: things that guard a stretch of floor and hurt the stick man. Ids 500-599 are this
 * feature's block in content/defs.ts. Another kind of enemy is another entry in `enemyDefs`.
 *
 * Every number of how an enemy looks for the stick man, moves and strikes is here: change a
 * number, never the logic. Metres, seconds and radians. An angle is measured at the enemy's
 * shoulder from straight ahead, the way it faces: positive is up, a quarter turn is straight up,
 * more than that is behind it.
 */
export interface EnemyDef extends Def {
  /** How wide its body is, in metres. The stick man cannot walk through it. */
  readonly width: number;
  /** How tall its body is, in metres: low enough for the stick man's jump to clear. */
  readonly height: number;
  /** How far above the floor line its underside floats, in metres. */
  readonly floatHeight: number;
  /** How far to either side it sees the stick man, in metres from its middle. */
  readonly sightDistance: number;
  /**
   * How far above or below its underside the stick man's feet may be for it to see the stick man,
   * in metres: more than a jump, less than a fall down a gap or a flight high overhead.
   */
  readonly sightHeight: number;
  /** How fast it moves along the floor towards the stick man, in metres per second. */
  readonly speed: number;
  /**
   * How far to either side of where the level put it it goes, in metres: the stretch it guards.
   * It never leaves it, and never leaves its floor line.
   */
  readonly guardedStretch: number;
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

/** The club an enemy holds, and the arc it swings it through. */
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
 * and `enemy.test.ts` holds what they must add up to:
 * - walking away the moment the club goes back gets the stick man out of its reach
 *   (`swingDistance`, `windUpSeconds` and the club's length against the stick man's walk speed);
 * - a jump over it during a swing is caught, because the arc reaches higher than the stick man
 *   jumps (`shoulderHeight`, `armLength` and `length` against the 2 m jump);
 * - its body is low and narrow enough to jump over (`height`, `floatHeight`, `width`);
 * - the time from the end of a swing to the next one is long enough to run in, jump over it and
 *   get out of reach on the far side (`recoverSeconds` and `windUpSeconds`).
 */
export const clubEnemyDef: EnemyDef = {
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

export const enemyDefs: readonly EnemyDef[] = [clubEnemyDef];

/** The enemy def with this id, or undefined when `defId` is not an enemy's. */
export function findEnemyDef(defId: number): EnemyDef | undefined {
  return enemyDefs.find((def) => def.id === defId);
}
