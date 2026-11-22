import Phaser from 'phaser';
import { boilFrameAt, handDrawnPath } from '../handDrawn';
import { PENCIL } from '../pencil';
import type { StrokeLayer } from '../stroke';

/** Technique 2: Phaser Graphics lines, with a circle stamped on every joint and line end so thick lines have no chipped corners. */
export function graphicsStrokeLayer(scene: Phaser.Scene): StrokeLayer {
  const graphics = scene.add.graphics();
  const colour = Phaser.Display.Color.HexStringToColor(PENCIL.colour).color;
  return {
    show(strokes) {
      const boilFrame = boilFrameAt(scene.time.now / 1000);
      graphics.clear();
      graphics.fillStyle(colour, 1);
      strokes.forEach((stroke, strokeIndex) => {
        const path = handDrawnPath(stroke, { strokeIndex, boilFrame });
        path.forEach((point, index) => {
          const width = stroke.thickness * point.pressure;
          graphics.fillCircle(point.x, point.y, width / 2);
          const next = path[index + 1];
          if (!next) return;
          graphics.lineStyle((width + stroke.thickness * next.pressure) / 2, colour, 1);
          graphics.lineBetween(point.x, point.y, next.x, next.y);
        });
      });
    },
    destroy() {
      graphics.destroy();
    },
  };
}
