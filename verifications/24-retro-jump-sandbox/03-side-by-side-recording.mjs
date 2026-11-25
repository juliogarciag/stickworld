/* global window, document */
/**
 * The two jumps side by side, recorded: two games in one page, the current one on the left and the 90s preset on the
 * right (chosen in its own panel), given the same moves at the same moments: a walk, a jump held long, a tap, a
 * short hold, and a jump that turns back in the air. Writes a video and a still of both at the top of the held jump.
 */
import { renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PROOF, check, summarize, writeProof } from './lib.mjs';
import { PORT, startDevServer } from './jumps.mjs';

const HALF = { width: 720, height: 460 };
const results = [];
const report = {};

let devServer;
let browser;
try {
  devServer = await startDevServer(results);
  browser = await chromium.launch();
  const size = { width: HALF.width * 2, height: HALF.height + 30 };
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: PROOF, size } });
  const page = await context.newPage();
  const url = `http://localhost:${PORT}/`;
  await page.setContent(`<body style="margin:0;display:flex;flex-wrap:wrap;font:16px sans-serif;background:#fff">
    <div style="width:${HALF.width}px;text-align:center;line-height:30px">current</div><div style="width:${HALF.width}px;text-align:center;line-height:30px">90s platformer</div>
    <iframe id="current" src="${url}" style="width:${HALF.width}px;height:${HALF.height}px;border:0;border-right:2px solid #333"></iframe>
    <iframe id="nineties" src="${url}" style="width:${HALF.width - 2}px;height:${HALF.height}px;border:0"></iframe></body>`);
  const frames = { current: await frameOf(page, 'current'), nineties: await frameOf(page, 'nineties') };
  for (const frame of Object.values(frames)) await frame.waitForFunction(() => window.__game && window.__game.sim.tick > 10 && document.querySelector('.lil-gui.lil-root'), null, { timeout: 15000 });

  // The right game's own panel, as the owner would use it; folded away again so it does not cover the sheet.
  await frames.nineties.locator('.lil-gui.lil-root > .lil-title').click();
  await frames.nineties.locator('.lil-gui .lil-controller.lil-option select').selectOption({ label: '90s platformer' });
  await frames.nineties.locator('.lil-gui.lil-root > .lil-title').click();
  await page.waitForTimeout(500);
  const tunings = { current: await tuningIn(frames.current), nineties: await tuningIn(frames.nineties) };
  report.tunings = tunings;
  results.push(check('left plays the current jump, right the 90s preset', tunings.current.letGoCut === 0 && tunings.nineties.letGoCut === 1 && tunings.nineties.jumpHeight > tunings.current.jumpHeight, `${tunings.current.jumpHeight} m and ${tunings.nineties.jumpHeight} m`));

  // The same moves in both, at the same moments: commands queued through the debug API, which is the queue the keys feed
  // (the keys themselves are script 02's). Both games hear each one at their next tick.
  const both = (commands) => Promise.all(Object.values(frames).map((frame) => frame.evaluate((list) => list.forEach((command) => window.__game.queueCommand(command)), commands)));
  const highest = { current: 0, nineties: 0 };
  const watchHeights = () => Promise.all(Object.entries(frames).map(async ([name, frame]) => (highest[name] = Math.max(highest[name], await frame.evaluate(() => window.__game.level.start.y - window.__game.stickMan().feet.y)))));
  const wait = async (ms) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      await watchHeights();
      await page.waitForTimeout(16);
    }
  };
  await wait(600);
  await both([{ type: 'player/walk', direction: 1 }]);
  await wait(500);
  await both([{ type: 'player/walk', direction: 0 }]);
  await wait(400);
  // Held long: the full jump of each. The still is taken near the top of the 90s jump.
  await both([{ type: 'player/jump' }]);
  await wait(300);
  await page.screenshot({ path: path.join(PROOF, '03-both-jumps-held-near-the-top.png') });
  await wait(500);
  await both([{ type: 'player/letGoOfJump' }]);
  await wait(900);
  // A tap.
  await both([{ type: 'player/jump' }, { type: 'player/letGoOfJump' }]);
  await wait(900);
  // A short hold.
  await both([{ type: 'player/jump' }]);
  await wait(130);
  await both([{ type: 'player/letGoOfJump' }]);
  await wait(900);
  // A jump that turns back and stops in the air.
  await both([{ type: 'player/walk', direction: 1 }, { type: 'player/jump' }]);
  await wait(200);
  await both([{ type: 'player/walk', direction: -1 }]);
  await wait(150);
  await both([{ type: 'player/walk', direction: 0 }]);
  await wait(500);
  await both([{ type: 'player/letGoOfJump' }]);
  await wait(800);
  report.highest = highest;
  results.push(check('the 90s jump went far higher than the current one on the same moves', highest.nineties > 4 * highest.current, `${highest.current.toFixed(2)} m and ${highest.nineties.toFixed(2)} m`));

  const video = page.video();
  await context.close();
  const recorded = await video.path();
  renameSync(recorded, path.join(PROOF, '03-side-by-side.webm'));
  const bytes = statSync(path.join(PROOF, '03-side-by-side.webm')).size;
  results.push(check('the recording was written', bytes > 100_000, `proof/03-side-by-side.webm, ${bytes} bytes`));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer?.stop();
}

report.results = results;
writeProof('03-side-by-side-recording.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

async function frameOf(page, id) {
  const handle = await page.waitForSelector(`#${id}`);
  return handle.contentFrame();
}

function tuningIn(frame) {
  return frame.evaluate(() => window.__game.movementTuning());
}
