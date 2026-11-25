import type { COLOURED_PENCILS } from './pencil';

/**
 * What a caller asks the pencil for. Everything on screen that is a pencil
 * line is a `Stroke`: the path the pencil follows and how thick the line is.
 * How it becomes pixels (the grain, the wobble, the boil) is decided inside
 * `render/strokes/` alone.
 */

/** A point in world pixels, the space Phaser's camera looks at. */
export interface StrokePoint {
  readonly x: number;
  readonly y: number;
}

export interface Stroke {
  /** The path the pencil follows, in world pixels. Two points are a straight line. */
  readonly points: readonly StrokePoint[];
  /** How thick the line is, in world pixels, where the pencil presses hardest. */
  readonly thickness: number;
  /** True for a loop (a head): the pencil comes back past where it started. */
  readonly closed?: boolean;
  /** A coloured pencil for the few lines that must stand out from the graphite (`COLOURED_PENCILS`); graphite when absent. */
  readonly colour?: ColouredPencil;
}

/** The coloured pencils there are, by name. What each looks like is `COLOURED_PENCILS` in `./pencil`. */
export type ColouredPencil = keyof typeof COLOURED_PENCILS;

/**
 * A set of strokes that is drawn every frame. `show` replaces what the layer
 * drew before; the layer redraws the same strokes a little differently a few
 * times a second, so a line that does not move still "boils" like hand
 * animation.
 */
export interface StrokeLayer {
  /** A stroke with fewer than two points draws nothing, and still counts in the order of the list. */
  show(strokes: readonly Stroke[]): void;
  destroy(): void;
}
