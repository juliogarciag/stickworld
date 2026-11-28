import type { ClubEnemyView } from '@stickworld/sim';
import { buildClubEnemyParts, buildClubEnemyStrokes } from './clubEnemy';
import type { Stroke, StrokePoint } from './strokes';
import { getRubbedOutSoFar, getWrittenSoFar } from './strokes/partly';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/**
 * TRYOUT (#44, comes out before merge): six ways the club enemy may go when the spear reaches it,
 * to be played and compared in a dev build. One will stay; the other five and the switch are then
 * taken out, and the one that stays is finished properly.
 *
 * All of it is drawing. The sim says only what it said before: the enemy was struck, is no longer
 * in anybody's way, and a moment later is off its list. What is left lying on the sheet after
 * that, where the club or the ball of paper comes to rest, and how long each takes are made up
 * here from the view's own clock, which a finished version would have to ask the sim for.
 */

/** The ways there are, in the order the switch goes through them. */
export const ENEMY_DEATHS = ['unfold', 'topple', 'crumple', 'tear', 'scribble', 'rubOut'] as const;
export type EnemyDeath = (typeof ENEMY_DEATHS)[number];

/** What each is called on screen. */
export const ENEMY_DEATH_WORDS: Readonly<Record<EnemyDeath, string>> = {
  unfold: 'it drops and unfolds',
  topple: 'it topples',
  crumple: 'it crumples',
  tear: 'it is torn',
  scribble: 'it is scribbled over',
  rubOut: 'it is rubbed out',
};

let selectedDeath: EnemyDeath = 'unfold';

/** The way that is tried right now. */
export function getEnemyDeath(): EnemyDeath {
  return selectedDeath;
}

/** Tries the next way, and after the last the first. Gives the one now tried. */
export function selectNextEnemyDeath(): EnemyDeath {
  selectedDeath = ENEMY_DEATHS[(ENEMY_DEATHS.indexOf(selectedDeath) + 1) % ENEMY_DEATHS.length]!;
  return selectedDeath;
}

/** Tries `death`. */
export function selectEnemyDeath(death: EnemyDeath): void {
  selectedDeath = death;
}

/** What a sheet shows its enemies with, every frame. */
export interface EnemiesFrame {
  /** The enemies as the sim has them right now. */
  readonly enemies: readonly ClubEnemyView[];
  /** The level they are on: what lies on one sheet does not lie on the next. */
  readonly level: number;
  /** How long ago the last frame was, and how long the sheet has been on top. */
  readonly seconds: number;
  readonly secondsOnSheet: number;
}

/**
 * Returns a function to call every frame with the enemies of a sheet. It gives the strokes that
 * draw them: one that is alive as it always was, one that was struck going the way that is tried,
 * and what it leaves lying there afterwards, for as long as the level does not start again.
 */
export function createEnemiesDrawing(): (frame: EnemiesFrame) => Stroke[] {
  const struck = new Map<string, { enemy: ClubEnemyView; seconds: number }>();
  let level: number | undefined;
  return (frame) => {
    if (frame.level !== level) {
      struck.clear();
      level = frame.level;
    }
    const strokes: Stroke[] = [];
    for (const enemy of frame.enemies) {
      const key = getPostKey(enemy);
      if (enemy.rubbedOutProgress === null) {
        // It is alive at this post: the level started again, and nothing of it lies there.
        struck.delete(key);
        strokes.push(...buildClubEnemyStrokes(enemy, frame.secondsOnSheet));
      } else if (!struck.has(key)) {
        struck.set(key, { enemy, seconds: 0 });
      }
    }
    const death = getEnemyDeath();
    for (const [key, entry] of struck) {
      entry.seconds += Number.isFinite(frame.seconds) ? frame.seconds : 0;
      const stillThere = frame.enemies.find((enemy) => getPostKey(enemy) === key);
      if (death !== 'rubOut') {
        strokes.push(...buildEnemyDeathStrokes(death, entry.enemy, entry.seconds));
      } else if (stillThere) {
        strokes.push(
          ...getRubbedOutSoFar(
            buildClubEnemyStrokes(stillThere, frame.secondsOnSheet),
            stillThere.rubbedOutProgress ?? 0,
          ),
        );
      }
    }
    return strokes;
  };
}

/**
 * The strokes of `enemy`, struck `seconds` ago, going the way `death` says, and of what it leaves
 * behind once that is over. In world pixels.
 */
