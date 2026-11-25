import type Phaser from 'phaser';
import { worldSeenBy } from './cameraView';
import { fixedUnits } from './fixedUnits';

/** The colour of the sheet of paper the game is drawn on. index.html uses the same colour behind the canvas. */
export const PAPER_COLOUR = '#f3eee2';

/** How the sheet's grain looks. View detail only. */
const GRAIN = {
  /** The side of the square tile that repeats across the sheet, in screen pixels. */
  tileSize: 1024,
  /** How much lighter or darker than the paper colour a single pixel can be, out of 255. */
  speckle: 7,
  /** How many paper fibres one tile has, and how long and how dark they are. */
  fibres: 1700,
  fibreLength: 22,
  fibreAlpha: 0.05,
  /** How many soft uneven patches one tile has, and how dark they are. */
  patches: 46,
  patchRadius: 260,
  patchAlpha: 0.022,
} as const;

/**
 * The paper's tooth: the specks of the sheet that a pencil passing over does
 * not reach. It is what makes a solid line look like graphite. Sizes are in
 * world pixels, so the grain of a line is the same on every screen.
 */
const TOOTH = {
  /** The side of the square tile that repeats across the sheet, in world pixels. */
  tileSize: 256,
  /** The share of the sheet's pixels that are specks. */
  coverage: 0.3,
  /** How much of what is drawn over a speck is missing, at most. */
  depth: 0.85,
  /** How much is missing everywhere else, at most: graphite is never solid. */
  haze: 0.22,
} as const;

const SHEET_TEXTURE = 'paper-grain';
const TOOTH_TEXTURE = 'paper-tooth';

/**
 * Everything drawn on the paper sits between these two depths: the sheet
 * under it, the sheet's tooth showing through it. What is not on the paper
 * (a HUD) goes above `TOOTH_DEPTH`.
 */
const SHEET_DEPTH = -1000;
const TOOTH_DEPTH = 1000;

export interface Paper {
  /** Lays the sheet under everything `camera` sees. Call after moving the camera, every frame. */
  cover(camera: Phaser.Cameras.Scene2D.Camera): void;
}

/**
 * The sheet of paper `scene` is drawn on: the sheet under everything, and
 * its tooth showing through whatever is drawn on it. The grain belongs to
 * the world: when the camera moves, it moves with the drawing.
 */
export function layPaper(scene: Phaser.Scene): Paper {
  paintOnce(scene, { key: SHEET_TEXTURE, size: GRAIN.tileSize, paint: paintGrain });
  paintOnce(scene, { key: TOOTH_TEXTURE, size: TOOTH.tileSize, paint: paintTooth });
  const sheet = scene.add.tileSprite(0, 0, GRAIN.tileSize, GRAIN.tileSize, SHEET_TEXTURE).setOrigin(0, 0).setDepth(SHEET_DEPTH);
  const tooth = scene.add.tileSprite(0, 0, TOOTH.tileSize, TOOTH.tileSize, TOOTH_TEXTURE).setOrigin(0, 0).setDepth(TOOTH_DEPTH);
  return {
    cover(camera) {
      const seen = worldSeenBy(camera);
      // The sheet's grain is painted in screen pixels, so it is as fine as the screen; the tooth in world pixels.
      sheet.setPosition(seen.x, seen.y).setSize(seen.width, seen.height);
      sheet.setTileScale(1 / seen.zoom);
      sheet.setTilePosition(seen.x * seen.zoom, seen.y * seen.zoom);
      tooth.setPosition(seen.x, seen.y).setSize(seen.width, seen.height);
      tooth.setTilePosition(seen.x, seen.y);
    },
  };
}

// ---- Helpers ----

/** Makes the square texture `key` and paints it, unless the game already has it. */
function paintOnce(scene: Phaser.Scene, { key, size, paint }: { key: string; size: number; paint: (context: CanvasRenderingContext2D) => void }): void {
  if (scene.textures.exists(key)) return;
  const tile = scene.textures.createCanvas(key, size, size);
  if (!tile) return;
  paint(tile.context);
  tile.refresh();
}

/** Paints one repeatable tile of tooth: the paper's colour, strong at the specks the pencil does not reach and a faint haze everywhere else. */
function paintTooth(context: CanvasRenderingContext2D): void {
  const size = TOOTH.tileSize;
  const nextUnit = fixedUnits(0x51ec);
  context.fillStyle = PAPER_COLOUR;
  context.fillRect(0, 0, size, size);
  const image = context.getImageData(0, 0, size, size);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const missing = nextUnit() < TOOTH.coverage ? TOOTH.depth * nextUnit() : TOOTH.haze * nextUnit();
    image.data[pixel * 4 + 3] = Math.round(255 * missing);
  }
  context.putImageData(image, 0, 0);
}

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
      // A patch fades to nothing at its radius, so only the pixels it reaches are filled: filling the whole tile for each one kept the page from its first frame for over a second.
      const reached = pixelsOfTileWithin({ size, x: x + offsetX, y: y + offsetY, radius });
      if (!reached) return;
      const gradient = context.createRadialGradient(x + offsetX, y + offsetY, 0, x + offsetX, y + offsetY, radius);
      gradient.addColorStop(0, `rgba(${shade}, ${GRAIN.patchAlpha})`);
      gradient.addColorStop(1, `rgba(${shade}, 0)`);
      context.fillStyle = gradient;
      context.fillRect(reached.left, reached.top, reached.width, reached.height);
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

/**
 * The whole pixels of a tile of side `size` that are within `radius` of (`x`, `y`) along both axes, or undefined when there are none.
 * Whole pixels, so that filling them leaves no half-covered pixel at the rim that filling the whole tile would not have.
 */
function pixelsOfTileWithin({ size, x, y, radius }: { size: number; x: number; y: number; radius: number }): { left: number; top: number; width: number; height: number } | undefined {
  const left = Math.max(0, Math.floor(x - radius));
  const top = Math.max(0, Math.floor(y - radius));
  const right = Math.min(size, Math.ceil(x + radius));
  const bottom = Math.min(size, Math.ceil(y + radius));
  if (right <= left || bottom <= top) return undefined;
  return { left, top, width: right - left, height: bottom - top };
}

const clampedByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

export const __testing__ = { pixelsOfTileWithin };
