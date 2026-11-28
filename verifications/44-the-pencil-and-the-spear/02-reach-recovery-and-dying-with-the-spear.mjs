/**
 * The thrust looked at a frame at a time, with the page's clock in the script's hands: what it
 * looks like as it goes out and is drawn back, that a second press during the drawing back does
 * nothing, that from just outside the club's reach the spear rubs the enemy out while the enemy
 * never swings, what the rubbing out looks like, and that dying, by a fall and by the club, costs
 * neither the spear nor a second reading of the letter.
 */
import { check, summarize, writeProof } from './lib.mjs';
import {
  getItemId,
  openGame,
  stepFrames,
  stepFramesUntil,
  takeScreenshot,
} from './game.mjs';

/** Not the port of the dev server left running for the human (5244), nor the first script's. */
const PORT = 5945;
const NAME = '02-reach-recovery-and-dying-with-the-spear';
const results = [];
const report = {};
let game;
try {
  game = await openGame(PORT, results, { steppedClock: true });
  const { page } = game;
  const spearId = await getItemId(page, 'spear');

  // Letter, pencil, spear, as in the first script.
  await page.keyboard.down('ArrowRight');
  await stepFramesUntil(page, 'the letter within reach', (now) => now.interaction === 'read');
  await page.keyboard.up('ArrowRight');
  for (const key of ['KeyK', 'KeyK', 'KeyJ']) {
    await page.keyboard.press(key);
    await stepFrames(page, 3);
  }
  const ready = await stepFrames(page, 30);
  results.push(
    check(
      'the spear is in its hand, ready',
      ready.slots[0].itemDefId === spearId && ready.spear?.action === 'ready' && ready.itemUse === 'thrust',
    ),
  );
  await takeScreenshot(page, '08-thrust-0-ready.png');

  // One thrust at nothing, every frame of it.
  await page.keyboard.press('KeyJ');
  const frames = [];
  let shots = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    const now = await stepFrames(page);
    frames.push(now);
    const previous = frames.at(-2)?.spear;
    const isFirstFrameOut = now.spear.action === 'thrusting' && shots === 0;
    const isAllTheWayOut = now.spear.action === 'recovering' && previous?.action === 'thrusting';
    const isHalfDrawnBack =
      now.spear.action === 'recovering' && now.spear.progress >= 0.5 && previous.progress < 0.5;
    if (isFirstFrameOut || isAllTheWayOut || isHalfDrawnBack) {
      shots += 1;
      const name = isFirstFrameOut ? 'going-out' : isAllTheWayOut ? 'all-the-way-out' : 'drawn-back-half';
      await takeScreenshot(page, `08-thrust-${shots}-${name}.png`);
    }
    if (isHalfDrawnBack) {
      // A press now, in the middle of the drawing back, must change nothing.
      await page.keyboard.press('KeyJ');
    }
    if (now.spear.action === 'ready') {
      break;
    }
  }
  const thrusting = frames.filter((now) => now.spear.action === 'thrusting');
  const recovering = frames.filter((now) => now.spear.action === 'recovering');
  const reaches = frames.map((now) => (now.spear.tip.x - now.stickMan.feet.x) * now.spear.direction);
  const reach = Math.max(...reaches);
  results.push(
    check(
      'the point goes out, further every frame, and is level at the height of its chest',
      thrusting.length >= 3 &&
        thrusting.every((now, index) => index === 0 || reaches[frames.indexOf(now)] > reaches[frames.indexOf(now) - 1]) &&
        frames.every((now) => now.spear.action === 'ready' || now.spear.tip.y === now.spear.butt.y),
      `${thrusting.length} frames out, reach ${reach.toFixed(2)} m`,
    ),
  );
  results.push(
    check(
      'drawing it back takes several times longer than the thrust, and the press in the middle of it changed nothing',
      recovering.length > 3 * thrusting.length &&
        recovering.every((now, index) => index === 0 || now.spear.progress >= recovering[index - 1].spear.progress) &&
        recovering.at(-1).spear.progress > 0.8 &&
        frames.at(-1).spear.action === 'ready',
      `${thrusting.length} frames out, ${recovering.length} frames back`,
    ),
  );
  results.push(
    check(
      'no J is offered from the press until the spear is ready again, and then it is',
      [...thrusting, ...recovering].every((now) => now.itemUse === null) && frames.at(-1).itemUse === 'thrust',
    ),
  );
  results.push(check('four pictures of the thrust were taken', shots === 3, `${shots + 1} with the one before it`));

  // From just outside the club's reach, with the enemy as near as it comes.
  const enemy = frames.at(-1).enemies[0];
  const clubReach =
    Math.hypot(enemy.club.grip.x - enemy.club.shoulder.x, enemy.club.grip.y - enemy.club.shoulder.y) +
    Math.hypot(enemy.club.tip.x - enemy.club.grip.x, enemy.club.tip.y - enemy.club.grip.y) +
    enemy.club.thickness / 2 +
    frames.at(-1).stickManWidth / 2;
  const nearEnd = enemy.guardedStretch.start;
  const standAt = nearEnd - clubReach - 0.15;
  await page.keyboard.down('ArrowRight');
  await stepFramesUntil(page, 'the enemy coming', (now) => now.enemies[0].action === 'approaching');
  await page.keyboard.up('ArrowRight');
  await stepFramesUntil(page, 'the enemy at the end of its stretch', (now) => now.enemies[0].position.x === nearEnd);
  // It backs off and comes forward again, so that it faces the enemy from where it means to stand.
  await page.keyboard.down('ArrowLeft');
  await stepFramesUntil(page, 'well back', (now) => now.stickMan.feet.x <= standAt - 0.4);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await stepFramesUntil(page, 'in place', (now) => now.stickMan.feet.x >= standAt);
  await page.keyboard.up('ArrowRight');
  const waited = [];
  for (let frame = 0; frame < 240; frame += 1) {
    waited.push(await stepFrames(page));
  }
  const standing = waited.at(-1);
  const distance = standing.enemies[0].position.x - standing.stickMan.feet.x;
  results.push(
    check(
      'standing just outside the reach of the club for four seconds, the stick man is not struck and the enemy does not swing',
      distance > clubReach &&
        distance < reach + enemy.width / 2 &&
        waited.every((now) => now.stickMan.action !== 'struck' && now.enemies[0].action === 'waiting'),
      `${distance.toFixed(2)} m away; the club reaches ${clubReach.toFixed(2)} m, the spear ${(reach + enemy.width / 2).toFixed(2)} m`,
    ),
  );
  await takeScreenshot(page, '09-outside-the-reach-of-the-club.png');

  await page.keyboard.press('KeyJ');
  const rubbedOut = [];
  let rubOutShots = 0;
  for (let frame = 0; frame < 240; frame += 1) {
    const now = await stepFrames(page);
    rubbedOut.push(now);
    const progress = now.enemies[0]?.rubbedOutProgress ?? null;
    const isNextShot = progress !== null && progress >= [0.05, 0.35, 0.7][rubOutShots];
    if (isNextShot) {
      rubOutShots += 1;
      await takeScreenshot(page, `10-rubbed-out-${rubOutShots}.png`);
    }
    if (now.enemies.length === 0) {
      break;
    }
  }
  const beingRubbedOut = rubbedOut.filter((now) => now.enemies[0]?.rubbedOutProgress != null);
  results.push(
    check(
      'the thrust from there rubs the enemy out: more and more, frame after frame, standing where it was struck, and then it is gone',
      beingRubbedOut.length > 10 &&
        beingRubbedOut.every((now, index) => index === 0 || now.enemies[0].rubbedOutProgress >= beingRubbedOut[index - 1].enemies[0].rubbedOutProgress) &&
        beingRubbedOut.at(-1).enemies[0].rubbedOutProgress > 0.8 &&
        beingRubbedOut.every((now) => now.enemies[0].position.x === nearEnd) &&
        rubbedOut.at(-1).enemies.length === 0 &&
        rubOutShots === 3,
      `${beingRubbedOut.length} frames, ${rubOutShots} pictures`,
    ),
  );
  results.push(check('the stick man was not struck', rubbedOut.every((now) => now.stickMan.action !== 'struck')));
  await stepFrames(page, 20);
  await takeScreenshot(page, '11-the-enemy-gone.png');

  // Dying by a fall: off the start of the paper.
  await page.keyboard.down('ArrowLeft');
  await stepFramesUntil(page, 'off the paper', (now) => now.stickMan.feet.y > now.start.y + 1);
  await page.keyboard.up('ArrowLeft');
  const again = await stepFramesUntil(
    page,
    'the level started again',
    (now) => now.stickMan.feet.x === now.start.x && now.stickMan.feet.y === now.start.y,
  );
  results.push(
    check(
      'after a fall the level starts again with the spear in its hand, no letter to read, and the enemy back at its post',
      again.slots[0].itemDefId === spearId &&
        again.slots[0].isSelected &&
        again.itemUse === 'thrust' &&
        again.letter === null &&
        again.fallenItem === null &&
        again.enemies.length === 1 &&
        again.enemies[0].rubbedOutProgress === null &&
        again.enemies[0].position.x > nearEnd,
      `slot ${JSON.stringify(again.slots[0])}, enemy at ${again.enemies[0]?.position.x}`,
    ),
  );
  await stepFrames(page, 30);
  await takeScreenshot(page, '12-again-after-a-fall-with-the-spear.png');

  // Dying by the club: it walks in and does not thrust.
  await page.keyboard.down('ArrowRight');
  const struck = await stepFramesUntil(page, 'struck down', (now) => now.stickMan.action === 'struck');
  await page.keyboard.up('ArrowRight');
  results.push(
    check(
      'the spear is no shield: walking into the swing without thrusting, the stick man is struck down',
      struck.stickMan.action === 'struck' && struck.itemUse === null,
    ),
  );
  await stepFrames(page, 40);
  await takeScreenshot(page, '13-struck-down-the-spear-on-the-floor.png');
  const afterClub = await stepFramesUntil(page, 'the level started again', (now) => now.stickMan.action !== 'struck');
  results.push(
    check(
      'after the club the level starts again with the spear in its hand, too',
      afterClub.slots[0].itemDefId === spearId && afterClub.slots[0].isSelected && afterClub.itemUse === 'thrust' && afterClub.letter === null,
    ),
  );

  results.push(check('no page errors', game.pageErrors.length === 0, game.pageErrors.join(' | ')));
  Object.assign(report, { reach, clubReach, distance, framesOut: thrusting.length, framesBack: recovering.length });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof(`${NAME}.json`, report);
process.exit(summarize(results) ? 0 : 1);
