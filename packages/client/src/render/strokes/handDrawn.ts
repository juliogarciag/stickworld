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
export function handDrawnPath(stroke: Stroke, { strokeIndex, boilFrame }: Redraw): PencilPoint[] {
  const path = evenlySpaced(stroke.closed ? overlappingLoop(stroke.points) : stroke.points, PENCIL.pointSpacing);
  if (path.length < 2) return [];
  const seed = mixed(mixed(strokeIndex + 1, boilFrame), path.length);
  const last = path.length - 1;
  return path.map((point, index) => {
    const along = index * PENCIL.pointSpacing;
    const normal = normalAt(path, index);
    const offset = PENCIL.wobble * smoothNoise(seed, along / PENCIL.wobbleLength);
    const fromNearestEnd = Math.min(index, last - index) * PENCIL.pointSpacing;
    const lift = Math.min(1, fromNearestEnd / PENCIL.taperLength);
    const pressure = (PENCIL.pressureAtEnds + (1 - PENCIL.pressureAtEnds) * lift) * (1 - PENCIL.pressureVariation * (0.5 + 0.5 * smoothNoise(seed + 7, along / PENCIL.pressureLength)));
    return { x: point.x + normal.x * offset, y: point.y + normal.y * offset, pressure };
  });
}

/** Which redraw is on screen at `seconds`: it changes `PENCIL.boilsPerSecond` times a second. */
export function boilFrameAt(seconds: number): number {
  return Math.floor(seconds * PENCIL.boilsPerSecond);
}

// ---- Helpers ----

/** A loop whose pencil goes a little past where it started, as a hand closing a circle does. */
function overlappingLoop(points: readonly StrokePoint[]): StrokePoint[] {
  if (points.length < 3) return [...points];
  const loop = [...points, points[0]!];
  let overlap = PENCIL.loopOverlap;
  for (let index = 1; index < points.length && overlap > 0; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length <= overlap) loop.push(to);
    else loop.push({ x: from.x + ((to.x - from.x) * overlap) / length, y: from.y + ((to.y - from.y) * overlap) / length });
    overlap -= length;
  }
  return loop;
}

/** The same path as points about `spacing` apart (each straight piece is divided evenly), keeping every corner. */
function evenlySpaced(points: readonly StrokePoint[], spacing: number): StrokePoint[] {
  const spaced: StrokePoint[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    // A piece with no length, or with a coordinate that is not a number, is skipped: it has nowhere to be drawn.
    if (!Number.isFinite(length) || length <= 0) continue;
    const steps = Math.max(1, Math.round(length / spacing));
    for (let step = spaced.length === 0 ? 0 : 1; step <= steps; step += 1) {
      const along = step / steps;
      spaced.push({ x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along });
    }
  }
  return spaced;
}

/** The unit vector across the path at `index`. */
function normalAt(path: readonly StrokePoint[], index: number): StrokePoint {
  const before = path[Math.max(0, index - 1)]!;
  const after = path[Math.min(path.length - 1, index + 1)]!;
  const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
  return { x: -(after.y - before.y) / length, y: (after.x - before.x) / length };
}

/** A smooth value between -1 and 1 that depends only on `seed` and `at`. */
function smoothNoise(seed: number, at: number): number {
  const cell = Math.floor(at);
  const within = at - cell;
  const eased = within * within * (3 - 2 * within);
  const from = unit(mixed(seed, cell));
  const to = unit(mixed(seed, cell + 1));
  return (from + (to - from) * eased) * 2 - 1;
}

/** Two integers mixed into one 32-bit integer that looks unrelated to both. */
function mixed(first: number, second: number): number {
  let value = (Math.imul(first | 0, 0x9e3779b1) ^ Math.imul(second | 0, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
  return (value ^ (value >>> 15)) >>> 0;
}

const unit = (integer: number): number => integer / 4294967296;
