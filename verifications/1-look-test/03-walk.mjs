/* global window */
/**
 * The walk, on the real app: the stick man walks along the floor by himself,
 * his limbs move through a walk cycle while the camera keeps him in view, and
 * the arrow keys walk him left and right and let him stand. Records the walk
 * (and the lines boiling) as proof/03-walk.webm, with frames of one cycle.
 */
import { chromium } from 'playwright';
import { readdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { PROOF, check, lastLinesOf, lookAt, onScreen, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

const PORT = 5912;
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
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, recordVideo: { dir: PROOF, size: VIEWPORT } });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game?.walkDemo?.() && window.__game.camera(), null, { timeout: 15000 });
  const hashAtStart = await page.evaluate(() => ({ hash: window.__game.hash(), tick: window.__game.sim.tick }));

  // ---- By himself ----
  const first = await poseOf(page);
  await page.waitForTimeout(1000);
  const second = await poseOf(page);
  report.byHimself = { first, second };
  results.push(check('he walks along the floor by himself', first.action === 'walking' && second.action === 'walking' && second.feet.x > first.feet.x + 0.5, `from ${first.feet.x.toFixed(2)} m to ${second.feet.x.toFixed(2)} m in a second`));
  results.push(check('his walk cycle moves on as he walks', second.walkCycle !== first.walkCycle));
  results.push(check('he stays on the floor line', second.feet.y === first.feet.y && second.feet.y === (await page.evaluate(() => window.__game.level.floor[0].from.y))));

  // ---- His limbs move, and the camera keeps him in view ----
  const game = await page.evaluate(() => ({ stickManHeight: window.__game.stickManHeight, floorY: window.__game.level.floor[0].from.y }));
  const frames = [];
  for (let frame = 0; frame < 4; frame += 1) {
    const screen = await onScreen(page);
    const { pose } = screen;
    const picture = await page.screenshot({ path: path.join(PROOF, `03-walk-${frame + 1}.png`) });
    frames.push({ picture, pose, feetX: screen.x(pose.feet.x), floorY: screen.y(game.floorY), manHeight: game.stickManHeight * screen.perMetre });
    await page.waitForTimeout(140);
  }
  const centred = frames.every((frame) => Math.abs(frame.feetX - VIEWPORT.width / 2) < 2);
  results.push(check('the camera keeps him in the middle of the view as he walks', centred, frames.map((frame) => frame.feetX.toFixed(1)).join(' ')));
  const { feetX, floorY, manHeight } = frames[0];
  const legs = { x: feetX - manHeight * 0.4, y: floorY - manHeight * 0.45, width: manHeight * 0.8, height: manHeight * 0.45 - 10 };
  const arms = { x: feetX - manHeight * 0.4, y: floorY - manHeight * 0.75, width: manHeight * 0.8, height: manHeight * 0.25 };
  // The paper scrolls under him, so pictures are compared by how wide his limbs spread, not pixel by pixel.
  const spreads = [];
  for (const frame of frames) {
    await showPicture(page, frame.picture);
    const [legsSpread, armsSpread] = await lookAt(page, [legs, arms]);
    spreads.push({ legs: legsSpread.darkWidth, arms: armsSpread.darkWidth });
  }
  await hidePicture(page);
  report.limbSpreads = spreads;
  const rangeOf = (limb) => Math.max(...spreads.map((spread) => spread[limb])) - Math.min(...spreads.map((spread) => spread[limb]));
  results.push(check('his legs and arms swing: how far they spread changes through the cycle', rangeOf('legs') > manHeight * 0.1 && rangeOf('arms') > manHeight * 0.05, spreads.map((spread) => `legs ${spread.legs.toFixed(0)} px, arms ${spread.arms.toFixed(0)} px`).join(' | ')));
  const [drawn] = await lookAt(page, [{ x: feetX - manHeight * 0.5, y: floorY - manHeight * 1.15, width: manHeight, height: manHeight * 1.15 - 10 }]);
  results.push(check('he is a whole stick man while walking: drawn from the floor up to his height', drawn.darkShare > 0.01 && Math.abs(floorY - (drawn.topDarkY ?? floorY) - manHeight) < manHeight * 0.08, `${(floorY - (drawn.topDarkY ?? floorY)).toFixed(1)} px tall, ${manHeight.toFixed(1)} px expected`));

  // ---- The arrow keys ----
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(700);
  const walkingLeft = await poseOf(page);
  await page.waitForTimeout(500);
  const furtherLeft = await poseOf(page);
  await page.screenshot({ path: path.join(PROOF, '03-walking-left.png') });
  await page.keyboard.up('ArrowLeft');
  results.push(check('the left arrow key walks him left', walkingLeft.facing === -1 && walkingLeft.action === 'walking' && furtherLeft.feet.x < walkingLeft.feet.x - 0.2, `facing ${walkingLeft.facing}, ${walkingLeft.feet.x.toFixed(2)} m then ${furtherLeft.feet.x.toFixed(2)} m`));

  await page.waitForFunction(() => window.__game.walkDemo().pose().action === 'standing');
  const standing = await poseOf(page);
  await page.waitForTimeout(600);
  const stillStanding = await poseOf(page);
  await page.screenshot({ path: path.join(PROOF, '03-standing.png') });
  results.push(check('with no key held he stands where he stopped', JSON.stringify(standing) === JSON.stringify(stillStanding) && standing.facing === -1, `at ${standing.feet.x.toFixed(2)} m`));

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  const walkingRight = await poseOf(page);
  await page.keyboard.up('ArrowRight');
  results.push(check('the right arrow key walks him right', walkingRight.facing === 1 && walkingRight.action === 'walking' && walkingRight.feet.x > standing.feet.x + 0.2, `facing ${walkingRight.facing}, at ${walkingRight.feet.x.toFixed(2)} m`));
  await page.waitForTimeout(800);

  // ---- None of it is game state ----
  const simAfter = await page.evaluate(() => {
    const { sim, level, snapshot } = window.__game;
    const restarted = JSON.stringify(snapshot());
    return { tick: sim.tick, snapshot: restarted, levelId: level.id };
  });
  report.snapshotAfterWalking = JSON.parse(simAfter.snapshot);
  const mentionsTheWalk = /walk|facing|pose|limb|feet/i.test(simAfter.snapshot);
  results.push(check('the walk is view only: the sim kept ticking and its state says nothing about him', simAfter.tick > hashAtStart.tick && !mentionsTheWalk, `tick ${hashAtStart.tick} to ${simAfter.tick}`));

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
  await context.close();
  const recorded = readdirSync(PROOF).find((file) => file.endsWith('.webm') && file !== '03-walk.webm');
  if (recorded) renameSync(path.join(PROOF, recorded), path.join(PROOF, '03-walk.webm'));
  results.push(check('the walk was recorded', Boolean(recorded), 'proof/03-walk.webm'));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('03-walk.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** Lays an earlier screenshot over the page, so `lookAt` measures that moment instead of now. */
function showPicture(page, picture) {
  return page.evaluate(async (png) => {
    const image = window.document.getElementById('earlier-picture') ?? window.document.body.appendChild(Object.assign(new window.Image(), { id: 'earlier-picture', style: 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:9' }));
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
  }, picture.toString('base64'));
}

function hidePicture(page) {
  return page.evaluate(() => window.document.getElementById('earlier-picture')?.remove());
}

function poseOf(page) {
  return page.evaluate(() => window.__game.walkDemo().pose());
}
