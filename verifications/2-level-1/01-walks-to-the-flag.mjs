/* global window, document, createImageBitmap */
/**
 * Level 1 as a player meets it, in the real app, with the real keyboard:
 * the stick man walks with the arrow keys, jumps, stops short of the flag
 * without finishing, reaches the flag and finishes, and falls off the paper
 * and starts again. Then the same walk once more for the camera: a recording
 * of the walk, a jump and the flag.
 *
 * Where things are and how big they are comes from `window.__game` (the
 * level, the flag, the camera, his height). The numbers typed in here are
 * loose bounds only: "a few metres", "more than a step", "much darker".
 */
import { chromium } from 'playwright';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { PROOF, check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

/** Not 5202: that one is the dev server left running for the human. */
const PORT = 5921;
/** CSS pixels; the page opens at a pixel ratio of 1 so screen, device and CSS pixels agree. */
const VIEWPORT = { width: 960, height: 540 };
const results = [];
const report = {};
const pageErrors = [];

const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
let browser;
try {
  // The ready line proves the port is this run's server, not something that was already listening there.
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await openGame(page);

  // ---- The level as it starts ----
  const atStart = await stateOf(page);
  const { level } = atStart;
  const placedFlag = level.placements.find((placement) => atStart.defs.find((def) => def.id === placement.defId)?.name === 'flag');
  results.push(check('he starts standing where level 1 starts, looking right', atStart.level.id === 1 && near(atStart.stickMan.feet.x, level.start.x) && near(atStart.stickMan.feet.y, level.start.y) && atStart.stickMan.action === 'standing' && atStart.stickMan.facing === 1, describe(atStart)));
  results.push(check('the flag stands where the level places it, a few metres to his right, not reached', Boolean(placedFlag) && near(atStart.flag.at.x, placedFlag.at.x) && atStart.flag.at.x - level.start.x > 3 && atStart.flag.reached === false, `flag at x ${atStart.flag?.at.x}, start at x ${level.start.x}`));
  results.push(check('the view is sized by his height: he is a sixth of it or so', between(onScreenHeight(atStart) / VIEWPORT.height, 0.1, 0.25), `${onScreenHeight(atStart).toFixed(0)} px of ${VIEWPORT.height}`));
  results.push(check('the camera is on him', near(screenOf(atStart, atStart.stickMan.feet).x, VIEWPORT.width / 2, 2), `feet at screen x ${screenOf(atStart, atStart.stickMan.feet).x.toFixed(1)}`));
  const startShot = await shoot(page, '01-start.png');
  const graphiteOnHim = await darkPixels(page, startShot, bodyBox(atStart));
  const graphiteOnBarePaper = await darkPixels(page, startShot, { ...bodyBox(atStart), x: bodyBox(atStart).x - 3 * bodyBox(atStart).width });
  results.push(check('he is drawn in pencil where the sim says he is, and not beside it', graphiteOnHim > 150 && graphiteOnBarePaper < graphiteOnHim / 10, `${graphiteOnHim} dark pixels on him, ${graphiteOnBarePaper} beside him`));
  // Nothing is near the flag yet, so graphite in the stick's box can only be the stick.
  const graphiteOnTheStick = await darkPixels(page, startShot, stickBox(atStart));
  const graphiteBesideTheStick = await darkPixels(page, startShot, { ...stickBox(atStart), x: stickBox(atStart).x - 4 * stickBox(atStart).width });
  results.push(check('the flag is drawn in pencil where the sim says it stands, and not beside it', between(screenOf(atStart, atStart.flag.at).x, 0, VIEWPORT.width) && graphiteOnTheStick > 60 && graphiteBesideTheStick < graphiteOnTheStick / 10, `${graphiteOnTheStick} dark pixels on the stick, ${graphiteBesideTheStick} beside it`));
  const clothDownAtStart = await darkPixels(page, startShot, clothBox(atStart, 0));
  const clothUpAtStart = await darkPixels(page, startShot, clothBox(atStart, 1));

  // ---- Walking right ----
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  const walking1 = await stateOf(page);
  await page.waitForTimeout(600);
  const walking2 = await stateOf(page);
  await shoot(page, '02-walking.png');
  const speed = (walking2.stickMan.feet.x - walking1.stickMan.feet.x) / ((walking2.tick - walking1.tick) * walking2.dt);
  results.push(check('holding the right arrow walks him right', walking2.stickMan.action === 'walking' && walking2.stickMan.facing === 1 && walking2.stickMan.feet.x > atStart.stickMan.feet.x + 1, `${describe(walking2)}, ${speed.toFixed(2)} m/s`));
  results.push(check('his walk moves on with the distance he walks', walking2.stickMan.distanceWalked > walking1.stickMan.distanceWalked && near(walking2.stickMan.distanceWalked, walking2.stickMan.feet.x - level.start.x, 0.01), `walked ${walking2.stickMan.distanceWalked.toFixed(2)} m`));
  results.push(check('the camera follows him along the line', walking2.camera.scrollX > atStart.camera.scrollX && near(screenOf(walking2, walking2.stickMan.feet).x, VIEWPORT.width / 2, 2), `scrollX ${atStart.camera.scrollX.toFixed(0)} -> ${walking2.camera.scrollX.toFixed(0)}`));

  // ---- A jump on the way ----
  await page.keyboard.press('Space');
  const jump = await watchUntilLanded(page);
  results.push(check('space makes him jump: a small jump, under his own height, and back to the floor', jump.left && jump.landed && between(jump.highest, 0.2, atStart.stickManHeight), `feet ${jump.highest.toFixed(2)} m above the floor at the top`));
  results.push(check('he keeps walking through the jump', jump.end.stickMan.feet.x > walking2.stickMan.feet.x + 0.5 && jump.end.stickMan.action === 'walking', describe(jump.end)));
  results.push(check('a jump moves him on the screen, not the paper: the camera stays at the floor', jump.cameraHeights.every((scrollY) => near(scrollY, walking2.camera.scrollY, 0.5)) && jump.highestOnScreen < screenOf(walking2, walking2.stickMan.feet).y - 10, `feet ${(screenOf(walking2, walking2.stickMan.feet).y - jump.highestOnScreen).toFixed(0)} px higher on screen at the top`));

  // ---- Stopping short does not finish the level ----
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(300);
  const stopped1 = await stateOf(page);
  await page.waitForTimeout(700);
  const stopped2 = await stateOf(page);
  await shoot(page, '04-stopped-short.png');
  results.push(check('letting go stops him, short of the flag', stopped2.stickMan.action === 'standing' && near(stopped1.stickMan.feet.x, stopped2.stickMan.feet.x) && stopped2.stickMan.feet.x < stopped2.flag.at.x - 0.5, describe(stopped2)));
  results.push(check('stopping short does not finish the level', stopped2.flag.reached === false && stopped2.flag.raised === 0));

  // ---- Left, and a jump on the spot with the up arrow ----
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  const wentLeft = await stateOf(page);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(150);
  results.push(check('holding the left arrow turns him and walks him left', wentLeft.stickMan.facing === -1 && wentLeft.stickMan.action === 'walking' && wentLeft.stickMan.feet.x < stopped2.stickMan.feet.x - 0.5, describe(wentLeft)));
  const beforeSpotJump = await stateOf(page);
  await page.keyboard.press('ArrowUp');
  const spotJump = await watchUntilLanded(page, '03-jumping.png');
  results.push(check('the jump was caught in a screenshot', spotJump.shot, '03-jumping.png'));
  results.push(check('the up arrow jumps too, straight up when he stands', spotJump.left && spotJump.landed && near(spotJump.end.stickMan.feet.x, beforeSpotJump.stickMan.feet.x) && spotJump.end.stickMan.action === 'standing', `feet ${spotJump.highest.toFixed(2)} m above the floor at the top`));

  // ---- Reaching the flag finishes the level ----
  await page.keyboard.down('ArrowRight');
  const secondsToTheFlag = (spotJump.end.flag.at.x - spotJump.end.stickMan.feet.x) / speed;
  const reached = await waitFor('the flag to be reached', { read: () => stateOf(page), until: (state) => state.flag.reached, timeoutMs: secondsToTheFlag * 2000 + 3000 }).catch(() => undefined);
  results.push(check('walking on to the flag finishes the level', Boolean(reached), reached ? `${describe(reached)}, flag at x ${reached.flag.at.x}` : 'never reached'));
  if (!reached) throw new Error('the flag was never reached');
  const raised = await waitFor('the flag to go up', { read: () => stateOf(page), until: (state) => state.flag.raised === 1 }).catch(() => undefined);
  results.push(check('the flag goes up the stick and he cheers', Boolean(raised) && raised.stickMan.action === 'cheering', raised ? describe(raised) : 'never raised'));
  const flagShot = await shoot(page, '05-at-the-flag.png');
  const finished = await stateOf(page);
  const clothDownAtEnd = await darkPixels(page, flagShot, clothBox(finished, 0));
  const clothUpAtEnd = await darkPixels(page, flagShot, clothBox(finished, 1));
  results.push(check('the cloth is drawn low on the stick before he reaches it and at the top after', clothDownAtStart > 3 * clothUpAtStart && clothUpAtEnd > 3 * clothDownAtEnd && clothUpAtEnd > 20, `dark pixels low/high: ${clothDownAtStart}/${clothUpAtStart} at the start, ${clothDownAtEnd}/${clothUpAtEnd} at the end`));
  results.push(check('the flag stays in view with him', between(screenOf(finished, finished.flag.at).x, 0, VIEWPORT.width)));

  // The right arrow is still down; then left and a jump are tried too.
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForTimeout(2600);
  await page.keyboard.up('ArrowLeft');
  const later = await stateOf(page);
  results.push(check('once finished he stays put whatever is pressed, and the last level stays finished', near(later.stickMan.feet.x, finished.stickMan.feet.x) && near(later.stickMan.feet.y, finished.stickMan.feet.y) && later.flag.reached && later.level.id === 1, describe(later)));

  // ---- Falling off the paper starts the level again ----
  await page.evaluate(() => window.__game.loadLevel(1));
  const again = await stateOf(page);
  results.push(check('playing the level again puts him back at the start with the flag down', near(again.stickMan.feet.x, level.start.x) && again.flag.reached === false && again.flag.raised === 0, describe(again)));
  await page.keyboard.down('ArrowLeft');
  const falling = await waitFor('him to fall below the floor', { read: () => stateOf(page), until: (state) => state.stickMan.feet.y > level.start.y + 0.8, timeoutMs: 8000 }).catch(() => undefined);
  await shoot(page, '06-falling-off-the-paper.png');
  results.push(check('walking left past the end of the floor, he falls', Boolean(falling) && falling.stickMan.feet.x < level.floor[0].from.x, falling ? describe(falling) : 'never fell'));
  const restarted = await waitFor('the level to start again', { read: () => stateOf(page), until: (state) => state.stickMan.feet.y <= level.start.y && state.stickMan.feet.x > level.floor[0].from.x, timeoutMs: 8000 }).catch(() => undefined);
  results.push(check('and the level starts again: he is back on the floor near the start, the flag not reached', Boolean(restarted) && restarted.stickMan.feet.x <= level.start.x && restarted.stickMan.feet.x > level.start.x - 1 && restarted.flag.reached === false && restarted.level.id === 1, restarted ? describe(restarted) : 'never restarted'));
  // The restart forgets which way he was walking; the key is still down, so the next frame tells the sim again.
  const walkingAgain = await waitFor('him to walk left again', { read: () => stateOf(page), until: (state) => state.stickMan.action === 'walking' && state.stickMan.facing === -1 && state.stickMan.feet.x < level.start.x, timeoutMs: 1000 }).catch(() => undefined);
  await page.keyboard.up('ArrowLeft');
  results.push(check('the left arrow, still held, walks him again after the restart', Boolean(walkingAgain), walkingAgain ? describe(walkingAgain) : 'he stood still'));

  report.atStart = atStart;
  report.walkSpeed = speed;
  report.jump = { highest: jump.highest, end: jump.end.stickMan };
  report.stoppedShort = stopped2;
  report.finished = finished;
  await page.close();

  // ---- The recording: walk, jump, flag ----
  const videoFolder = path.join(PROOF, 'video');
  rmSync(videoFolder, { recursive: true, force: true });
  mkdirSync(videoFolder, { recursive: true });
  const filming = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, recordVideo: { dir: videoFolder, size: VIEWPORT } });
  const film = await filming.newPage();
  film.on('pageerror', (error) => pageErrors.push(String(error)));
  film.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await openGame(film);
  await film.waitForTimeout(600);
  await film.keyboard.down('ArrowRight');
  await film.waitForTimeout(1200);
  await film.keyboard.press('Space');
  await film.waitForTimeout(1300);
  await film.keyboard.press('ArrowUp');
  const filmed = await waitFor('the flag to go up in the recording', { read: () => stateOf(film), until: (state) => state.flag.raised === 1, timeoutMs: 15000 }).catch(() => undefined);
  await film.waitForTimeout(1200);
  await film.keyboard.up('ArrowRight');
  const video = film.video();
  await filming.close();
  renameSync(await video.path(), path.join(PROOF, '07-walk-jump-flag.webm'));
  rmSync(videoFolder, { recursive: true, force: true });
  results.push(check('recorded the walk, two jumps and the flag', Boolean(filmed), '07-walk-jump-flag.webm'));
  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('01-walks-to-the-flag.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

async function openGame(page) {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10 && window.__game.camera(), null, { timeout: 15000 });
}

