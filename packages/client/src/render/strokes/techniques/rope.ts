import Phaser from 'phaser';
import { boilFrameAt, handDrawnPath } from '../handDrawn';
import { paperToothTile } from '../grain';
import { PENCIL } from '../pencil';
import type { Stroke, StrokeLayer } from '../stroke';

/** Technique 1: each stroke is a Phaser Rope, a strip of pencil-grain texture bent along the path. */
export function ropeStrokeLayer(scene: Phaser.Scene): StrokeLayer {
  const ropes: Phaser.GameObjects.Rope[] = [];
  return {
    show(strokes) {
      const boilFrame = boilFrameAt(scene.time.now / 1000);
      strokes.forEach((stroke, strokeIndex) => {
        const path = handDrawnPath(stroke, { strokeIndex, boilFrame });
        if (path.length < 2) return;
        const texture = stripTexture(scene, stroke);
        const alphas = path.map((point) => point.pressure);
        const points = path.map((point) => new Phaser.Math.Vector2(point.x, point.y));
        const rope = ropes[strokeIndex];
        if (rope) rope.setTexture(texture).setPoints(points, undefined, alphas).setVisible(true);
        else ropes[strokeIndex] = scene.add.rope(0, 0, texture, undefined, points, true, undefined, alphas);
      });
      for (let index = strokes.length; index < ropes.length; index += 1) ropes[index]?.setVisible(false);
    },
    destroy() {
      for (const rope of ropes) rope.destroy();
    },
  };
}

// ---- Helpers ----

const STRIP_LENGTH = 512;

/** The key of a strip of graphite as thick as `stroke`, with rough edges, made on first use. */
function stripTexture(scene: Phaser.Scene, stroke: Stroke): string {
  const thickness = Math.max(2, Math.round(stroke.thickness));
  const key = `pencil-strip-${thickness}`;
  if (scene.textures.exists(key)) return key;
  const height = thickness + 2;
  const strip = scene.textures.createCanvas(key, STRIP_LENGTH, height);
  if (!strip) return key;
  const context = strip.context;
  context.fillStyle = PENCIL.colour;
  context.fillRect(0, 1, STRIP_LENGTH, thickness);
  context.globalCompositeOperation = 'destination-out';
  const tooth = context.createPattern(paperToothTile(), 'repeat');
  if (tooth) {
    context.fillStyle = tooth;
    context.fillRect(0, 0, STRIP_LENGTH, height);
  }
  strip.refresh();
  return key;
}
