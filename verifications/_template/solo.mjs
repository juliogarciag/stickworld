/* global window */
/**
 * Solo template: starts `PORT=<n> pnpm dev`, opens the page in Chromium, reads
 * the sim through `window.__game`, and writes a screenshot and a JSON report
 * into ./proof.
 *
 * The checks below only show the moves (read state, act, compare). Replace
 * them with what your ticket promises, from the point of view of the player,
 * and derive every expected number from the debug API (level, defs, camera,
 * pixelsPerMetre) instead of typing it into the script. To press keys the way
 * a person does: `await page.keyboard.down('ArrowRight')`, then read again.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import {
  PROOF,
  check,
  getLastLines,
  start,
  summarize,
  waitFor,
  waitForPort,
  writeProof,
} from './lib.mjs';

/**
 * A port no other session uses, and not the one of the dev server you leave running for the human.
 */
const PORT = 5901;
/** CSS pixels; the page opens at a pixel ratio of 1 so screen, device and CSS pixels agree. */
const VIEWPORT = { width: 960, height: 540 };
const results = [];
const report = {};
const pageErrors = [];

const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
let browser;
try {
  // The ready line proves the port is this run's server, not something that was already listening
  // there.
  const ready =
    (await waitForPort(PORT)) &&
    (await waitFor("the dev server's ready line", {
      read: () => devServer.output.includes(`localhost:${PORT}/`),
      until: Boolean,
    }).catch(() => false));
  results.push(
    check(
      'dev server up, started by this run',
      ready,
      ready ? undefined : getLastLines(devServer.output),
    ),
  );
  if (!ready) {
    throw new Error('nothing to open');
  }

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, {
    timeout: 15000,
  });

  // Read: the sim as the page has it.
  const first = await readStateOf(page);
  results.push(
    check(
      'the sim is running on a level',
      first.level !== undefined && first.tick > 10,
      `level ${first.level}, tick ${first.tick}`,
    ),
  );

  // Act, then read again: the sim moves with real time, about one tick per dt.
  await page.waitForTimeout(1000);
  const second = await readStateOf(page);
  const ticksPerSecond = (second.tick - first.tick) / ((second.at - first.at) / 1000);
  results.push(
    check(
      'the sim advances with real time',
      Math.abs(ticksPerSecond - 1 / first.dt) < 0.2 / first.dt,
      `${ticksPerSecond.toFixed(1)} ticks per second, dt ${first.dt.toFixed(4)}`,
    ),
  );

  await page.evaluate((level) => window.__game.loadLevel(level), first.level);
  const restarted = await readStateOf(page);
  results.push(
    check(
      'loadLevel plays the level again from its start',
      restarted.tick < 10 && restarted.level === first.level,
      `tick ${restarted.tick}`,
    ),
  );

  await page.screenshot({ path: path.join(PROOF, 'solo.png') });
  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
  report.first = first;
  report.second = second;
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('solo.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** The tick, the tick length and the level as the sim has them, with the page's clock. */
function readStateOf(page) {
  return page.evaluate(() => {
    const api = window.__game;
    return {
      at: window.performance.now(),
      tick: api.sim.tick,
      dt: api.sim.dt,
      level: api.level.id,
      hash: api.hash(),
    };
  });
}