export function buildEnemyDeathStrokes(
  death: Exclude<EnemyDeath, 'rubOut'>,
  enemy: ClubEnemyView,
  seconds: number,
): Stroke[] {
  const place = getPlace(enemy);
  if (death === 'unfold') {
    return buildUnfoldStrokes(enemy, place, seconds);
  }
  if (death === 'topple') {
    return buildToppleStrokes(enemy, place, seconds);
  }
  if (death === 'crumple') {
    return buildCrumpleStrokes(enemy, place, seconds);
  }
  if (death === 'tear') {
    return buildTearStrokes(enemy, place, seconds);
  }
  return buildScribbleStrokes(enemy, place, seconds);
}

// ---- Helpers ----

/** Seconds, and shares of the enemy's size. All of it is for trying, none of it is tuned. */
const TIMING = {
  /** How long it takes to stop floating and come down onto the floor line. */
  drop: 0.12,
  /** How long the club takes to fall from its hand to the floor. */
  clubFall: 0.45,
  unfold: 0.75,
  topple: 0.5,
  crumple: 0.3,
  ballFall: 0.22,
  ballRoll: 0.9,
  tear: 0.5,
  scribble: 0.4,
} as const;

/** Where an enemy is, in world pixels. */
interface Place {
  /** The x of its middle, the y of its underside and of the floor line under it. */
  readonly middle: number;
  readonly underside: number;
  readonly floor: number;
  readonly width: number;
  readonly height: number;
  /** 1 when the stick man that struck it is to its left, -1 when to its right. */
  readonly away: 1 | -1;
}

function getPlace(enemy: ClubEnemyView): Place {
  return {
    middle: convertToPixels(enemy.position.x),
    underside: convertToPixels(enemy.position.y),
    floor: convertToPixels(enemy.position.y + enemy.floatHeight),
    width: convertToPixels(enemy.width),
    height: convertToPixels(enemy.height),
    away: enemy.facing === 1 ? -1 : 1,
  };
}

/** One enemy from frame to frame: the stretch it guards is its own. */
function getPostKey(enemy: ClubEnemyView): string {
  return `${enemy.defId}:${enemy.guardedStretch.start}:${enemy.guardedStretch.end}`;
}

/**
 * 1. It drops and unfolds: a hollow paper box that stops floating, lets go of its club, and whose
 * sides fall open into the flat cross a box is folded from. Drawn a little from above, so that the
 * flat sheet is more than a line.
 */
function buildUnfoldStrokes(enemy: ClubEnemyView, place: Place, seconds: number): Stroke[] {
  const parts = buildClubEnemyParts(enemy);
  const stillUp = (place.floor - place.underside) * (1 - getShare(seconds, TIMING.drop));
  const open = smooth(getShare(seconds - TIMING.drop, TIMING.unfold));
  const turn = (open * Math.PI) / 2;
  const { width, height } = place;
  const depth = width;
  // The lid opens away from the stick man: `across` is how far that way, `up` above the floor,
  // `back` into the sheet.
  const getProjected = (across: number, up: number, back: number): StrokePoint => ({
    x: place.middle + place.away * across + back * 0.35,
    y: place.floor - stillUp - up - back * 0.22,
  });
  const buildPanel = (corners: readonly (readonly [number, number, number])[]): Stroke => ({
    points: corners.map(([across, up, back]) => getProjected(across, up, back)),
    thickness: PENCIL.thickness,
    isClosed: true,
  });
  const half = width / 2;
  const lean = height * Math.sin(turn);
  const rise = height * Math.cos(turn);
  const lidStart = { across: half + lean, up: rise };
  const lidEnd = {
    across: lidStart.across - width * Math.cos(Math.PI * open),
    up: lidStart.up + width * Math.sin(Math.PI * open),
  };
  const face = parts.face.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => {
      const across = (point.x - place.middle) * place.away;
      const up = place.underside - point.y;
      return getProjected(across, up * Math.cos(turn), -up * Math.sin(turn));
    }),
  }));
  return [
    buildPanel([
      [-half, 0, 0],
      [half, 0, 0],
      [half, 0, depth],
      [-half, 0, depth],
    ]),
    buildPanel([
      [-half, 0, depth],
      [half, 0, depth],
      [half, rise, depth + lean],
      [-half, rise, depth + lean],
    ]),
    buildPanel([
      [-half, 0, 0],
      [-half, 0, depth],
      [-half - lean, rise, depth],
      [-half - lean, rise, 0],
    ]),
    buildPanel([
      [half, 0, 0],
      [half, 0, depth],
      [half + lean, rise, depth],
      [half + lean, rise, 0],
    ]),
    buildPanel([
      [lidStart.across, lidStart.up, 0],
      [lidStart.across, lidStart.up, depth],
      [lidEnd.across, lidEnd.up, depth],
      [lidEnd.across, lidEnd.up, 0],
    ]),
    buildPanel([
      [-half, 0, 0],
      [half, 0, 0],
      [half, rise, -lean],
      [-half, rise, -lean],
    ]),
    ...face,
    ...buildFallingClub(parts.club, enemy, {
      place,
      seconds,
      restAhead: -place.away * (half + convertToPixels(0.35)),
      hop: 0,
    }),
  ];
}

