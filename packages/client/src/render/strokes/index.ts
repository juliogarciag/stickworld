import type Phaser from 'phaser';
import type { StrokeLayer } from './stroke';
import { graphicsStrokeLayer } from './graphicsLayer';

/**
 * The only place a pencil stroke is drawn (AGENTS.md rule 12, ADR 0002).
 * A caller makes a layer once and shows it its strokes whenever they change
 * (every frame is fine); a layer shown once keeps boiling by itself:
 *
 *   const floor = createStrokeLayer(scene);
 *   floor.show([{ points: [from, to], thickness: PENCIL.thickness }]);
 *
 * Points and thickness are in world pixels; `PENCIL` in `./pencil` has the thickness lines usually have. The technique behind a layer
 * lives in `graphicsLayer.ts` and can be swapped there without touching a caller.
 */
export type { Stroke, StrokeLayer, StrokePoint } from './stroke';

/** A layer of pencil strokes in `scene`, drawn above what the scene already has. */
export function createStrokeLayer(scene: Phaser.Scene): StrokeLayer {
  return graphicsStrokeLayer(scene);
}
