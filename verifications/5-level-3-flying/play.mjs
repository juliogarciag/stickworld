/* global window */
/**
 * What both scripts do the same way: start the dev server on level 3, open the
 * page with a recording, read the sim through `window.__game`, and play level
 * 3 as far as the airplane on the edge with the real keyboard.
 */
import { chromium } from 'playwright';
import { renameSync } from 'node:fs';
import path from 'node:path';
import { PROOF, check, lastLinesOf, start, waitFor, waitForPort } from './lib.mjs';

/** CSS pixels; the page opens at a pixel ratio of 1 so screen, device and CSS pixels agree. */
export const VIEWPORT = { width: 960, height: 540 };

/** Starts `PORT=<port> VITE_LEVEL=3 pnpm dev` and opens the page, recording it. `close()` stops both and keeps the recording as proof/<name>.webm. */
export async function openLevel3({ port, name, results }) {
  const devServer = start('pnpm', ['dev'], { env: { PORT: String(port), VITE_LEVEL: '3' } });
  // The ready line proves the port is this run's server, not something that was already listening there.
  const ready = (await waitForPort(port)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${port}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) {
    devServer.stop();
    throw new Error('nothing to open');
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, recordVideo: { dir: PROOF, size: VIEWPORT } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, { timeout: 15000 });
  return {
    page,
    pageErrors,
    async close() {
      const video = page.video();
      await context.close();
      await browser.close();
      devServer.stop();
      if (video) renameSync(await video.path(), path.join(PROOF, `${name}.webm`));
    },
  };
}

/** The sim as the page has it right now: everything the checks read, in one round trip. */
export function stateOf(page) {
  return page.evaluate(() => {
    const api = window.__game;
    const level = api.level;
    const flagPlaced = api.flag();
    return {
      tick: api.sim.tick,
      dt: api.sim.dt,
      level: level.id,
      start: level.start,
      // Level 3 is two floor lines with the gap between them.
      gap: { from: level.floor[0].to.x, to: level.floor[1].from.x },
      farEnd: level.floor[1].to.x,
      stickMan: api.stickMan(),
      airplane: api.airplane() ?? null,
      letter: api.letter() ?? null,
      flag: flagPlaced ?? null,
      slots: api.itemSlots().map((slot) => slot.itemDefId),
      interaction: api.interaction(),
      itemUse: api.itemUse(),
    };
  });
}

/** Waits, frame by frame inside the page, until `condition(window.__game)` holds. Throws on timeout, naming `what`. */
export async function untilTheSim(page, what, condition, timeoutMs = 15000) {
  try {
    await page.waitForFunction(`(${condition.toString()})(window.__game)`, null, { timeout: timeoutMs, polling: 'raf' });
  } catch {
    throw new Error(`timed out waiting for: ${what}`);
  }
}

/** Holds the arrow key towards `x` until his feet are there, then lets go and waits for him to stand. */
export async function walkTo(page, x) {
  const { stickMan } = await stateOf(page);
  const key = x > stickMan.feet.x ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(key);
  await page.waitForFunction(([target, direction]) => (target - window.__game.stickMan().feet.x) * direction <= 0, [x, key === 'ArrowRight' ? 1 : -1], { timeout: 30000, polling: 'raf' });
  await page.keyboard.up(key);
  await untilTheSim(page, 'him to stand still', (api) => api.stickMan().action === 'standing' || api.stickMan().action === 'cheering');
}

/** Presses a key the way a person does and gives the sim two frames to hear it. */
export async function press(page, key) {
  await page.keyboard.press(key, { delay: 40 });
  await page.waitForTimeout(60);
}

/**
 * From wherever he stands on the near side with a letter lying in the level: reads it, folds the paper it gives or he
 * has, sets the airplane down, lifts it, carries it to the edge and puts it down with its nose over the gap.
 * Returns the state once K would board it.
 */
export async function putTheAirplaneOnTheEdge(page) {
  await untilTheSim(page, 'a letter lying on the floor', (api) => api.letter() !== undefined && api.letter().height === 0);
  const before = await stateOf(page);
  await walkTo(page, before.letter.at.x);
  await press(page, 'k'); // read: it teaches the recipe, gives the paper when he has none and puts it in his hand
  await press(page, 'k'); // put the letter away
  await press(page, 'j'); // fold a paper airplane: one press
  await press(page, 'j'); // set the airplane down
  const placed = await stateOf(page);
  if (!placed.airplane) throw new Error(`no airplane was set down (slots ${JSON.stringify(placed.slots)}, J would ${placed.itemUse})`);
  // How far in front of him he puts it down, as the sim just did it: nothing typed in here.
  const putDownAhead = placed.airplane.at.x - placed.stickMan.feet.x;
  await press(page, 'k'); // lift
  await walkTo(page, placed.gap.from - putDownAhead - placed.airplane.length / 4);
  await press(page, 'k'); // put down
  return stateOf(page);
}

/** How many pixels of a screenshot are as dark as a pencil line, counted in the page: the paper and its grain are much lighter. */
export function pencilPixelsIn(page, png) {
  return page.evaluate(async (base64) => {
    const image = new window.Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = window.document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let dark = 0;
    for (let index = 0; index < data.length; index += 4) if ((data[index] + data[index + 1] + data[index + 2]) / 3 < 150) dark += 1;
    return dark;
  }, png.toString('base64'));
}
