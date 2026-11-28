import type { ClubEnemyView } from '@stickworld/sim';
import { buildClubEnemyParts } from './clubEnemy';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/**
 * The club enemy that the spear reached, as pencil strokes: it is torn in two along a jagged line
 * at its mouth. The lower half comes down onto the floor line and stays; the upper half falls off
 * away from the stick man and lies beside it; the club falls from its hand. They lie there for a
 * moment, and then each falls off the sheet: it tips over the floor line and tumbles down out of
 * view, one after the other, as things that fall in this game are lost. That it is torn, which of
 * the three it is at and how far along are the sim's (`enemy.torn`); where the halves come to lie
 * and how they tumble off are how it looks, decided here.
 */

/**
 * The strokes of `enemy`, which is torn, in world pixels. The same strokes in the same order for
 * as long as it is there, so that none of them wobbles anew as the halves move.
 */
export function buildTornClubEnemyStrokes(enemy: ClubEnemyView): Stroke[] {
  const parts = buildClubEnemyParts(enemy);
  const place = getPlace(enemy);
  const whole = [...parts.body, ...parts.face, ...parts.arm];
  const tearLine = place.underside - place.height * TEAR.height;
  const jagged: Stroke = {
    points: Array.from({ length: TEAR.teeth * 2 + 1 }, (_, tooth) => ({
      x: place.middle - place.width / 2 + (place.width * tooth) / (TEAR.teeth * 2),
      y: tearLine + (tooth % 2 === 0 ? -1 : 1) * place.height * TEAR.toothHeight,
    })),
    thickness: PENCIL.thickness,
  };
  const fallen = getShareFallen(enemy);
  const scraps = [
    {
      strokes: [...whole.flatMap((stroke) => cutStroke(stroke, tearLine, 'above')), jagged],
      move: getUpperHalfMove(place, tearLine, fallen),
      centre: { x: place.middle + place.away * place.width, y: place.floor - place.width / 2 },
    },
    {
      strokes: [...whole.flatMap((stroke) => cutStroke(stroke, tearLine, 'below')), jagged],
      move: getLowerHalfMove(place, fallen),
      centre: { x: place.middle, y: (tearLine + place.floor) / 2 },
    },
    {
      strokes: parts.club,
      move: getClubMove(enemy, place, fallen),
      centre: {
        x: place.middle - place.away * (place.width / 2 + convertToPixels(TEAR.clubAhead + 0.4)),
        y: place.floor,
      },
    },
  ];
  const leaving = enemy.torn?.action === 'leaving' ? enemy.torn.progress : 0;
  return scraps.flatMap((scrap, index) => {
    const fallOff = getFallOffMove({ place, centre: scrap.centre, index, leaving });
    return scrap.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => fallOff(scrap.move(point))),
    }));
  });
}

// ---- Helpers ----

/** How the tear looks, as shares of the enemy's size, metres and radians. View detail only. */
const TEAR = {
  /** How high up its body the tear runs: through its mouth. */
  height: 0.36,
  /** How many teeth the torn edge has, and how tall each is. */
  teeth: 5,
  toothHeight: 0.035,
  /** How much of the tearing is the lower half coming down onto the floor line. */
  dropShare: 0.25,
  /** How far the upper half turns as it falls off, and how far aside it comes to lie. */
  upperHalfTurn: 1.75,
  upperHalfAside: 0.3,
  /** How far in front of its body the club comes to lie, in metres. */
  clubAhead: 0.35,
} as const;

/**
 * How the halves and the club fall off the sheet, in metres and turns. View detail only: the sim
 * says when they are gone, and by then each of them has to be below the widest view the camera
 * takes.
 */
const FALL = {
  /** How far a scrap falls, and how far it drifts aside, away from the stick man. */
  down: 12,
  aside: 1.2,
  /** How far it turns over on the way, in turns. */
  turns: 0.65,
  /** How much more the second and the third turn than the first, each. */
  turnsMore: 0.4,
  /** How much later each scrap goes than the one before, as a share of the leaving. */
  delay: 0.14,
} as const;

/** Where a torn enemy is, in world pixels. */
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

/** How much of the way down the halves and the club are, from 0, just torn, to 1, lying. */
function getShareFallen(enemy: ClubEnemyView): number {
  return enemy.torn?.action === 'tearing' ? enemy.torn.progress : 1;
}

