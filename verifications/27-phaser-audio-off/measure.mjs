/* global window */
// Ticket 27: how long the production build takes to draw its first frame, and whether an audio context is made.
// Usage: node measure.mjs <label>=<dist folder> [<label>=<dist folder> ...]
// Loads each build RUNS times in a browser just started and once more in the same browser, taking turns between
// builds so that a busy machine is busy for all of them. The two loads differ because the first audio context a
// browser makes starts its audio service, which is the slow part; the ones after it cost a few milliseconds.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const RUNS = 9;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const builds = process.argv.slice(2).map((argument) => {
  const [label, folder] = argument.split('=');
  return { label, folder: resolve(folder), runs: [] };
});

for (const build of builds) build.server = await serve(build.folder);
for (let run = 0; run < RUNS; run += 1) {
  for (const build of builds) {
    const browser = await chromium.launch({ channel: 'chromium', headless: true });
    const inANewBrowser = await bootOnce(browser, build.server.url);
    const inTheSameBrowserAgain = await bootOnce(browser, build.server.url);
    build.runs.push({ inANewBrowser, inTheSameBrowserAgain });
    await browser.close();
  }
}
for (const build of builds) build.server.close();

const report = builds.map(({ label, runs }) => ({
  label,
  inANewBrowser: summaryOf(runs.map((run) => run.inANewBrowser)),
  inTheSameBrowserAgain: summaryOf(runs.map((run) => run.inTheSameBrowserAgain)),
  runs,
}));
for (const { label, inANewBrowser, inTheSameBrowserAgain } of report) {
  console.log(`${label}, in a new browser:       ${JSON.stringify(inANewBrowser)}`);
  console.log(`${label}, in the same one again:  ${JSON.stringify(inTheSameBrowserAgain)}`);
}
if (report.length === 2) {
  const [before, after] = report;
  for (const load of ['inANewBrowser', 'inTheSameBrowserAgain']) {
    const from = before[load].medianFirstFrameMs;
    const to = after[load].medianFirstFrameMs;
    console.log(`first frame, ${load}: ${from} ms -> ${to} ms (${round(from - to)} ms sooner)`);
  }
}
console.log('REPORT ' + JSON.stringify(report));

// ---- Helpers ----

async function bootOnce(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.addInitScript(() => {
    const seen = { firstFrameMs: null, audioContextsMade: 0, makingAudioContextsMs: 0, longTasks: [] };
    window.__seen = seen;
    // The first frame: the end of the first animation frame the page asked for (Phaser's first step draws it).
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      request((time) => {
        callback(time);
        if (seen.firstFrameMs === null) seen.firstFrameMs = performance.now();
      });
    for (const name of ['AudioContext', 'webkitAudioContext']) {
      const Original = window[name];
      if (!Original) continue;
      window[name] = new Proxy(Original, {
        construct(target, constructorArguments, newTarget) {
          const started = performance.now();
          const made = Reflect.construct(target, constructorArguments, newTarget);
          seen.audioContextsMade += 1;
          seen.makingAudioContextsMs += performance.now() - started;
          return made;
        },
      });
    }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) seen.longTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__seen.firstFrameMs !== null, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const atFirstFrame = await page.evaluate(() => ({ ...window.__seen }));
  // Phaser makes or resumes its audio context on the first key or click when it could not before: press one.
  await page.keyboard.press('ArrowRight');
  await page.mouse.click(200, 200);
  await page.waitForTimeout(300);
  const audioContextsMadeAfterAKeyPress = await page.evaluate(() => window.__seen.audioContextsMade);
  const canvases = await page.locator('#game canvas').count();
  await context.close();
  return {
    firstFrameMs: round(atFirstFrame.firstFrameMs),
    blockedBeforeFirstFrameMs: round(
      atFirstFrame.longTasks.filter((task) => task.start < atFirstFrame.firstFrameMs).reduce((sum, task) => sum + task.duration, 0),
    ),
    makingAudioContextsMs: round(atFirstFrame.makingAudioContextsMs),
    audioContextsMade: atFirstFrame.audioContextsMade,
    audioContextsMadeAfterAKeyPress,
    canvases,
    pageErrors,
  };
}

function summaryOf(loads) {
  return {
    medianFirstFrameMs: median(loads.map((load) => load.firstFrameMs)),
    medianBlockedBeforeFirstFrameMs: median(loads.map((load) => load.blockedBeforeFirstFrameMs)),
    medianMakingAudioContextsMs: median(loads.map((load) => load.makingAudioContextsMs)),
    audioContextsMade: loads.map((load) => load.audioContextsMade),
    audioContextsMadeAfterAKeyPress: loads.map((load) => load.audioContextsMadeAfterAKeyPress),
    canvases: loads.map((load) => load.canvases),
    pageErrors: loads.flatMap((load) => load.pageErrors),
  };
}

function serve(folder) {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    try {
      const file = join(folder, path === '/' ? 'index.html' : path);
      if (!file.startsWith(folder)) throw new Error('outside the build');
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () => done({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })),
  );
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function round(number) {
  return Math.round(number * 10) / 10;
}
