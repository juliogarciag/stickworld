/* global window */
/**
 * Before: the look test's stick man as `main` drew him (commit d47ed3a), walking
 * in the client-only demo this ticket deletes. Run once, before the client was
 * changed, so the "after" screenshots have something to be compared with. It
 * cannot run again on this branch: `walkDemo()` is gone.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { PROOF, check, lastLinesOf, start, summarize, waitFor, waitForPort } from './lib.mjs';

const PORT = 5922;
const VIEWPORT = { width: 960, height: 540 };
const results = [];

const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
let browser;
try {
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && window.__game.walkDemo && window.__game.walkDemo(), null, { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__game.walkDemo().setPaused(true));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(PROOF, '00-before-walking.png') });
  results.push(check('screenshot of the look test walk taken', true));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}
process.exit(summarize(results) ? 0 : 1);
