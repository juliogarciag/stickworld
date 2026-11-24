/* global window */
/**
 * Plays the three levels in order from a fresh load, with real key presses, the way a new player would,
 * and takes a screenshot at every moment the review talks about. Nothing is asserted: this is a review,
 * and the proof is what the captures show.
 *
 * Usage: node playthrough.mjs <wide|narrow|portrait> [url]
 * It plays against a dev server that is already running without VITE_LEVEL (default http://localhost:5215/).
 * Sim state is read through window.__game only to time the key presses (when to jump, when the level changed)
 * and to write down, beside each capture, what the sim had at that moment.
 *
 * The page's clock is held and moved a frame at a time, so a screenshot can be taken at any moment of a flight
 * that lasts a second; the game runs exactly as it does in real time, only the waiting between frames is gone.
 * At the wide window four short stretches are also filmed, a frame at a time, and put together at their real
 * speed as GIFs (ffmpeg has to be installed for that): Chromium's own screen recording ran the game at about
 * half speed on the machine this was made on, which is no proof of how long anything takes.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WINDOWS = {
  wide: { width: 1600, height: 900 },
  narrow: { width: 820, height: 760 },
  portrait: { width: 480, height: 860 },
};

const name = process.argv[2] ?? 'wide';
const url = process.argv[3] ?? 'http://localhost:5215/';
const viewport = WINDOWS[name];
if (!viewport) throw new Error(`unknown window: ${name}`);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROOF = path.join(HERE, 'proof', name);
mkdirSync(PROOF, { recursive: true });

/** One frame of a 60 Hz screen, in milliseconds. */
const FRAME = 1000 / 60;

const log = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));
page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));

let shots = 0;
/** The stretch being filmed, or null. */
let filming = null;