/**
 * 2. It topples: it comes down, tips over backwards, away from the stick man, and lies there with
 * crosses for eyes; the club is thrown clear and comes to rest further on.
 */
function buildToppleStrokes(enemy: ClubEnemyView, place: Place, seconds: number): Stroke[] {
  const parts = buildClubEnemyParts(enemy);
  const drop = (place.floor - place.underside) * getShare(seconds, TIMING.drop);
  const tipped = getShare(seconds - TIMING.drop * 0.6, TIMING.topple);
  const angle = place.away * (Math.PI / 2) * tipped * tipped;
  const pivot = { x: place.middle + (place.away * place.width) / 2, y: place.floor };
  // Nothing of it goes through the floor line: what would is laid along it.
  const moveOver = (point: StrokePoint): StrokePoint => {
    const turned = turnAbout({ x: point.x, y: point.y + drop }, pivot, angle);
    return { x: turned.x, y: Math.min(turned.y, place.floor - PENCIL.thickness) };
  };
  const [oneEye, otherEye, ...mouth] = parts.face;
  const eyes = [oneEye, otherEye].flatMap((eye) => (eye ? buildCross(eye) : []));
  return [
    ...[...parts.body, ...eyes, ...mouth, ...parts.arm].map((stroke) =>
      moveStroke(stroke, moveOver),
    ),
    ...buildFallingClub(parts.club, enemy, {
      place,
      seconds,
      restAhead: place.away * (place.width / 2 + place.height + convertToPixels(0.7)),
      hop: convertToPixels(0.9),
    }),
  ];
}

/**
 * 3. It crumples: it is scrunched into a small ball of paper, which drops and rolls a little way
 * away from the stick man; the club falls where it was held.
 */
function buildCrumpleStrokes(enemy: ClubEnemyView, place: Place, seconds: number): Stroke[] {
  const parts = buildClubEnemyParts(enemy);
  const centre = { x: place.middle, y: place.underside - place.height / 2 };
  const radius = place.width * 0.24;
  const club = buildFallingClub(parts.club, enemy, {
    place,
    seconds,
    restAhead: -place.away * (place.width / 2 + convertToPixels(0.3)),
    hop: 0,
  });
  if (seconds < TIMING.crumple) {
    const scrunched = getShare(seconds, TIMING.crumple);
    const size = 1 - 0.72 * scrunched;
    const jitter = place.height * 0.13 * scrunched;
    const body = [...parts.body, ...parts.face].map((stroke, strokeIndex) => ({
      ...stroke,
      points: stroke.points.map((point, pointIndex) => ({
        x:
          centre.x +
          (point.x - centre.x) * size +
          (getNoise(strokeIndex * 31 + pointIndex) - 0.5) * 2 * jitter,
        y:
          centre.y +
          (point.y - centre.y) * size +
          (getNoise(strokeIndex * 57 + pointIndex + 7) - 0.5) * 2 * jitter,
      })),
    }));
    return [...body, ...club];
  }
  const fallen = getShare(seconds - TIMING.crumple, TIMING.ballFall);
  const rolled = getShare(seconds - TIMING.crumple - TIMING.ballFall * 0.5, TIMING.ballRoll);
  const distance = convertToPixels(0.95) * (1 - (1 - rolled) * (1 - rolled));
  const ball = {
    x: centre.x + place.away * distance,
    y: centre.y + (place.floor - radius - centre.y) * fallen * fallen,
  };
  const spin = (place.away * distance) / radius;
  const corners = Array.from({ length: BALL_CORNERS }, (_, corner) => {
    const angle = (corner / BALL_CORNERS) * Math.PI * 2 + spin;
    const reach = radius * (0.72 + 0.4 * getNoise(corner + 3));
    return { x: ball.x + Math.cos(angle) * reach, y: ball.y + Math.sin(angle) * reach };
  });
  const creases = [
    [0, 4],
    [2, 7],
    [5, 9],
    [8, 1],
  ].map(([start, end]) => ({
    points: [corners[start!]!, movePartWay(corners[start!]!, corners[end!]!, 0.7)],
    thickness: PENCIL.thickness * 0.6,
  }));
  return [{ points: corners, thickness: PENCIL.thickness, isClosed: true }, ...creases, ...club];
}

