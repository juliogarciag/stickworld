/* global window */
/**
 * The ticket from start to end, played in real time with the keys a person presses: the stick man
 * walks to the letter and reads it, has a sheet of paper in its hand, rolls it into the spear, thrusts the spear at
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
const NAME = '01-letter-roll-thrust-enemy-gone';
const results = [];
const report = {};
let game;
try {
  game = await openGame(PORT, results, { video: '01-the-whole-way.webm' });
  const { page } = game;
  const paperId = await getItemId(page, 'paper');
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
      'the paper and the spear are items the game knows by name',
      paperId !== null && spearId !== null,
      `paper ${paperId}, spear ${spearId}`,
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
      'reading it puts a sheet of paper in the hand of the stick man',
      reading.slots[0].itemDefId === paperId && reading.slots[0].isSelected,
      JSON.stringify(reading.slots),
    ),
  );
  results.push(
    check('while it reads, J does nothing and K puts the letter away', reading.itemUse === null && reading.interaction === 'putLetterAway'),
  );
  await page.waitForTimeout(400);
  await takeScreenshot(page, '02-reading-the-letter.png');

  // The paper.
  await page.keyboard.press('KeyK');
  const withPaper = await waitForGame(page, 'the letter put away', (now) => now.letter === null);
  results.push(
    check(
      'with the letter put away, J would roll the paper into the spear, and there is nothing to switch to',
      withPaper.itemUse === 'craft' && withPaper.crafting.canMake?.name === 'spear' && withPaper.spear === null &&
        withPaper.canSwitchItemUse === false,
      `J: ${withPaper.itemUse}, would make ${withPaper.crafting.canMake?.name}`,
    ),
  );
  await page.waitForTimeout(300);
  await takeScreenshot(page, '03-the-paper-in-its-hand.png');

  // The spear.
  await page.keyboard.press('KeyJ');
  const withSpear = await waitForGame(page, 'the spear in its hand', (now) => now.spear !== null);
  results.push(
    check(
      'J rolls it: the spear is in the same slot, in its hand, and J would now thrust it',
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
  const thrust = await pressAndFollowThrust(page);
  const reach = Math.max(...thrust.map((now) => (now.spear.tip.x - now.stickMan.feet.x) * now.spear.direction));
  const reachAtRest = (withSpear.spear.tip.x - withSpear.stickMan.feet.x) * withSpear.spear.direction;
  results.push(
    check(
      'J thrusts: the point is out in front of the stick man, further than it is held ready, and then the spear is drawn back',
      reach > reachAtRest && thrust.some((now) => now.spear.action === 'recovering'),
      `reach seen ${reach.toFixed(2)} m, ready at ${reachAtRest.toFixed(2)} m, ${thrust.length} frames drawn`,
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
      afterMiss.slots[0].itemDefId === spearId && afterMiss.itemUse === 'thrust' && afterMiss.enemies[0].torn === null,
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

  // It walks at the enemy, stops a little short of the spear's reach, and thrusts as the enemy
  // comes into it, outside the club's reach. Standing still for the last of it: the two close in
  // fast, and a script reads the game less often than a player sees it.
  const thrustFrom = (spearHitsFrom + clubReach) / 2;
  let wasStruck = false;
  await page.keyboard.down('ArrowRight');
  await waitForGame(page, 'the enemy nearly within the spear', (now) => {
    wasStruck ||= now.stickMan.action === 'struck';
    return now.enemies[0].position.x - now.stickMan.feet.x <= thrustFrom + enemy.width + 0.4;
  }, 20000);
  await page.keyboard.up('ArrowRight');
  const inReach = await waitForGame(page, 'the enemy within the spear', (now) => {
    wasStruck ||= now.stickMan.action === 'struck';
    return now.enemies[0].position.x - now.stickMan.feet.x <= thrustFrom;
  }, 20000);
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
    'the enemy torn',
    (now) => now.enemies.length === 0 || now.enemies[0].torn !== null,
  );
  await takeScreenshot(page, '05-the-enemy-torn.png');
  results.push(
    check(
      'the thrust reaches the enemy: it is torn in two',
      struckEnemy.enemies.length === 0 || struckEnemy.enemies[0].torn !== null,
      `${struckEnemy.enemies[0]?.torn?.action ?? 'gone already'}`,
    ),
  );
  const gone = await waitForGame(page, 'the enemy gone', (now) => {
    wasStruck ||= now.stickMan.action === 'struck';
    return now.enemies.length === 0;
  });
  results.push(check('its halves lie, leave the sheet, and then the enemy is gone', gone.enemies.length === 0));
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

/**
 * J is pressed and the thrust is followed from inside the page, once every frame it draws, from
 * the press until the spear is ready again: a read from here would miss most of a tenth of a
 * second.
 */
async function pressAndFollowThrust(page) {
  const followed = page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const api = window.__game;
        const seen = [];
        const startedAt = window.performance.now();
        const look = () => {
          seen.push({
            tick: api.sim.tick,
            dt: api.sim.dt,
            spear: api.getSpear(),
            stickMan: api.getStickMan(),
            itemUse: api.getItemUse(),
          });
          const isOver =
            seen.at(-1).spear.action === 'ready' &&
            seen.some((earlier) => earlier.spear.action !== 'ready');
          if (isOver) {
            resolve(seen);
          } else if (window.performance.now() - startedAt > 5000) {
            reject(new Error('the thrust never ended'));
          } else {
            window.requestAnimationFrame(look);
          }
        };
        window.requestAnimationFrame(look);
      }),
  );
  await page.keyboard.press('KeyJ');
  return followed;
}
