/* global window */
/**
 * What both scripts do to the game in the page: open it fresh, follow the stick man frame by frame, and press keys
 * the way a person does. Everything is read through `window.__game`.
 */
import { chromium } from 'playwright';
import { check, lastLinesOf, start, waitFor, waitForPort } from './lib.mjs';

export const VIEWPORT = { width: 960, height: 540 };

/** Starts `PORT=<port> pnpm dev` and a Chromium page on it, with no panel touched (a fresh context has no storage). */
export async function openTheGame({ port, results, pageErrors, recordVideoDir }) {
  const devServer = start('pnpm', ['dev'], { env: { PORT: String(port) } });
  const ready = (await waitForPort(port)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${port}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) {
    devServer.stop();
    throw new Error('nothing to open');
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, ...(recordVideoDir ? { recordVideo: { dir: recordVideoDir, size: VIEWPORT } } : {}) });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  // Headless Chromium has no audio device: Phaser's sound manager says so, which is the machine and not the game.
  page.on('console', (message) => message.type() === 'error' && !message.text().startsWith('The AudioContext encountered an error') && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, { timeout: 15000 });
  await page.locator('canvas').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
  return {
    page,
    async close() {
      await context.close();
      await browser.close();
      devServer.stop();
    },
  };
}

/** Starts noting, every frame, where his feet are and what the sim says he is doing. */
export function startFollowing(page) {
  return page.evaluate(() => {
    window.__followed = [];
    const follow = () => {
      if (!window.__following) return;
      const man = window.__game.stickMan();
      window.__followed.push({ tick: window.__game.sim.tick, level: window.__game.level.id, x: man.feet.x, y: man.feet.y, vx: man.horizontalSpeed, vy: man.verticalSpeed, action: man.action });
      window.requestAnimationFrame(follow);
    };
    window.__following = true;
    window.requestAnimationFrame(follow);
  });
}

/** Stops following him and returns what was noted. */
export function stopFollowing(page) {
  return page.evaluate(() => {
    window.__following = false;
    return window.__followed;
  });
}

export function stickManOf(page) {
  return page.evaluate(() => window.__game.stickMan());
}

/** Waits until he stands, sits or cheers: not in the air. */
export function waitUntilOnHisFeet(page, timeoutMs = 8000) {
  return page.waitForFunction(() => window.__game.stickMan().action !== 'jumping', null, { timeout: timeoutMs });
}

/** Plays the level again from its start and waits for him to stand there. */
export async function playLevelAgain(page, level) {
  await page.evaluate((id) => window.__game.loadLevel(id), level);
  await page.waitForFunction(() => window.__game.sim.tick > 5 && window.__game.stickMan().action === 'standing', null, { timeout: 8000 });
}

/** Holds `key` down for `ms` milliseconds of real time (0: a tap, down and up within one frame). */
export async function hold(page, key, ms) {
  await page.keyboard.down(key);
  if (ms > 0) await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/** How high his feet got above where they were on the first sample, in metres. */
export function heightOf(samples) {
  const floor = samples[0].y;
  return Math.max(...samples.map((sample) => floor - sample.y));
}

/** A jump with `key`, held for `ms`, followed until he is on his feet again: how high it went and what was noted. */
export async function jumpWith(page, key, ms) {
  await startFollowing(page);
  await hold(page, key, ms);
  await page.waitForTimeout(50);
  await waitUntilOnHisFeet(page);
  const samples = await stopFollowing(page);
  return { height: heightOf(samples), samples };
}

/** Walks with `key` held until `reached(stickMan)` holds, then lets go. */
export async function walkUntil(page, key, reached, timeoutMs = 15000) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(`(${reached})(window.__game.stickMan())`, null, { timeout: timeoutMs, polling: 'raf' });
  } finally {
    await page.keyboard.up(key);
  }
}

/** Presses `key` and waits until `changed()` holds in the page: one press, one thing done. */
export async function press(page, key, changed) {
  await hold(page, key, 60);
  await page.waitForFunction(changed, null, { timeout: 5000 });
}

/**
 * On level 3 from its start, as a player does it with the keys the prompts show: walks to the letter, reads it and
 * puts it away, makes the airplane, lifts it, carries it to the edge and sets it down there, ready to board.
 */
export async function airplaneReadyOnTheEdge(page) {
  await walkUntil(page, 'ArrowRight', () => window.__game.interaction() === 'read');
  await press(page, 'k', () => window.__game.letter()?.beingRead === true);
  await press(page, 'k', () => window.__game.letter() === undefined);
  for (let presses = 0; presses < 4 && (await page.evaluate(() => window.__game.stickMan().carrying !== true)); presses += 1) {
    const use = await page.evaluate(() => [window.__game.itemUse(), window.__game.interaction()]);
    if (use[0] !== null) await hold(page, 'j', 60);
    else if (use[1] !== null) await hold(page, 'k', 60);
    await page.waitForTimeout(150);
  }
  const gapFrom = await page.evaluate(() => window.__game.level.floor[0].to.x);
  // Up to where setting it down puts it on the edge: the airplane goes down ahead of him.
  await walkUntil(page, 'ArrowRight', `(man) => man.feet.x >= ${gapFrom} - 1.25`);
  await page.waitForTimeout(100);
  await press(page, 'k', () => window.__game.airplane()?.state === 'resting' && window.__game.airplane()?.onAnEdge === true);
  await page.waitForFunction(() => window.__game.interaction() === 'board', null, { timeout: 5000 });
}
