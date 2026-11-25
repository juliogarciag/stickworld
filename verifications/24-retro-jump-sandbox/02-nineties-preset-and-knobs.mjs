/* global window */
/**
 * The owner's loop, from the panel: open it, choose "90s platformer", jump with the key held long and tapped, move a
 * knob and feel it at once, steer and stop in the air, reload and find the choice kept, play the level again and
 * keep it, and type into the panel without moving him.
 */
import path from 'node:path';
import { chromium } from 'playwright';
import { PROOF, check, summarize, writeProof } from './lib.mjs';
import { VIEWPORT, choosePreset, jumpWithKey, knob, movementTuning, openGame, openPanel, panelIsOpen, recordTicks, setKnob, startDevServer, ticksRecorded, waitForTicks, waitUntilStanding } from './jumps.mjs';

const STICK_MAN_HEIGHT_ROUNDING = 0.05;
const results = [];
const report = {};
const pageErrors = [];

let devServer;
let browser;
try {
  devServer = await startDevServer(results);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  let page = await openGame(context, { pageErrors });
  const current = await movementTuning(page);
  const stickManHeight = await page.evaluate(() => window.__game.stickManHeight);

  await openPanel(page);
  await choosePreset(page, '90s platformer');
  const nineties = await movementTuning(page);
  report.nineties = nineties;
  results.push(check('choosing the 90s preset reaches the sim: a jump about twice his height, cut whole by letting go', nineties.jumpHeight >= 2 * stickManHeight - STICK_MAN_HEIGHT_ROUNDING && nineties.letGoCut === 1 && nineties.fallGravity > nineties.riseGravity, JSON.stringify(nineties)));
  await page.screenshot({ path: path.join(PROOF, '02-panel-open-with-the-90s-preset.png') });

  // Held long, the jump goes to the top; tapped, it is a short hop; in between, in between.
  const held = await jumpWithKey(page, { holdMs: 700 });
  const middle = await jumpWithKey(page, { holdMs: 120 });
  const tapped = await jumpWithKey(page, { holdMs: 0 });
  report.jumps = { held, middle, tapped };
  results.push(check('held, the jump lifts his feet to the preset height', held.landed && held.highest > nineties.jumpHeight * 0.95 && held.highest <= nineties.jumpHeight + 1e-6, `${held.highest.toFixed(2)} m, ${(held.highest / stickManHeight).toFixed(2)} of his height`));
  results.push(check('it rises fast: at the top in less than 0.4 s', held.ticksToTop * held.dt < 0.4, `${(held.ticksToTop * held.dt).toFixed(3)} s`));
  results.push(check('a tap is a short hop, a short hold is in between', tapped.highest < held.highest / 3 && tapped.highest < middle.highest && middle.highest < held.highest, `tap ${tapped.highest.toFixed(2)} m, 120 ms ${middle.highest.toFixed(2)} m, held ${held.highest.toFixed(2)} m`));

  // A knob changes the very next jump.
  await openPanel(page);
  await setKnob(page, 'jump height (m)', 2);
  const afterKnob = await movementTuning(page);
  const heldAfterKnob = await jumpWithKey(page, { holdMs: 700 });
  report.afterKnob = { tuning: afterKnob, jump: heldAfterKnob };
  results.push(check('moving the jump height knob to 2 m changes the next jump at once', afterKnob.jumpHeight === 2 && heldAfterKnob.highest > 1.9 && heldAfterKnob.highest <= 2 + 1e-6, `${heldAfterKnob.highest.toFixed(3)} m`));

  // Full air control: in a jump he turns at once, and with no key he stops at once, on the very tick the sim hears it.
  await waitUntilStanding(page);
  await recordTicks(page);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await waitForTicks(page, 4);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await waitForTicks(page, 2);
  await page.keyboard.up('ArrowLeft');
  await waitForTicks(page, 2);
  await page.keyboard.up('Space');
  const ticks = await ticksRecorded(page);
  const heard = (direction) => ticks.find((tick) => tick.commands.some((command) => command.type === 'player/walk' && command.direction === direction) && tick.stickMan.action === 'jumping');
  const turned = heard(-1);
  const stopped = ticks.find((tick) => tick.tick > (turned?.tick ?? Infinity) && tick.commands.some((command) => command.type === 'player/walk' && command.direction === 0));
  report.airControl = { turned, stopped };
  results.push(check('in the air he turns at once and stops at once', turned?.stickMan.horizontalSpeed === -nineties.walkSpeed && stopped?.stickMan.action === 'jumping' && stopped.stickMan.horizontalSpeed === 0, `on the tick of the turn ${turned?.stickMan.horizontalSpeed} m/s, on the tick of the stop ${stopped?.stickMan.action} ${stopped?.stickMan.horizontalSpeed} m/s`));

  // Keys typed into the panel are the panel's.
  await waitUntilStanding(page);
  const before = await page.evaluate(() => window.__game.stickMan().feet.x);
  await knob(page, 'walk speed (m/s)').focus();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  const after = await page.evaluate(() => window.__game.stickMan().feet.x);
  await page.evaluate(() => window.document.activeElement?.blur());
  results.push(check('an arrow key pressed in a knob does not walk him', after === before, `x ${before} then ${after}`));

  // Kept: a reload, then playing the level again (a new sim).
  await page.close();
  page = await openGame(context, { pageErrors });
  await page.waitForTimeout(400);
  const reloaded = await movementTuning(page);
  results.push(check('a reload keeps what was chosen', JSON.stringify(reloaded) === JSON.stringify(afterKnob), JSON.stringify(reloaded)));
  await page.evaluate(() => window.__game.loadLevel(window.__game.level.id));
  const rightAfterLoad = await movementTuning(page);
  await page.waitForTimeout(600);
  const settled = await movementTuning(page);
  results.push(check('a new sim (loadLevel) starts with the current preset and is given the chosen tuning again', JSON.stringify(rightAfterLoad) === JSON.stringify(current) && JSON.stringify(settled) === JSON.stringify(afterKnob), `${rightAfterLoad.jumpHeight} m, then ${settled.jumpHeight} m`));

  // A button of the panel gives the keys back: the title clicked to fold it and open it again, then a jump.
  await page.locator('.lil-gui.lil-root > .lil-title').click();
  await page.locator('.lil-gui.lil-root > .lil-title').click();
  await page.waitForTimeout(400);
  const afterTitle = await jumpWithKey(page, { holdMs: 300 });
  results.push(check('after the panel title is clicked, space still jumps him and does not fold the panel', afterTitle.landed && afterTitle.highest > 1 && (await panelIsOpen(page)), `${afterTitle.highest.toFixed(2)} m`));

  // "Back to the preset" puts the preset's numbers back after a knob moved one.
  await page.locator('.lil-gui .lil-controller', { hasText: 'back to the preset' }).locator('button').click();
  await page.waitForTimeout(300);
  const backToPreset = await movementTuning(page);
  results.push(check('"back to the preset" puts the 90s numbers back', JSON.stringify(backToPreset) === JSON.stringify(nineties), `jump height ${backToPreset.jumpHeight} m`));

  // Back to the game as it is.
  await openPanel(page);
  await choosePreset(page, 'current');
  results.push(check('choosing "current" again gives back the game as it is', JSON.stringify(await movementTuning(page)) === JSON.stringify(current)));

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer?.stop();
}

report.results = results;
writeProof('02-nineties-preset-and-knobs.json', report);
process.exit(summarize(results) ? 0 : 1);
