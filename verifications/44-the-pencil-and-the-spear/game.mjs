/* global window */
/**
 * The game in a browser, for this ticket's scripts: a dev server on the yard with the club enemy
 * and the letter about the spear (level 900), a Chromium page on it, and the few moves the scripts
 * share. Keys are pressed the way a person presses them; what happened is read from
 * `window.__game`.
 */
import { chromium } from 'playwright';
import { renameSync } from 'node:fs';
import path from 'node:path';
import { PROOF, check, getLastLines, start, waitFor, waitForPort } from './lib.mjs';

/** The practice level this ticket is tried in. */
export const YARD = 900;
/** CSS pixels; the page opens at a pixel ratio of 1 so screen, device and CSS pixels agree. */
export const VIEWPORT = { width: 1280, height: 720 };

/**
 * Starts `VITE_LEVEL=900 PORT=<port> pnpm dev` and opens the page. `options.video` names the
 * recording to keep in ./proof; `options.steppedClock` puts the page's clock in the script's
 * hands, so that a frame is drawn only when `stepFrames` says so.
 */
export async function openGame(port, results, options = {}) {
  const devServer = start('pnpm', ['dev'], { env: { PORT: String(port), VITE_LEVEL: String(YARD) } });
  const ready =
    (await waitForPort(port)) &&
    (await waitFor("the dev server's ready line", {
      read: () => devServer.output.includes(`localhost:${port}/`),
      until: Boolean,
    }).catch(() => false));
  results.push(
    check(
      'dev server up, started by this run',
      ready,
      ready ? undefined : getLastLines(devServer.output),
    ),
  );
  if (!ready) {
    devServer.stop();
    throw new Error('nothing to open');
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    ...(options.video ? { recordVideo: { dir: PROOF, size: VIEWPORT } } : {}),
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  if (options.steppedClock) {
    await page.clock.install();
  }
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, {
    timeout: 15000,
  });
  if (options.steppedClock) {
    // An installed clock still runs by itself until it is paused: from here on only `stepFrames`
    // moves it.
    await page.clock.pauseAt(await page.evaluate(() => window.Date.now() + 100));
  }
  return {
    page,
    pageErrors,
    async close() {
      const video = page.video();
      await context.close();
      await browser.close();
      devServer.stop();
      if (video && options.video) {
        renameSync(await video.path(), path.join(PROOF, options.video));
      }
    },
  };
}

/** Everything the checks read, as the sim has it this instant. */
export function readGame(page) {
  return page.evaluate(() => {
    const api = window.__game;
    return {
      tick: api.sim.tick,
      dt: api.sim.dt,
      level: api.level.id,
      start: api.level.start,
      stickMan: api.getStickMan(),
      stickManWidth: api.stickManWidth,
      slots: api.getItemSlots().map((slot) => ({
        itemDefId: slot.itemDefId,
        isSelected: slot.isSelected,
      })),
      letter: api.getLetter() ?? null,
      crafting: api.getCrafting(),
      itemUse: api.getItemUse(),
      canSwitchItemUse: api.canSwitchItemUse(),
      interaction: api.getInteraction(),
      spear: api.getSpear() ?? null,
      enemies: api.getEnemies(),
      flag: api.getFlag() ?? null,
      fallenItem: api.getFallenItem() ?? null,
    };
  });
}

/**
 * Plays on as a stick man that came through level 3 would: from the game as it is right now, with
 * the recipes named `recipeNames` known before the ones it knows already.
 */
export function playOnKnowingAlso(page, recipeNames) {
  return page.evaluate((names) => {
    const api = window.__game;
    const snapshot = api.takeSnapshot();
    const earlier = api.defs
      .filter((def) => 'madeFrom' in def && names.includes(def.name))
      .map((def) => def.id);
    const known = snapshot.slices.knownRecipes.filter((id) => !earlier.includes(id));
    api.loadSnapshot({
      ...snapshot,
      slices: { ...snapshot.slices, knownRecipes: [...earlier, ...known] },
    });
  }, recipeNames);
}

/** The def id of the item called `name`, from the game's own defs. */
export function getItemId(page, name) {
  return page.evaluate(
    (wanted) => window.__game.defs.find((def) => def.name === wanted)?.id ?? null,
    name,
  );
}

export function takeScreenshot(page, name) {
  return page.screenshot({ path: path.join(PROOF, name) });
}

/** Holds `key` down until `until` holds for the game, reading it every few milliseconds. */
export async function holdKeyUntil(page, key, label, until) {
  await page.keyboard.down(key);
  try {
    return await waitFor(label, { read: () => readGame(page), until, timeoutMs: 20000 });
  } finally {
    await page.keyboard.up(key);
  }
}

/** Reads the game again and again until `until` holds, and returns it as it was then. */
export function waitForGame(page, label, until, timeoutMs = 10000) {
  return waitFor(label, { read: () => readGame(page), until, timeoutMs });
}

/**
 * With the clock in the script's hands: draws `frames` frames, one sixtieth of a second apart, and
 * returns the game as it is after the last.
 */
export async function stepFrames(page, frames = 1) {
  for (let frame = 0; frame < frames; frame += 1) {
    await page.clock.runFor(FRAME_MS);
  }
  return readGame(page);
}

/** With the clock in the script's hands: draws frames until `until` holds for the game. */
export async function stepFramesUntil(page, label, until, maxFrames = 1800) {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const game = await stepFrames(page);
    if (until(game)) {
      return game;
    }
  }
  throw new Error(`never happened: ${label}`);
}

// ---- Helpers ----

const FRAME_MS = 1000 / 60;
