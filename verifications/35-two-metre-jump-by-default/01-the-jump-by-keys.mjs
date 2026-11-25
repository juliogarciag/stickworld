/* global window, KeyboardEvent */
/**
 * The game's own jump in a fresh game, with no panel touched, played with the real keys: the owner's 2 m jump held,
 * a hop tapped, the up keys as the jump key, a jump let go of by a window that loses focus, the jump out of the
 * airplane, and a fall off an edge that stops at once and never falls faster than 10 m/s. His pose is `03-poses.mjs`.
 */
import path from 'node:path';
import { PROOF, check, summarize, writeProof } from './lib.mjs';
import { airplaneReadyOnTheEdge, hold, jumpWith, openTheGame, playLevelAgain, startFollowing, stopFollowing, waitUntilOnHisFeet, walkUntil } from './game.mjs';

/** A port no other session uses, and not the one of the dev server left running for the human (5235). */
const PORT = 5935;
/** The owner's numbers, as issue #35 gives them: what a fresh game must play. */
const OWNERS_JUMP = { walkSpeed: 2.2, jumpHeight: 2, jumpHeightCarrying: 0.7, riseGravity: 20, fallGravity: 20, fastestFall: 10, letGoCut: 1, airSteering: 100, airBraking: 100 };
/** The jump the game had before, `MOVEMENT_PRESETS.smallJump`: only for the "before" screenshots. */
/**
 * A tap is the shortest hop the frames allow: the keys are read once a frame, so a slow frame between the key going
 * down and up counts as a few ticks held. Well under half the held jump, however the frames fall.
 */
const MOST_OF_A_TAP = 0.4;
const results = [];
const report = {};
const pageErrors = [];

let game;
try {
  game = await openTheGame({ port: PORT, results, pageErrors, recordVideoDir: path.join(PROOF, 'video-01') });
  const { page } = game;

  const tuning = await page.evaluate(() => window.__game.movementTuning());
  results.push(check("a fresh game plays the owner's numbers", JSON.stringify(tuning) === JSON.stringify(OWNERS_JUMP), JSON.stringify(tuning)));
  const { jumpHeight } = tuning;

  // The jump key: held, a little over his height; tapped, a hop; held a moment, in between.
  await playLevelAgain(page, 1);
  const heldSpace = await jumpWith(page, 'Space', 900);
  results.push(check('Space held: his feet get 2 m up', heldSpace.height > 0.97 * jumpHeight && heldSpace.height <= jumpHeight + 1e-6, `${heldSpace.height.toFixed(3)} m`));
  const tappedSpace = await jumpWith(page, 'Space', 0);
  results.push(check('Space tapped: a short hop', tappedSpace.height > 0 && tappedSpace.height < MOST_OF_A_TAP * jumpHeight, `${tappedSpace.height.toFixed(3)} m`));
  const briefSpace = await jumpWith(page, 'Space', 200);
  results.push(check('Space held a fifth of a second: between the hop and the full jump', briefSpace.height > tappedSpace.height && briefSpace.height < 0.95 * heldSpace.height, `${briefSpace.height.toFixed(3)} m`));
  report.space = { held: heldSpace.height, tapped: tappedSpace.height, fifthOfASecond: briefSpace.height };

  // The up keys are the jump key too, and are let go of the same way.
  for (const key of ['ArrowUp', 'w']) {
    const held = await jumpWith(page, key, 900);
    const tapped = await jumpWith(page, key, 0);
    results.push(check(`${key} held jumps 2 m, tapped hops`, held.height > 0.97 * jumpHeight && tapped.height < MOST_OF_A_TAP * jumpHeight, `${held.height.toFixed(3)} m held, ${tapped.height.toFixed(3)} m tapped`));
    report[key] = { held: held.height, tapped: tapped.height };
  }

  // The window loses focus with the key still down: Phaser forgets held keys, and the rise is cut there.
  await startFollowing(page);
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  // A key still held when focus comes back goes on repeating: the browser sends keydown with repeat set.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, repeat: true })));
  await waitUntilOnHisFeet(page);
  const blurred = await stopFollowing(page);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  const blurredHeight = Math.max(...blurred.map((sample) => blurred[0].y - sample.y));
  const standsAfter = await page.evaluate(() => window.__game.stickMan().action);
  results.push(check('a window that loses focus mid-jump lets go of it: the rise stops short', blurredHeight < 0.8 * jumpHeight && blurredHeight > tappedSpace.height, `${blurredHeight.toFixed(3)} m`));
  results.push(check('the key still down and repeating when focus comes back does not jump him again', standsAfter === 'standing', standsAfter));
  report.blurred = blurredHeight;

  // A fall off an edge: with the key let go he stops almost at once, and never falls faster than 10 m/s.
  await playLevelAgain(page, 1);
  await startFollowing(page);
  await walkUntil(page, 'ArrowLeft', (man) => man.action === 'jumping');
  await page.waitForTimeout(500);
  await page.waitForFunction(() => window.__game.stickMan().feet.x > 0.5 && window.__game.stickMan().action === 'standing', null, { timeout: 8000 });
  const fall = (await stopFollowing(page)).filter((sample) => sample.action === 'jumping' && sample.level === 1);
  const fallStart = fall[0];
  const stoppedAt = fall.find((sample) => sample.vx === 0);
  const fastest = Math.max(...fall.map((sample) => sample.vy));
  results.push(check('let go over the edge, he stops sideways within a tenth of a second', stoppedAt !== undefined && stoppedAt.tick - fallStart.tick <= 6, stoppedAt ? `${stoppedAt.tick - fallStart.tick} ticks` : 'never'));
  results.push(check('he never falls faster than 10 m/s, and gets there', fastest === OWNERS_JUMP.fastestFall, `${fastest} m/s`));
  report.fall = { ticksToStop: stoppedAt ? stoppedAt.tick - fallStart.tick : null, fastest };

  // The jump out of the airplane: the jump key, tapped a hop, held a full jump.
  report.jumpOut = {};
  for (const [name, ms] of [['tapped', 0], ['held', 900]]) {
    await playLevelAgain(page, 3);
    await airplaneReadyOnTheEdge(page);
    await hold(page, 'k', 60);
    await page.waitForFunction(() => window.__game.stickMan().action === 'seated', null, { timeout: 5000 });
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(300);
    await startFollowing(page);
    await hold(page, 'Space', ms);
    await page.keyboard.up('ArrowUp');
    await page.waitForFunction(() => window.__game.stickMan().action === 'jumping' && window.__game.stickMan().verticalSpeed > 0, null, { timeout: 5000 });
    const followed = await stopFollowing(page);
    const seat = followed.filter((sample) => sample.action === 'seated').at(-1);
    const out = followed.filter((sample) => sample.action === 'jumping');
    report.jumpOut[name] = Math.max(...out.map((sample) => seat.y - sample.y));
  }
  results.push(check('jumping out of the airplane: a tap hops, held it is a full jump', report.jumpOut.tapped < MOST_OF_A_TAP * jumpHeight && report.jumpOut.held > 0.97 * jumpHeight, `${report.jumpOut.tapped.toFixed(3)} m tapped, ${report.jumpOut.held.toFixed(3)} m held`));

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof('01-the-jump-by-keys.json', report);
process.exit(summarize(results) ? 0 : 1);
