import { fixedUnits } from '../fixedUnits';
import { PENCIL } from './pencil';

/** The side of the square grain tile, in pixels. */
const GRAIN_SIZE = 128;

/**
 * A tile of what the paper's tooth leaves unmarked under a pencil: mostly
 * clear, with specks of varying strength. Erasing it out of a solid line
 * (or multiplying a strip by it) is what makes the line look like graphite.
 * The same tile every time: the specks come from a fixed seed.
 */
export function paperToothTile(): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = GRAIN_SIZE;
  tile.height = GRAIN_SIZE;
  const context = tile.getContext('2d');
  if (!context) return tile;
  const image = context.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  const nextUnit = fixedUnits(0x51ec);
  for (let pixel = 0; pixel < GRAIN_SIZE * GRAIN_SIZE; pixel += 1) {
    const roll = nextUnit();
    const strength = roll < PENCIL.toothCoverage ? PENCIL.toothDepth * nextUnit() : PENCIL.toothHaze * nextUnit();
    image.data[pixel * 4 + 3] = Math.round(255 * strength);
  }
  context.putImageData(image, 0, 0);
  return tile;
}
