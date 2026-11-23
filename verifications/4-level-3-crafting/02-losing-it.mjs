/* global window */
/**
 * Loses the airplane in every way there is, with the keyboard, and each time
 * gets it back: a new letter falls from the sky to where the old one was,
 * and reading it gives a new paper, which folds into a new airplane.
 *
 * Level 3 is started on its own here, so the first letter also has to give
 * the paper to someone who arrives without one.
 */
import { check, summarize, writeProof } from './lib.mjs';
import { content, openGame, pageRectangle, pencilPixelsIn, screenshot, seen, tap, waitInGame, walkTo } from './play.mjs';

const results = [];
const report = { ways: [] };
let game;
try {
  game = await openGame({ port: 5915, results });
  const { page, pageErrors } = game;
  await page.evaluate(() => window.__game.loadLevel(3));
  const level = await content(page);
  const edge = level.floor[0].to.x;
  const tooCloseToTheEdge = edge - 0.2;

  let now = await seen(page);
  results.push(check('level 3 started on its own: no paper, and the letter lies there', now.level === 3 && now.slots[0].itemDefId === null && now.letter?.height === 0));
  await readTheLetter(page, level);
  now = await seen(page);
  results.push(check('the first letter gives the paper to him who has none, in his hand', now.slots[0].itemDefId === level.paper && now.slots[0].selected, JSON.stringify(now.slots)));
  await fold(page);

  const ways = [
    {
      name: 'put down too far past the edge',
      shot: '09-put-down-past-the-edge.png',
      lose: async () => {
        await tap(page, 'j');
        await tap(page, 'k');
        await walkTo(page, tooCloseToTheEdge);
        await tap(page, 'k');
        return expectItToFall(page, 'it falls past the edge when he puts it down that close to it', edge);
      },
    },
    {
      name: 'set down from the slot too far past the edge',
      lose: async () => {
        await walkTo(page, tooCloseToTheEdge);
        await tap(page, 'j');
        return expectItToFall(page, 'it falls past the edge when he sets it down from the slot that close to it', edge);
      },
    },
    {
      name: 'carried off the edge',
      lose: async () => {
        await tap(page, 'j');
        await tap(page, 'k');
        await page.keyboard.down('ArrowRight');
        await waitInGame(page, () => window.__game.airplane()?.state === 'falling' && window.__game.stickMan().feet.y > 0.6);
        const falling = await seen(page);
        await screenshot(page, '10-carried-off-the-edge.png');
        await page.keyboard.up('ArrowRight');
        results.push(check('it falls out of his hands when he walks off the edge with it', falling.airplane.at.x > edge && !falling.stickMan.carrying && falling.stickMan.action === 'jumping', `airplane at ${falling.airplane.at.x.toFixed(2)}, edge at ${edge}`));
        await waitInGame(page, (start) => window.__game.stickMan().feet.x === start.x && window.__game.stickMan().feet.y === start.y, level.start);
        results.push(check('he dies, and the level starts again', true));
      },
    },
    {
      name: 'carried into the gap by a jump from the edge',
      lose: async () => {
        await tap(page, 'j');
        await tap(page, 'k');
        await page.keyboard.down('ArrowRight');
        await waitInGame(page, (x) => window.__game.stickMan().feet.x > x, edge - 0.15);
        await page.keyboard.press('ArrowUp');
        await waitInGame(page, () => window.__game.airplane()?.state === 'falling');
        const jumped = await seen(page);
        await waitInGame(page, (start) => window.__game.stickMan().feet.x === start.x && window.__game.stickMan().feet.y === start.y, level.start);
        await page.keyboard.up('ArrowRight');
        const after = await seen(page);
        results.push(check('a jump from the edge with it does not cross the gap: he falls in, it falls out of his hands, and the level starts again', jumped.stickMan.feet.x > edge && jumped.stickMan.feet.x < level.floor[1].from.x && after.flag.reached === false, `let go at x ${jumped.stickMan.feet.x.toFixed(2)}, gap from ${edge} to ${level.floor[1].from.x}`));
      },
    },
    {
      name: 'left on the floor when he dies',
      lose: async () => {
        await tap(page, 'j');
        const resting = await seen(page);
        results.push(check('it rests on the floor while he walks off the paper to the left', resting.airplane?.state === 'resting'));
        await page.keyboard.down('ArrowLeft');
        await waitInGame(page, () => window.__game.stickMan().action === 'jumping');
        await page.keyboard.up('ArrowLeft');
        await waitInGame(page, (start) => window.__game.stickMan().feet.x === start.x && window.__game.stickMan().feet.y === start.y, level.start);
      },
    },
  ];

  for (const way of ways) {
    console.log(`\n-- ${way.name} --`);
    await way.lose();
    if (way.shot) await screenshot(page, way.shot);
    await waitInGame(page, () => window.__game.airplane() === undefined);
    now = await seen(page);
    results.push(check(`${way.name}: the airplane is lost, and he holds nothing`, now.airplane === null && now.slots[0].itemDefId === null && now.letter === null));

    // A new letter: first high above the place, then lower, then lying where the old one was.
    await waitInGame(page, () => window.__game.letter() !== undefined);
    const high = (await seen(page)).letter;
    await waitInGame(page, (below) => window.__game.letter().height < below, high.height / 2);
    const lower = (await seen(page)).letter;
    const around = await pageRectangle(page, { x: level.letterAt.x - 0.9, y: -lower.height - 0.9 }, { x: level.letterAt.x + 0.9, y: -lower.height + 0.4 });
    const fallingPixels = await pencilPixelsIn(page, around);
    if (way === ways[0]) await screenshot(page, '11-a-new-letter-falls.png');
    await waitInGame(page, () => window.__game.letter().height === 0);
    const landed = (await seen(page)).letter;
    results.push(check(`${way.name}: a new letter falls from the sky to where the old one was`, high.height > 3 && lower.height < high.height && landed.at.x === level.letterAt.x && landed.at.y === level.letterAt.y && fallingPixels > 80, `seen at ${high.height.toFixed(1)} m, then ${lower.height.toFixed(1)} m, then on the floor at x ${landed.at.x}; ${fallingPixels} pencil pixels on its way down`));

    await readTheLetter(page, level);
    now = await seen(page);
    results.push(check(`${way.name}: reading it gives a new paper`, now.slots[0].itemDefId === level.paper, JSON.stringify(now.slots)));
    if (way === ways[0]) await screenshot(page, '12-a-new-paper.png');
    await fold(page);
    report.ways.push(way.name);
  }

  await page.waitForTimeout(2500);
  now = await seen(page);
  results.push(check('with the airplane in his slot again, no further letter falls', now.letter === null && now.slots[0].itemDefId === level.airplaneItem));
  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof('02-losing-it.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** Walks to the letter and reads it with K. He is left reading. */
async function readTheLetter(page, level) {
  await walkTo(page, level.letterAt.x + ((await seen(page)).stickMan.feet.x > level.letterAt.x ? 0.35 : -0.35));
  await tap(page, 'k');
  await waitInGame(page, () => window.__game.letter()?.beingRead === true, null, 5000);
}

/** Puts the letter away and folds the paper, which reading put in his hand: K, J. The airplane ends up as the item in his selected slot. */
async function fold(page) {
  await tap(page, 'k');
  await tap(page, 'j');
  const now = await seen(page);
  results.push(check('the paper folds into an airplane', now.slots[0].itemDefId !== null && now.itemUse === 'place' && now.letter === null, JSON.stringify(now.slots)));
}

/** The airplane is past the edge and falling, and he still stands on the floor. */
async function expectItToFall(page, name, edge) {
  await waitInGame(page, () => window.__game.airplane()?.state === 'falling' && window.__game.airplane().at.y > 0.3, null, 5000).catch(() => undefined);
  const now = await seen(page);
  results.push(check(name, now.airplane?.state === 'falling' && now.airplane.at.x > edge && now.stickMan.action === 'standing' && !now.stickMan.carrying, JSON.stringify(now.airplane)));
}
