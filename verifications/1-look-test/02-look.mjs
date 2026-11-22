/* global window */
/**
 * The look, on the real app: the paper has a grain, level 1's floor is a
 * pencil line where the level says the floor is, the stick man stands on it
 * as tall as the sim says he is, the lines have a pencil's grain, and a
 * still picture boils (the lines are redrawn, the paper is not).
 *
 * Expected positions come from `window.__game` (level, camera,
 * pixelsPerMetre, stickManHeight, walkDemo), never from numbers typed here.
 * Writes the "after" screenshots.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { PROOF, check, differingPixels, lastLinesOf, lookAt, onScreen, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

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
  const page = await openGame(browser, { viewport: VIEWPORT, deviceScaleFactor: 1 });

  // A still picture: the stick man standing a few steps from where the level starts him.
  await holdStill(page);
  const game = await page.evaluate(() => ({ level: window.__game.level, pose: window.__game.walkDemo().pose(), stickManHeight: window.__game.stickManHeight }));
  const screen = await onScreen(page);
  const floor = game.level.floor[0];
  const floorY = screen.y(floor.from.y);
  const feetX = screen.x(game.pose.feet.x);
  const manHeight = game.stickManHeight * screen.perMetre;
  report.game = game;
  report.screen = { floorY, feetX, manHeight, perMetre: screen.perMetre, camera: screen.camera };
  await page.screenshot({ path: path.join(PROOF, '02-after.png') });

  // ---- The paper ----
  const emptyPaper = { x: 20, y: 20, width: 240, height: 120 };
  const [paper] = await lookAt(page, [emptyPaper]);
  report.paper = paper;
  results.push(check('the paper is not a flat colour: it has a grain', paper.distinctColours > 30 && paper.luminanceSpread > 0.8, `${paper.distinctColours} colours, luminance spread ${paper.luminanceSpread.toFixed(2)}`));
  results.push(check('the paper is still light, with nothing drawn where nothing is', paper.meanLuminance > 220 && paper.darkShare === 0, `mean luminance ${paper.meanLuminance.toFixed(1)}`));

  // ---- The floor line ----
  const visibleFrom = Math.max(floor.from.x, game.pose.feet.x - (VIEWPORT.width / 2 - 20) / screen.perMetre);
  const visibleTo = Math.min(floor.to.x, game.pose.feet.x + (VIEWPORT.width / 2 - 20) / screen.perMetre);
  const alongTheFloor = Array.from({ length: 9 }, (_, sample) => visibleFrom + ((visibleTo - visibleFrom) * (sample + 0.5)) / 9).filter((metres) => Math.abs(screen.x(metres) - feetX) > manHeight * 0.5);
  const onTheLine = await lookAt(page, alongTheFloor.map((metres) => ({ x: screen.x(metres) - 3, y: floorY - 8, width: 6, height: 16 })));
  const underTheLine = await lookAt(page, alongTheFloor.map((metres) => ({ x: screen.x(metres) - 3, y: floorY + 14, width: 6, height: 40 })));
  results.push(check(`the floor is a pencil line where level ${game.level.id} says the floor is`, alongTheFloor.length >= 5 && onTheLine.every((spot) => spot.darkShare > 0.1), `${alongTheFloor.length} spots along it, dark share ${onTheLine.map((spot) => spot.darkShare.toFixed(2)).join(' ')}`));
  results.push(check('the line stays a line: nothing is drawn under it', underTheLine.every((spot) => spot.darkShare === 0)));
  const beforeTheFloor = screen.x(floor.from.x) - 60;
  const [leftOfTheFloor] = beforeTheFloor > 10 ? await lookAt(page, [{ x: 10, y: floorY - 10, width: beforeTheFloor - 10, height: 20 }]) : [undefined];
  results.push(check('the line starts where the floor starts', leftOfTheFloor?.darkShare === 0, leftOfTheFloor ? `dark share left of the floor ${leftOfTheFloor.darkShare.toFixed(3)}` : 'the start of the floor is not in view'));

  // ---- The pencil's grain ----
  const stretch = { x: feetX + manHeight * 0.5, y: floorY - 6, width: 300, height: 12 };
  // The middle of the line is the darkest row of pixels along it. A flat line (a marker) is one colour there; graphite is not.
  const rows = await lookAt(page, [-2, -1, 0, 1, 2].map((offset) => ({ x: stretch.x, y: Math.round(floorY) + offset, width: stretch.width, height: 1 })));
  const middle = rows.reduce((darkest, row) => (row.meanLuminance < darkest.meanLuminance ? row : darkest));
  report.middleOfTheLine = middle;
  results.push(check('the line has a grain: along its middle it is not one flat colour', middle.luminanceSpread > 10 && middle.meanLuminance < 140, `luminance ${middle.meanLuminance.toFixed(0)}, spread ${middle.luminanceSpread.toFixed(1)} (a flat line has 0)`));

  // ---- The stick man ----
  const aroundHim = { x: feetX - manHeight * 0.4, y: floorY - manHeight * 1.15, width: manHeight * 0.8, height: manHeight * 1.15 - 10 };
  const besideHim = { x: feetX + manHeight * 0.6, y: floorY - manHeight * 1.15, width: manHeight * 0.8, height: manHeight * 1.15 - 10 };
  const [man, noMan] = await lookAt(page, [aroundHim, besideHim]);
  report.man = man;
  const drawnHeight = floorY - (man.topDarkY ?? floorY);
  results.push(check('the stick man is drawn standing on the floor line', man.darkShare > 0.01 && man.darkShare < 0.3 && noMan.darkShare === 0, `dark share ${man.darkShare.toFixed(3)} around him, ${noMan.darkShare.toFixed(3)} beside him`));
  results.push(check('he is as tall on screen as the sim says he is', Math.abs(drawnHeight - manHeight) < manHeight * 0.06, `${drawnHeight.toFixed(1)} px drawn, ${manHeight.toFixed(1)} px expected`));
  const headRadius = manHeight * 0.1;
  const [insideTheHead] = await lookAt(page, [{ x: feetX - headRadius * 0.3, y: (man.topDarkY ?? 0) + headRadius * 0.7, width: headRadius * 0.6, height: headRadius * 0.6 }]);
  results.push(check('his head is a drawn circle, not a filled one', insideTheHead.darkShare === 0, `dark share inside ${insideTheHead.darkShare.toFixed(3)}`));

  // ---- The boil ----
  const still = await page.screenshot();
  await page.waitForTimeout(400);
  const later = await page.screenshot();
  const poseLater = await page.evaluate(() => window.__game.walkDemo().pose());
  const [lineChanged, manChanged, paperChanged] = await differingPixels(page, { before: still, after: later, rectangles: [stretch, aroundHim, emptyPaper] });
  report.boil = { lineChanged, manChanged, paperChanged };
  results.push(check('nothing moved between the two pictures', JSON.stringify(poseLater) === JSON.stringify(game.pose)));
  results.push(check('a still line boils: the floor is redrawn a little differently', lineChanged > 30, `${lineChanged} pixels changed`));
  results.push(check('a still stick man boils too', manChanged > 30, `${manChanged} pixels changed`));
  results.push(check('the paper does not boil', paperChanged === 0, `${paperChanged} pixels changed`));

  // ---- Size on screen comes from the camera, whatever the window ----
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForFunction((height) => window.__game.camera().height === height, 720);
  await page.waitForTimeout(200);
  const bigger = await onScreen(page);
  const biggerHeight = game.stickManHeight * bigger.perMetre;
  const [biggerMan] = await lookAt(page, [{ x: bigger.x(game.pose.feet.x) - biggerHeight * 0.4, y: bigger.y(floor.from.y) - biggerHeight * 1.15, width: biggerHeight * 0.8, height: biggerHeight * 1.15 - 12 }]);
  const shareBefore = drawnHeight / VIEWPORT.height;
  const shareAfter = (bigger.y(floor.from.y) - (biggerMan.topDarkY ?? 0)) / 720;
  results.push(check('in a bigger window he fills the same share of the view', Math.abs(shareAfter - shareBefore) < 0.02, `${(shareBefore * 100).toFixed(1)}% of the height, then ${(shareAfter * 100).toFixed(1)}%`));
  await page.close();

  // ---- The same picture on a Retina screen, and close up ----
  for (const [name, viewport, deviceScaleFactor] of [['02-after-retina', { width: 800, height: 450 }, 2], ['02-after-closeup', { width: 420, height: 300 }, 3]]) {
    const sharper = await openGame(browser, { viewport, deviceScaleFactor });
    // Mid-stride: a few steps in, just after a foot comes down in front.
    await sharper.waitForFunction(() => window.__game.walkDemo().pose().feet.x > 2.2 && window.__game.walkDemo().pose().walkCycle % 0.5 < 0.06);
    await sharper.evaluate(() => window.__game.walkDemo().setPaused(true));
    await sharper.waitForTimeout(200);
    const sharpScreen = await onScreen(sharper);
    const sharpPose = await sharper.evaluate(() => window.__game.walkDemo().pose());
    const sharpHeight = game.stickManHeight * sharpScreen.perMetre;
    const [sharpMan] = await lookAt(sharper, [{ x: sharpScreen.x(sharpPose.feet.x) - sharpHeight * 0.5, y: sharpScreen.y(floor.from.y) - sharpHeight * 1.15, width: sharpHeight, height: sharpHeight * 1.15 - 6 }]);
    const sharpDrawn = sharpScreen.y(floor.from.y) - (sharpMan.topDarkY ?? 0);
    results.push(check(`at pixel ratio ${deviceScaleFactor} he is the same size against the view, mid-stride`, Math.abs(sharpDrawn - sharpHeight) < sharpHeight * 0.08, `${sharpDrawn.toFixed(1)} px drawn, ${sharpHeight.toFixed(1)} px expected`));
    await sharper.screenshot({ path: path.join(PROOF, `${name}.png`) });
    await sharper.close();
  }

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('02-look.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

async function openGame(browser, { viewport, deviceScaleFactor }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game?.walkDemo?.() && window.__game.camera(), null, { timeout: 15000 });
  return page;
}

/** Walks him a few steps with the arrow key, as a player would, and lets go: he stands, and the picture is still. */
async function holdStill(page) {
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.__game.walkDemo().pose().action === 'standing');
  await page.waitForTimeout(300);
}
