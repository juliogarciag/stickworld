import type { Stroke, StrokePoint } from './stroke';

/**
 * Strokes that are only partly there: being written, one after another, or
 * being rubbed out. Plain arithmetic on the paths; a layer draws what comes
 * out like any other strokes.
 */

/**
 * The first `share` (0 to 1) of `strokes` as a hand writing them has got: whole strokes in the
 * order given, and the one being written as far as the pencil has come. Every stroke takes as long
 * as it is long. The very same list once all of it is written, so a layer shown it does not draw it
 * anew.
 */
export function getWrittenSoFar(strokes: readonly Stroke[], share: number): readonly Stroke[] {
  if (share >= 1) {
    return strokes;
  }
  return keepBetween(strokes, { start: 0, end: Math.max(0, share) }).filter(
    (stroke) => stroke.points.length > 1,
  );
}

/**
 * `strokes` with the first `share` (0 to 1) rubbed out, in the order they were written. A stroke
 * that is gone leaves an empty one in its place, so the strokes still there keep their number in
 * the layer and do not wobble anew. The very same list while nothing is rubbed out.
 */
export function getRubbedOutSoFar(strokes: readonly Stroke[], share: number): readonly Stroke[] {
  if (share <= 0) {
    return strokes;
  }
  return keepBetween(strokes, { start: Math.min(1, share), end: 1 });
}

// ---- Helpers ----

/**
 * Every stroke cut down to the part of it between the shares `from` and `to` of the length of all
 * of them together.
 */
function keepBetween(strokes: readonly Stroke[], range: { start: number; end: number }): Stroke[] {
  const paths = strokes.map(getPath);
  const whole = paths.reduce((length, path) => length + measureLength(path), 0);
  let before = 0;
  return strokes.map((stroke, index) => {
    const path = paths[index]!;
    const length = measureLength(path);
    const start = range.start * whole - before;
    const end = range.end * whole - before;
    before += length;
    const isWholeStroke = start <= 0 && end >= length;
    if (isWholeStroke) {
      return stroke;
    }
    // Sums of lengths are a rounding off: a piece shorter than this is no piece.
    const isTooShort = end <= SHORTEST_PIECE || start >= length - SHORTEST_PIECE;
    if (isTooShort) {
      return { points: [], thickness: stroke.thickness };
    }
    return {
      points: cutBetween(path, { start: Math.max(0, start), end: Math.min(length, end) }),
      thickness: stroke.thickness,
    };
  });
}

/** In the pixels of the strokes: far less than can be seen. */
const SHORTEST_PIECE = 1e-6;

/** The path the pencil follows for `stroke`: a loop comes back to where it started. */
function getPath(stroke: Stroke): readonly StrokePoint[] {
  const isLoop = stroke.isClosed && stroke.points.length > 2;
  return isLoop ? [...stroke.points, stroke.points[0]!] : stroke.points;
}

function measureLength(path: readonly StrokePoint[]): number {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    length += Math.hypot(path[index]!.x - path[index - 1]!.x, path[index]!.y - path[index - 1]!.y);
  }
  return length;
}

/** The part of `path` between `from` and `to`, measured along it from its start. */
function cutBetween(
  path: readonly StrokePoint[],
  range: { start: number; end: number },
): StrokePoint[] {
  const cut: StrokePoint[] = [];
  let walked = 0;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]!;
    const end = path[index]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const getPointAlong = (distance: number): StrokePoint => {
      const share = length === 0 ? 0 : (distance - walked) / length;
      return { x: start.x + (end.x - start.x) * share, y: start.y + (end.y - start.y) * share };
    };
    const isPieceInRange = walked + length > range.start && walked < range.end;
    if (isPieceInRange) {
      if (cut.length === 0) {
        cut.push(getPointAlong(Math.max(range.start, walked)));
      }
      cut.push(getPointAlong(Math.min(range.end, walked + length)));
    }
    walked += length;
  }
  return cut;
}
