/* global window */
/**
 * What both scripts do with the page: open the game on the practice yard with a video of it,
 * read the sim through `window.__game`, wait for a moment in it, and take a picture of exactly
 * that moment by putting Phaser's loop to sleep for the length of the screenshot.
 */
import { chromium } from 'playwright';
import { renameSync } from 'node:fs';
import path from 'node:path';
import { PROOF, getLastLines, start, waitFor, waitForPort } from './lib.mjs';

/** The practice level with the club enemy on it (`practiceLevels` in the sim). */
export const YARD = 900;
/** CSS pixels; the page opens at a pixel ratio of 1 so screen, device and CSS pixels agree. */
export const VIEWPORT = { width: 960, height: 540 };

/**
 * Starts `VITE_LEVEL=900 PORT=<port> pnpm dev` and opens the page in Chromium, recording a video.
 * Returns the page, what went wrong on it, and `close(videoName)`, which stops everything and
 * keeps the video under that name in ./proof.
 */
export async function openYard(port) {
  const devServer = start('pnpm', ['dev'], { env: { PORT: String(port), VITE_LEVEL: String(YARD) } });
  // The ready line proves the port is this run's server, not something that was already listening
  // there.
  const isReady =
    (await waitForPort(port)) &&
    (await waitFor("the dev server's ready line", {
      read: () => devServer.output.includes(`localhost:${port}/`),
      until: Boolean,
    }).catch(() => false));
  if (!isReady) {
    devServer.stop();
    throw new Error(`the dev server did not start: ${getLastLines(devServer.output)}`);
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: PROOF, size: VIEWPORT },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, {
    timeout: 15000,
  });
  return {
    page,
    pageErrors,
    async close(videoName) {
      const video = page.video();
      await context.close();
      await browser.close();
      devServer.stop();
      if (video) {
        renameSync(await video.path(), path.join(PROOF, videoName));
      }
    },
  };
}

/** The sim as the page has it right now: the stick man, the first enemy with its def, the level. */
export function readGame(page) {
  return page.evaluate(() => {
    const api = window.__game;
    const enemy = api.getEnemies()[0];
    return {
      tick: api.sim.tick,
      dt: api.sim.dt,
      level: api.level,
      stickMan: api.getStickMan(),
      stickManWidth: api.stickManWidth,
      stickManHeight: api.stickManHeight,
      jumpHeight: api.getMovementTuning().jumpHeight,
      enemies: api.getEnemies(),
      enemy,
      enemyDef: enemy && api.defs.find((def) => def.id === enemy.defId),
      flag: api.getFlag(),
      itemUse: api.getItemUse(),
      interaction: api.getInteraction(),
    };
  });
}

/**
 * Waits until `isNow` holds in the page, looking once a frame. `isNow` runs in the page and gets
 * `argument`.
 */
export function waitUntil(page, isNow, argument, timeoutMs = 20000) {
  return page.waitForFunction(isNow, argument, { polling: 'raf', timeout: timeoutMs });
}

/**
 * Stops the game on the first frame `isNow` holds, takes a picture of it into ./proof, reads the
 * sim as it is in the picture, and lets the game go on. The sim does not advance while the picture
 * is taken, so what is read is what is shown.
 */
export async function takePictureWhen(page, name, isNow, argument) {
  await page.evaluate(
    ([source, passed]) =>
      new Promise((resolve) => {
        const isNowInPage = new Function('argument', `return (${source})(argument)`);
        const look = () => {
          if (isNowInPage(passed)) {
            window.__game.game.loop.sleep();
            resolve();
          } else {
            window.requestAnimationFrame(look);
          }
        };
        look();
      }),
    [isNow.toString(), argument],
  );
  await page.screenshot({ path: path.join(PROOF, name) });
  const game = await readGame(page);
  await page.evaluate(() => window.__game.game.loop.wake());
  return game;
}

/**
 * Makes the enemy swing at nothing with the keys a player has: walks right until the club goes
 * back, walks left until it has come down, and lets go.
 */
export async function makeEnemySwingAtNothing(page) {
  await page.keyboard.down('ArrowRight');
  await waitUntil(page, () => window.__game.getEnemies()[0].action === 'windingUp');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await waitUntil(page, () => window.__game.getEnemies()[0].action === 'recovering');
  await page.keyboard.up('ArrowLeft');
}
