import type Phaser from 'phaser';
import { worldSeenBy } from './cameraView';
import { fixedUnits } from './fixedUnits';

/** The colour of the sheet of paper the game is drawn on. index.html uses the same colour behind the canvas. */
export const PAPER_COLOUR = '#f3eee2';

/** How the sheet's grain looks. View detail only. */
const GRAIN = {
  /** The side of the square tile that repeats across the sheet, in screen pixels. */
  tileSize: 512,
  /** How much lighter or darker than the paper colour a single pixel can be, out of 255. */
  speckle: 7,
  /** How many paper fibres one tile has, and how long and how dark they are. */
  fibres: 420,
  fibreLength: 22,
  fibreAlpha: 0.05,
  /** How many soft uneven patches one tile has, and how dark they are. */
  patches: 14,
  patchRadius: 150,
  patchAlpha: 0.035,
} as const;

const TEXTURE_KEY = 'paper-grain';

export interface Paper {
  /** Lays the sheet under everything `camera` sees. Call after moving the camera, every frame. */
  cover(camera: Phaser.Cameras.Scene2D.Camera): void;
}

/**
 * The sheet of paper behind everything in `scene`. The grain is one tile
 * repeated at screen resolution, and it belongs to the world: when the camera
 * moves, the grain moves with the drawing on it.
 */
export function layPaper(scene: Phaser.Scene): Paper {
  if (!scene.textures.exists(TEXTURE_KEY)) {
    const tile = scene.textures.createCanvas(TEXTURE_KEY, GRAIN.tileSize, GRAIN.tileSize);
    if (tile) {
      paintGrain(tile.context);
      tile.refresh();
    }
  }
  const sheet = scene.add.tileSprite(0, 0, GRAIN.tileSize, GRAIN.tileSize, TEXTURE_KEY).setOrigin(0, 0).setDepth(-1);
  return {
    cover(camera) {
      const seen = worldSeenBy(camera);
      sheet.setPosition(seen.x, seen.y).setSize(seen.width, seen.height);
      sheet.setTileScale(1 / seen.zoom);
      sheet.setTilePosition(seen.x * seen.zoom, seen.y * seen.zoom);
    },
  };
}

// ---- Helpers ----

/** Paints one repeatable tile of paper: the colour, uneven patches, fibres, and a speckle on every pixel. */
function paintGrain(context: CanvasRenderingContext2D): void {
  const size = GRAIN.tileSize;
  const nextUnit = fixedUnits(0x9a9e7);
  context.fillStyle = PAPER_COLOUR;
  context.fillRect(0, 0, size, size);

  for (let patch = 0; patch < GRAIN.patches; patch += 1) {
    const x = nextUnit() * size;
    const y = nextUnit() * size;
    const radius = GRAIN.patchRadius * (0.5 + nextUnit() * 0.5);
    const shade = nextUnit() < 0.5 ? '120, 100, 70' : '255, 255, 250';
    onEveryRepeat(size, (offsetX, offsetY) => {
      const gradient = context.createRadialGradient(x + offsetX, y + offsetY, 0, x + offsetX, y + offsetY, radius);
      gradient.addColorStop(0, `rgba(${shade}, ${GRAIN.patchAlpha})`);
      gradient.addColorStop(1, `rgba(${shade}, 0)`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    });
  }

  context.lineWidth = 1;
  for (let fibre = 0; fibre < GRAIN.fibres; fibre += 1) {
    const x = nextUnit() * size;
    const y = nextUnit() * size;
    const angle = nextUnit() * Math.PI;
    const length = GRAIN.fibreLength * (0.3 + nextUnit() * 0.7);
    const bend = (nextUnit() - 0.5) * length * 0.5;
    context.strokeStyle = nextUnit() < 0.6 ? `rgba(90, 75, 50, ${GRAIN.fibreAlpha})` : `rgba(255, 255, 255, ${GRAIN.fibreAlpha * 3})`;
    onEveryRepeat(size, (offsetX, offsetY) => {
      const endX = x + offsetX + Math.cos(angle) * length;
      const endY = y + offsetY + Math.sin(angle) * length;
      context.beginPath();
      context.moveTo(x + offsetX, y + offsetY);
      context.quadraticCurveTo((x + offsetX + endX) / 2 - Math.sin(angle) * bend, (y + offsetY + endY) / 2 + Math.cos(angle) * bend, endX, endY);
      context.stroke();
    });
  }

  const image = context.getImageData(0, 0, size, size);
  for (let channel = 0; channel < image.data.length; channel += 4) {
    const speckle = (nextUnit() + nextUnit() - 1) * GRAIN.speckle;
    image.data[channel] = clampedByte(image.data[channel]! + speckle);
    image.data[channel + 1] = clampedByte(image.data[channel + 1]! + speckle);
    image.data[channel + 2] = clampedByte(image.data[channel + 2]! + speckle * 1.2);
  }
  context.putImageData(image, 0, 0);
}

/** Calls `paint` for the tile and its eight neighbours, so what crosses an edge comes back on the other side and the tile repeats without a seam. */
function onEveryRepeat(size: number, paint: (offsetX: number, offsetY: number) => void): void {
  for (const offsetX of [-size, 0, size]) for (const offsetY of [-size, 0, size]) paint(offsetX, offsetY);
}

const clampedByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
