/* global window */
/**
 * What the scripts of this ticket share: a page with the game on it, the
 * keys a player presses, and reads of the sim through `window.__game`.
 * Every key goes through the keyboard, as a player's does.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { PROOF, check, lastLinesOf, start, waitFor, waitForPort } from './lib.mjs';

/** CSS pixels; the page opens at a pixel ratio of 1 so screen, device and CSS pixels agree. */
export const VIEWPORT = { width: 1280, height: 720 };

/** Starts this run's dev server and opens the game. `video` names a file in proof/ to record the page into. */
export async function openGame({ port, results, video }) {
  const devServer = start('pnpm', ['dev'], { env: { PORT: String(port) } });
  // The ready line proves the port is this run's server, not something that was already listening there.
  const ready = (await waitForPort(port)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${port}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) {
    devServer.stop();
    throw new Error('nothing to open');
  }
  // On macOS headless Chromium draws a few frames a second without this; a recording needs them all.
  const browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, ...(video ? { recordVideo: { dir: PROOF, size: { width: VIEWPORT.width * 0.75, height: VIEWPORT.height * 0.75 } } } : {}) });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, { timeout: 15000 });
  const close = async () => {
    await context.close();
    if (video) await page.video()?.saveAs(path.join(PROOF, video));
    if (video) await page.video()?.delete();
    await browser.close();
    devServer.stop();
  };
  return { page, pageErrors, close };
}

/** Everything a check reads, as the sim has it this instant. */
export function seen(page) {
  return page.evaluate(() => {
    const game = window.__game;
    return {
      tick: game.sim.tick,
      level: game.level.id,
      stickMan: game.stickMan(),
      slots: game.itemSlots().map(({ slot, itemDefId, selected }) => ({ slot, itemDefId, selected })),
      letter: game.letter() ?? null,
      recipeList: game.recipeList(),
      airplane: game.airplane() ?? null,
      itemUse: game.itemUse(),
      interaction: game.interaction(),
      flag: game.flag() ?? null,
    };
  });
}

/** What the level and the defs say, for expectations: nothing here is typed into a script. */
export function content(page) {
  return page.evaluate(() => {
    const game = window.__game;
    const idOf = (name) => game.defs.find((def) => def.name === name)?.id;
    const letterPlaced = game.level.placements.find((placement) => placement.defId === idOf('the letter about the paper airplane'));
    return {
      floor: game.level.floor,
      start: game.level.start,
      letterAt: letterPlaced?.at ?? null,
      paper: idOf('paper'),
      airplaneItem: idOf('paper airplane'),
      stickManHeight: game.stickManHeight,
    };
  });
}

/** Presses and lets go of a key, then waits until the sim has taken a tick with it. */
export async function tap(page, key) {
  const { tick } = await seen(page);
  await page.keyboard.press(key, { delay: 40 });
  await page.waitForFunction((before) => window.__game.sim.tick > before + 1, tick);
}

/** Holds a walking key until his feet are past `x` in that direction, then lets go and waits for him to stand. */
export async function walkTo(page, x) {
  const from = (await seen(page)).stickMan.feet.x;
  const key = x > from ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(key);
  await page.waitForFunction(({ target, right }) => (right ? window.__game.stickMan().feet.x >= target : window.__game.stickMan().feet.x <= target), { target: x, right: x > from }, { timeout: 30000, polling: 'raf' });
  await page.keyboard.up(key);
  await page.waitForFunction(() => window.__game.stickMan().action === 'standing', null, { polling: 'raf' });
}

/** Waits until `until`, a function run in the page with `window.__game`, is true. */
export function waitInGame(page, until, argument, timeout = 30000) {
  return page.waitForFunction(until, argument, { timeout, polling: 'raf' });
}

export function screenshot(page, name) {
  return page.screenshot({ path: path.join(PROOF, name) });
}

/** Where a point of the level (metres) is on the page, in CSS pixels. */
export function onPage(page, point) {
  return page.evaluate(({ x, y }) => {
    const game = window.__game;
    const { zoom, scrollX, scrollY, width, height } = game.camera();
    // What the camera sees starts here, in world pixels; one world pixel is `zoom` canvas pixels, and the canvas fills the page.
    const seenX = scrollX + (width - width / zoom) / 2;
    const seenY = scrollY + (height - height / zoom) / 2;
    const cssPerCanvas = game.game.canvas.getBoundingClientRect().width / game.game.canvas.width;
    return { x: (x * game.pixelsPerMetre - seenX) * zoom * cssPerCanvas, y: (y * game.pixelsPerMetre - seenY) * zoom * cssPerCanvas };
  }, point);
}

/** How many pixels of a rectangle of the page are pencil: much darker than the paper. Counted on a screenshot, so it is what a player sees. */
export async function pencilPixelsIn(page, { x, y, width, height }) {
  const clip = { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), width: Math.round(width), height: Math.round(height) };
  const png = (await page.screenshot({ clip })).toString('base64');
  return page.evaluate(async (data) => {
    const image = new window.Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = window.document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data: pixels } = context.getImageData(0, 0, image.width, image.height);
    let dark = 0;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index] + pixels[index + 1] + pixels[index + 2] < 3 * 140) dark += 1;
    return dark;
  }, png);
}

/** A rectangle of the page around a stretch of the level: `from` and `to` are opposite corners, in metres. */
export async function pageRectangle(page, from, to) {
  const one = await onPage(page, from);
  const other = await onPage(page, to);
  return { x: Math.min(one.x, other.x), y: Math.min(one.y, other.y), width: Math.abs(other.x - one.x), height: Math.abs(other.y - one.y) };
}