/** The lower half stops floating: it comes straight down onto the floor line. */
function getLowerHalfMove(place: Place, fallen: number): (point: StrokePoint) => StrokePoint {
  const drop = (place.floor - place.underside) * Math.min(1, fallen / TEAR.dropShare);
  return (point) => ({ x: point.x, y: point.y + drop });
}

/**
 * The upper half falls off: it turns over about its far corner as it comes down, faster as it
 * goes, and nothing of it goes through the floor line.
 */
function getUpperHalfMove(
  place: Place,
  tearLine: number,
  fallen: number,
): (point: StrokePoint) => StrokePoint {
  const pivot = { x: place.middle + (place.away * place.width) / 2, y: tearLine };
  const angle = place.away * TEAR.upperHalfTurn * fallen * fallen;
  return (point) => {
    const turned = turnAbout(point, pivot, angle);
    return {
      x: turned.x + place.away * place.width * TEAR.upperHalfAside * fallen,
      y: Math.min(
        turned.y + (place.floor - tearLine) * fallen * fallen,
        place.floor - PENCIL.thickness,
      ),
    };
  };
}

/**
 * The club is let go of: it falls from where it was held to lie on the floor in front of the
 * enemy, its end towards the stick man, turning the shorter way round.
 */
function getClubMove(
  enemy: ClubEnemyView,
  place: Place,
  fallen: number,
): (point: StrokePoint) => StrokePoint {
  const grip = { x: convertToPixels(enemy.club.grip.x), y: convertToPixels(enemy.club.grip.y) };
  const tip = { x: convertToPixels(enemy.club.tip.x), y: convertToPixels(enemy.club.tip.y) };
  const heldAngle = Math.atan2(tip.y - grip.y, tip.x - grip.x);
  const lyingAngle = place.away === 1 ? Math.PI : 0;
  const turn = Math.atan2(Math.sin(lyingAngle - heldAngle), Math.cos(lyingAngle - heldAngle));
  const rest = {
    x: place.middle - place.away * (place.width / 2 + convertToPixels(TEAR.clubAhead)),
    y: place.floor - convertToPixels(enemy.club.thickness) / 2,
  };
  const offset = {
    x: (rest.x - grip.x) * fallen,
    y: (rest.y - grip.y) * fallen * fallen,
  };
  return (point) => {
    const turned = turnAbout(point, grip, turn * fallen);
    return { x: turned.x + offset.x, y: turned.y + offset.y };
  };
}

/**
 * A scrap falls off the sheet: it goes a little after the one before it, tips over the floor line
 * and tumbles down out of view, turning about its own middle, faster as it goes. Nothing moves
 * while nothing is leaving.
 */
function getFallOffMove(scrap: {
  place: Place;
  centre: StrokePoint;
  index: number;
  leaving: number;
}): (point: StrokePoint) => StrokePoint {
  const delay = FALL.delay * scrap.index;
  // Each scrap is all the way down by the end of the leaving, however late it went.
  const fallen = Math.max(0, Math.min(1, (scrap.leaving - delay) / (1 - 2 * FALL.delay)));
  if (fallen === 0) {
    return (point) => point;
  }
  const { away } = scrap.place;
  const offset = {
    x: away * convertToPixels(FALL.aside) * fallen,
    y: convertToPixels(FALL.down) * fallen * fallen,
  };
  const turns = FALL.turns * (1 + scrap.index * FALL.turnsMore);
  const angle = away * turns * Math.PI * 2 * fallen;
  return (point) => {
    const turned = turnAbout(point, scrap.centre, angle);
    return { x: turned.x + offset.x, y: turned.y + offset.y };
  };
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
      const share = (y - previous.y) / (point.y - previous.y);
      piece.push({
        x: previous.x + (point.x - previous.x) * share,
        y: previous.y + (point.y - previous.y) * share,
      });
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

/** `point` turned about `centre` by `angle` radians, clockwise on the page. */
function turnAbout(point: StrokePoint, centre: StrokePoint, angle: number): StrokePoint {
  const x = point.x - centre.x;
  const y = point.y - centre.y;
  return {
    x: centre.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: centre.y + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

export const __testing__ = { FALL, TEAR, cutStroke };
