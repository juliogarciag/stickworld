import type Phaser from 'phaser';
import type { StrokeLayer } from './stroke';
import { createGraphicsStrokeLayer } from './graphicsLayer';

/**
 * The only place a pencil stroke is drawn (AGENTS.md rule 12, ADR 0002).
 * A caller makes a layer once and shows it its strokes whenever they change
 * (every frame is fine); a layer shown once keeps boiling by itself:
 *
 *   const floor = createStrokeLayer(scene);
 *   floor.show([{ points: [from, to], thickness: PENCIL.thickness }]);
 *
 * Strokes that are being written or rubbed out are cut down by `./partly` before they are shown.
 * Points and thickness are in world pixels; `PENCIL` in `./pencil` has the thickness lines usually have. The technique behind a layer
 * lives in `graphicsLayer.ts` and can be swapped there without touching a caller.
 */
export type { ColouredPencil, Stroke, StrokeLayer, StrokePoint } from './stroke';

/** A layer of pencil strokes in `scene`, drawn above what the scene already has. */
export function createStrokeLayer(scene: Phaser.Scene): StrokeLayer {
  return createGraphicsStrokeLayer(scene);
}
