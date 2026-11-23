/* global window */
/**
 * The fall as it looked before this ticket: the same keys as the "after"
 * captures of 01-fall.mjs, against a checkout of the branch this one starts
 * from. Run once, by hand, with that checkout's path:
 *
 *   git worktree add --detach /tmp/before origin/3-level-2 && (cd /tmp/before && pnpm install)
 *   BEFORE_ROOT=/tmp/before node 00-before.mjs
 *
 * It is not in run.sh: the build it photographs is not in this branch.
 */
import { check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';
import { launchBrowser, openGame, shotsOfAFall, walkOffTheGapAndLetGo } from './scenes.mjs';

const PORT = 5919;
const BEFORE_ROOT = process.env.BEFORE_ROOT;
/** How far below the line his feet are in each picture, in metres. The same as in 01-fall.mjs. */
const DEPTHS = [0.3, 1.0, 1.3, 1.6];
const results = [];
const report = {};

if (!BEFORE_ROOT) throw new Error('BEFORE_ROOT must be the path of a checkout of the branch this ticket starts from');
const devServer = start('pnpm', ['dev'], { cwd: BEFORE_ROOT, env: { PORT: String(PORT) } });
let browser;
try {
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server of the build from before up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');

  browser = await launchBrowser();
  const { page } = await openGame(browser, { port: PORT, pixelRatio: 2 });
  report.shots = await shotsOfAFall(page, { prefix: 'before-walk-off', depths: DEPTHS, fall: walkOffTheGapAndLetGo });
  const edge = await page.evaluate(() => window.__game.level.floor[0].to.x);
  const height = await page.evaluate(() => window.__game.stickManHeight);
  const pastTheEdge = report.shots.map((shot) => shot.stickMan.feet.x - edge);
  results.push(check('before: he drops straight down at the edge once the key is let go, wherever in the fall he is', pastTheEdge.every((metres) => metres > 0 && metres < height / 20), `feet ${pastTheEdge.map((metres) => metres.toFixed(3)).join(', ')} m past the edge`));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('00-before.json', report);
process.exit(summarize(results) ? 0 : 1);
