/**
 * The ticket from start to end, played in real time with the keys a person presses: the stick man
 * walks to the letter and reads it, has the pencil in its hand, sharpens it, thrusts the spear at
 * nothing once, then walks at the club enemy, thrusts from further away than the club reaches,
 * and walks on to the flag through where the enemy stood. Recorded as a video.
 */
import { check, summarize, writeProof } from './lib.mjs';
import {
  YARD,
  getItemId,
  holdKeyUntil,
  openGame,
  readGame,
  takeScreenshot,
  waitForGame,
} from './game.mjs';

/** Not the port of the dev server left running for the human (5244). */
const PORT = 5944;
const NAME = '01-letter-sharpen-thrust-enemy-gone';
const results = [];
const report = {};
let game;
try {
  game = await openGame(PORT, results, { video: '01-the-whole-way.webm' });
  const { page } = game;
  const pencilId = await getItemId(page, 'pencil');
  const spearId = await getItemId(page, 'spear');

  const atStart = await readGame(page);
  results.push(
    check(
      'the yard starts with an empty hand, a letter on the floor and one enemy',
      atStart.level === YARD &&
        atStart.slots.every((slot) => slot.itemDefId === null) &&
        atStart.letter !== null &&
        atStart.enemies.length === 1 &&
        atStart.itemUse === null &&
        atStart.spear === null,
      `level ${atStart.level}, slots ${JSON.stringify(atStart.slots)}`,
    ),
  );
  results.push(
    check(
      'the pencil and the spear are items the game knows by name',
      pencilId !== null && spearId !== null,
      `pencil ${pencilId}, spear ${spearId}`,
    ),
  );
  await takeScreenshot(page, '01-the-yard.png');

  // The letter.
  await holdKeyUntil(page, 'ArrowRight', 'the letter within reach', (now) => now.interaction === 'read');
  await page.keyboard.press('KeyK');
  const reading = await waitForGame(page, 'the letter being read', (now) => now.letter?.isBeingRead);
  results.push(
    check(
      'K by the letter reads it, and it teaches the spear',
      reading.letter.teaches === 'spear' && reading.crafting.knownRecipes.some((recipe) => recipe.name === 'spear'),
      `teaches ${reading.letter.teaches}`,
    ),
  );
  results.push(
    check(
      'reading it puts the pencil in the hand of the stick man',
      reading.slots[0].itemDefId === pencilId && reading.slots[0].isSelected,
      JSON.stringify(reading.slots),
    ),
  );
  results.push(
    check('while it reads, J does nothing and K puts the letter away', reading.itemUse === null && reading.interaction === 'putLetterAway'),
  );
  await page.waitForTimeout(400);
  await takeScreenshot(page, '02-reading-the-letter.png');

  // The pencil.
  await page.keyboard.press('KeyK');
  const withPencil = await waitForGame(page, 'the letter put away', (now) => now.letter === null);
  results.push(
    check(
      'with the letter put away, J would sharpen the pencil into the spear',
      withPencil.itemUse === 'craft' && withPencil.crafting.canMake?.name === 'spear' && withPencil.spear === null,
      `J: ${withPencil.itemUse}, would make ${withPencil.crafting.canMake?.name}`,
    ),
  );
  await page.waitForTimeout(300);
  await takeScreenshot(page, '03-the-pencil-in-its-hand.png');

  // The spear.
  await page.keyboard.press('KeyJ');
  const withSpear = await waitForGame(page, 'the spear in its hand', (now) => now.spear !== null);
  results.push(
    check(
      'J sharpens it: the spear is in the same slot, in its hand, and J would now thrust it',
      withSpear.slots[0].itemDefId === spearId &&
        withSpear.slots[0].isSelected &&
        withSpear.itemUse === 'thrust' &&
        withSpear.spear.action === 'ready',
      `slot ${JSON.stringify(withSpear.slots[0])}, J: ${withSpear.itemUse}`,
    ),
  );
  await page.waitForTimeout(300);
  await takeScreenshot(page, '04-the-spear-in-its-hand.png');

  // A thrust at nothing: how far it reaches, and what it costs.
  await page.keyboard.press('KeyJ');
  const thrust = await followThrust(page);
  const reach = Math.max(...thrust.map((now) => (now.spear.tip.x - now.stickMan.feet.x) * now.spear.direction));
  results.push(
    check(
      'J thrusts: the point goes out in front of the stick man and the spear is drawn back',
      thrust.some((now) => now.spear.action === 'thrusting') && thrust.some((now) => now.spear.action === 'recovering'),
      `reach ${reach.toFixed(2)} m, seen ${thrust.length} times`,
    ),
  );
  const seconds = (thrust.at(-1).tick - thrust[0].tick) * thrust[0].dt;
  const whileBusy = thrust.filter((now) => now.spear.action !== 'ready');
  results.push(
    check(
      'a thrust costs time: no J is offered until the spear is drawn back',
      whileBusy.length > 0 && whileBusy.every((now) => now.itemUse === null),
      `${seconds.toFixed(2)} s from the press to ready again`,
    ),
  );
  const afterMiss = await readGame(page);
  results.push(
    check(
      'the spear is still in its hand after the thrust, and the enemy untouched',
      afterMiss.slots[0].itemDefId === spearId && afterMiss.itemUse === 'thrust' && afterMiss.enemies[0].rubbedOutProgress === null,
    ),
  );

  // The enemy: how far its club reaches, from the game itself.
  const enemy = afterMiss.enemies[0];
  const clubReach =
    Math.hypot(enemy.club.grip.x - enemy.club.shoulder.x, enemy.club.grip.y - enemy.club.shoulder.y) +
    Math.hypot(enemy.club.tip.x - enemy.club.grip.x, enemy.club.tip.y - enemy.club.grip.y) +
    enemy.club.thickness / 2 +
    afterMiss.stickManWidth / 2;
  const spearHitsFrom = reach + enemy.width / 2;
  results.push(
    check(
      'the spear reaches the enemy from further away than its club reaches the stick man',
      spearHitsFrom > clubReach,
      `spear from ${spearHitsFrom.toFixed(2)} m, club from ${clubReach.toFixed(2)} m, middle to middle`,
    ),
  );

  // It walks at the enemy and thrusts as soon as the spear reaches, outside the club's reach.
  const thrustFrom = (spearHitsFrom + clubReach) / 2;
  let wasStruck = false;
  await page.keyboard.down('ArrowRight');
  const inReach = await waitForGame(page, 'the enemy within the spear', (now) => {
    wasStruck ||= now.stickMan.action === 'struck';
    return now.enemies[0].position.x - now.stickMan.feet.x <= thrustFrom;
  }, 20000);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyJ');
  results.push(
    check(
      'it thrusts from outside the reach of the club',
      inReach.enemies[0].position.x - inReach.stickMan.feet.x > clubReach - 0.2,
      `${(inReach.enemies[0].position.x - inReach.stickMan.feet.x).toFixed(2)} m away, the enemy ${inReach.enemies[0].action}`,
    ),
  );
  const struckEnemy = await waitForGame(
    page,
    'the enemy being rubbed out',
    (now) => now.enemies.length === 0 || now.enemies[0].rubbedOutProgress !== null,
  );
  await takeScreenshot(page, '05-the-enemy-being-rubbed-out.png');
  results.push(
    check(
      'the thrust reaches the enemy: it is being rubbed out',
      struckEnemy.enemies.length === 0 || struckEnemy.enemies[0].rubbedOutProgress !== null,
      `rubbed out ${struckEnemy.enemies[0]?.rubbedOutProgress ?? 'all of it'}`,
    ),
  );
  const gone = await waitForGame(page, 'the enemy gone', (now) => {
    wasStruck ||= now.stickMan.action === 'struck';
    return now.enemies.length === 0;
  });
  results.push(check('a moment later the enemy is gone', gone.enemies.length === 0));
  await page.waitForTimeout(700);
  await takeScreenshot(page, '06-the-enemy-gone.png');

  // On to the flag, through where it stood.
  const atFlag = await holdKeyUntil(page, 'ArrowRight', 'the flag reached', (now) => {
    wasStruck ||= now.stickMan.action === 'struck';
    return now.flag?.isReached === true;
  });
  results.push(
    check(
      'the stick man walks on through where the enemy stood and reaches the flag',
      atFlag.flag.isReached && atFlag.stickMan.feet.x > enemy.position.x,
      `at x ${atFlag.stickMan.feet.x.toFixed(2)}`,
    ),
  );
  results.push(check('it was never struck on the way', !wasStruck));
  results.push(
    check('it still has the spear under the flag', atFlag.slots[0].itemDefId === spearId),
  );
  await page.waitForTimeout(900);
  await takeScreenshot(page, '07-at-the-flag-with-the-spear.png');

  results.push(check('no page errors', game.pageErrors.length === 0, game.pageErrors.join(' | ')));
  Object.assign(report, { reach, clubReach, spearHitsFrom, thrustSeconds: seconds, atFlag });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof(`${NAME}.json`, report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** The game read as fast as it can be from a press of J until the spear is ready again. */
async function followThrust(page) {
  const seen = [];
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const now = await readGame(page);
    seen.push(now);
    const isOver = now.spear?.action === 'ready' && seen.some((earlier) => earlier.spear.action !== 'ready');
    if (isOver) {
      return seen;
    }
  }
  throw new Error('the thrust never ended');
}
