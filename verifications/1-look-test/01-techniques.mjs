/* global window */
/**
 * One screenshot per stroke technique tried, of the same still moment: the
 * stick man held mid-stride on level 1's floor. A whole view and a close-up
 * (pixel ratio 3) of each, so they can be compared side by side.
 *
 * Usage: node 01-techniques.mjs rope graphics canvas
 * Only works on a commit where `VITE_STROKES` still picks the technique.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { PROOF, check, start, summarize, waitFor, waitForPort } from './lib.mjs';

const PORT = 5912;
const techniques = process.argv.slice(2);
const results = [];
let browser;
try {
  browser = await chromium.launch();
  for (const technique of techniques) {
    const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT), VITE_STROKES: technique } });
    try {
      await waitForPort(PORT);
      await waitFor('ready line', { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean });
      for (const [name, deviceScaleFactor, viewport] of [['view', 1, { width: 960, height: 540 }], ['closeup', 3, { width: 420, height: 300 }]]) {
        const page = await browser.newPage({ viewport, deviceScaleFactor });
        const errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        await page.goto(`http://localhost:${PORT}/`);
        await page.waitForFunction(() => window.__game?.walkDemo?.(), null, { timeout: 15000 });
        // Let him get into his stride, then hold the picture.
        await page.waitForFunction(() => window.__game.walkDemo().pose().feet.x > 2.2);
        await page.evaluate(() => window.__game.walkDemo().setPaused(true));
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(PROOF, `01-technique-${technique}-${name}.png`) });
        results.push(check(`${technique}: ${name} screenshot, no page errors`, errors.length === 0, errors.join(' | ')));
        await page.close();
      }
    } finally {
      devServer.stop();
      await waitFor('port free', { read: () => waitForPort(PORT, 300), until: (open) => !open }).catch(() => {});
    }
  }
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
}
process.exit(summarize(results) ? 0 : 1);
