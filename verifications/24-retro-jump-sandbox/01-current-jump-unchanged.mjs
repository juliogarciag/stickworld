/**
 * The game as it is played does not change: a fresh page plays the current preset, which is the jump of PLAYER
 * (0.7 m), letting go of the jump early does not shorten it, the panel is there but folded away, and a production
 * build has neither the panel nor the library that draws it.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PROOF, ROOT, check, summarize, writeProof } from './lib.mjs';
import { VIEWPORT, jumpWithKey, movementTuning, openGame, panelIsOpen, startDevServer } from './jumps.mjs';

const CURRENT_JUMP_HEIGHT = 0.7;
const results = [];
const report = {};
const pageErrors = [];

let devServer;
let browser;
try {
  devServer = await startDevServer(results);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await openGame(context, { pageErrors });

  const tuning = await movementTuning(page);
  report.tuning = tuning;
  results.push(check('a fresh page plays the current preset: a 0.7 m jump, nothing cut by letting go, no braking in the air', tuning.jumpHeight === CURRENT_JUMP_HEIGHT && tuning.letGoCut === 0 && tuning.airBraking === 0 && tuning.riseGravity === tuning.fallGravity, JSON.stringify(tuning)));
  results.push(check('the movement panel is there, folded away', !(await panelIsOpen(page))));

  const held = await jumpWithKey(page, { holdToTheTop: true });
  const tapped = await jumpWithKey(page, { holdMs: 0 });
  report.held = held;
  report.tapped = tapped;
  results.push(check('a held jump lifts his feet to the jump height, as before', held.landed && held.highest > CURRENT_JUMP_HEIGHT * 0.95 && held.highest <= CURRENT_JUMP_HEIGHT + 1e-6, `${held.highest.toFixed(3)} m in ${held.ticksToTop} ticks`));
  results.push(check('a tap jumps just as high: letting go cuts nothing in the game as it is', tapped.landed && Math.abs(tapped.highest - held.highest) < 0.02, `${tapped.highest.toFixed(3)} m`));
  await page.screenshot({ path: path.join(PROOF, '01-current-with-the-panel-folded.png') });

  // The production bundle: the panel's title and the library's class names must not be in it.
  execFileSync('pnpm', ['build'], { cwd: ROOT, stdio: 'ignore' });
  const assets = path.join(ROOT, 'packages/client/dist/assets');
  const bundle = readdirSync(assets).filter((file) => file.endsWith('.js')).map((file) => readFileSync(path.join(assets, file), 'utf8')).join('\n');
  const leaks = ['Movement (dev)', 'lil-gui', 'stickworld.movementPanel'].filter((word) => bundle.includes(word));
  results.push(check('a production build has neither the panel nor lil-gui', leaks.length === 0, leaks.length ? `found: ${leaks.join(', ')}` : `${bundle.length} bytes searched`));

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer?.stop();
}

report.results = results;
writeProof('01-current-jump-unchanged.json', report);
process.exit(summarize(results) ? 0 : 1);
