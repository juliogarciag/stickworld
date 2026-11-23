/* global window */
/**
 * What both the before and the after captures do in the page: open the game,
 * note where the stick man is on every frame, stop the picture at a chosen
 * moment for a screenshot, and walk him off the near end of level 2's gap.
 * Nothing here reads anything this ticket added to the debug API, so the same
 * moves run against the build from before it.
 */
import path from 'node:path';
import { chromium } from 'playwright';
import { PROOF } from './lib.mjs';

/** CSS pixels. The page for the pictures is opened at twice that (`pixelRatio: 2`) so the pencil lines can be looked at closely. */
export const VIEWPORT = { width: 960, height: 540 };

/**
 * Chromium drawing with the machine's graphics card where that is known to work. Without it a headless page draws the
 * game a few frames a second, and a check that reads one sample a frame sees too little of a fall that lasts half a second.
 */
export function launchBrowser() {
  return chromium.launch({ args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] });
}

export async function openGame(browser, { port, video, pixelRatio = 1 }) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: pixelRatio, ...(video ? { recordVideo: { dir: video, size: VIEWPORT } } : {}) });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, { timeout: 15000 });
  // One sample per frame, for as long as the page lives: where he is and what he is doing.
  await page.evaluate(() => {
    window.__samples = [];
    const sample = () => {
      const api = window.__game;
      window.__samples.push({ tick: api.sim.tick, level: api.level.id, ...api.stickMan() });
      window.requestAnimationFrame(sample);
    };
    window.requestAnimationFrame(sample);
  });
  return { context, page, pageErrors };
}

/** Plays `level` from its start and forgets the samples of whatever was played before. */
export async function playLevel(page, level) {
  await page.evaluate((id) => {
    window.__game.loadLevel(id);
    window.__samples.length = 0;
  }, level);
  await page.waitForFunction(() => window.__game.sim.tick > 2);
}

export function samplesOf(page) {
  return page.evaluate(() => window.__samples.slice());
}

/**
 * Stops the game the frame `condition` first holds for the stick man (a function of the debug API, as source text),
 * takes a screenshot of him and what is around him, and lets the game go on. Returns him as he was when it stopped.
 */
export async function shotWhen(page, { name, condition }) {
  const stickMan = await page.evaluate(
    (source) =>
      new Promise((resolve, reject) => {
        window.setTimeout(() => reject(new Error(`the moment to photograph never came: ${source}`)), 15000);
        const holds = new Function('api', `return (${source})(api);`);
        const look = () => {
          const api = window.__game;
          if (!holds(api)) return window.requestAnimationFrame(look);
          api.game.loop.sleep();
          resolve({ tick: api.sim.tick, ...api.stickMan() });
        };
        look();
      }),
    condition,
  );
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(PROOF, name), clip: await aroundHim(page) });
  await page.evaluate(() => window.__game.game.loop.wake());
  return stickMan;
}

/** Holds the right arrow from the start of level 2 until he has walked off the near end of the gap, then lets go. */
export async function walkOffTheGapAndLetGo(page) {
  await playLevel(page, 2);
  await page.keyboard.down('ArrowRight');
  await letGoOfRightArrowWhen(page, `(api) => api.stickMan().action === 'jumping' && api.stickMan().feet.x > api.level.floor[0].to.x`);
}

/**
 * Stands him at the near end of level 2's gap, hops, and holds the right arrow just until he is past the end: in a
 * jump he stops the moment the key is let go, so he comes down beside the end of the line, straight.
 */
export async function hopOffTheEdgeAndStop(page) {
  await playLevel(page, 2);
  const { edge, width } = await page.evaluate(() => ({ edge: window.__game.level.floor[0].to.x, width: window.__game.stickManWidth }));
  await page.keyboard.down('ArrowRight');
  await letGoOfRightArrowWhen(page, `(api) => api.stickMan().feet.x >= ${edge - width / 3}`);
  await page.waitForFunction(() => window.__game.stickMan().action === 'standing', null, { polling: 'raf' });
  await page.keyboard.press('Space');
  await page.keyboard.down('ArrowRight');
  await letGoOfRightArrowWhen(page, `(api) => api.stickMan().feet.x >= ${edge}`);
}

/**
 * Lets go of the right arrow on the very frame `condition` first holds (a function of the debug API, as source text).
 * A key let go from outside the page arrives a few frames late, which at walking speed is further than the width of
 * what is being aimed at, so the page lets go of it itself: the same key-up the game gets from a keyboard.
 */
async function letGoOfRightArrowWhen(page, condition) {
  await page.evaluate(
    (source) =>
      new Promise((resolve, reject) => {
        window.setTimeout(() => reject(new Error(`the moment to let go of the key never came: ${source}`)), 15000);
        const holds = new Function('api', `return (${source})(api);`);
        const look = () => {
          if (!holds(window.__game)) return window.requestAnimationFrame(look);
          window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true }));
          resolve();
        };
        look();
      }),
    condition,
  );
  // So the browser's own idea of the key agrees with the page's.
  await page.keyboard.up('ArrowRight');
}

/**
 * One picture per fall, so each is taken the frame his feet pass its depth: `fall` is played again for every depth in
 * `depths` (metres below the line he left). Returns what was photographed.
 */
export async function shotsOfAFall(page, { prefix, depths, fall }) {
  const shots = [];
  for (const depth of depths) {
    await fall(page);
    const name = `${prefix}-${String(depth).replace('.', '_')}m.png`;
    shots.push({ name, depth, stickMan: await shotWhen(page, { name, condition: feetBelowTheLineBy(depth) }) });
    await untilTheLevelStartsAgain(page);
  }
  return shots;
}

/** Waits until he is back where the level starts, standing: the level started again. */
export async function untilTheLevelStartsAgain(page) {
  await page.waitForFunction(
    () => {
      const { feet, action } = window.__game.stickMan();
      const { start } = window.__game.level;
      return action === 'standing' && Math.abs(feet.x - start.x) < 1e-6 && Math.abs(feet.y - start.y) < 1e-6;
    },
    null,
    { polling: 'raf', timeout: 10000 },
  );
  // A few frames more, so the samples end with him standing there.
  await page.waitForTimeout(100);
}

/** His feet this far below the floor line he left, as a condition for `shotWhen`. */
export const feetBelowTheLineBy = (metres) => `(api) => api.stickMan().action === 'jumping' && api.stickMan().feet.y >= ${metres}`;

// ---- Helpers ----

/** The part of the page that shows him with a body's length of paper on every side, in CSS pixels. */
function aroundHim(page) {
  return page.evaluate(() => {
    const api = window.__game;
    const { feet } = api.stickMan();
    const seen = api.game.scene.getScene('level').cameras.main.worldView;
    const canvas = api.game.canvas.getBoundingClientRect();
    const onPage = (metresX, metresY) => ({
      x: canvas.left + ((metresX * api.pixelsPerMetre - seen.x) / seen.width) * canvas.width,
      y: canvas.top + ((metresY * api.pixelsPerMetre - seen.y) / seen.height) * canvas.height,
    });
    const reach = api.stickManHeight * 1.1;
    const topLeft = onPage(feet.x - reach, feet.y - api.stickManHeight - reach / 2);
    const bottomRight = onPage(feet.x + reach, feet.y + reach / 2);
    const x = Math.max(canvas.left, topLeft.x);
    const y = Math.max(canvas.top, topLeft.y);
    return { x, y, width: Math.min(canvas.right, bottomRight.x) - x, height: Math.min(canvas.bottom, bottomRight.y) - y };
  });
}
