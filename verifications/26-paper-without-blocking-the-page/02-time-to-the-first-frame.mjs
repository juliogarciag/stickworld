/* global window, document, requestAnimationFrame, WebGLRenderingContext, WebGL2RenderingContext */
/**
 * The page is no longer blocked while the paper is made. Builds the client
 * for production twice, from the repository as it was before this ticket and
 * from this worktree, serves each as a host would, and measures in Chromium:
 *
 * - the time from navigation to the first frame the game draws, and the long
 *   tasks that blocked the page before it, on the build as it is deployed;
 * - how long `paintGrain` took, from a CPU profile of the same build left
 *   unminified so the function has its name.
 *
 * Each is the median of RUNS loads, every load in a fresh browser context.
 */
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import { ROOT, buildClient, check, medianOf, repositoryBefore, serveFolder, summarize, writeProof } from './lib.mjs';

const PORTS = { before: 5928, after: 5929 };
const VIEWPORT = { width: 1280, height: 720 };
const RUNS = 7;
const results = [];
const report = { machine: `${os.cpus()[0].model}, ${os.platform()} ${os.arch()}`, runs: RUNS, viewport: VIEWPORT, deviceScaleFactor: 2 };

const before = repositoryBefore();
report.before = { commit: before.commit };
const repositories = { before: before.folder, after: ROOT };
let browser;
const servers = [];
try {
  // Chromium itself in its new headless mode, as ticket 22 measured with: the same engine as Chrome.
  browser = await chromium.launch({ channel: 'chromium' });
  report.browser = browser.version();
  const measured = {};
  for (const which of ['before', 'after']) {
    const builds = path.join(os.tmpdir(), `stickworld-26-builds-${which}`);
    const asDeployed = buildClient({ repository: repositories[which], into: path.join(builds, 'as-deployed'), minify: true });
    const withNames = buildClient({ repository: repositories[which], into: path.join(builds, 'with-names'), minify: false });
    const port = PORTS[which];

    let server = await serveFolder(asDeployed, port);
    servers.push(server);
    const loads = [];
    for (let run = 0; run < RUNS; run += 1) loads.push(await loadOnce(browser, port, { profiled: false }));
    server.close();

    server = await serveFolder(withNames, port);
    servers.push(server);
    const profiles = [];
    for (let run = 0; run < RUNS; run += 1) profiles.push(await loadOnce(browser, port, { profiled: true }));
    server.close();

    measured[which] = {
      firstFrameMs: medianOf(loads.map((load) => load.firstFrameMs)),
      blockedBeforeFirstFrameMs: medianOf(loads.map((load) => load.blockedMs)),
      longestTaskBeforeFirstFrameMs: medianOf(loads.map((load) => load.longestTaskMs)),
      paintGrainMs: medianOf(profiles.map((load) => load.paintGrainMs)),
      everyRun: { firstFrameMs: loads.map((load) => load.firstFrameMs), longTasksMs: loads.map((load) => load.longTasksMs), paintGrainMs: profiles.map((load) => load.paintGrainMs) },
    };
    const medians = measured[which];
    // A load that draws no frame throws in loadOnce; a profile without the function would measure nothing and say 0.
    results.push(check(`${which}: paintGrain was in every profile`, profiles.every((load) => load.paintGrainMs > 0)));
    console.log(`      ${which}: first frame ${medians.firstFrameMs.toFixed(0)} ms, blocked before it ${medians.blockedBeforeFirstFrameMs.toFixed(0)} ms (longest task ${medians.longestTaskBeforeFirstFrameMs.toFixed(0)} ms), paintGrain ${medians.paintGrainMs.toFixed(1)} ms`);
  }
  report.measured = measured;
  const paintSaved = measured.before.paintGrainMs - measured.after.paintGrainMs;
  const firstFrameSaved = measured.before.firstFrameMs - measured.after.firstFrameMs;
  report.saved = { paintGrainMs: paintSaved, firstFrameMs: firstFrameSaved, blockedBeforeFirstFrameMs: measured.before.blockedBeforeFirstFrameMs - measured.after.blockedBeforeFirstFrameMs };
  results.push(
    check('paintGrain takes less time than it took', measured.after.paintGrainMs < measured.before.paintGrainMs, `${measured.before.paintGrainMs.toFixed(1)} ms before, ${measured.after.paintGrainMs.toFixed(1)} ms after`),
  );
  // What painting the grain no longer costs should show in the page: at least half of it, allowing for noise between loads, in the first frame and in the long tasks before it.
  results.push(check('the first frame comes earlier by at least half of what paintGrain no longer costs', firstFrameSaved > paintSaved / 2, `${measured.before.firstFrameMs.toFixed(0)} ms before, ${measured.after.firstFrameMs.toFixed(0)} ms after, ${firstFrameSaved.toFixed(0)} ms earlier`));
  results.push(
    check(
      'the page is blocked for less before the first frame, by at least half of what paintGrain no longer costs',
      measured.after.blockedBeforeFirstFrameMs < measured.before.blockedBeforeFirstFrameMs - paintSaved / 2,
      `${measured.before.blockedBeforeFirstFrameMs.toFixed(0)} ms of long tasks before, ${measured.after.blockedBeforeFirstFrameMs.toFixed(0)} ms after`,
    ),
  );
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  for (const server of servers) server.close();
}

