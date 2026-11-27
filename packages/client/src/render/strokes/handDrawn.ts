import { PENCIL } from './pencil';
import type { Stroke, StrokePoint } from './stroke';

/**
 * Turns the exact path a caller asked for into the path a hand would draw:
 * never quite straight, pressed harder in the middle than at the ends, and a
 * little different on every redraw. Plain arithmetic, no Phaser, so it is the
 * same whichever technique paints it.
 */

/** One point of a hand-drawn path, with how hard the pencil presses there (0 to 1). */
export interface PencilPoint extends StrokePoint {
  readonly pressure: number;
}

interface Redraw {
  /** Which stroke of its layer this is, so two strokes do not wobble alike. */
  readonly strokeIndex: number;
  /** Which redraw this is; the wobble changes when it does. */
  readonly boilFrame: number;
}

/** The path a hand would draw for `stroke` on this redraw. The same arguments always give the same path. */
export function buildHandDrawnPath(stroke: Stroke, redraw: Redraw): PencilPoint[] {
  const path = spaceEvenly(stroke.isClosed ? buildOverlappingLoop(stroke.points) : stroke.points, PENCIL.pointSpacing);
  if (path.length < 2) return [];
  const seed = mix(mix(redraw.strokeIndex + 1, redraw.boilFrame), path.length);
  const last = path.length - 1;
  return path.map((point, index) => {
    const distanceAlong = index * PENCIL.pointSpacing;
    const normal = getNormalAt(path, index);
    const offset = PENCIL.wobble * getSmoothNoise(seed, distanceAlong / PENCIL.wobbleLength);
    const fromNearestEnd = Math.min(index, last - index) * PENCIL.pointSpacing;
    const lift = Math.min(1, fromNearestEnd / PENCIL.taperLength);
    const pressure = (PENCIL.pressureAtEnds + (1 - PENCIL.pressureAtEnds) * lift) * (1 - PENCIL.pressureVariation * (0.5 + 0.5 * getSmoothNoise(seed + 7, distanceAlong / PENCIL.pressureLength)));
    return { x: point.x + normal.x * offset, y: point.y + normal.y * offset, pressure };
  });
}

/** Which redraw is on screen at `seconds`: it changes `PENCIL.boilsPerSecond` times a second. */
export function getBoilFrameAt(seconds: number): number {
  return Math.floor(seconds * PENCIL.boilsPerSecond);
}

// ---- Helpers ----

/** A loop whose pencil goes a little past where it started, as a hand closing a circle does. */
function buildOverlappingLoop(points: readonly StrokePoint[]): StrokePoint[] {
  if (points.length < 3) return [...points];
  const loop = [...points, points[0]!];
  let overlap = PENCIL.loopOverlap;
  for (let index = 1; index < points.length && overlap > 0; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length <= overlap) loop.push(end);
    else loop.push({ x: start.x + ((end.x - start.x) * overlap) / length, y: start.y + ((end.y - start.y) * overlap) / length });
    overlap -= length;
  }
  return loop;
}

/** The same path as points about `spacing` apart (each straight piece is divided evenly), keeping every corner. */
function spaceEvenly(points: readonly StrokePoint[], spacing: number): StrokePoint[] {
  const spaced: StrokePoint[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    // A piece with no length, or with a coordinate that is not a number, is skipped: it has nowhere to be drawn.
    if (!Number.isFinite(length) || length <= 0) continue;
    const steps = Math.max(1, Math.round(length / spacing));
    for (let step = spaced.length === 0 ? 0 : 1; step <= steps; step += 1) {
      const distanceAlong = step / steps;
      spaced.push({ x: start.x + (end.x - start.x) * distanceAlong, y: start.y + (end.y - start.y) * distanceAlong });
    }
  }
  return spaced;
}

/** The unit vector across the path at `index`. */
function getNormalAt(path: readonly StrokePoint[], index: number): StrokePoint {
  const before = path[Math.max(0, index - 1)]!;
  const after = path[Math.min(path.length - 1, index + 1)]!;
  const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
  return { x: -(after.y - before.y) / length, y: (after.x - before.x) / length };
}

/** A smooth value between -1 and 1 that depends only on `seed` and `at`. */
function getSmoothNoise(seed: number, offset: number): number {
  const cell = Math.floor(offset);
  const within = offset - cell;
  const eased = within * within * (3 - 2 * within);
  const start = convertToUnit(mix(seed, cell));
  const end = convertToUnit(mix(seed, cell + 1));
  return (start + (end - start) * eased) * 2 - 1;
}

/** Two integers mixed into one 32-bit integer that looks unrelated to both. */
function mix(first: number, second: number): number {
  let value = (Math.imul(first | 0, 0x9e3779b1) ^ Math.imul(second | 0, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
  return (value ^ (value >>> 15)) >>> 0;
}

const convertToUnit = (integer: number): number => integer / 4294967296;