try {
  await page.clock.install();
  await page.goto(url);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 2, null, { timeout: 15000 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));

  // ---- Level 1: the first seconds, the keys a new player tries, the walk, the flag ----
  await shot('l1-first-frame');
  await wait(6000);
  await shot('l1-after-six-idle-seconds');
  for (const key of ['j', 'k', '1', 'Enter']) await pressAndLetTheGameSee(key);
  await wait(300);
  await shot('l1-after-trying-j-k-1-enter');
  await page.keyboard.press('Space');
  await wait(180);
  await shot('l1-a-jump');
  await wait(600);
  await page.keyboard.down('ArrowRight');
  await wait(1200);
  await shot('l1-walking');
  await until(() => window.__game.stickMan().feet.x > 9.5);
  film('level-1-ends-level-2-starts');
  await until(() => window.__game.flag().reached);
  await shot('l1-flag-reached');
  await wait(1000);
  await shot('l1-flag-up-one-second-in');
  await wait(850);
  await shot('l1-last-moment-of-level-1');
  await until(() => window.__game.level.id === 2);
  await shot('l2-first-frame-right-still-held');
  await page.keyboard.up('ArrowRight');
  await wait(600);
  await wait(900);
  cut();
  await shot('l2-where-he-is-after-the-key-was-let-go');

  // ---- Level 2: walk into the gap, then jump it ----
  await page.keyboard.down('ArrowRight');
  await until(() => window.__game.stickMan().feet.x > 4.8);
  film('dying-in-the-gap');
  await until(() => window.__game.stickMan().feet.y > 0.05);
  await shot('l2-walked-off-the-edge');
  await until(() => window.__game.stickMan().feet.y > 1.5);
  await shot('l2-falling-into-the-gap');
  await until(() => window.__game.stickMan().feet.y > 5.5);
  await shot('l2-last-moment-before-the-restart');
  await until(() => window.__game.stickMan().feet.x < 3);
  await shot('l2-first-frame-after-dying');
  await wait(1000);
  cut();
  await until(() => window.__game.stickMan().feet.x > 5.82);
  await page.keyboard.press('Space');
  await wait(250);
  await shot('l2-jumping-the-gap');
  await until(() => window.__game.flag().reached);
  await shot('l2-flag-reached');
  await wait(1000);
  await shot('l2-flag-up-paper-in-slot');
  await wait(850);
  await shot('l2-last-moment-of-level-2');
  await until(() => window.__game.level.id === 3);
  await page.keyboard.up('ArrowRight');
  await shot('l3-first-frame');
  await wait(1500);
  await shot('l3-start');
  await page.keyboard.press('j');
  await wait(300);
  await shot('l3-j-with-the-paper-before-the-letter');
  await page.keyboard.press('1');
  await wait(300);
  await shot('l3-after-pressing-1');
  await page.keyboard.press('1');
  await wait(300);
  await shot('l3-after-pressing-1-again');

  // ---- Level 3: the letter, the fold, carrying ----
  await page.keyboard.down('ArrowRight');
  await until(() => window.__game.interaction() === 'read');
  await page.keyboard.up('ArrowRight');
  await wait(400);
  await shot('l3-at-the-letter');
  await page.keyboard.press('k');
  await wait(600);
  await shot('l3-reading-the-letter');
  await page.keyboard.press('k');
  await wait(500);
  await shot('l3-letter-put-away');
  await page.keyboard.press('j');
  await wait(100);
  await shot('l3-a-moment-after-folding');
  await wait(500);
  await shot('l3-folded');
  await page.keyboard.press('j');
  await wait(100);
  await shot('l3-a-moment-after-setting-down');
  await wait(600);
  await shot('l3-airplane-set-down-far-from-the-edge');
  await page.keyboard.press('k');
  await wait(100);
  await shot('l3-a-moment-after-lifting');
  await wait(600);
  await shot('l3-airplane-lifted');
  await page.keyboard.down('ArrowRight');
  await wait(900);
  await shot('l3-carrying');
  await page.keyboard.press('Space');
  await wait(180);
  await shot('l3-jumping-while-carrying');
  await until(() => window.__game.stickMan().feet.x > 9.25);
  await page.keyboard.up('ArrowRight');
  await wait(300);
  await shot('l3-at-the-edge-carrying');
  await page.keyboard.press('k');
  await wait(700);
  await shot('l3-airplane-on-the-edge');

  film('first-flight-hands-off');
  await wait(800);
  // ---- Flight 1: board and do nothing ----
  await page.keyboard.press('k');
  await wait(100);
  await shot('l3-flight1-a-tenth-of-a-second-in');
  await wait(400);
  await shot('l3-flight1-half-a-second-in');
  await wait(400);
  await shot('l3-flight1-nine-tenths-in');
  await until(() => window.__game.stickMan().feet.y > 2.5 || window.__game.stickMan().feet.x < 3, 20000);
  await shot('l3-flight1-below-the-far-side');
  await until(() => window.__game.stickMan().feet.x < 3, 20000);
  await shot('l3-first-frame-after-losing-the-airplane');
  await until(() => window.__game.letter() !== undefined, 20000);
  await wait(1200);
  await shot('l3-new-letter-falling');
  await until(() => window.__game.letter().height === 0, 20000);
  await wait(300);
  await shot('l3-new-letter-landed');
  cut();

  // ---- Flight 2: hold the climb key and never let go ----
  await foldAtTheLetterAndBoardAtTheEdge('flight2');
  await page.keyboard.down('ArrowUp');
  await wait(600);
  await shot('l3-flight2-climbing');
  await until(() => window.__game.airplane()?.state === 'falling' || window.__game.stickMan().feet.x < 3, 20000);
  await shot('l3-flight2-stalled');
  await wait(450);
  await shot('l3-flight2-falling-after-the-stall');
  await untilTheFlightIsOver();
  await page.keyboard.up('ArrowUp');
  await wait(300);
  await shot('l3-flight2-where-holding-climb-ends');
  await backToTheStartOfLevel3('after-flight2');

  // ---- Flight 3: jump out over the gap ----
  await foldAtTheLetterAndBoardAtTheEdge('flight3');
  await page.keyboard.down('ArrowUp');
  await wait(420);
  await page.keyboard.up('ArrowUp');
  await wait(300);
  await page.keyboard.press('Space');
  await wait(250);
  await shot('l3-flight3-jumped-out');
  await untilTheFlightIsOver();
  await backToTheStartOfLevel3('after-flight3');

  // ---- Flight 4: a climb of the right length ----
  await foldAtTheLetterAndBoardAtTheEdge('flight4');
  await page.keyboard.down('ArrowUp');
  await wait(450);
  await page.keyboard.up('ArrowUp');
  await shot('l3-flight4-let-go-after-the-climb');
  await wait(600);
  await shot('l3-flight4-over-the-gap');
  await until(() => window.__game.airplane()?.at.x > 19 || window.__game.stickMan().action !== 'seated', 20000);
  await shot('l3-flight4-coming-in');
  await until(() => window.__game.airplane()?.state === 'landing' || window.__game.stickMan().action !== 'seated', 20000);
  await shot('l3-flight4-landing');
  await until(() => window.__game.stickMan().action !== 'seated', 20000);
  await wait(400);
  await shot('l3-flight4-stood-up-on-the-far-side');
  const side = await page.evaluate(() => (window.__game.stickMan().feet.x < window.__game.flag().at.x ? 'ArrowRight' : 'ArrowLeft'));
  await page.keyboard.down(side);
  await until(() => window.__game.flag().reached, 20000);
  await page.keyboard.up(side);
  await shot('l3-last-flag-reached');
  await wait(700);
  await shot('end-the-end-written');
  await wait(2500);
  cut();
  await wait(7500);
  await shot('end-ten-seconds-later');

  // ---- After the end: can he still do things? ----
  for (const key of ['j', 'k', 'Enter', 'Space']) await pressAndLetTheGameSee(key);
  await page.keyboard.down('ArrowRight');
  await wait(3000);
  await shot('end-after-trying-every-key');
  await page.keyboard.up('ArrowRight');
} catch (error) {
  note(`STOPPED: ${error.message}`);
  await shot('stopped-here').catch(() => {});
} finally {
  note(`page errors: ${pageErrors.length === 0 ? 'none' : pageErrors.join(' | ')}`);
  writeFileSync(path.join(PROOF, 'playthrough.txt'), log.join('\n') + '\n');
  await browser.close();
}

