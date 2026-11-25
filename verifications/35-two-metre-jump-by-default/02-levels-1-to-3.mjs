/* global window */
/**
 * A fresh game played through levels 1 to 3 with the real keys and the game's own jump, recorded: level 1 walked to
 * its flag, level 2's gap jumped with a held jump, level 3's letter read, the airplane made, set down on the edge,
 * boarded and flown across with a climb of the up key, and its flag reached. On the way, the shortcuts are tried once
 * each and refused: level 2's gap walked into, level 3's gap jumped.
 */
import path from 'node:path';
import { PROOF, check, summarize, writeProof } from './lib.mjs';
import { airplaneReadyOnTheEdge, hold, openTheGame, startFollowing, stopFollowing, walkUntil } from './game.mjs';

/** A port no other session uses, and not the one of the dev server left running for the human (5235). */
const PORT = 5936;
/** How long the up key is held to climb across level 3's gap: inside the window its test holds (16 to 42 ticks). */
const CLIMB_MS = 480;
const results = [];
const report = {};
const pageErrors = [];

let game;
try {
  game = await openTheGame({ port: PORT, results, pageErrors, recordVideoDir: path.join(PROOF, 'video-02') });
  const { page } = game;
  const levelNow = () => page.evaluate(() => window.__game.level.id);
  const waitForLevel = (id) => page.waitForFunction((wanted) => window.__game.level.id === wanted && window.__game.pageTurn() === null, id, { timeout: 15000 });

  // Level 1: walk to the flag.
  results.push(check('a fresh game starts on level 1', (await levelNow()) === 1));
  await walkUntil(page, 'ArrowRight', () => window.__game.flag()?.reached === true, 20000);
  await page.screenshot({ path: path.join(PROOF, 'level-1-flag.png') });
  await waitForLevel(2);
  results.push(check('level 1 finished: level 2 starts', true));

  // Level 2: walking into the gap is refused; a held jump before the edge crosses it.
  const gap2 = await page.evaluate(() => ({ from: window.__game.level.floor[0].to.x, to: window.__game.level.floor[1].from.x, start: window.__game.level.start.x }));
  await startFollowing(page);
  await walkUntil(page, 'ArrowRight', `(man) => man.feet.x < ${gap2.start} + 0.01 && window.__game.sim.tick > 60 && window.__followed.some((s) => s.y > 3)`, 20000).catch(() => {});
  const walkedIn = await stopFollowing(page);
  results.push(check("level 2: walking into the gap is refused, he falls and starts again", walkedIn.some((sample) => sample.y > 3) && (await levelNow()) === 2 && (await page.evaluate(() => !window.__game.flag().reached))));
  await page.waitForFunction(() => window.__game.stickMan().action === 'standing', null, { timeout: 8000 });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(`window.__game.stickMan().feet.x >= ${gap2.from} - 0.35`, null, { timeout: 10000, polling: 'raf' });
  await startFollowing(page);
  await hold(page, 'Space', 700);
  await page.waitForFunction(() => window.__game.flag()?.reached === true || window.__game.level.id !== 2, null, { timeout: 15000 });
  await page.keyboard.up('ArrowRight');
  const jump2 = await stopFollowing(page);
  const highest2 = Math.max(...jump2.filter((sample) => sample.level === 2).map((sample) => -sample.y));
  await page.screenshot({ path: path.join(PROOF, 'level-2-flag.png') });
  results.push(check('level 2: a held jump crosses the gap and reaches the flag', highest2 > 1.5, `feet ${highest2.toFixed(2)} m up over the gap`));
  report.level2 = { gap: gap2, highestOverTheGap: highest2 };
  await waitForLevel(3);

  // Level 3: a jump at the edge is refused; the airplane crosses.
  const gap3 = await page.evaluate(() => ({ from: window.__game.level.floor[0].to.x, to: window.__game.level.floor[1].from.x }));
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(`window.__game.stickMan().feet.x >= ${gap3.from} - 0.3`, null, { timeout: 15000, polling: 'raf' });
  await startFollowing(page);
  await hold(page, 'Space', 700);
  await page.waitForFunction(() => window.__game.stickMan().feet.y > 3, null, { timeout: 8000 });
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.__game.stickMan().action === 'standing' && window.__game.stickMan().feet.y === 0, null, { timeout: 8000 });
  const jump3 = await stopFollowing(page);
  const highest3 = Math.max(...jump3.map((sample) => -sample.y));
  const furthest3 = Math.max(...jump3.map((sample) => sample.x));
  const afterTheJump = await page.evaluate(() => ({ x: window.__game.stickMan().feet.x, level: window.__game.level.id }));
  results.push(check("level 3: a full running jump at the edge falls into the gap and the level starts again", highest3 > 1.9 && furthest3 > gap3.from && afterTheJump.level === 3 && afterTheJump.x < gap3.from, `feet ${highest3.toFixed(2)} m up, furthest x ${furthest3.toFixed(2)}, back at x ${afterTheJump.x.toFixed(2)}`));

  await airplaneReadyOnTheEdge(page);
  await page.screenshot({ path: path.join(PROOF, 'level-3-ready-to-board.png') });
  await hold(page, 'k', 60);
  await page.waitForFunction(() => window.__game.stickMan().action === 'seated', null, { timeout: 5000 });
  await page.waitForTimeout(150);
  await hold(page, 'ArrowUp', CLIMB_MS);
  await page.waitForFunction(() => window.__game.stickMan().action === 'standing' || window.__game.stickMan().action === 'walking', null, { timeout: 20000 });
  const landed = await page.evaluate(() => window.__game.stickMan().feet.x);
  results.push(check('level 3: the airplane, boarded and climbed, crosses the gap', landed > gap3.to, `stood up at x ${landed.toFixed(2)} (gap ends at ${gap3.to})`));
  await walkUntil(page, 'ArrowRight', () => window.__game.flag()?.reached === true, 20000);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(PROOF, 'level-3-the-end.png') });
  results.push(check('level 3: the flag is reached and the game ends', await page.evaluate(() => window.__game.ending().over === true)));

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof('02-levels-1-to-3.json', report);
process.exit(summarize(results) ? 0 : 1);
