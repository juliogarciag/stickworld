import type { Stroke, StrokePoint } from './stroke';

/**
 * Strokes that are only partly there: being written, one after another, or
 * being rubbed out. Plain arithmetic on the paths; a layer draws what comes
 * out like any other strokes.
 */

/**
 * The first `share` (0 to 1) of `strokes` as a hand writing them has got: whole strokes in the order given, and the
 * one being written as far as the pencil has come. Every stroke takes as long as it is long. The very same list once
 * all of it is written, so a layer shown it does not draw it anew.
 */
export function writtenSoFar(strokes: readonly Stroke[], share: number): readonly Stroke[] {
  if (share >= 1) return strokes;
  return keptBetween(strokes, { from: 0, to: Math.max(0, share) }).filter((stroke) => stroke.points.length > 1);
}

/**
 * `strokes` with the first `share` (0 to 1) rubbed out, in the order they were written. A stroke that is gone leaves
 * an empty one in its place, so the strokes still there keep their number in the layer and do not wobble anew. The
 * very same list while nothing is rubbed out.
 */
export function rubbedOutSoFar(strokes: readonly Stroke[], share: number): readonly Stroke[] {
  if (share <= 0) return strokes;
  return keptBetween(strokes, { from: Math.min(1, share), to: 1 });
}

// ---- Helpers ----

/** Every stroke cut down to the part of it between the shares `from` and `to` of the length of all of them together. */
function keptBetween(strokes: readonly Stroke[], { from, to }: { from: number; to: number }): Stroke[] {
  const paths = strokes.map(pathOf);
  const whole = paths.reduce((length, path) => length + lengthOf(path), 0);
  let before = 0;
  return strokes.map((stroke, index) => {
    const path = paths[index]!;
    const length = lengthOf(path);
    const start = from * whole - before;
    const end = to * whole - before;
    before += length;
    if (start <= 0 && end >= length) return stroke;
    // Sums of lengths are a rounding off: a piece shorter than this is no piece.
    if (end <= SHORTEST_PIECE || start >= length - SHORTEST_PIECE) return { points: [], thickness: stroke.thickness };
    return { points: cutBetween(path, { from: Math.max(0, start), to: Math.min(length, end) }), thickness: stroke.thickness };
  });
}

/** In the pixels of the strokes: far less than can be seen. */
const SHORTEST_PIECE = 1e-6;

/** The path the pencil follows for `stroke`: a loop comes back to where it started. */
function pathOf({ points, closed }: Stroke): readonly StrokePoint[] {
  return closed && points.length > 2 ? [...points, points[0]!] : points;
}

function lengthOf(path: readonly StrokePoint[]): number {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) length += Math.hypot(path[index]!.x - path[index - 1]!.x, path[index]!.y - path[index - 1]!.y);
  return length;
}

/** The part of `path` between `from` and `to`, measured along it from its start. */
function cutBetween(path: readonly StrokePoint[], { from, to }: { from: number; to: number }): StrokePoint[] {
  const cut: StrokePoint[] = [];
  let walked = 0;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]!;
    const end = path[index]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const along = (distance: number): StrokePoint => {
      const share = length === 0 ? 0 : (distance - walked) / length;
      return { x: start.x + (end.x - start.x) * share, y: start.y + (end.y - start.y) * share };
    };
    if (walked + length > from && walked < to) {
      if (cut.length === 0) cut.push(along(Math.max(from, walked)));
      cut.push(along(Math.min(to, walked + length)));
    }
    walked += length;
  }
  return cut;
}
