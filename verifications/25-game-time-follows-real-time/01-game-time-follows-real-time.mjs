/* global window, document */
/**
 * Ticket 25: game time follows real time from the first frame.
 *
 * Opens the real app (`PORT=<n> pnpm dev`) once for each way a frame gets
 * long: the CPU slowed 4x and 6x (CDP), and frames delivered at 30 Hz. In
 * each it holds the right arrow and measures, from the sim's own state, how
 * much game time and how many metres 120 frames gave him against the real
 * time they took:
 *
 *   - the first 120 frames after the game starts,
 *   - the 120 frames after the tab was hidden for a while and shown again,
 *   - 120 frames while the window is not focused.
 *
 * Every one must be full speed. Real time is all of every frame up to the
 * loop's one cap (`window.__game.maxFrameSeconds`): what a frame took beyond
 * it, such as the frame the paper is made in, is meant to be dropped. A run with the CPU as it is, at 60 Hz, is
 * there to show the measurement itself reads full speed where nothing is
 * slow. `PROOF_NAME=before` names the proof of a run on the code as it was.
 *
 * Headless Chromium never really hides a page, so the page is shown what a
 * hidden tab is shown: no frames, `document.hidden`, and `visibilitychange`
 * (`framesAsTheScriptSays` below). 30 Hz is every other frame of the same.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { PROOF, check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

const PORT = 5925;
const PROOF_NAME = process.env.PROOF_NAME ?? 'after';
const VIEWPORT = { width: 960, height: 540 };
/** How long Phaser's cap on a frame's time lasted after a start, a show or a focus: the frames each measurement covers. */
const FRAMES_MEASURED = 120;
/** Full speed, within what one tick at either end of 120 frames can add or take. */
const FULL_SPEED = { atLeast: 0.97, atMost: 1.03 };
const SECONDS_HIDDEN = 2;
const WAYS_A_FRAME_GETS_LONG = [
  { name: 'cpu-1x-60hz', cpuSlowedBy: 1, oneFrameIn: 1, mustBeFullSpeed: true },
  { name: 'cpu-4x', cpuSlowedBy: 4, oneFrameIn: 1, mustBeFullSpeed: true },
  { name: 'cpu-6x', cpuSlowedBy: 6, oneFrameIn: 1, mustBeFullSpeed: true },
  { name: 'frames-at-30hz', cpuSlowedBy: 1, oneFrameIn: 2, mustBeFullSpeed: true },
];

const results = [];
const report = { proofName: PROOF_NAME, framesMeasured: FRAMES_MEASURED, measurements: [] };
const pageErrors = [];

const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT), VITE_LEVEL: '1' } });
let browser;
try {
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');

  // The full Chromium in its new headless mode draws with the machine's GPU; Playwright's default headless shell draws in
  // software, where every frame is long whatever the CPU is slowed by.
  browser = await chromium.launch({ channel: 'chromium' });
  for (const way of WAYS_A_FRAME_GETS_LONG) {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('console', (message) => message.type() === 'error' && !message.text().startsWith('Failed to load resource') && pageErrors.push(message.text()));
    // A response that failed is named here by its address; the browser asks for a favicon the game does not have.
    page.on('response', (response) => response.status() >= 400 && !response.url().endsWith('/favicon.ico') && pageErrors.push(`${response.status()} ${response.url()}`));
    await page.addInitScript(framesAsTheScriptSays, { oneFrameIn: way.oneFrameIn });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: way.cpuSlowedBy });
    await page.goto(`http://localhost:${PORT}/`);

    // 1. From the first frame.
    await page.waitForFunction(() => window.__game && window.__game.game.loop.frame >= 1, null, { timeout: 90000, polling: 'raf' });
    await page.keyboard.down('ArrowRight');
    // The frame the paper is made in is seconds long here. What is written on the sheet over its first seconds, the
    // level's name, must still be there to see: the view's clocks take no more of a frame than the sim does.
    if (way.name === 'cpu-6x') await page.screenshot({ path: path.join(PROOF, `${PROOF_NAME}-cpu-6x-the-sheet-in-its-first-frames.png`) });
    record(way, 'the first 120 frames', await walkMeasuredOver(page, { fromFrame: 1 }));
    await page.keyboard.up('ArrowRight');

    // 2. After the tab was hidden and shown again.
    await backAtTheStartOfTheLevel(page);
    const hidden = await page.evaluate(async (secondsHidden) => {
      const tickOf = () => window.__game.sim.tick;
      const tickWhenHidden = tickOf();
      window.__frames.tabIs('hidden');
      await new Promise((resolve) => setTimeout(resolve, secondsHidden * 1000));
      const tickBeforeShown = tickOf();
      const frameWhenShown = window.__game.game.loop.frame;
      window.__frames.tabIs('visible');
      await new Promise((resolve) => window.__frames.afterNextFrame(resolve));
      return { tickWhenHidden, tickBeforeShown, tickAfterFirstFrameBack: tickOf(), frameWhenShown, dt: window.__game.sim.dt };
    }, SECONDS_HIDDEN);
    await page.keyboard.down('ArrowRight');
    record(way, 'the 120 frames after the tab is shown again', await walkMeasuredOver(page, { fromFrame: hidden.frameWhenShown + 1 }));
    await page.keyboard.up('ArrowRight');
    const ticksForTheTimeHidden = hidden.tickAfterFirstFrameBack - hidden.tickWhenHidden;
    results.push(check(`${way.name}: the ${SECONDS_HIDDEN} s the tab was hidden are not played on its return`, hidden.tickBeforeShown === hidden.tickWhenHidden && ticksForTheTimeHidden * hidden.dt < SECONDS_HIDDEN / 4, `${ticksForTheTimeHidden} ticks, ${(ticksForTheTimeHidden * hidden.dt).toFixed(3)} s of game time`));
    report.measurements.push({ way: way.name, when: 'hidden and shown', ...hidden });

    // 3. While the window is not focused.
    await backAtTheStartOfTheLevel(page);
    const frameWhenUnfocused = await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
      return window.__game.game.loop.frame;
    });
    await page.keyboard.down('ArrowRight');
    record(way, '120 frames while the window is not focused', await walkMeasuredOver(page, { fromFrame: frameWhenUnfocused + 1 }));
    await page.keyboard.up('ArrowRight');

    await page.close();
  }
  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

