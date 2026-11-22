import type Phaser from 'phaser';
import { worldSeenBy } from '../../cameraView';
import { boilFrameAt, handDrawnPath } from '../handDrawn';
import { paperToothTile } from '../grain';
import { PENCIL } from '../pencil';
import type { StrokeLayer } from '../stroke';

let surfacesMade = 0;

/**
 * Technique 3: a Canvas 2D surface the size of the screen, drawn with the
 * browser's own line drawing and shown by Phaser as a texture over exactly
 * what the camera sees. The paper's tooth is erased out of the solid lines
 * in world space, so the grain stays on the paper when the camera moves.
 */
export function canvasStrokeLayer(scene: Phaser.Scene): StrokeLayer {
  surfacesMade += 1;
  const key = `pencil-surface-${surfacesMade}`;
  const camera = scene.cameras.main;
  const surface = scene.textures.createCanvas(key, Math.max(1, camera.width), Math.max(1, camera.height));
  if (!surface) throw new Error('the pencil needs a canvas texture to draw on');
  const image = scene.add.image(0, 0, key).setOrigin(0, 0);
  const context = surface.context;
  const tooth = context.createPattern(paperToothTile(), 'repeat');

  return {
    show(strokes) {
      const seen = worldSeenBy(camera);
      if (surface.width !== camera.width || surface.height !== camera.height) surface.setSize(Math.max(1, camera.width), Math.max(1, camera.height));
      image.setPosition(seen.x, seen.y).setDisplaySize(seen.width, seen.height);

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalCompositeOperation = 'source-over';
      context.clearRect(0, 0, surface.width, surface.height);
      context.setTransform(seen.zoom, 0, 0, seen.zoom, -seen.x * seen.zoom, -seen.y * seen.zoom);
      context.strokeStyle = PENCIL.colour;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      const boilFrame = boilFrameAt(scene.time.now / 1000);
      strokes.forEach((stroke, strokeIndex) => {
        const path = handDrawnPath(stroke, { strokeIndex, boilFrame });
        for (let index = 1; index < path.length; index += 1) {
          const from = path[index - 1]!;
          const to = path[index]!;
          context.lineWidth = (stroke.thickness * (from.pressure + to.pressure)) / 2;
          context.beginPath();
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
          context.stroke();
        }
      });

      if (tooth) {
        context.globalCompositeOperation = 'destination-out';
        context.fillStyle = tooth;
        context.fillRect(seen.x, seen.y, seen.width, seen.height);
      }
      surface.refresh();
    },
    destroy() {
      image.destroy();
      scene.textures.remove(key);
    },
  };
}