/** The sim and the camera as the page has them right now. */
function stateOf(page) {
  return page.evaluate(() => {
    const api = window.__game;
    return { tick: api.sim.tick, dt: api.sim.dt, level: api.level, defs: api.defs, stickMan: api.stickMan(), flag: api.flag(), camera: api.camera(), pixelsPerMetre: api.pixelsPerMetre, stickManHeight: api.stickManHeight };
  });
}

/** Reads every frame from now until he has left the floor and come back to it. With `shotName`, takes a screenshot on the way up. */
async function watchUntilLanded(page, shotName) {
  const seen = { left: false, landed: false, shot: false, highest: 0, highestOnScreen: Infinity, cameraHeights: [], end: undefined };
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const state = await stateOf(page);
    const height = state.level.start.y - state.stickMan.feet.y;
    if (state.stickMan.action === 'jumping') {
      seen.left = true;
      seen.highest = Math.max(seen.highest, height);
      seen.highestOnScreen = Math.min(seen.highestOnScreen, screenOf(state, state.stickMan.feet).y);
      seen.cameraHeights.push(state.camera.scrollY);
      if (shotName && !seen.shot && height > 0.3) {
        seen.shot = true;
        await shoot(page, shotName);
      }
    } else if (seen.left) {
      seen.landed = true;
      seen.end = state;
      return seen;
    }
  }
  seen.end = await stateOf(page);
  return seen;
}

