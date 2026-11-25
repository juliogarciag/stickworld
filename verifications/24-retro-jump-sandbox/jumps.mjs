/* global window, document */
/**
 * What the scripts of this folder share: opening the game, measuring a jump the way a player makes one (the space key
 * held for a while), and the movement panel's controls. Every expected number comes from the page: the tuning the
 * sim has, through `window.__game.movementTuning()`.
 */
import { check, lastLinesOf, start, waitFor, waitForPort } from './lib.mjs';

/** Not 5224, the port of the dev server left running for the human. */
export const PORT = 5924;
export const VIEWPORT = { width: 1100, height: 620 };

/** Starts the dev server on PORT and says, as a check, whether it is this run's. */
export async function startDevServer(results) {
  const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');
  return devServer;
}

/** Opens the game in a new page of `context` and waits for the sim and the movement panel. */
export async function openGame(context, { pageErrors }) {
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10 && document.querySelector('.lil-gui.lil-root'), null, { timeout: 15000 });
  await installJumpWatcher(page);
  return page;
}

/**
 * Jumps with the space key held for `holdMs` (0: a tap, down and up at once), or until the sim says he is at the top
 * (`holdToTheTop`: a full jump however slowly a headless browser runs the sim), and says how high his feet got above
 * where they were, and how many ticks to the top and in the air, read from the sim after every tick.
 */
export async function jumpWithKey(page, { holdMs = 0, holdToTheTop = false }) {
  await waitUntilStanding(page);
  // Watching starts before the key goes down, so that the first tick of the jump is seen too.
  await page.evaluate(() => {
    window.jumpBeingWatched = window.watchOneJump();
  });
  await page.keyboard.down('Space');
  if (holdToTheTop) await page.waitForFunction(() => window.__game.stickMan().action === 'jumping' && window.__game.stickMan().verticalSpeed >= 0, null, { timeout: 5000 });
  else if (holdMs > 0) await page.waitForTimeout(holdMs);
  await page.keyboard.up('Space');
  return page.evaluate(() => window.jumpBeingWatched);
}

/** Waits until the sim has run `ticks` more ticks: a headless browser may run fewer than 60 a second. */
export async function waitForTicks(page, ticks) {
  const from = await page.evaluate(() => window.__game.sim.tick);
  await page.waitForFunction((until) => window.__game.sim.tick >= until, from + ticks, { timeout: 5000 });
}

export async function waitUntilStanding(page) {
  await page.waitForFunction(() => ['standing', 'walking'].includes(window.__game.stickMan().action), null, { timeout: 5000 });
  await page.waitForTimeout(150);
}

/**
 * Starts writing down, after every tick of the sim being played, the commands it was given and the stick man as the
 * sim then has him; `ticksRecorded` returns the list. Like the jump watcher, a check's own instrument.
 */
export async function recordTicks(page) {
  await page.evaluate(() => {
    const api = window.__game;
    const sim = api.sim;
    const step = sim.step;
    window.ticksRecorded = [];
    sim.step = (commands) => {
      step.call(sim, commands);
      window.ticksRecorded.push({ tick: sim.tick, commands: commands ?? [], stickMan: api.stickMan() });
    };
  });
}

export function ticksRecorded(page) {
  return page.evaluate(() => window.ticksRecorded);
}

/** The text field of the panel's knob called `label`. */
export function knob(page, label) {
  return page.locator('.lil-gui .lil-controller', { hasText: label }).locator('input').first();
}

export async function panelIsOpen(page) {
  return page.evaluate(() => !document.querySelector('.lil-gui.lil-root').classList.contains('lil-closed'));
}

export async function openPanel(page) {
  if (!(await panelIsOpen(page))) await page.locator('.lil-gui.lil-root > .lil-title').click();
  await page.waitForTimeout(400);
}

export async function choosePreset(page, label) {
  await page.locator('.lil-gui .lil-controller.lil-option select').selectOption({ label });
  await page.waitForTimeout(200);
}

export async function setKnob(page, label, value) {
  const input = knob(page, label);
  await input.fill(String(value));
  await input.press('Enter');
  await page.waitForTimeout(200);
}

export function movementTuning(page) {
  return page.evaluate(() => window.__game.movementTuning());
}

// ---- Helpers ----

/**
 * Installs `watchOneJump` in the page: resolves once he has been in the air and stands again, or after 600 ticks or 30 s. It reads
 * him after every tick of the sim (frames can be fewer than ticks in a headless browser, and would miss the top), by
 * wrapping `step` on the sim being played: a check's own instrument, never the game's.
 */
async function installJumpWatcher(page) {
  await page.evaluate(() => {
    window.watchOneJump = () =>
      new Promise((resolve) => {
        const api = window.__game;
        const sim = api.sim;
        const floor = api.stickMan().feet.y;
        const startTick = sim.tick;
        const step = sim.step;
        let highest = 0;
        let topTick = startTick;
        let left = false;
        const finish = (landed) => {
          sim.step = step;
          resolve({ highest, ticksToTop: topTick - startTick, ticksInTheAir: sim.tick - startTick, dt: sim.dt, landed });
        };
        const timeout = window.setTimeout(() => finish(false), 30000);
        sim.step = (commands) => {
          step.call(sim, commands);
          const stickMan = api.stickMan();
          const height = floor - stickMan.feet.y;
          if (height > highest) {
            highest = height;
            topTick = sim.tick;
          }
          if (stickMan.action === 'jumping') left = true;
          else if (left) {
            window.clearTimeout(timeout);
            finish(true);
          } else if (sim.tick - startTick >= 600) {
            window.clearTimeout(timeout);
            finish(false);
          }
        };
      });
  });
}