printTable(report.measurements.filter((measurement) => measurement.gameSecondsPerRealSecond !== undefined));
report.results = results;
writeProof(`${PROOF_NAME}.json`, report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** Notes one measurement and checks it is full speed, both as game time and as metres walked. */
function record(way, when, measured) {
  report.measurements.push({ way: way.name, when, ...measured });
  if (measured.levelChanged) {
    results.push(check(`${way.name}, ${when}: measured on one level`, false, 'the level changed while measuring'));
    return;
  }
  const isFullSpeed = (share) => share >= FULL_SPEED.atLeast && share <= FULL_SPEED.atMost;
  results.push(check(`${way.name}, ${when}: game time keeps up with real time`, isFullSpeed(measured.gameSecondsPerRealSecond), `${measured.gameSeconds.toFixed(3)} s of game time in ${measured.realSeconds.toFixed(3)} s: ${percent(measured.gameSecondsPerRealSecond)}`));
  results.push(
    check(
      `${way.name}, ${when}: he walks at full speed`,
      measured.metresWalked > 1 && isFullSpeed(measured.shareOfWalkSpeed),
      `${measured.metresWalked.toFixed(2)} m in ${measured.secondsWalking.toFixed(3)} s: ${measured.metresPerRealSecond.toFixed(2)} m/s of the sim's ${measured.walkSpeedInTheSim.toFixed(2)} m/s, ${percent(measured.shareOfWalkSpeed)}`,
    ),
  );
}

/**
 * What the 120 frames from Phaser's frame `fromFrame` gave the game, read from what the page noted after each frame:
 * game time (ticks of `dt`) against real time, and how far he walked against how long he was walking. His walk speed is
 * the sim's own, metres per second of game time, so nothing here is typed in from the tuning.
 */
async function walkMeasuredOver(page, { fromFrame }) {
  const toFrame = fromFrame + FRAMES_MEASURED;
  await page.waitForFunction((frame) => window.__game.game.loop.frame >= frame, toFrame, { timeout: 90000, polling: 'raf' });
  return page.evaluate(
    ({ fromFrame, toFrame }) => {
      const dt = window.__game.sim.dt;
      const maxFrameSeconds = window.__game.maxFrameSeconds;
      const notes = window.__frames.notes;
      const first = notes.find((note) => note.frame >= fromFrame);
      const last = notes.find((note) => note.frame >= toFrame);
      const during = notes.filter((note) => note.frame >= first.frame && note.frame <= last.frame);
      // Real time as the game is meant to take it: all of every frame, up to the loop's one cap.
      const realSecondsBetween = (from, to) => {
        let seconds = 0;
        for (let index = during.indexOf(from) + 1; index <= during.indexOf(to); index += 1) seconds += Math.min((during[index].at - during[index - 1].at) / 1000, maxFrameSeconds);
        return seconds;
      };
      const realSeconds = realSecondsBetween(first, last);
      const gameSeconds = (last.tick - first.tick) * dt;
      // Walking: from the last frame he had not moved yet to the last before the flag stopped him.
      const firstMoved = during.findIndex((note) => note.x > first.x);
      const walking = during.slice(Math.max(firstMoved - 1, 0)).filter((note) => !note.flagReached);
      const stepsOff = walking[0];
      const arrives = walking[walking.length - 1];
      const metresWalked = arrives.x - stepsOff.x;
      const secondsWalking = realSecondsBetween(stepsOff, arrives);
      const walkSpeedInTheSim = metresWalked / ((arrives.tick - stepsOff.tick) * dt);
      const metresPerRealSecond = metresWalked / secondsWalking;
      return {
        fromFrame: first.frame,
        toFrame: last.frame,
        realSeconds,
        gameSeconds,
        gameSecondsPerRealSecond: gameSeconds / realSeconds,
        longestFrameMs: Math.max(...during.slice(1).map((note, index) => note.at - during[index].at)),
        framesOverTheCap: during.slice(1).filter((note, index) => (note.at - during[index].at) / 1000 > maxFrameSeconds).length,
        maxFrameSeconds,
        metresWalked,
        secondsWalking,
        metresPerRealSecond,
        walkSpeedInTheSim,
        shareOfWalkSpeed: metresPerRealSecond / walkSpeedInTheSim,
        levelChanged: during.some((note) => note.level !== first.level || note.tick < first.tick),
      };
    },
    { fromFrame, toFrame },
  );
}

/** Level 1 again from its start, standing still: every measurement has the whole floor to the flag ahead of him. */
async function backAtTheStartOfTheLevel(page) {
  await page.evaluate(() => window.__game.loadLevel(1));
  await page.waitForFunction(() => window.__game.sim.tick > 5 && window.__game.stickMan().feet.x === window.__game.level.start.x, null, { timeout: 30000, polling: 'raf' });
}

function percent(share) {
  return `${(share * 100).toFixed(1)}% of full speed`;
}

function printTable(measurements) {
  console.log(`\n${PROOF_NAME}: game time and walking against real time, over ${FRAMES_MEASURED} frames`);
  console.log('frames long because | when | real s | game s | game time | walked m | walk speed | longest frame ms | frames over the cap');
  for (const measurement of measurements) {
    console.log([measurement.way, measurement.when, measurement.realSeconds.toFixed(3), measurement.gameSeconds.toFixed(3), `${(measurement.gameSecondsPerRealSecond * 100).toFixed(1)}%`, measurement.metresWalked.toFixed(2), `${(measurement.shareOfWalkSpeed * 100).toFixed(1)}%`, measurement.longestFrameMs.toFixed(1), measurement.framesOverTheCap].join(' | '));
  }
  console.log();
}

/**
 * Runs in the page before anything of the game's. Frames reach the page through here, so the script can give it one
 * frame in two (30 Hz) or none at all (a hidden tab), and after every frame the game was given it notes where the sim
 * is: Phaser's frame count, the frame's own time, the tick, where he stands, whether the flag stopped him.
 */
function framesAsTheScriptSays({ oneFrameIn }) {
  const browserFrame = window.requestAnimationFrame.bind(window);
  const waiting = new Map();
  const afterNextFrame = [];
  let lastId = 0;
  let framesOfTheBrowser = 0;
  let hidden = false;
  const notes = [];
  window.requestAnimationFrame = (callback) => {
    lastId += 1;
    waiting.set(lastId, callback);
    return lastId;
  };
  window.cancelAnimationFrame = (id) => {
    waiting.delete(id);
  };
  Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => (hidden ? 'hidden' : 'visible'), configurable: true });
  window.__frames = {
    notes,
    tabIs(state) {
      hidden = state === 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    },
    afterNextFrame(callback) {
      afterNextFrame.push(callback);
    },
  };
  const everyFrameOfTheBrowser = (time) => {
    framesOfTheBrowser += 1;
    if (!hidden && framesOfTheBrowser % oneFrameIn === 0) {
      const due = [...waiting.values()];
      waiting.clear();
      for (const callback of due) callback(time);
      const api = window.__game;
      if (api && api.game.loop) {
        const flag = api.flag();
        notes.push({ frame: api.game.loop.frame, at: time, tick: api.sim.tick, x: api.stickMan().feet.x, flagReached: Boolean(flag && flag.reached), level: api.level.id });
      }
      for (const callback of afterNextFrame.splice(0)) callback();
    }
    browserFrame(everyFrameOfTheBrowser);
  };
  browserFrame(everyFrameOfTheBrowser);
}
