/* global window, document, Image */
/**
 * Plays level 2 in the real app, with the keys a player uses: arrow keys to
 * walk, space to jump, 1 for item slot 1.
 *
 *   1. Level 1 is walked to its flag, and level 2 starts by itself.
 *   2. He walks into the gap, falls below the line, dies, and the level starts again.
 *   3. He jumps the gap and walks to the flag, which puts the paper in slot 1.
 *   4. The 1 key selects slot 1, and unselects it when pressed again.
 *
 * What the sim holds is read through `window.__game`; what the HUD shows is
 * measured in the screenshots, as how much pencil there is where the slot is
 * drawn. Where he must be and what he must hold come from the level's data
 * and the defs; the thresholds on time and on pencil are named below.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { renameSync } from 'node:fs';
import { PROOF, check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

/** Not the port of the dev server left running for the human (5203). */
const PORT = 5913;
/** CSS pixels; the page opens at a pixel ratio of 1 so screen, device and CSS pixels agree. */
const VIEWPORT = { width: 960, height: 540 };
/** "At once": the longest he may be gone between leaving the line and standing at the start again, in seconds. */
const LONGEST_DEATH_SECONDS = 2;
/** How much more pencil the slot's part of the page must hold with the paper in it, and with the second box around it. */
const PAPER_ADDS = 1.15;
const SECOND_BOX_ADDS = 1.3;
/** The least pencil an empty slot is: fewer pixels than this and no box was drawn. */
const LEAST_PENCIL_OF_A_BOX = 100;
const results = [];
const report = {};
const pageErrors = [];