report.results = results;
writeProof('02-time-to-the-first-frame.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/**
 * Loads the game once in a fresh context and waits for its first frame. Says when that frame was (milliseconds from
 * navigation), which long tasks blocked the page before it, and, when `profiled`, how long `paintGrain` ran.
 */
async function loadOnce(browser, port, { profiled }) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.addInitScript(watchForTheFirstFrame);
  const devtools = profiled ? await context.newCDPSession(page) : undefined;
  if (devtools) {
    await devtools.send('Profiler.enable');
    await devtools.send('Profiler.setSamplingInterval', { interval: 100 });
    await devtools.send('Profiler.start');
  }
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__firstFrame.at !== undefined, null, { timeout: 60000 });
  // Long tasks are reported a moment after they end.
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => window.__firstFrame);
  const longTasksMs = seen.longTasks.filter((task) => task.start < seen.at).map((task) => Math.round(task.duration));
  let paintGrainMs;
  if (devtools) paintGrainMs = timeInside('paintGrain', (await devtools.send('Profiler.stop')).profile);
  await context.close();
  return { firstFrameMs: seen.at, longTasksMs, blockedMs: longTasksMs.reduce((sum, task) => sum + task, 0), longestTaskMs: Math.max(0, ...longTasksMs), paintGrainMs };
}

/** Runs in the page before anything else: notes the first animation frame after the game's first WebGL draw on a canvas that is in the page, and every long task. */
function watchForTheFirstFrame() {
  const seen = { at: undefined, longTasks: [] };
  window.__firstFrame = seen;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) seen.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }).observe({ type: 'longtask', buffered: true });
  let drawn = false;
  for (const Context of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const draw of ['drawArrays', 'drawElements']) {
      const original = Context.prototype[draw];
      Context.prototype[draw] = function (...args) {
        if (!drawn && document.contains(this.canvas)) {
          drawn = true;
          requestAnimationFrame(() => (seen.at = performance.now()));
        }
        return original.apply(this, args);
      };
    }
  }
}

/** The milliseconds a CPU profile spent in the function `name` and in what it called. */
function timeInside(name, profile) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const parentOf = new Map();
  for (const node of profile.nodes) for (const child of node.children ?? []) parentOf.set(child, node.id);
  const inside = new Map();
  const isInside = (id) => {
    if (inside.has(id)) return inside.get(id);
    const answer = byId.get(id).callFrame.functionName === name || (parentOf.has(id) && isInside(parentOf.get(id)));
    inside.set(id, answer);
    return answer;
  };
  let microseconds = 0;
  profile.samples.forEach((id, index) => {
    if (isInside(id)) microseconds += profile.timeDeltas[index + 1] ?? 0;
  });
  return microseconds / 1000;
}
