/* global window */
/**
 * What goes wrong on level 3's flight, played with the real keyboard in
 * Chromium against `pnpm dev`, and recorded: doing nothing sinks into the gap
 * and the level starts again with a new letter; climbing all the way stalls
 * and falls short; and a flight that would fall just short is saved by
 * jumping out next to the far edge.
 */
import path from 'node:path';
import { PROOF, check, summarize, writeProof } from './lib.mjs';
import { openLevel3, putTheAirplaneOnTheEdge, stateOf, untilTheSim } from './play.mjs';

/** A port no other session uses, and not the one of the dev server left running for the human (5205). */
const PORT = 5916;
const NAME = '02-falls-and-saves';
const results = [];
const report = {};
let game;
try {
  game = await openLevel3({ port: PORT, name: NAME, results });
  const { page, pageErrors } = game;

  // ---- 1. Boarding and doing nothing: it sinks into the gap ----
  await putTheAirplaneOnTheEdge(page);
  await page.keyboard.press('k');
  await untilTheSim(page, 'him to be seated', (api) => api.stickMan().action === 'seated');
  await untilTheSim(page, 'it to sink below the line', (api) => api.stickMan().action === 'seated' && api.airplane().at.y > 1);
  const sinking = await stateOf(page);
  await page.screenshot({ path: path.join(PROOF, '07-sinking-into-the-gap.png') });
  results.push(check('left alone it sinks below the line short of the far side, with him in it', sinking.stickMan.action === 'seated' && sinking.airplane.at.x < sinking.gap.to && sinking.airplane.pitch < 0, `${sinking.airplane.at.y.toFixed(2)} m below the line at x ${sinking.airplane.at.x.toFixed(2)}, the far side starts at ${sinking.gap.to}`));
  await untilTheSim(page, 'the level to start again', (api) => api.stickMan().action !== 'seated');
  const afterTheFall = await stateOf(page);
  results.push(check('falling while flying kills him: the level starts again from its start', afterTheFall.level === 3 && samePoint(afterTheFall.stickMan.feet, afterTheFall.start) && afterTheFall.stickMan.action === 'standing' && afterTheFall.flag.reached === false, `feet at ${JSON.stringify(afterTheFall.stickMan.feet)}`));
  results.push(check('the airplane is lost with him: none in the world, none in his slot', afterTheFall.airplane === null && afterTheFall.slots.every((item) => item === null), `slots ${JSON.stringify(afterTheFall.slots)}`));
  await untilTheSim(page, 'a new letter to fall', (api) => api.letter() !== undefined && api.letter().height > 0);
  const newLetter = await stateOf(page);
  await untilTheSim(page, 'the new letter to be half way down', (api) => api.letter().height < 4);
  await page.screenshot({ path: path.join(PROOF, '08-a-new-letter-falls.png') });
  results.push(check('so a new letter falls from the sky, as issue #4 defined', newLetter.letter.height > 0 && newLetter.letter.beingRead === false, `${newLetter.letter.height.toFixed(2)} m up, coming down`));

  // ---- 2. Climbing all the way: it stalls and falls short ----
  const again = await putTheAirplaneOnTheEdge(page);
  results.push(check('the new letter gives a new paper, which folds into a new airplane he carries to the edge', again.airplane?.onAnEdge === true && again.interaction === 'board'));
  await page.keyboard.down('k');
  await untilTheSim(page, 'him to be seated', (api) => api.stickMan().action === 'seated');
  await page.keyboard.down('ArrowUp');
  await page.keyboard.up('k');
  await untilTheSim(page, 'it to stall', (api) => api.airplane()?.state === 'falling');
  const stalled = await stateOf(page);
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(PROOF, '09-stalled.png') });
  const falling = await stateOf(page);
  await page.keyboard.up('ArrowUp');
  results.push(check('held up all the way, it climbs until it is too slow and stalls high over the gap', stalled.airplane.state === 'falling' && stalled.stickMan.action === 'seated' && stalled.airplane.at.x < stalled.gap.to && -stalled.airplane.at.y > 2, `stalled ${(-stalled.airplane.at.y).toFixed(2)} m up at x ${stalled.airplane.at.x.toFixed(2)}, at ${stalled.airplane.speed.toFixed(2)} m/s sideways (stall speed ${stalled.airplane.stallSpeed})`));
  results.push(check('stalled it falls faster and faster with him in it, whatever is held', falling.airplane?.state === 'falling' && falling.stickMan.action === 'seated' && falling.airplane.verticalSpeed > stalled.airplane.verticalSpeed + 1, `${stalled.airplane.verticalSpeed.toFixed(2)} -> ${falling.airplane?.verticalSpeed.toFixed(2)} m/s down`));
  let reachedTheFarSide = false;
  for (;;) {
    const now = await stateOf(page);
    if (now.stickMan.action !== 'seated') break;
    if (now.airplane && now.airplane.at.x >= now.gap.to && now.airplane.at.y < 0) reachedTheFarSide = true;
  }
  const afterTheStall = await stateOf(page);
  results.push(check('it falls short of the far side and the level starts again', !reachedTheFarSide && samePoint(afterTheStall.stickMan.feet, afterTheStall.start) && afterTheStall.airplane === null && afterTheStall.flag.reached === false));

  // ---- 3. A climb a little too short, saved by jumping out next to the far edge ----
  await putTheAirplaneOnTheEdge(page);
  await page.keyboard.down('k');
  await untilTheSim(page, 'him to be seated', (api) => api.stickMan().action === 'seated');
  await page.keyboard.down('ArrowUp');
  await page.keyboard.up('k');
  // Let go a little too soon: the nose not as far up as a flight that crosses needs.
  await untilTheSim(page, 'the nose to be part of the way up', (api) => api.airplane()?.pitch >= 0.55);
  await page.keyboard.up('ArrowUp');
  // He holds the walk key towards the far side, which does nothing yet, and jumps out three quarters of a metre before the edge.
  await page.keyboard.down('ArrowRight');
  await untilTheSim(page, 'it to be next to the far edge', (api) => api.airplane() && api.airplane().at.x >= api.level.floor[1].from.x - 0.75);
  const beforeTheJump = await stateOf(page);
  await page.keyboard.down('Space');
  await untilTheSim(page, 'him to be out of his seat', (api) => api.stickMan().action === 'jumping');
  await page.keyboard.up('Space');
  const jumpedOut = await stateOf(page);
  await page.screenshot({ path: path.join(PROOF, '10-jumping-out.png') });
  await untilTheSim(page, 'him to land or to die', (api) => api.stickMan().action !== 'jumping');
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);
  const saved = await stateOf(page);
  await page.screenshot({ path: path.join(PROOF, '11-saved-on-the-far-side.png') });
  results.push(check('the airplane came in too low to land: at or under the height of the line just before the far edge', beforeTheJump.stickMan.action === 'seated' && beforeTheJump.airplane.at.x < beforeTheJump.gap.to && beforeTheJump.airplane.at.y > -0.35, `${(-beforeTheJump.airplane.at.y).toFixed(2)} m above the line at x ${beforeTheJump.airplane.at.x.toFixed(2)}, sinking`));
  results.push(check('the jump key stands him up and jumps him out; the airplane falls on without him', jumpedOut.stickMan.action === 'jumping' && jumpedOut.stickMan.verticalSpeed < 0 && jumpedOut.airplane?.state === 'falling', `he rises at ${(-jumpedOut.stickMan.verticalSpeed).toFixed(2)} m/s, the airplane is ${jumpedOut.airplane?.state}`));
  results.push(check('the jump saves him: he stands on the far side, and the level did not start again', saved.stickMan.feet.y === 0 && saved.stickMan.feet.x > saved.gap.to && saved.tick > beforeTheJump.tick, `feet at x ${saved.stickMan.feet.x.toFixed(2)}, the far side starts at ${saved.gap.to}`));

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
  Object.assign(report, { sinking, afterTheFall, newLetter, again, stalled, falling, afterTheStall, beforeTheJump, jumpedOut, saved });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof(`${NAME}.json`, report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

function samePoint(one, other) {
  return Math.abs(one.x - other.x) < 1e-9 && Math.abs(one.y - other.y) < 1e-9;
}
