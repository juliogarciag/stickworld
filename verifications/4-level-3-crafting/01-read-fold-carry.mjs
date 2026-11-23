/* global window */
/**
 * Plays the first half of level 3 the way a player does, with the keyboard,
 * starting on level 2 so that the paper is the one its flag gives: read the
 * letter, fold the paper, set the airplane down, lift it, carry it, jump with
 * it, and put it down on the edge. The whole run is recorded.
 *
 * Expected numbers come from the level and the defs through `window.__game`;
 * the keys (arrows, 1, J, K) are the game's fixed keys.
 */
import { check, summarize, writeProof } from './lib.mjs';
import { content, openGame, pageRectangle, pencilPixelsIn, screenshot, seen, tap, VIEWPORT, waitInGame, walkTo } from './play.mjs';

const results = [];
const report = {};
let game;
try {
  game = await openGame({ port: 5914, results, video: '01-read-fold-carry.webm' });
  const { page, pageErrors } = game;

  // ---- Level 2 gives the paper, and level 3 follows ----
  await page.evaluate(() => window.__game.loadLevel(2));
  const level2 = await content(page);
  const gap2 = { from: level2.floor[0].to.x, to: level2.floor[1].from.x };
  await walkTo(page, gap2.from - 0.6 * (gap2.to - gap2.from) - 0.3);
  await page.keyboard.down('ArrowRight');
  await waitInGame(page, (edge) => window.__game.stickMan().feet.x > edge, gap2.from - 0.25 * (gap2.to - gap2.from));
  await page.keyboard.press('ArrowUp');
  await waitInGame(page, () => window.__game.flag()?.reached === true);
  await page.keyboard.up('ArrowRight');
  await waitInGame(page, () => window.__game.level.id === 3);
  const level = await content(page);
  const edge = level.floor[0].to.x;
  let now = await seen(page);
  results.push(check('level 3 starts after level 2, with the paper its flag gave in slot 1', now.level === 3 && now.slots[0].itemDefId === level.paper, `level ${now.level}, slot 1 holds ${now.slots[0].itemDefId}`));
  results.push(check('the letter lies on the floor just in front of the start', now.letter !== null && now.letter.height === 0 && now.letter.at.x > level.start.x && now.letter.at.x - level.start.x < level.stickManHeight, `letter at ${now.letter?.at.x}, start at ${level.start.x}`));
  const letterOnTheFloor = await pageRectangle(page, { x: level.letterAt.x - 0.45, y: -0.6 }, { x: level.letterAt.x + 0.45, y: -0.05 });
  const letterPixels = await pencilPixelsIn(page, letterOnTheFloor);
  results.push(check('the letter is drawn on the floor', letterPixels > 80, `${letterPixels} pencil pixels where it lies`));
  await screenshot(page, '01-level-3-start.png');

  // ---- The paper has no use before he has read the letter ----
  const promptArea = { x: 20, y: VIEWPORT.height - 150, width: 520, height: 140 };
  await tap(page, '1');
  now = await seen(page);
  const promptsWithNoUse = await pencilPixelsIn(page, promptArea);
  results.push(check('before the letter is read, the paper in his hand has no use, and no key is shown', now.slots[0].selected && now.itemUse === null && now.crafting.knownRecipes.length === 0 && promptsWithNoUse < 30, `item use: ${now.itemUse}, ${promptsWithNoUse} pencil pixels in the bottom left`));
  await tap(page, 'j');
  await tap(page, '1');
  now = await seen(page);
  results.push(check('J changed nothing, and he walks on with the paper put back', now.slots[0].itemDefId === level.paper && !now.slots[0].selected, JSON.stringify(now.slots)));

  // ---- Reading the letter ----
  await walkTo(page, level.letterAt.x - 0.35);
  now = await seen(page);
  results.push(check('next to the letter, K would read it', now.interaction === 'read', `interaction: ${now.interaction}`));
  const sheetArea = { x: VIEWPORT.width * 0.25, y: 0, width: VIEWPORT.width * 0.5, height: VIEWPORT.height * 0.42 };
  const sheetBefore = await pencilPixelsIn(page, sheetArea);
  await tap(page, 'k');
  await page.waitForTimeout(300);
  now = await seen(page);
  const sheetWhileReading = await pencilPixelsIn(page, sheetArea);
  results.push(check('K shows the letter: the sim says he reads it, and its text is its def\'s', now.letter?.beingRead === true && now.letter.text.length > 20, now.letter?.text));
  results.push(check('the text is written on the screen', sheetBefore < 50 && sheetWhileReading > 2500, `${sheetBefore} pencil pixels in the top middle before, ${sheetWhileReading} while reading`));
  results.push(check('reading taught the paper airplane, the only recipe he knows, and the letter says so', now.crafting.knownRecipes.length === 1 && now.crafting.knownRecipes[0].name === 'paper airplane' && now.letter.teaches === 'paper airplane', JSON.stringify(now.crafting.knownRecipes)));
  results.push(check('reading put the paper in his hand, and while he reads only K has a use: it puts the letter away', now.slots[0].itemDefId === level.paper && now.slots[0].selected && now.itemUse === null && now.interaction === 'putLetterAway', JSON.stringify({ slots: now.slots, itemUse: now.itemUse, interaction: now.interaction })));
  await screenshot(page, '02-reading-the-letter.png');
  report.letterText = now.letter?.text;
  await tap(page, 'j');
  now = await seen(page);
  results.push(check('J while he reads does nothing: the letter stays up and the paper stays paper', now.letter?.beingRead === true && now.slots[0].itemDefId === level.paper));
  await tap(page, 'k');
  await page.waitForTimeout(200);
  now = await seen(page);
  results.push(check('K puts the letter away: it is gone from the level and from the screen', now.letter === null && (await pencilPixelsIn(page, sheetArea)) < 50 && (await pencilPixelsIn(page, letterOnTheFloor)) < 40));

  // ---- Folding ----
  await page.waitForTimeout(300);
  const promptsWithAUse = await pencilPixelsIn(page, promptArea);
  results.push(check('with the letter away, J would fold the paper airplane, and the key and what it does are written in the bottom left', now.itemUse === 'craft' && now.crafting.canMake?.name === 'paper airplane' && promptsWithAUse > 400, `item use: ${now.itemUse}, ${promptsWithAUse} pencil pixels in the bottom left`));
  await screenshot(page, '03-ready-to-fold.png');
  await tap(page, 'j');
  await page.waitForTimeout(300);
  now = await seen(page);
  results.push(check('one press of J turns the paper into an airplane in the same slot', now.slots[0].itemDefId === level.airplaneItem && now.slots[0].selected && now.airplane === null && now.itemUse === 'place', JSON.stringify(now.slots)));
  await screenshot(page, '04-airplane-in-the-slot.png');

  // ---- Setting it down ----
  await tap(page, 'j');
  await page.waitForTimeout(400);
  now = await seen(page);
  const placed = now.airplane;
  results.push(check('J with the airplane puts it on the floor in front of him and empties the slot', placed !== null && placed.state === 'resting' && placed.at.y === 0 && placed.at.x > now.stickMan.feet.x && placed.at.x - now.stickMan.feet.x < placed.length && now.slots[0].itemDefId === null, JSON.stringify({ airplane: placed, feet: now.stickMan.feet })));
  const overHisHead = () => pageRectangle(page, { x: now.stickMan.feet.x - 0.8, y: -(level.stickManHeight + 0.42) }, { x: now.stickMan.feet.x + 0.8, y: -(level.stickManHeight + 0.1) });
  const onTheFloorAhead = await pageRectangle(page, { x: placed.at.x - placed.length / 2, y: -placed.height - 0.05 }, { x: placed.at.x + placed.length / 2, y: -0.04 });
  const floorPixels = await pencilPixelsIn(page, onTheFloorAhead);
  results.push(check('the airplane is drawn on the floor, and nothing over his head', floorPixels > 150 && (await pencilPixelsIn(page, await overHisHead())) < 20, `${floorPixels} pencil pixels where it rests`));
  await screenshot(page, '05-set-down.png');

  // ---- Lifting and carrying ----
  results.push(check('next to it, K would lift it', now.interaction === 'lift', `interaction: ${now.interaction}`));
  await tap(page, 'k');
  await page.waitForTimeout(500);
  now = await seen(page);
  results.push(check('K lifts it over his head', now.airplane?.state === 'carried' && now.stickMan.carrying && now.airplane.at.x === now.stickMan.feet.x && -now.airplane.at.y >= level.stickManHeight, JSON.stringify(now.airplane)));
  const liftedPixels = await pencilPixelsIn(page, await overHisHead());
  results.push(check('the airplane is drawn over his head, and no longer on the floor', liftedPixels > 150 && (await pencilPixelsIn(page, onTheFloorAhead)) < 20, `${liftedPixels} pencil pixels over his head`));
  await screenshot(page, '06-lifted.png');

  const jump = (carrying) => highestJump(page).then((height) => ({ carrying, height }));
  const carriedJump = await jump(true);
  now = await seen(page);
  results.push(check('a jump with it keeps it over his head', now.airplane?.state === 'carried' && now.stickMan.action === 'standing'));

  // Walk with it, and look at every frame: it never leaves his head.
  await page.evaluate(() => {
    window.__carried = { frames: 0, apart: 0 };
    const look = () => {
      const game = window.__game;
      const airplane = game.airplane();
      if (!airplane || airplane.state !== 'carried') return;
      window.__carried.frames += 1;
      window.__carried.apart = Math.max(window.__carried.apart, Math.abs(airplane.at.x - game.stickMan().feet.x));
      window.requestAnimationFrame(look);
    };
    window.requestAnimationFrame(look);
  });
  const carriedFrom = now.stickMan.feet.x;
  await page.keyboard.down('ArrowRight');
  await waitInGame(page, (x) => window.__game.stickMan().feet.x > x, carriedFrom + 2);
  now = await seen(page);
  // Looked at while he walks: a little ahead of where he was when the picture was asked for, so the rectangle is wide.
  const overHimWalking = await pageRectangle(page, { x: now.stickMan.feet.x - 1, y: -(level.stickManHeight + 0.42) }, { x: now.stickMan.feet.x + 1.4, y: -(level.stickManHeight + 0.1) });
  const walkingPixels = await pencilPixelsIn(page, overHimWalking);
  results.push(check('while he walks the airplane is drawn over his head', walkingPixels > 150, `${walkingPixels} pencil pixels over his head mid-walk`));
  await screenshot(page, '07-carrying.png');
  await page.keyboard.up('ArrowRight');
  await walkTo(page, edge - 1.25);
  now = await seen(page);
  const carried = await page.evaluate(() => window.__carried);
  results.push(check('he carries it as he walks: on every frame the sim has it over his feet', carried.frames > 60 && carried.apart === 0 && now.airplane?.state === 'carried' && now.stickMan.feet.x - carriedFrom > 2, `${carried.frames} frames, ${(now.stickMan.feet.x - carriedFrom).toFixed(1)} m, never more than ${carried.apart} m apart`));

  // ---- Putting it down on the edge ----
  results.push(check('while he carries it, K would put it down', now.interaction === 'putDown', `interaction: ${now.interaction}`));
  await tap(page, 'k');
  await page.waitForTimeout(500);
  now = await seen(page);
  const resting = now.airplane;
  const nose = resting ? resting.at.x + resting.length / 2 : NaN;
  results.push(check('K near the edge puts it down in front of him, sitting on the edge with its nose out over the gap', resting?.state === 'resting' && resting.onAnEdge && resting.at.x < edge && nose > edge && !now.stickMan.carrying, `middle at ${resting?.at.x.toFixed(2)}, nose at ${nose.toFixed(2)}, edge at ${edge}`));
  results.push(check('there, K would board it (boarding itself is the next ticket), and pressing it changes nothing yet', now.interaction === 'board' && (await unchangedByAPress(page))));
  await screenshot(page, '08-on-the-edge.png');
  await page.waitForTimeout(1500);
  now = await seen(page);
  results.push(check('it stays on the edge and no letter falls: nothing is lost', now.airplane?.state === 'resting' && now.letter === null && now.stickMan.action === 'standing'));

  // ---- The jump, with and without it ----
  await walkTo(page, edge - 4);
  const freeJump = await jump(false);
  results.push(check('carrying shortens the jump', carriedJump.height > 0.2 && carriedJump.height < freeJump.height - 0.1, `${carriedJump.height.toFixed(2)} m with it, ${freeJump.height.toFixed(2)} m without`));
  report.jumps = { carriedJump, freeJump };

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof('01-read-fold-carry.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** Presses jump and says how high his feet got, in metres, looking at every frame until he stands again. */
async function highestJump(page) {
  await page.evaluate(() => {
    window.__highest = 0;
    const look = () => {
      window.__highest = Math.max(window.__highest, -window.__game.stickMan().feet.y);
      if (!window.__jumpOver) window.requestAnimationFrame(look);
    };
    window.__jumpOver = false;
    window.requestAnimationFrame(look);
  });
  await page.keyboard.press('ArrowUp');
  await waitInGame(page, () => window.__game.stickMan().action === 'jumping');
  await waitInGame(page, () => window.__game.stickMan().action === 'standing');
  return page.evaluate(() => {
    window.__jumpOver = true;
    return window.__highest;
  });
}

/** True when a press of K leaves the airplane, the stick man and the slots as they were. */
async function unchangedByAPress(page) {
  const before = await seen(page);
  await tap(page, 'k');
  await page.waitForTimeout(300);
  const after = await seen(page);
  return JSON.stringify([before.airplane, before.stickMan, before.slots]) === JSON.stringify([after.airplane, after.stickMan, after.slots]);
}
