/* global window */
/**
 * The choice between two things made of paper, for a stick man that came through level 3 and so
 * knows the airplane when it reads the letter about the spear. No level of the game leads from
 * level 3 to this yard yet (#45), so the script reads the letter in the yard and then plays on
 * from a snapshot of that moment with the airplane's recipe known as well
 * (`window.__game.loadSnapshot`). From there it is keys only: J makes what is chosen, L switches.
 */
import { check, summarize, writeProof } from './lib.mjs';
import {
  getItemId,
  holdKeyUntil,
  openGame,
  playOnKnowingAlso,
  readGame,
  takeScreenshot,
  waitForGame,
} from './game.mjs';

/** Not the port of the dev server left running for the human (5244), nor another script's. */
const PORT = 5946;
const NAME = '03-two-things-to-make-of-paper';
const results = [];
const report = {};
let game;
try {
  game = await openGame(PORT, results);
  const { page } = game;
  const paperId = await getItemId(page, 'paper');
  const spearId = await getItemId(page, 'spear');
  const airplaneId = await getItemId(page, 'paper airplane');

  await holdKeyUntil(page, 'ArrowRight', 'the letter within reach', (now) => now.interaction === 'read');
  await page.keyboard.press('KeyK');
  await waitForGame(page, 'the letter being read', (now) => now.letter?.isBeingRead);
  await page.keyboard.press('KeyK');
  const knowingOne = await waitForGame(page, 'the letter put away', (now) => now.letter === null);
  results.push(
    check(
      'knowing only the spear, there is nothing to switch to and no key for it',
      knowingOne.crafting.canMake?.name === 'spear' &&
        knowingOne.crafting.couldMakeInstead === null &&
        knowingOne.canSwitchItemUse === false,
    ),
  );
  await page.keyboard.press('KeyL');
  await page.waitForTimeout(200);
  const afterIdleSwitch = await readGame(page);
  results.push(check('L does nothing then', afterIdleSwitch.crafting.canMake?.name === 'spear'));

  // From here on: a stick man that knew the airplane before it read this letter.
  await playOnKnowingAlso(page, ['paper airplane']);
  const knowingBoth = await waitForGame(page, 'both recipes known', (now) => now.crafting.knownRecipes.length === 2);
  results.push(
    check(
      'knowing the airplane too, the paper is for the spear by default: the letter read last',
      knowingBoth.slots[0].itemDefId === paperId &&
        knowingBoth.itemUse === 'craft' &&
        knowingBoth.crafting.canMake?.name === 'spear' &&
        knowingBoth.crafting.couldMakeInstead?.name === 'paper airplane' &&
        knowingBoth.canSwitchItemUse === true,
      `J: ${knowingBoth.crafting.canMake?.name}, L: ${knowingBoth.crafting.couldMakeInstead?.name}`,
    ),
  );
  await page.waitForTimeout(400);
  await takeScreenshot(page, '14-the-spear-chosen-the-airplane-offered.png');
  const chosenAtFirst = await page.evaluate(() => window.__game.takeSnapshot());

  await page.keyboard.press('KeyL');
  const switched = await waitForGame(page, 'the airplane chosen', (now) => now.crafting.canMake?.name === 'paper airplane');
  results.push(
    check(
      'L switches: J would fold the airplane, and L would switch back to the spear',
      switched.crafting.couldMakeInstead?.name === 'spear' && switched.canSwitchItemUse === true && switched.slots[0].itemDefId === paperId,
    ),
  );
  await page.waitForTimeout(400);
  await takeScreenshot(page, '15-the-airplane-chosen-the-spear-offered.png');
  await page.keyboard.press('KeyL');
  const switchedBack = await waitForGame(page, 'the spear chosen again', (now) => now.crafting.canMake?.name === 'spear');
  results.push(check('L again switches back', switchedBack.crafting.couldMakeInstead?.name === 'paper airplane'));

  // Never touching L: the spear.
  await page.keyboard.press('KeyJ');
  const rolled = await waitForGame(page, 'the paper made into something', (now) => now.slots[0].itemDefId !== paperId);
  results.push(
    check(
      'J without ever switching makes the spear, and then there is nothing to switch',
      rolled.slots[0].itemDefId === spearId && rolled.itemUse === 'thrust' && rolled.canSwitchItemUse === false,
    ),
  );

  // The other way: L, then J.
  await page.evaluate((snapshot) => window.__game.loadSnapshot(snapshot), chosenAtFirst);
  await waitForGame(page, 'the paper in its hand again', (now) => now.slots[0].itemDefId === paperId);
  await page.keyboard.press('KeyL');
  await waitForGame(page, 'the airplane chosen', (now) => now.crafting.canMake?.name === 'paper airplane');
  await page.keyboard.press('KeyJ');
  const folded = await waitForGame(page, 'the paper made into something', (now) => now.slots[0].itemDefId !== paperId);
  results.push(
    check(
      'L and then J folds the airplane instead',
      folded.slots[0].itemDefId === airplaneId && folded.itemUse === 'place' && folded.spear === null,
    ),
  );
  await page.waitForTimeout(300);
  await takeScreenshot(page, '16-the-airplane-folded-instead.png');

  // It is never left without the way on: a new sheet falls, and it is for the spear again.
  const fallen = await waitForGame(page, 'a new sheet on the floor', (now) => now.interaction === 'pickUp', 20000);
  results.push(
    check(
      'with the paper spent on an airplane in the yard, a new sheet falls where the stick man stands',
      fallen.fallenItem?.itemDefId === paperId && fallen.fallenItem.height === 0,
    ),
  );
  await takeScreenshot(page, '17-a-new-sheet-fell.png');
  await page.keyboard.press('KeyK');
  const pickedUp = await waitForGame(page, 'the sheet picked up', (now) => now.fallenItem === null);
  results.push(
    check(
      'K picks it up in place of the airplane (one slot), and it is for the spear again',
      pickedUp.slots[0].itemDefId === paperId && pickedUp.slots[0].isSelected && pickedUp.crafting.canMake?.name === 'spear',
      `slot ${JSON.stringify(pickedUp.slots[0])}, J: ${pickedUp.crafting.canMake?.name}`,
    ),
  );
  await page.keyboard.press('KeyJ');
  const rolledAfterAll = await waitForGame(page, 'the spear', (now) => now.slots[0].itemDefId === spearId);
  results.push(check('J then rolls the spear', rolledAfterAll.itemUse === 'thrust'));

  results.push(check('no page errors', game.pageErrors.length === 0, game.pageErrors.join(' | ')));
  Object.assign(report, { knowingBoth: knowingBoth.crafting, switched: switched.crafting });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof(`${NAME}.json`, report);
process.exit(summarize(results) ? 0 : 1);