// ---- Helpers ----

/** From the start of level 3 with nothing in his hands but what the letter gives: read, fold, carry to the edge, put down, board. Leaves him just launched. */
async function foldAtTheLetterAndBoardAtTheEdge(flight) {
  await page.keyboard.down('ArrowRight');
  await until(() => window.__game.interaction() === 'read', 20000);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('k');
  await wait(300);
  await page.keyboard.press('k');
  await wait(200);
  await page.keyboard.press('j');
  await wait(200);
  await page.keyboard.down('ArrowRight');
  await until(() => window.__game.stickMan().feet.x > 9.25, 20000);
  await page.keyboard.up('ArrowRight');
  await wait(200);
  await page.keyboard.press('j');
  await wait(600);
  await shot(`l3-${flight}-set-down-at-the-edge`);
  if (flight === 'flight4') film('the-flight-that-crosses-and-the-end');
  if (flight === 'flight4') await wait(800);
  await page.keyboard.press('k');
  await wait(250);
}

/** Lets the game run until he is on his feet on a floor line again: back at the start after being lost, or stood up where the airplane came down. */
function untilTheFlightIsOver() {
  return until(() => {
    const { feet, action } = window.__game.stickMan();
    return action !== 'seated' && action !== 'jumping' && feet.y === 0;
  }, 30000);
}

