import Phaser from 'phaser';
import { worldSeenBy } from '../cameraView';
import { boilFrameAt, handDrawnPath, type PencilPoint } from './handDrawn';
import { PENCIL } from './pencil';
import type { Stroke, StrokeLayer } from './stroke';

/**
 * The technique (ADR 0002): a Phaser Graphics object per layer. A stroke is
 * a straight piece between each two points of its hand-drawn path, with a
 * round dab stamped on every point so thick lines have no chipped corners
 * and the pencil's pressure can change along the line. The graphite's grain
 * is not drawn here: it is the paper's tooth, which `render/paper.ts` lays
 * over everything drawn on the sheet.
 */

/** A new layer of pencil strokes in `scene`, drawn above what the scene already has. */
export function graphicsStrokeLayer(scene: Phaser.Scene): StrokeLayer {
  const number = layersMade;
  layersMade += 1;
  const graphics = scene.add.graphics();
  const colour = Phaser.Display.Color.HexStringToColor(PENCIL.colour).color;
  let strokes: readonly Stroke[] = [];
  let drawnStrokes: readonly Stroke[] | undefined;
  let drawnBoilFrame = -1;

  const draw = (): void => {
    const boilFrame = boilFrameAt(scene.time.now / 1000);
    if (strokes === drawnStrokes && boilFrame === drawnBoilFrame) return;
    drawnStrokes = strokes;
    drawnBoilFrame = boilFrame;

    const seen = worldSeenBy(scene.cameras.main);
    const inView = (point: PencilPoint): boolean =>
      point.x > seen.x - OFF_SCREEN_MARGIN && point.x < seen.x + seen.width + OFF_SCREEN_MARGIN && point.y > seen.y - OFF_SCREEN_MARGIN && point.y < seen.y + seen.height + OFF_SCREEN_MARGIN;

    graphics.clear();
    graphics.fillStyle(colour, 1);
    strokes.forEach((stroke, index) => {
      // Numbered by layer, so two layers' lines do not wobble alike.
      const path = handDrawnPath(stroke, { strokeIndex: number * STROKES_PER_LAYER + index, boilFrame });
      path.forEach((point, pointIndex) => {
        if (!inView(point)) return;
        const width = stroke.thickness * point.pressure;
        graphics.fillCircle(point.x, point.y, width / 2);
        const next = path[pointIndex + 1];
        if (!next) return;
        graphics.lineStyle((width + stroke.thickness * next.pressure) / 2, colour, 1);
        graphics.lineBetween(point.x, point.y, next.x, next.y);
      });
    });
  };

  const destroy = (): void => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, draw);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, destroy);
    graphics.destroy();
  };
  // Drawn just before Phaser renders, so a layer shown once still boils, and the camera is where the scene put it for this frame.
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, draw);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);

  return {
    show(next) {
      strokes = next;
    },
    destroy,
  };
}

// ---- Helpers ----

let layersMade = 0;

/** More strokes than a layer ever shows: keeps the numbering of two layers' strokes apart. */
const STROKES_PER_LAYER = 4096;

/** How far outside the view, in world pixels, a line is still drawn, so a long line costs what is on screen and the camera can move a little before the next redraw. */
const OFF_SCREEN_MARGIN = 200;
