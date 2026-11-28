/* global window */
/**
 * The rest of what the ticket promises, in the real app with the keys a player has: touching the
 * enemy does not hurt and its body stops a walk; a jump over it during the swing is caught in the
 * air; and the way past is to make it swing at nothing, jump over it while it lifts its club, and
 * walk on to the flag.
 *
 * Every expected number comes from the page (`window.__game`). The whole run is recorded.
 */
import { check, summarize, writeProof } from './lib.mjs';
import {
  YARD,
  makeEnemySwingAtNothing,
  openYard,
  readGame,
  takePictureWhen,
  waitUntil,
} from './game.mjs';

/**
 * A port no other session uses, and not the one of the dev server left running for the human.
 */
const PORT = 5944;
/** How far in front of the enemy's middle the stick man jumps from, in metres. */
const JUMP_FROM = 1;
const results = [];
const report = {};
let game;
try {
  game = await openYard(PORT);
  const { page } = game;

  // ---- The swing at nothing: the stick man walks away when the club goes back. ----
  await page.keyboard.down('ArrowRight');
  await waitUntil(page, () => window.__game.getEnemies()[0].action === 'windingUp');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  const swinging = await takePictureWhen(page, '06-the-swing-at-nothing.png', () => {
    const enemy = window.__game.getEnemies()[0];
    // Where the club is highest: a third of the way through, straight up.
    return enemy.action === 'swinging' && enemy.progress > 0.25 && enemy.progress < 0.45;
  });
  await waitUntil(page, () => window.__game.getEnemies()[0].action === 'recovering');
  await page.keyboard.up('ArrowLeft');
  const baited = await readGame(page);
  const topOfBody = swinging.enemy.position.y - swinging.enemy.height;
  results.push(
    check(
      'the swing takes the club from behind it over the top: higher than the stick man jumps',
      swinging.enemy.action === 'swinging' &&
        swinging.enemy.club.tip.y < topOfBody &&
        -swinging.enemy.club.tip.y > swinging.jumpHeight,
      `club end ${(-swinging.enemy.club.tip.y).toFixed(2)} m above the floor, the jump is ${swinging.jumpHeight} m, ${Math.round(swinging.enemy.progress * 100)}% through the swing`,
    ),
    check(
      'walking away when the club goes back gets the stick man out of its reach: the swing hits nothing',
      baited.enemy.action === 'recovering' && baited.stickMan.struckFor === null,
      `stick man ${Math.abs(baited.stickMan.feet.x - baited.enemy.position.x).toFixed(2)} m away, ${baited.stickMan.action}`,
    ),
  );
  // ---- Its body: the stick man walks into it while the club is down. ----
  await page.keyboard.down('ArrowRight');
  const against = await takePictureWhen(
    page,
    '07-up-against-its-body.png',
    (ticks) => {
      const stickMan = window.__game.getStickMan();
      const enemy = window.__game.getEnemies()[0];
      window.__ticksAgainst =
        stickMan.feet.x > enemy.position.x - enemy.width / 2 - window.__game.stickManWidth
          ? (window.__ticksAgainst ?? window.__game.sim.tick)
          : undefined;
      return (
        window.__ticksAgainst !== undefined && window.__game.sim.tick - window.__ticksAgainst > ticks
      );
    },
    20,
  );
  await page.keyboard.up('ArrowRight');
  const stoppedAt = against.enemy.position.x - against.enemy.width / 2 - against.stickManWidth / 2;
  results.push(
    check(
      'its body stops the stick man who walks into it, half a stick man from its side',
      Math.abs(against.stickMan.feet.x - stoppedAt) < 1e-6 && against.stickMan.action === 'walking',
      `stick man at ${against.stickMan.feet.x.toFixed(3)}, its side less half a stick man is ${stoppedAt.toFixed(3)}`,
    ),
    check(
      'touching it does not hurt: only the club does, and the club is being lifted',
      against.stickMan.struckFor === null && against.enemy.action === 'recovering',
      `stick man ${against.stickMan.action}, enemy ${against.enemy.action}`,
    ),
  );

  // ---- A jump timed into the swing. ----
  await page.evaluate((level) => window.__game.loadLevel(level), YARD);
  await page.keyboard.down('ArrowRight');
  await waitUntil(page, () => window.__game.getEnemies()[0].action === 'windingUp');
  await page.keyboard.down('Space');
  const caught = await takePictureWhen(
    page,
    '08-caught-in-the-air.png',
    () => window.__game.getStickMan().action === 'struck',
  );
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
  results.push(
    check(
      'a jump over it as it winds up is caught by the swing: the stick man is struck in the air, over it',
      caught.stickMan.action === 'struck' &&
        caught.enemy.action === 'swinging' &&
        -caught.stickMan.feet.y > caught.stickManHeight / 2 &&
        Math.abs(caught.stickMan.feet.x - caught.enemy.position.x) < caught.enemy.width,
      `feet ${(-caught.stickMan.feet.y).toFixed(2)} m up, ${Math.abs(caught.stickMan.feet.x - caught.enemy.position.x).toFixed(2)} m from its middle`,
    ),
  );
  await waitUntil(page, () => window.__game.getStickMan().struckFor > 0.9);
  const fallen = await readGame(page);
  results.push(
    check(
      'and falls to the floor beside it, not into it',
      fallen.stickMan.feet.y === fallen.level.start.y &&
        Math.abs(fallen.stickMan.feet.x - fallen.enemy.position.x) >=
          fallen.enemy.width / 2 + fallen.stickManWidth / 2 - 1e-6,
      `lying ${Math.abs(fallen.stickMan.feet.x - fallen.enemy.position.x).toFixed(2)} m from its middle`,
    ),
  );

  // ---- The way past: a jump timed between two swings. ----
  await page.evaluate((level) => window.__game.loadLevel(level), YARD);
  await makeEnemySwingAtNothing(page);
  const enemyX = (await readGame(page)).enemy.position.x;
  await page.keyboard.down('ArrowRight');
  await waitUntil(page, (x) => window.__game.getStickMan().feet.x >= x, enemyX - JUMP_FROM);
  await page.keyboard.down('Space');
  const over = await takePictureWhen(
    page,
    '09-over-it-while-it-lifts-its-club.png',
    (x) => window.__game.getStickMan().feet.x >= x,
    enemyX,
  );
  results.push(
    check(
      'a jump while it lifts its club clears it: the stick man is over its middle, above its top, unhurt',
      over.stickMan.action === 'jumping' &&
        -over.stickMan.feet.y > over.enemy.height + over.enemy.floatHeight &&
        over.enemy.action === 'recovering',
      `feet ${(-over.stickMan.feet.y).toFixed(2)} m up over a top at ${(over.enemy.height + over.enemy.floatHeight).toFixed(2)} m, enemy ${over.enemy.action}`,
    ),
  );
  await waitUntil(page, () => window.__game.getStickMan().action !== 'jumping');
  await page.keyboard.up('Space');
  const landed = await readGame(page);
  results.push(
    check(
      'it lands on the far side',
      landed.stickMan.feet.x > enemyX + landed.enemy.width / 2 && landed.stickMan.struckFor === null,
      `landed ${(landed.stickMan.feet.x - enemyX).toFixed(2)} m past its middle`,
    ),
  );
  const atFlag = await takePictureWhen(page, '10-at-the-flag-behind-it.png', () => {
    const flag = window.__game.getFlag();
    return flag.upFor > 0.3 || window.__game.getStickMan().action === 'struck';
  });
  await page.keyboard.up('ArrowRight');
  results.push(
    check(
      'and walks on out of its reach to the flag it guards',
      atFlag.flag.isReached && atFlag.stickMan.action === 'cheering',
      `flag reached: ${atFlag.flag.isReached}, stick man ${atFlag.stickMan.action}`,
    ),
    check(
      'the enemy did not follow past the stretch it guards',
      atFlag.enemy.position.x <= atFlag.enemy.guardedStretch.end &&
        atFlag.flag.position.x > atFlag.enemy.guardedStretch.end,
      `enemy at ${atFlag.enemy.position.x.toFixed(2)}, guards up to ${atFlag.enemy.guardedStretch.end}, flag at ${atFlag.flag.position.x}`,
    ),
  );
  await page.waitForTimeout(1500);
  const later = await readGame(page);
  results.push(
    check(
      'under the flag the stick man is left alone',
      later.stickMan.action === 'cheering' && later.stickMan.struckFor === null,
      `stick man ${later.stickMan.action}, enemy ${later.enemy.action}`,
    ),
    check('no page errors', game.pageErrors.length === 0, game.pageErrors.join(' | ')),
  );
  Object.assign(report, { swinging, baited, against, caught, fallen, over, landed, atFlag, later });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close('02-the-way-past.webm');
}

report.results = results;
writeProof('02-its-body-and-the-way-past.json', report);
process.exit(summarize(results) ? 0 : 1);