/** If a flight left him on the far side, walks him back into the gap, as a player who wants another go would have to. Then waits for the new letter to land. */
async function backToTheStartOfLevel3(moment) {
  const farSide = await page.evaluate(() => window.__game.stickMan().feet.x > 12);
  if (farSide) {
    await page.keyboard.down('ArrowLeft');
    await until(() => window.__game.stickMan().feet.y > 1.5, 30000);
    await shot(`l3-${moment}-walking-back-into-the-gap`);
    await until(() => window.__game.stickMan().feet.x < 3, 30000);
    await page.keyboard.up('ArrowLeft');
  }
  await until(() => window.__game.letter()?.height === 0, 30000);
}

/** Presses `key` and lets a few frames pass before the next one: keys pressed while the clock stands still did not all reach the game. */
async function pressAndLetTheGameSee(key) {
  await page.keyboard.press(key);
  await wait(100);
}

/** Lets `milliseconds` of game time pass. */
async function wait(milliseconds) {
  if (!filming) return page.clock.runFor(milliseconds);
  for (let passed = 0; passed < milliseconds; passed += FRAME) await oneFrame();
}

/** Lets the game run until `read` holds in the page. */
async function until(read, timeoutMs = 15000) {
  for (let passed = 0; passed < timeoutMs; passed += FRAME) {
    if (await page.evaluate(read)) return;
    await oneFrame();
  }
  throw new Error(`timed out waiting for: ${String(read)}`);
}

/** Moves the game on by one frame, and keeps every second one while a stretch is being filmed. */
async function oneFrame() {
  await page.clock.runFor(FRAME);
  if (!filming) return;
  filming.frames += 1;
  if (filming.frames % 2 === 0) await page.screenshot({ path: path.join(filming.folder, `${String(filming.frames / 2).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 90 });
}

/** Starts filming what follows, at the wide window only. */
function film(stretch) {
  if (name !== 'wide') return;
  filming = { stretch, folder: path.join(PROOF, `frames-${stretch}`), frames: 0 };
  mkdirSync(filming.folder, { recursive: true });
}

/** Stops filming and puts the frames together as a small GIF that plays at the game's real speed: every second frame is kept, at 30 a second, and ffmpeg thins that to 12. */
function cut() {
  if (!filming) return;
  const { stretch, folder, frames } = filming;
  filming = null;
  const gif = `clip-${stretch}.gif`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '30', '-i', path.join(folder, '%04d.jpg'), '-vf', 'fps=12,scale=640:-1:flags=lanczos,hqdn3d=8:8:12:12,split[a][b];[a]palettegen=max_colors=16[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', path.join(PROOF, gif)]);
  rmSync(folder, { recursive: true });
  note(`${gif}  ${(frames / 60).toFixed(1)} seconds of play`);
}

/** A screenshot, numbered in the order taken, with a line in the log saying what the sim had at that moment. */
async function shot(moment) {
  shots += 1;
  const file = `${String(shots).padStart(2, '0')}-${moment}.jpg`;
  const state = await page.evaluate(() => {
    const api = window.__game;
    const stickMan = api.stickMan();
    const airplane = api.airplane();
    const letter = api.letter();
    return {
      level: api.level.id,
      tick: api.sim.tick,
      x: Number(stickMan.feet.x.toFixed(2)),
      y: Number(stickMan.feet.y.toFixed(2)),
      action: stickMan.action,
      slots: api.itemSlots().map((slot) => `${slot.itemDefId}${slot.selected ? '*' : ''}`),
      airplane: airplane ? `${airplane.state} at ${airplane.at.x.toFixed(2)},${airplane.at.y.toFixed(2)} speed ${airplane.speed.toFixed(1)} pitch ${airplane.pitch.toFixed(2)}` : null,
      letter: letter ? `${letter.beingRead ? 'being read' : 'lying'} at ${letter.at.x},${letter.height.toFixed(1)} up` : null,
      J: api.itemUse(),
      K: api.interaction(),
    };
  });
  await page.screenshot({ path: path.join(PROOF, file), type: 'jpeg', quality: 78 });
  note(`${file}  ${JSON.stringify(state)}`);
}

function note(line) {
  log.push(line);
  console.log(line);
}