const BALL_CORNERS = 11;

/**
 * 4. It is torn: it splits along a jagged line at its mouth. The lower half comes down and stays;
 * the upper half falls off away from the stick man and lies beside it. The club falls.
 */
function buildTearStrokes(enemy: ClubEnemyView, place: Place, seconds: number): Stroke[] {
  const parts = buildClubEnemyParts(enemy);
  const tearLine = place.underside - place.height * 0.36;
  const whole = [...parts.body, ...parts.face, ...parts.arm];
  const jagged: Stroke = {
    points: Array.from({ length: TEAR_TEETH * 2 + 1 }, (_, tooth) => ({
      x: place.middle - place.width / 2 + (place.width * tooth) / (TEAR_TEETH * 2),
      y: tearLine + (tooth % 2 === 0 ? -1 : 1) * place.height * 0.035,
    })),
    thickness: PENCIL.thickness,
  };
  const drop = (place.floor - place.underside) * getShare(seconds, TIMING.drop);
  const moveDown = (point: StrokePoint): StrokePoint => ({ x: point.x, y: point.y + drop });
  const fallen = getShare(seconds - TIMING.drop * 0.5, TIMING.tear);
  const pivot = { x: place.middle + (place.away * place.width) / 2, y: tearLine };
  const moveOffTop = (point: StrokePoint): StrokePoint => {
    const turned = turnAbout(point, pivot, place.away * 1.75 * fallen * fallen);
    return {
      x: turned.x + place.away * place.width * 0.3 * fallen,
      y: Math.min(
        turned.y + (place.floor - tearLine) * fallen * fallen,
        place.floor - PENCIL.thickness,
      ),
    };
  };
  return [
    ...[...whole.flatMap((stroke) => cutStroke(stroke, tearLine, 'below')), jagged].map((stroke) =>
      moveStroke(stroke, moveDown),
    ),
    ...[...whole.flatMap((stroke) => cutStroke(stroke, tearLine, 'above')), jagged].map((stroke) =>
      moveStroke(stroke, moveOffTop),
    ),
    ...buildFallingClub(parts.club, enemy, {
      place,
      seconds,
      restAhead: -place.away * (place.width / 2 + convertToPixels(0.35)),
      hop: 0,
    }),
  ];
}

const TEAR_TEETH = 5;

/**
 * 5. It is scribbled over: it comes down and stays where it stood, drawn faint, under a heavy
 * scribble of the pencil. The club falls.
 */
function buildScribbleStrokes(enemy: ClubEnemyView, place: Place, seconds: number): Stroke[] {
  const parts = buildClubEnemyParts(enemy);
  const drop = (place.floor - place.underside) * getShare(seconds, TIMING.drop);
  const moveDown = (point: StrokePoint): StrokePoint => ({ x: point.x, y: point.y + drop });
  const faint = [...parts.body, ...parts.face, ...parts.arm].map((stroke) => ({
    ...moveStroke(stroke, moveDown),
    thickness: stroke.thickness * 0.4,
  }));
  const top = place.underside - place.height + drop;
  const scribble: Stroke = {
    points: Array.from({ length: SCRIBBLE_PASSES + 1 }, (_, pass) => ({
      x:
        place.middle +
        (pass % 2 === 0 ? -1 : 1) * place.width * (0.5 + 0.14 * getNoise(pass + 11)) +
        place.width * 0.08 * (getNoise(pass + 23) - 0.5),
      y: top + (place.height * pass) / SCRIBBLE_PASSES + place.height * 0.04 * getNoise(pass),
    })),
    thickness: PENCIL.thickness * 1.7,
  };
  return [
    ...faint,
    ...getWrittenSoFar([scribble], getShare(seconds - TIMING.drop, TIMING.scribble)),
    ...buildFallingClub(parts.club, enemy, {
      place,
      seconds,
      restAhead: -place.away * (place.width / 2 + convertToPixels(0.35)),
      hop: 0,
    }),
  ];
}

const SCRIBBLE_PASSES = 13;

/**
 * The club let go of: it falls from where it was held to lie on the floor, `restAhead` pixels from
 * the enemy's middle, with a `hop` on the way when it is thrown.
 */
