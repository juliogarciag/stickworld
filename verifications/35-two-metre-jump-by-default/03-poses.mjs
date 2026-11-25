/* global window */
/**
 * His pose through a held jump with the game's own jump, and with the jump the game had before (`smallJump`, chosen
 * through the movement panel's kept choice, the way the owner would); through a tap hop; and in a long fall off an
 * edge. Each is played in real time and recorded, and the frames of the recording are laid out in one sheet
 * (`ffmpeg`, which must be installed), so the sheet shows what a player sees frame by frame. Each run is checked to be
 * under the tuning it is meant to show, from start to end.
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PROOF, check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';
import { VIEWPORT, heightOf, hold, startFollowing, stopFollowing, waitUntilOnHisFeet, walkUntil } from './game.mjs';

/** A port no other session uses, and not the one of the dev server left running for the human (5235). */
const PORT = 5937;
/** Frames a second taken from the recording into a sheet, and how many sheet cells across. */
const SHEET = { fps: 15, across: 6 };
const RUNS = [
  { name: 'held-current', preset: 'current', act: (page) => hold(page, 'Space', 900), seconds: 1.3 },
  { name: 'held-smallJump', preset: 'smallJump', act: (page) => hold(page, 'Space', 600), seconds: 0.8 },
  { name: 'tap-current', preset: 'current', act: (page) => hold(page, 'Space', 0), seconds: 0.5 },
  { name: 'long-fall', preset: 'current', act: (page) => walkUntil(page, 'ArrowLeft', (man) => man.action === 'jumping'), seconds: 1.6, untilFallen: true },
];
const results = [];
const report = {};
const pageErrors = [];

const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
let browser;
try {
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');
  browser = await chromium.launch();

  for (const run of RUNS) {
    const videoDir = path.join(PROOF, `video-03-${run.name}`);
    rmSync(videoDir, { recursive: true, force: true });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, recordVideo: { dir: videoDir, size: VIEWPORT } });
    const recordingStarted = Date.now();
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    // The panel's own kept choice: the preset alone, so it plays that preset's numbers.
    if (run.preset !== 'current') await page.addInitScript((name) => window.localStorage.setItem('stickworld.movementPanel.2', JSON.stringify({ preset: name, tuning: {}, open: false })), run.preset);
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(() => window.__game && window.__game.sim.tick > 30, null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    const tuningBefore = await page.evaluate(() => window.__game.movementTuning());

    await startFollowing(page);
    const actedAt = (Date.now() - recordingStarted) / 1000;
    await run.act(page);
    if (run.untilFallen) await page.waitForTimeout(run.seconds * 1000);
    else await waitUntilOnHisFeet(page);
    const samples = await stopFollowing(page);
    const tuningAfter = await page.evaluate(() => window.__game.movementTuning());
    await page.waitForTimeout(300);
    await context.close();

    const video = await page.video().path();
    const sheet = `pose-${run.name}.png`;
    const from = Math.max(0, actedAt - 0.1);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(from), '-t', String(run.seconds), '-i', video, '-vf', `fps=${SHEET.fps},crop=420:420:270:60,scale=210:210,tile=${SHEET.across}x${Math.ceil((run.seconds * SHEET.fps) / SHEET.across)}`, '-frames:v', '1', path.join(PROOF, sheet)]);

    const sameTuning = JSON.stringify(tuningBefore) === JSON.stringify(tuningAfter);
    const highest = heightOf(samples);
    const fastest = Math.max(...samples.map((sample) => sample.vy));
    report[run.name] = { tuning: tuningBefore, highest, fastest, frames: samples.length, sheet };
    results.push(check(`${run.name}: played under the ${run.preset} tuning from start to end, recorded into ${sheet}`, sameTuning && samples.length > 3, `jump height ${tuningBefore.jumpHeight} m, highest ${highest.toFixed(2)} m, fastest fall ${fastest.toFixed(1)} m/s`));
  }
  results.push(check('the held jumps are the 2 m one and the old 0.7 m one', report['held-current'].tuning.jumpHeight === 2 && report['held-smallJump'].tuning.jumpHeight === 0.7 && Math.abs(report['held-current'].highest - 2) < 0.05 && Math.abs(report['held-smallJump'].highest - 0.7) < 0.05));
  results.push(check('the long fall reaches his fastest fall, where the long-fall pose is', report['long-fall'].fastest === report['long-fall'].tuning.fastestFall, `${report['long-fall'].fastest} m/s`));
  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
}

report.results = results;
writeProof('03-poses.json', report);
process.exit(summarize(results) ? 0 : 1);
