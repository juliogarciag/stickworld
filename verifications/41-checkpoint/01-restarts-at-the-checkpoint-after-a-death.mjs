/* global window */
/**
 * The real app, with real keys, on the level that has a checkpoint. The mark is drawn on the sheet.
 * A death before the checkpoint restarts the level at its start. Walking past the checkpoint passes it.
 * A death after that restarts the level at the checkpoint.
 * Every place and distance is read from the level's data through `window.__game`.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { PROOF, check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

/** Not the port of the dev server left running for the human (5241). */
const PORT = 5941;
const VIEWPORT = { width: 960, height: 540 };
const results = [];
const report = {};
const pageErrors = [];

const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
let browser;
try {
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, { timeout: 15000 });

  const levelWithOne = await page.evaluate(() => window.__game.defs && [1, 2, 3].find((id) => (window.__game.loadLevel(id), window.__game.getCheckpoint() !== undefined)));
  results.push(check('a level has a checkpoint', levelWithOne !== undefined, `level ${levelWithOne}`));
  await page.waitForFunction(() => window.__game.sim.tick > 30);
  const level = await page.evaluate(() => ({ start: window.__game.level.start, checkpoint: window.__game.getCheckpoint() }));
  results.push(check('the checkpoint is past the level start and is not passed yet', level.checkpoint.position.x > level.start.x && level.checkpoint.isPassed === false, JSON.stringify(level)));

  // A death before the checkpoint (off the left end of the paper) restarts the level at its start.
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__game.getStickMan().feet.y > 2, null, { timeout: 20000 });
  await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(() => window.__game.getStickMan().feet.y === window.__game.level.start.y, null, { timeout: 10000 });
  const afterDeathBefore = await page.evaluate(() => ({ man: window.__game.getStickMan(), checkpoint: window.__game.getCheckpoint() }));
  results.push(check('a death before the checkpoint restarts the level at its start', afterDeathBefore.man.feet.x === level.start.x && afterDeathBefore.checkpoint.isPassed === false, `x ${afterDeathBefore.man.feet.x}`));

  // Walking towards the checkpoint: the mark comes into view not passed, and is passed as the stick man walks by.
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__game.getStickMan().feet.x > window.__game.getCheckpoint().position.x - 1.2);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(700);
  const before = await markOnScreen(page);
  await page.screenshot({ path: path.join(PROOF, '01-the-checkpoint-not-passed.png') });
  results.push(check('the mark is in view before the stick man reaches the checkpoint', before.inView && before.isPassed === false, JSON.stringify(before)));
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__game.getCheckpoint().isPassed, null, { timeout: 10000 });
  const passedAt = await page.evaluate(() => window.__game.getStickMan().feet.x);
  await page.waitForFunction(() => window.__game.getStickMan().feet.x > window.__game.getCheckpoint().position.x + 0.8);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(PROOF, '01-the-checkpoint-passed.png') });
  results.push(check('the checkpoint is passed as the stick man walks past it, not before', passedAt >= level.checkpoint.position.x && passedAt < level.checkpoint.position.x + 0.2, `passed with the feet at x ${passedAt.toFixed(3)}, the mark at ${level.checkpoint.position.x}`));
  // That the mark looks different once passed is shown by the two screenshots and held by `render/checkpoint.test.ts`. The stick man has moved between the two screenshots, so comparing their pixels would prove nothing.

  // Two deaths after the checkpoint (into the gap): each restarts the level at the checkpoint.
  for (const death of [1, 2]) {
    await page.keyboard.down('ArrowRight');
    // The key is released as soon as the fall begins, well before the level restarts. A key still down at the restart would walk the stick man away from the checkpoint.
    await page.waitForFunction(() => window.__game.getStickMan().feet.y > window.__game.level.start.y + 0.2, null, { timeout: 20000 });
    await page.keyboard.up('ArrowRight');
    if (death === 1) {
      await page.waitForFunction(() => window.__game.getStickMan().feet.y > 2, null, { timeout: 5000 }).catch(() => undefined);
      await page.screenshot({ path: path.join(PROOF, '01-falling-into-the-gap.png') });
    }
    await page.waitForFunction(() => window.__game.getStickMan().feet.y === window.__game.level.start.y, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ man: window.__game.getStickMan(), checkpoint: window.__game.getCheckpoint(), level: window.__game.level.id, turning: window.__game.getPageTurn() !== null }));
    results.push(check(`death ${death} past the checkpoint restarts the level there, with the stick man standing and no page turned`, after.man.feet.x === level.checkpoint.position.x && after.man.action === 'standing' && after.checkpoint.isPassed && !after.turning && after.level === levelWithOne, `x ${after.man.feet.x}, ${after.man.action}`));
    if (death === 1) await page.screenshot({ path: path.join(PROOF, '01-back-at-the-checkpoint.png') });
    report[`afterDeath${death}`] = after;
  }

  // Loading the level afresh (a new game on that level) forgets the checkpoint.
  await page.evaluate((id) => window.__game.loadLevel(id), levelWithOne);
  await page.waitForFunction(() => window.__game.sim.tick > 5);
  const afresh = await page.evaluate(() => ({ man: window.__game.getStickMan(), checkpoint: window.__game.getCheckpoint() }));
  results.push(check('the level loaded afresh starts at the level start, with the checkpoint not passed', afresh.man.feet.x === level.start.x && afresh.checkpoint.isPassed === false, `x ${afresh.man.feet.x}`));

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
  Object.assign(report, { level, afterDeathBefore, before, passedAt, afresh });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('01-restarts-at-the-checkpoint-after-a-death.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** Whether the level's camera shows the place the checkpoint stands at, and whether the sim has it passed. */
function markOnScreen(page) {
  return page.evaluate(() => {
    const { position, isPassed } = window.__game.getCheckpoint();
    const seen = window.__game.getLevelInView();
    return { isPassed, position, seen, inView: position.x > seen.left && position.x < seen.right && position.y > seen.top && position.y < seen.bottom };
  });
}