function buildFallingClub(
  club: readonly Stroke[],
  enemy: ClubEnemyView,
  fall: { place: Place; seconds: number; restAhead: number; hop: number },
): Stroke[] {
  const grip = { x: convertToPixels(enemy.club.grip.x), y: convertToPixels(enemy.club.grip.y) };
  const tip = { x: convertToPixels(enemy.club.tip.x), y: convertToPixels(enemy.club.tip.y) };
  const heldAngle = Math.atan2(tip.y - grip.y, tip.x - grip.x);
  // It lies with its end pointing on from the enemy, so that it does not lie across it.
  const lyingAngle = fall.restAhead > 0 ? 0 : Math.PI;
  // The shorter way round to lying flat.
  const turn = Math.atan2(Math.sin(lyingAngle - heldAngle), Math.cos(lyingAngle - heldAngle));
  const fallen = getShare(fall.seconds, fall.hop > 0 ? TIMING.clubFall * 1.4 : TIMING.clubFall);
  const rest = {
    x: fall.place.middle + fall.restAhead,
    y: fall.place.floor - convertToPixels(enemy.club.thickness) / 2,
  };
  const gripNow = {
    x: grip.x + (rest.x - grip.x) * fallen,
    y: grip.y + (rest.y - grip.y) * fallen * fallen - fall.hop * Math.sin(Math.PI * fallen),
  };
  return club.map((stroke) =>
    moveStroke(stroke, (point) => {
      const turned = turnAbout(point, grip, turn * fallen);
      return { x: turned.x + gripNow.x - grip.x, y: turned.y + gripNow.y - grip.y };
    }),
  );
}

/** An eye as a cross: two lines through where it was, as big as it was. */
function buildCross(eye: Stroke): Stroke[] {
  const xs = eye.points.map((point) => point.x);
  const ys = eye.points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return [
    {
      points: [
        { x: left, y: top },
        { x: right, y: bottom },
      ],
      thickness: eye.thickness,
    },
    {
      points: [
        { x: right, y: top },
        { x: left, y: bottom },
      ],
      thickness: eye.thickness,
    },
  ];
}

/**
 * The parts of `stroke` on one side of the level line `y`: `above` it or `below` it on the page.
 * A loop is cut open.
 */
function cutStroke(stroke: Stroke, y: number, side: 'above' | 'below'): Stroke[] {
  const isLoop = stroke.isClosed && stroke.points.length > 2;
  const path = isLoop ? [...stroke.points, stroke.points[0]!] : stroke.points;
  const isKept = (point: StrokePoint): boolean => (side === 'above' ? point.y <= y : point.y >= y);
  const pieces: StrokePoint[][] = [];
  let piece: StrokePoint[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index]!;
    const previous = path[index - 1];
    const doesCross = previous !== undefined && isKept(previous) !== isKept(point);
    if (doesCross) {
      const crossing = movePartWay(previous, point, (y - previous.y) / (point.y - previous.y));
      piece.push(crossing);
      if (isKept(previous)) {
        pieces.push(piece);
        piece = [];
      }
    }
    if (isKept(point)) {
      piece.push(point);
    }
  }
  pieces.push(piece);
  return pieces
    .filter((points) => points.length > 1)
    .map((points) => ({ points, thickness: stroke.thickness }));
}

function moveStroke(stroke: Stroke, move: (point: StrokePoint) => StrokePoint): Stroke {
  return { ...stroke, points: stroke.points.map(move) };
}

/** `point` turned about `centre` by `angle` radians, clockwise on the page. */
function turnAbout(point: StrokePoint, centre: StrokePoint, angle: number): StrokePoint {
  const x = point.x - centre.x;
  const y = point.y - centre.y;
  return {
    x: centre.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: centre.y + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

function movePartWay(start: StrokePoint, end: StrokePoint, share: number): StrokePoint {
  return { x: start.x + (end.x - start.x) * share, y: start.y + (end.y - start.y) * share };
}

/** How much of `duration` has gone by after `seconds`, from 0 to 1. */
function getShare(seconds: number, duration: number): number {
  return Math.max(0, Math.min(1, seconds / duration));
}

/** `share` from 0 to 1, starting and ending gently (smoothstep). */
function smooth(share: number): number {
  return share * share * (3 - 2 * share);
}

/** A number from 0 to 1 that is always the same for the same `seed`: no two creases alike. */
function getNoise(seed: number): number {
  const wave = Math.sin(seed * 12.9898) * 43758.5453;
  return wave - Math.floor(wave);
}
