/* global window */
/**
 * The real app, with real keys: a death starts the level again without a page
 * turn and the key still held walks him on, and a flag turns the page to the
 * next level. Both are a level starting at the end of a tick (this ticket);
 * the client has to see them exactly as it did before.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { PROOF, check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

/** Not the port of the dev server left running for the human (5237). */
const PORT = 5937;
const VIEWPORT = { width: 960, height: 540 };
/** The level with the gap no jump crosses. */
const LEVEL_WITH_THE_WIDE_GAP = 3;
const results = [];
const report = {};
const pageErrors = [];

const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
let browser;
try {
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, { timeout: 15000 });

  // A death: he walks into the gap with the key held all the way, and it stays held.
  await page.evaluate((level) => window.__game.loadLevel(level), LEVEL_WITH_THE_WIDE_GAP);
  await page.waitForFunction((level) => window.__game.sim.tick > 5 && window.__game.level.id === level, LEVEL_WITH_THE_WIDE_GAP);
  const startsAt = await page.evaluate(() => window.__game.level.start);
  await watch(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__game.getStickMan().feet.y > 2, null, { timeout: 20000 });
  await page.screenshot({ path: path.join(PROOF, '02-falling-into-the-gap.png') });
  const tickWhileFalling = await page.evaluate(() => window.__game.sim.tick);
  await page.waitForFunction(() => window.__game.getStickMan().feet.y === window.__game.level.start.y, null, { timeout: 10000 });
  const afterDeath = await page.evaluate(() => ({ tick: window.__game.sim.tick, level: window.__game.level.id, man: window.__game.getStickMan() }));
  results.push(check('falling into the gap starts the same level again, and the tick count goes on', afterDeath.level === LEVEL_WITH_THE_WIDE_GAP && afterDeath.tick > tickWhileFalling, `level ${afterDeath.level}, tick ${tickWhileFalling} -> ${afterDeath.tick}`));
  results.push(check('he is back near where the level starts', Math.abs(afterDeath.man.feet.x - startsAt.x) < 1, `x ${afterDeath.man.feet.x.toFixed(2)}, start ${startsAt.x}`));
  await page.waitForTimeout(600);
  const walkedOn = await page.evaluate(() => window.__game.getStickMan());
  results.push(check('the key still held walks him on after the restart, without being pressed again', walkedOn.feet.x > afterDeath.man.feet.x + 0.5, `${walkedOn.action}, x ${afterDeath.man.feet.x.toFixed(2)} -> ${walkedOn.feet.x.toFixed(2)}`));
  await page.screenshot({ path: path.join(PROOF, '02-walking-again-after-the-death.png') });
  await page.keyboard.up('ArrowRight');
  const death = await watched(page);
  results.push(check('a death is not a page turn', death.turnsSeen === 0 && death.levels.length === 1, `page turns seen in ${death.frames} frames: ${death.turnsSeen}; levels: ${death.levels}`));

  // A flag: on the first level he walks to it, and the next level starts with the page turning.
  await page.evaluate(() => window.__game.loadLevel(1));
  await page.waitForFunction(() => window.__game.sim.tick > 5 && window.__game.level.id === 1);
  await watch(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__game.getFlag().isReached, null, { timeout: 30000 });
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.__game.level.id === 2, null, { timeout: 15000 });
  await page.waitForFunction(() => window.__game.getPageTurn() !== null, null, { timeout: 3000 }).catch(() => undefined);
  await page.screenshot({ path: path.join(PROOF, '02-the-page-turns-to-level-2.png') });
  await page.waitForFunction(() => window.__game.getPageTurn() === null, null, { timeout: 15000 });
  const flag = await watched(page);
  const onLevel2 = await page.evaluate(() => ({ level: window.__game.level.id, man: window.__game.getStickMan(), start: window.__game.level.start }));
  results.push(check('reaching the flag starts the next level', onLevel2.level === 2 && flag.levels.join() === '1,2', `levels seen: ${flag.levels}`));
  results.push(check('the page is turned between the two', flag.turnsSeen > 10, `the turn was seen in ${flag.turnsSeen} of ${flag.frames} frames`));
  results.push(check('the turn begins on the frame the level changes: the new level is never shown bare', flag.framesOnTheNewLevelBeforeTheTurn === 0, `frames on level 2 before the turn: ${flag.framesOnTheNewLevelBeforeTheTurn}`));
  results.push(check('he stands where level 2 starts', Math.abs(onLevel2.man.feet.x - onLevel2.start.x) < 0.01 && onLevel2.man.feet.y === onLevel2.start.y, `x ${onLevel2.man.feet.x}`));
  await page.screenshot({ path: path.join(PROOF, '02-level-2-after-the-turn.png') });

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
  Object.assign(report, { afterDeath, walkedOn, death, flag, onLevel2 });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('02-dies-and-turns-the-page-in-the-browser.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** Starts noting, every frame, which level is played and whether a page is being turned. */
function watch(page) {
  return page.evaluate(() => {
    const seen = { frames: 0, turnsSeen: 0, levels: [], framesOnTheNewLevelBeforeTheTurn: 0, turned: false, watching: true };
    window.__seen = seen;
    const first = window.__game.level.id;
    const look = () => {
      if (!seen.watching) return;
      const level = window.__game.level.id;
      const turning = window.__game.getPageTurn() !== null;
      seen.frames += 1;
      if (turning) seen.turnsSeen += 1;
      seen.turned ||= turning;
      if (level !== first && !seen.turned) seen.framesOnTheNewLevelBeforeTheTurn += 1;
      if (seen.levels.at(-1) !== level) seen.levels.push(level);
      window.requestAnimationFrame(look);
    };
    window.requestAnimationFrame(look);
  });
}

/** Stops noting and gives what was seen. */
function watched(page) {
  return page.evaluate(() => {
    window.__seen.watching = false;
    return window.__seen;
  });
}
