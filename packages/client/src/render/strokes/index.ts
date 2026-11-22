import type Phaser from 'phaser';
import type { StrokeLayer } from './stroke';
import { canvasStrokeLayer } from './techniques/canvas';
import { graphicsStrokeLayer } from './techniques/graphics';
import { ropeStrokeLayer } from './techniques/rope';

/**
 * The only place a pencil stroke is drawn (AGENTS.md rule 12, ADR 0002).
 * A caller makes a layer once and shows it its strokes every frame:
 *
 *   const floor = createStrokeLayer(scene);
 *   floor.show([{ points: [from, to], thickness: PENCIL.thickness }]);
 */
export { PENCIL } from './pencil';
export type { Stroke, StrokeLayer, StrokePoint } from './stroke';

const TECHNIQUES = { rope: ropeStrokeLayer, graphics: graphicsStrokeLayer, canvas: canvasStrokeLayer } as const;

/** A layer of pencil strokes in `scene`, drawn above what the scene already has. */
export function createStrokeLayer(scene: Phaser.Scene): StrokeLayer {
  const asked = import.meta.env.VITE_STROKES;
  const technique = asked && asked in TECHNIQUES ? (asked as keyof typeof TECHNIQUES) : 'rope';
  return TECHNIQUES[technique](scene);
}
