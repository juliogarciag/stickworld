/* global window, document, Image */
/**
 * Ticket 23: a cue when the airplane is ready to board. Plays level 3 with the keys a person presses: reads the
 * letter, folds the airplane, sets it down, lifts it, carries it to the edge and puts it down there, then boards it.
 * At each step it reads what the sim says (`flyingHint()`, `interaction()`, `airplane()`) and counts the green pixels
 * of the HUD's prompts in a screenshot: none while the hint says to take the airplane to the edge, many the moment it
 * sits ready on the edge, none again once he has boarded it.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { PROOF, check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

/** A port no other session uses, and not the one of the dev server left running for the human (5223). */
const PORT = 5923;
/** CSS pixels; the page opens at a pixel ratio of 1 so screen, device and CSS pixels agree. */
const VIEWPORT = { width: 960, height: 540 };
/** Green pixels the "ready" words must at least leave in the prompts' corner: a handwritten line of words is far more. */
const LEAST_GREEN_OF_WORDS = 200;
const results = [];
const report = { steps: {} };
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
  await page.evaluate(() => window.__game.loadLevel(3));
  await page.waitForFunction(() => window.__game.level.id === 3 && window.__game.sim.tick > 5);
  // The level's name is written on the sheet for its first seconds; let it go before the screenshots.
  await page.waitForTimeout(3500);

  const edge = await page.evaluate(() => window.__game.level.floor[0].to.x);

  // Read the letter, put it away, fold the airplane.
  await holdRightUntil(page, () => window.__game.interaction() === 'read');
  await press(page, 'KeyK', () => window.__game.interaction() === 'putLetterAway');
  await press(page, 'KeyK', () => window.__game.itemUse() === 'craft');
  await press(page, 'KeyJ', () => window.__game.itemUse() === 'place');
  const folded = await stateOf(page);
  results.push(check('with the airplane folded, the hint says to take it to the edge', folded.flyingHint === 'takeToEdge', JSON.stringify(folded)));
  await shoot(page, '01-folded');

  // Set it down, lift it, carry it to where putting it down leaves it on the edge.
  await press(page, 'KeyJ', () => window.__game.airplane()?.state === 'resting');
  const set = await stateOf(page);
  const putDownAhead = Math.abs(set.airplane.at.x - set.feet.x);
  await press(page, 'KeyK', () => window.__game.airplane()?.state === 'carried');
  const target = edge - putDownAhead - set.airplane.length / 4;
  await holdRightUntil(page, (feetAt) => window.__game.stickMan().feet.x >= feetAt, target);
  await page.waitForTimeout(300);
  const carried = await stateOf(page);
  results.push(check('carried to the edge, still told to take it to the edge, and K puts it down', carried.flyingHint === 'takeToEdge' && carried.interaction === 'putDown', JSON.stringify(carried)));
  const beforeGreen = await shoot(page, '02-before-carried-to-the-edge');
  results.push(check('before: nothing green in the prompts', beforeGreen === 0, `${beforeGreen} green pixels`));

  // Put it down on the edge: the cue.
  await press(page, 'KeyK', () => window.__game.airplane()?.state === 'resting');
  const onTheEdge = await stateOf(page);
  results.push(check('put down, it sits on the edge and K boards it', onTheEdge.airplane.onAnEdge && onTheEdge.interaction === 'board', JSON.stringify(onTheEdge)));
  results.push(check('the hint is "ready" on the same read that it sits on the edge', onTheEdge.flyingHint === 'readyToBoard', `flyingHint ${onTheEdge.flyingHint}`));
  await page.waitForTimeout(200);
  const afterGreen = await shoot(page, '03-after-ready-on-the-edge');
  results.push(check('after: the ready words are written in green in the prompts', afterGreen >= LEAST_GREEN_OF_WORDS, `${afterGreen} green pixels`));

  // Board it with K.
  await press(page, 'KeyK', () => window.__game.stickMan().action === 'seated');
  const boarded = await stateOf(page);
  results.push(check('K boards it: he is seated and nothing is said about the edge any more', boarded.action === 'seated' && boarded.flyingHint === null, JSON.stringify(boarded)));
  await page.waitForTimeout(150);
  const boardedGreen = await shoot(page, '04-boarded');
  results.push(check('boarded: nothing green in the prompts', boardedGreen === 0, `${boardedGreen} green pixels`));

  Object.assign(report.steps, { edge, putDownAhead, target, folded, carried, onTheEdge, boarded, green: { before: beforeGreen, after: afterGreen, boarded: boardedGreen } });
  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('01-ready-cue-on-level-3.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** What the sim says about him, the airplane and the keys right now. */
function stateOf(page) {
  return page.evaluate(() => {
    const api = window.__game;
    const stickMan = api.stickMan();
    return { tick: api.sim.tick, feet: stickMan.feet, action: stickMan.action, airplane: api.airplane() ?? null, flyingHint: api.flyingHint(), interaction: api.interaction(), itemUse: api.itemUse() };
  });
}

/** Holds the right arrow until `until` (run in the page) is true, then lets go. */
async function holdRightUntil(page, until, argument) {
  await page.keyboard.down('ArrowRight');
  try {
    await page.waitForFunction(until, argument, { timeout: 15000, polling: 'raf' });
  } finally {
    await page.keyboard.up('ArrowRight');
  }
}

/** Presses `key` once, as a person does, and waits until `until` (run in the page) is true. */
async function press(page, key, until) {
  await page.keyboard.press(key);
  await page.waitForFunction(until, null, { timeout: 5000 });
}

/** Saves a screenshot as proof and returns how many clearly green pixels the bottom left quarter, where the prompts are, has. */
async function shoot(page, name) {
  const png = await page.screenshot({ path: path.join(PROOF, `${name}.png`) });
  return page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, image.height / 2, image.width / 2, image.height / 2);
    let green = 0;
    for (let index = 0; index < data.length; index += 4) if (data[index + 1] > data[index] + 30 && data[index + 1] > data[index + 2] + 30) green += 1;
    return green;
  }, `data:image/png;base64,${png.toString('base64')}`);
}
