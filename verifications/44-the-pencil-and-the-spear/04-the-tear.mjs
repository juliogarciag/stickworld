/**
 * The tear on its own, in real time and recorded: the stick man thrusts, the enemy is torn in two,
 * and the stick man walks on through its halves while they still lie there. Then the scraps leave
 * the sheet and nothing of the enemy is left, on the sheet or in the game.
 */
import { check, summarize, writeProof } from './lib.mjs';
import { holdKeyUntil, openGame, readGame, takeScreenshot, waitForGame } from './game.mjs';

/** Not the port of the dev server left running for the human (5244), nor another script's. */
const PORT = 5947;
const NAME = '04-the-tear';
const results = [];
const report = {};
let game;
try {
  game = await openGame(PORT, results, { video: '04-the-tear.webm' });
  const { page } = game;
  await holdKeyUntil(page, 'ArrowRight', 'the letter within reach', (now) => now.interaction === 'read');
  for (const key of ['KeyK', 'KeyK', 'KeyJ']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
  }
  const withSpear = await readGame(page);
  const reachAtRest = (withSpear.spear.tip.x - withSpear.stickMan.feet.x) * withSpear.spear.direction;
  const enemyWidth = withSpear.enemies[0].width;

  // It walks at the enemy and thrusts when the spear, held ready, would all but touch it: the
  // thrust reaches further than that.
  await page.keyboard.down('ArrowRight');
  await waitForGame(
    page,
    'the enemy a spear away',
    (now) => now.enemies[0].position.x - now.stickMan.feet.x <= reachAtRest + enemyWidth,
    20000,
  );
  await page.keyboard.press('KeyJ');
  const seen = [];
  const tornAt = await waitForGame(page, 'the enemy torn', (now) => {
    seen.push(now);
    return now.enemies[0]?.torn != null;
  });
  const stoodAt = tornAt.enemies[0].position.x;
  await takeScreenshot(page, '18-the-tear-in-real-time.png');
  // The key is still down: it walks on, through where the enemy stood.
  const through = await waitForGame(page, 'through where it stood', (now) => {
    seen.push(now);
    return now.stickMan.feet.x > stoodAt + enemyWidth / 2;
  });
  await page.keyboard.up('ArrowRight');
  results.push(
    check(
      'the stick man walks through where the enemy stood while its halves are still on the sheet',
      through.enemies[0]?.torn != null,
      `past it at x ${through.stickMan.feet.x.toFixed(2)}, the enemy ${through.enemies[0]?.torn?.action ?? 'gone'}`,
    ),
  );
  await takeScreenshot(page, '19-walking-through-the-halves.png');
  const gone = await waitForGame(page, 'the enemy gone', (now) => {
    seen.push(now);
    return now.enemies.length === 0;
  });
  const actions = [...new Set(seen.flatMap((now) => (now.enemies[0]?.torn ? [now.enemies[0].torn.action] : [])))];
  results.push(
    check(
      'it tore, its halves lay there, and they left, in that order',
      actions.join(' ') === 'tearing lying leaving',
      actions.join(', '),
    ),
  );
  const tornTicks = gone.tick - tornAt.tick;
  results.push(
    check(
      'nothing of it is left in the game afterwards, and the stick man was never struck',
      gone.enemies.length === 0 && seen.every((now) => now.stickMan.action !== 'struck'),
      `gone ${(tornTicks * gone.dt).toFixed(2)} s after it was torn`,
    ),
  );
  await page.waitForTimeout(600);
  await takeScreenshot(page, '20-nothing-left.png');
  results.push(check('no page errors', game.pageErrors.length === 0, game.pageErrors.join(' | ')));
  Object.assign(report, { actions, secondsTorn: tornTicks * gone.dt });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof(`${NAME}.json`, report);
process.exit(summarize(results) ? 0 : 1);