const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
let browser;
let context;
let page;
try {
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');

  browser = await chromium.launch();
  context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, recordVideo: { dir: PROOF, size: VIEWPORT } });
  page = await context.newPage();
  // Counts pencil pixels in screenshots. In a context of its own, so it is not in the recording.
  const pixelCounter = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10 && window.__game.itemSlots().length > 0, null, { timeout: 15000 });
  await recordEveryFrame(page);

  // ---- 1. Level 1 leads to level 2 ----
  const levelAtStart = await page.evaluate(() => window.__game.level.id);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__game.flag()?.reached === true, null, { timeout: 15000, polling: 'raf' });
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.__game.level.id === 2, null, { timeout: 10000, polling: 'raf' });
  await page.waitForTimeout(300);
  const level2 = await stateOf(page);
  results.push(
    check(
      'reaching the flag of level 1 starts level 2 by itself, with him standing at its start',
      levelAtStart === 1 && level2.level.id === 2 && level2.stickMan.feet.x === level2.level.start.x && level2.stickMan.feet.y === level2.level.start.y,
      `level ${levelAtStart} -> ${level2.level.id}, feet at ${JSON.stringify(level2.stickMan.feet)}`,
    ),
  );

  const { floor } = level2.level;
  const gap = floor.length === 2 ? { from: floor[0].to.x, to: floor[1].from.x } : undefined;
  const floorY = floor[0].from.y;
  results.push(check('level 2 is two stretches of floor with a gap between them, and a flag past the gap', Boolean(gap) && gap.to > gap.from && level2.flag?.at.x > gap.to, `gap ${JSON.stringify(gap)}, flag at x ${level2.flag?.at.x}`));
  if (!gap) throw new Error('level 2 has no gap to play');

  const paper = level2.defs.find((def) => def.id === level2.level.flagGivesItem);
  const flagReach = level2.defs.find((def) => def.name === 'flag')?.reach ?? NaN;
  results.push(check("what level 2's flag gives is a def, the paper", paper?.name === 'paper', JSON.stringify(paper)));
  results.push(check('slot 1 is there, empty and not selected, when level 2 starts', level2.slots.length >= 1 && level2.slots[0].slot === 1 && level2.slots[0].itemDefId === null && level2.slots[0].selected === false, JSON.stringify(level2.slots[0])));
  const slotOnPage = aroundSlot(level2.slots[0].onPage);
  results.push(check('slot 1 is drawn inside the page', slotOnPage.x >= 0 && slotOnPage.y >= 0 && slotOnPage.x + slotOnPage.width < VIEWPORT.width && slotOnPage.y + slotOnPage.height < VIEWPORT.height, JSON.stringify(level2.slots[0].onPage)));
  await page.screenshot({ path: path.join(PROOF, '01-level-2-starts.png') });
  const pencilWhenEmpty = await pencilIn(page, pixelCounter, slotOnPage);
  results.push(check('the HUD draws slot 1: there is pencil where the HUD says its box is', pencilWhenEmpty > LEAST_PENCIL_OF_A_BOX, `${pencilWhenEmpty} pencil pixels`));

  // ---- 2. Walking into the gap: a death, and the level starts again ----
  await clearFrames(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    ({ gap, floorY }) => {
      const { feet } = window.__game.stickMan();
      return feet.x > gap.from && feet.y > floorY + 0.4;
    },
    { gap, floorY },
    { timeout: 15000, polling: 'raf' },
  );
  await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: path.join(PROOF, '02-falling-into-the-gap.png') });
  await page.waitForFunction((startX) => window.__game.stickMan().feet.x === startX && window.__game.stickMan().action === 'standing', level2.level.start.x, { timeout: 10000, polling: 'raf' });
  await page.waitForTimeout(300);
  const afterDeath = await stateOf(page);
  const death = await framesOf(page);
  const inTheGap = death.filter((frame) => frame.x > gap.from && frame.x < gap.to);
  const firstBelow = death.find((frame) => frame.y > floorY);
  const firstBack = death.find((frame) => firstBelow && frame.at > firstBelow.at && frame.x === level2.level.start.x && frame.y === level2.level.start.y);
  const deepest = Math.max(...death.map((frame) => frame.y));
  results.push(check('walking into the gap, he falls below the line', inTheGap.some((frame) => frame.y > floorY) && death.every((frame) => frame.x < gap.to || frame.y > floorY), `deepest ${deepest.toFixed(2)} m below the line, ${inTheGap.length} frames in the gap`));
  const secondsToRestart = firstBelow && firstBack ? (firstBack.at - firstBelow.at) / 1000 : NaN;
  results.push(check('he dies and the level starts again at once: back at the start within two seconds of leaving the line', secondsToRestart < LONGEST_DEATH_SECONDS, `${secondsToRestart.toFixed(2)} s`));
  results.push(
    check(
      "the restart is the sim's own: same level, the same sim still counting ticks, flag not reached",
      afterDeath.level.id === 2 && afterDeath.tick > level2.tick && death.every((frame, index) => index === 0 || frame.tick >= death[index - 1].tick) && afterDeath.flag.reached === false,
      `level ${afterDeath.level.id}, tick ${level2.tick} -> ${afterDeath.tick}`,
    ),
  );
  results.push(check('slot 1 is still empty after the death', afterDeath.slots[0].itemDefId === null, JSON.stringify(afterDeath.slots[0])));
  await page.screenshot({ path: path.join(PROOF, '03-level-started-again.png') });

  // ---- 3. The jump, the flag and the paper ----
  await clearFrames(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((x) => window.__game.stickMan().feet.x >= x, gap.from - 0.25 * (gap.to - gap.from), { timeout: 15000, polling: 'raf' });
  await page.keyboard.press('Space');
  await page.waitForFunction(({ gap }) => window.__game.stickMan().feet.x > (gap.from + gap.to) / 2 - 0.15, { gap }, { timeout: 5000, polling: 'raf' });
  await page.screenshot({ path: path.join(PROOF, '04-jumping-the-gap.png') });
  await page.waitForFunction((x) => window.__game.stickMan().feet.x > x + 0.5 && window.__game.stickMan().action === 'walking', gap.to, { timeout: 5000, polling: 'raf' });
  const landed = await stateOf(page);
  await page.waitForFunction(() => window.__game.flag().reached === true, null, { timeout: 15000, polling: 'raf' });
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(1000);
  const atTheFlag = await stateOf(page);
  const jump = await framesOf(page);
  const overTheGap = jump.filter((frame) => frame.x > gap.from && frame.x < gap.to);
  results.push(
    check(
      'jumping at the edge, he crosses the gap with his feet above the line the whole way',
      overTheGap.length > 3 && overTheGap.every((frame) => frame.y < floorY) && jump.every((frame) => frame.y <= floorY),
      `${overTheGap.length} frames over the gap, highest ${(floorY - Math.min(...jump.map((frame) => frame.y))).toFixed(2)} m, lowest over the gap ${(floorY - Math.max(...overTheGap.map((frame) => frame.y))).toFixed(2)} m above the line`,
    ),
  );
  results.push(check('he lands on the far side and walks on, with slot 1 still empty', landed.stickMan.feet.x > gap.to && landed.stickMan.feet.y === floorY && landed.slots[0].itemDefId === null, `feet ${JSON.stringify(landed.stickMan.feet)}, slot holds ${JSON.stringify(landed.slots[0].itemDefId)}`));
  // He stops within the flag's reach of the stick, give or take the half metre a late key release could carry him.
  results.push(check('he reaches the flag of level 2', atTheFlag.flag.reached && atTheFlag.level.id === 2 && Math.abs(atTheFlag.stickMan.feet.x - atTheFlag.flag.at.x) <= flagReach + 0.5, `feet x ${atTheFlag.stickMan.feet.x.toFixed(2)}, flag x ${atTheFlag.flag.at.x}`));
  results.push(check('reaching the flag puts the paper in slot 1', Boolean(paper) && atTheFlag.slots[0].itemDefId === paper.id && atTheFlag.slots[0].selected === false, JSON.stringify(atTheFlag.slots[0])));
  const paperFrame = jump.find((frame) => frame.item !== null);
  const reachedFrame = jump.find((frame) => frame.reached);
  results.push(check('the paper arrives the moment the flag is reached, not before', Boolean(paperFrame && reachedFrame) && paperFrame.tick - reachedFrame.tick <= 2 && jump.every((frame) => frame.reached || frame.item === null), `flag reached at tick ${reachedFrame?.tick}, paper held at tick ${paperFrame?.tick}`));
  await page.screenshot({ path: path.join(PROOF, '05-the-paper-in-slot-1.png') });
  const pencilWithPaper = await pencilIn(page, pixelCounter, slotOnPage);
  results.push(check('the HUD draws the paper in slot 1: more pencil there than when it was empty', pencilWithPaper > pencilWhenEmpty * PAPER_ADDS, `${pencilWhenEmpty} -> ${pencilWithPaper} pencil pixels`));

  // ---- 4. The 1 key ----
  await page.keyboard.press('1');
  await page.waitForFunction(() => window.__game.itemSlots()[0].selected === true, null, { timeout: 3000, polling: 'raf' }).catch(() => undefined);
  await page.waitForTimeout(300);
  const selected = await stateOf(page);
  results.push(check('pressing 1 selects slot 1, which still holds the paper', selected.slots[0].selected === true && selected.slots[0].itemDefId === paper?.id, JSON.stringify(selected.slots[0])));
  await page.screenshot({ path: path.join(PROOF, '06-slot-1-selected.png') });
  const pencilWhenSelected = await pencilIn(page, pixelCounter, slotOnPage);
  results.push(check('the HUD shows slot 1 selected: a second box around it', pencilWhenSelected > pencilWithPaper * SECOND_BOX_ADDS, `${pencilWithPaper} -> ${pencilWhenSelected} pencil pixels`));

  await page.waitForTimeout(500);
  const stillSelected = await stateOf(page);
  results.push(check('it stays selected until 1 is pressed again', stillSelected.slots[0].selected === true));

  await page.keyboard.press('1');
  await page.waitForFunction(() => window.__game.itemSlots()[0].selected === false, null, { timeout: 3000, polling: 'raf' }).catch(() => undefined);
  await page.waitForTimeout(300);
  const unselected = await stateOf(page);
  results.push(check('pressing 1 again unselects it, and the paper stays', unselected.slots[0].selected === false && unselected.slots[0].itemDefId === paper?.id, JSON.stringify(unselected.slots[0])));
  await page.screenshot({ path: path.join(PROOF, '07-slot-1-unselected.png') });
  const pencilWhenUnselected = await pencilIn(page, pixelCounter, slotOnPage);
  // The pencil boils, so the same drawing is not the same count twice: nearer to what it was before than to selected is the test.
  results.push(check('the HUD takes the second box away', pencilWhenUnselected - pencilWithPaper < (pencilWhenSelected - pencilWithPaper) / 4, `${pencilWhenUnselected} pencil pixels: ${pencilWithPaper} before it was selected, ${pencilWhenSelected} while it was`));

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
  // The defs are the same in every state: the report keeps the paper's and leaves the rest out.
  const withoutDefs = (state) => ({ ...state, defs: undefined });
  Object.assign(report, {
    gap,
    paper,
    level2Start: withoutDefs(level2),
    afterDeath: withoutDefs(afterDeath),
    landed: withoutDefs(landed),
    atTheFlag: withoutDefs(atTheFlag),
    selected: withoutDefs(selected),
    unselected: withoutDefs(unselected),
    pencilPixelsAroundSlot1: { empty: pencilWhenEmpty, withPaper: pencilWithPaper, selected: pencilWhenSelected, unselected: pencilWhenUnselected },
    framesWatched: { death: death.length, jump: jump.length },
  });
} catch (error) {
  results.push(check(`run completed (${String(error.message).split('\n')[0]})`, false));
} finally {
  const video = page?.video();
  await context?.close();
  if (video) renameSync(await video.path(), path.join(PROOF, '08-death-jump-paper-and-slot.webm'));
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('01-level-2.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** The sim as the page has it: level, stick man, flag, item slots. */
function stateOf(page) {
  return page.evaluate(() => {
    const api = window.__game;
    return { tick: api.sim.tick, level: api.level, defs: api.defs, stickMan: api.stickMan(), flag: api.flag(), slots: api.itemSlots() };
  });
}

/** Starts writing down, on every frame the page draws, where he is and what slot 1 holds. */
function recordEveryFrame(page) {
  return page.evaluate(() => {
    window.__frames = [];
    const record = () => {
      const api = window.__game;
      const { feet, action } = api.stickMan();
      window.__frames.push({ at: window.performance.now(), tick: api.sim.tick, level: api.level.id, x: feet.x, y: feet.y, action, reached: api.flag()?.reached ?? false, item: api.itemSlots()[0]?.itemDefId ?? null });
      window.requestAnimationFrame(record);
    };
    window.requestAnimationFrame(record);
  });
}

function clearFrames(page) {
  return page.evaluate(() => void (window.__frames.length = 0));
}

function framesOf(page) {
  return page.evaluate(() => window.__frames.slice());
}

/** The part of the page slot 1 is drawn in, with room for the box around a selected slot and the number under it. */
function aroundSlot({ x, y, width, height }) {
  const room = 0.45 * width;
  return { x: Math.max(0, x - room), y: Math.max(0, y - room), width: width + 2 * room, height: height + 2 * room };
}

/**
 * How many pixels of `clip` are pencil rather than paper on `page` now: the
 * middle count of five screenshots a boil apart, because the pencil is redrawn
 * a little differently several times a second and one count of the same
 * drawing can differ from the next by a tenth.
 */
async function pencilIn(page, counter, clip) {
  const counts = [];
  for (let shot = 0; shot < 5; shot += 1) {
    counts.push(await pencilInOneScreenshot(page, counter, clip));
    await page.waitForTimeout(140);
  }
  return counts.sort((left, right) => left - right)[2];
}

/** Counted in a second page, on a plain 2d canvas. */
async function pencilInOneScreenshot(page, counter, clip) {
  const png = await page.screenshot({ clip });
  return counter.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let pencil = 0;
    // Paper is light (about 240 of 255); graphite is dark (about 60).
    for (let index = 0; index < data.length; index += 4) if ((data[index] + data[index + 1] + data[index + 2]) / 3 < 150) pencil += 1;
    return pencil;
  }, `data:image/png;base64,${png.toString('base64')}`);
}