/** Where a point of the world (metres) is on the screen, in pixels, with the camera as `state` has it. */
function screenOf({ camera, pixelsPerMetre }, point) {
  return {
    x: (point.x * pixelsPerMetre - camera.scrollX - camera.width / 2) * camera.zoom + camera.width / 2,
    y: (point.y * pixelsPerMetre - camera.scrollY - camera.height / 2) * camera.zoom + camera.height / 2,
  };
}

function onScreenHeight(state) {
  return state.stickManHeight * state.pixelsPerMetre * state.camera.zoom;
}

/** The screen rectangle his body is in: his height tall, a third of it wide, standing on his feet. */
function bodyBox(state) {
  const feet = screenOf(state, state.stickMan.feet);
  const height = onScreenHeight(state);
  return { x: feet.x - height / 6, y: feet.y - height, width: height / 3, height };
}

/** The screen rectangle the flag's stick is in. */
function stickBox(state) {
  const foot = screenOf(state, state.flag.at);
  const top = screenOf(state, { x: state.flag.at.x, y: state.flag.at.y - state.flag.height });
  // It stops short of the foot, so the floor line is not counted.
  return { x: foot.x - 6, y: top.y, width: 12, height: foot.y - top.y - 8 };
}

/**
 * The screen rectangle to the right of the stick where the cloth is when the flag is `raised` (0 or 1):
 * the top fifth of the stick when up, the fifth below the middle when down. The two do not overlap.
 */
function clothBox(state, raised) {
  const stick = stickBox(state);
  const top = raised === 1 ? stick.y + stick.height * 0.05 : stick.y + stick.height * 0.5;
  return { x: stick.x + stick.width, y: top, width: stick.height * 0.12, height: stick.height * 0.1 };
}

async function shoot(page, name) {
  return page.screenshot({ path: path.join(PROOF, name) });
}

/** How many pixels of `box` in the screenshot `png` are graphite: much darker than the paper. */
function darkPixels(page, png, box) {
  return page.evaluate(
    async ({ base64, box }) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height));
      let dark = 0;
      for (let index = 0; index < data.length; index += 4) if (data[index] + data[index + 1] + data[index + 2] < 3 * 130) dark += 1;
      return dark;
    },
    { base64: png.toString('base64'), box },
  );
}

function near(value, expected, tolerance = 1e-6) {
  return Math.abs(value - expected) <= tolerance;
}

function between(value, low, high) {
  return value > low && value < high;
}

function describe({ stickMan }) {
  return `${stickMan.action} at x ${stickMan.feet.x.toFixed(2)}, y ${stickMan.feet.y.toFixed(2)}, facing ${stickMan.facing}`;
}
