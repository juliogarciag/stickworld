/* global window */
/**
 * The look before this ticket: one screenshot of the game as main had it
 * (flat paper, nothing drawn). Run once, before the change, and kept as proof.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { PROOF, check, start, summarize, waitFor, waitForPort } from './lib.mjs';

const PORT = 5911;
const results = [];
const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
let browser;
try {
  await waitForPort(PORT);
  await waitFor('ready line', { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, { timeout: 15000 });
  await page.screenshot({ path: path.join(PROOF, '00-before.png') });
  results.push(check('before screenshot taken', true));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}
process.exit(summarize(results) ? 0 : 1);
