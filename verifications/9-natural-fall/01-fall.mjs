/* global window */
/**
 * The fall, played in the real app with the keys a player uses: walking off
 * the near end of level 2's gap carries him forward, the far end stops him
 * and he drops beside it; a hop at the edge drops him all but straight
 * beside the near end, which pushes him clear; a running jump still crosses
 * the gap and reaches the flag; level 1 is still finished by walking.
 *
 * How it looks cannot be checked, so it is photographed (the same moments as
 * 00-before.mjs) and filmed: proof/after-*.png and proof/fall.mp4.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROOF, check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';
import { hopOffTheEdgeAndStop, launchBrowser, openGame, playLevel, samplesOf, shotWhen, shotsOfAFall, untilTheLevelStartsAgain, walkOffTheGapAndLetGo } from './scenes.mjs';

/** Not 5209: that is the dev server left running for the human. */
const PORT = 5909;
/** How far below the line his feet are in each picture, in metres. The same as in 00-before.mjs. */
const DEPTHS = [0.3, 1.0, 1.3, 1.6];
const results = [];
const report = {};
const videoFolder = mkdtempSync(path.join(os.tmpdir(), 'fall-video-'));

const devServer = start('pnpm', ['dev'], { env: { PORT: String(PORT) } });
let browser;
try {
  const ready = (await waitForPort(PORT)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${PORT}/`), until: Boolean }).catch(() => false));
  results.push(check('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output)));
  if (!ready) throw new Error('nothing to open');

  browser = await launchBrowser();
  // The checks read one sample a frame, so they run on a page that is not being filmed and keeps up with the sim.
  const { context, page, pageErrors } = await openGame(browser, { port: PORT });
  const world = await page.evaluate(() => {
    const api = window.__game;
    api.loadLevel(2);
    const [near, far] = api.level.floor;
    return { dt: api.sim.dt, height: api.stickManHeight, width: api.stickManWidth, gap: { from: near.to.x, to: far.from.x }, floorY: near.to.y };
  });
  report.world = world;

  // ---- 1. A forward fall: walk off the near end of the gap and let go of the key. ----
  await walkOffTheGapAndLetGo(page);
  await untilTheLevelStartsAgain(page);
  const forward = await samplesOf(page);

  const walking = forward.filter((sample) => sample.action === 'walking');
  const walkSpeed = (walking[walking.length - 1].feet.x - walking[0].feet.x) / ((walking[walking.length - 1].tick - walking[0].tick) * world.dt);
  const falling = forward.filter((sample) => sample.action === 'jumping');
  const letGo = falling.filter((sample) => sample.walkDirectionAsked === 0);
  const drifting = letGo.filter((sample) => sample.feet.x < world.gap.to - world.width / 2 - 1e-6);
  results.push(check('he walked off the edge and the key was let go while he fell', letGo.length >= 3 && drifting.length >= 2, `${letGo.length} frames falling with no key held, ${drifting.length} of them before the far end`));
  results.push(
    check(
      'after the key is let go he keeps the speed he walked at',
      drifting.every((sample) => Math.abs(sample.horizontalSpeed - walkSpeed) < 0.02 * walkSpeed),
      `walked at ${walkSpeed.toFixed(3)} m/s, drifted at ${Math.min(...drifting.map((sample) => sample.horizontalSpeed)).toFixed(3)} to ${Math.max(...drifting.map((sample) => sample.horizontalSpeed)).toFixed(3)} m/s`,
    ),
  );
  const carried = drifting[drifting.length - 1].feet.x - letGo[0].feet.x;
  const atWalkSpeed = walkSpeed * (drifting[drifting.length - 1].tick - letGo[0].tick) * world.dt;
  results.push(check('his momentum carries him forward over the gap, as far as walking would have', carried > 0.1 && Math.abs(carried - atWalkSpeed) < 0.02 * atWalkSpeed, `${carried.toFixed(3)} m after the key was let go; ${atWalkSpeed.toFixed(3)} m at walk speed over the same ticks`));

  const besideTheLine = falling.filter((sample) => sample.feet.y > world.floorY && sample.feet.y < world.floorY + world.height);
  const furthest = Math.max(...besideTheLine.map((sample) => sample.feet.x));
  results.push(check('the far end of the gap stops him: his body never goes through it', Math.abs(furthest - (world.gap.to - world.width / 2)) < 1e-6, `furthest feet x ${furthest.toFixed(4)} with the line inside his height, far end at ${world.gap.to}, half his width ${world.width / 2}`));
  const stopped = besideTheLine.filter((sample) => Math.abs(sample.feet.x - furthest) < 1e-6);
  results.push(check('he then drops straight beside the far end', stopped.length >= 3 && stopped.every((sample) => sample.horizontalSpeed === 0), `${stopped.length} frames at feet x ${furthest.toFixed(4)} with no sideways speed`));
  results.push(check('falling into the gap still starts the level again', forward[forward.length - 1].action === 'standing' && forward.some((sample) => sample.feet.y > world.floorY + world.height)));

  // ---- 2. A straight drop: stand at the edge, hop, and hold the right arrow just until he is past the end. ----
  await hopOffTheEdgeAndStop(page);
  await untilTheLevelStartsAgain(page);
  const straight = await samplesOf(page);
  const stoodAt = straight.filter((sample) => sample.action === 'standing' && sample.feet.x > world.gap.from - world.width / 2).map((sample) => sample.feet.x)[0];
  const droppingBeside = straight.filter((sample) => sample.action === 'jumping' && sample.feet.y > world.floorY && sample.feet.y < world.floorY + world.height);
  results.push(check('he stood at the very edge, hopped, and came down past it', stoodAt !== undefined && stoodAt < world.gap.from && droppingBeside.length >= 3, `stood at ${stoodAt?.toFixed(3)}, edge at ${world.gap.from}, ${droppingBeside.length} frames dropping beside the line`));
  const cameDownAt = droppingBeside[0]?.feet.x;
  results.push(check('he came down closer to the end of the line than half his width', cameDownAt > world.gap.from && cameDownAt < world.gap.from + world.width / 2, `feet x ${cameDownAt?.toFixed(4)} as they passed the line, end of the line at ${world.gap.from}, half his width ${world.width / 2}`));
  const lowDown = droppingBeside.filter((sample) => sample.feet.y > world.floorY + world.height / 2);
  const closest = Math.min(...lowDown.map((sample) => sample.feet.x));
  results.push(check('the near end pushes him aside: he was not moving sideways, and half his height down he is exactly half his width from it', lowDown.length >= 1 && Math.abs(closest - (world.gap.from + world.width / 2)) < 1e-6, `feet x ${closest.toFixed(4)}`));
  const sidewaysPerTick = droppingBeside.map((sample, index) => (index === 0 ? 0 : Math.abs(sample.feet.x - droppingBeside[index - 1].feet.x) / Math.max(1, sample.tick - droppingBeside[index - 1].tick)));
  results.push(check('it pushes him a little every tick, never across the paper at once', Math.max(...sidewaysPerTick) < world.width / 8, `at most ${Math.max(...sidewaysPerTick).toFixed(3)} m in a tick`));
  const steepest = Math.min(...droppingBeside.map((sample) => sample.verticalSpeed / Math.max(Math.abs(sample.horizontalSpeed), 1e-9)));
  results.push(check('it is a straight drop: he falls at least five times faster than he drifts, all the way down the line', steepest >= 5, steepest > 1e6 ? 'he does not drift at all' : `falling ${steepest.toFixed(1)} times faster than drifting at the least`));
  const inTheHop = straight.filter((sample) => sample.action === 'jumping' && sample.walkDirectionAsked === 0 && sample.feet.y < world.floorY);
  results.push(check('a jump has no momentum: with the key let go in the air he does not drift', inTheHop.length >= 2 && inTheHop.every((sample) => sample.horizontalSpeed === 0), `${inTheHop.length} frames above the line with no key held, all with no sideways speed`));

  // ---- 3. A running jump across the gap, to the flag. ----
  await playLevel(page, 2);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((takeOff) => window.__game.stickMan().feet.x >= takeOff, world.gap.from - 0.25 * (world.gap.to - world.gap.from), { polling: 'raf' });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__game.flag().reached, null, { polling: 'raf', timeout: 10000 });
  await page.keyboard.up('ArrowRight');
  const jumped = await samplesOf(page);
  const overTheGap = jumped.filter((sample) => sample.feet.x > world.gap.from && sample.feet.x < world.gap.to);
  results.push(check('a running jump carries him over the gap, above the line all the way', overTheGap.length >= 3 && overTheGap.every((sample) => sample.feet.y < world.floorY), `${overTheGap.length} frames over the gap, lowest ${Math.max(...overTheGap.map((sample) => sample.feet.y)).toFixed(3)} m`));
  results.push(check('level 2 is still finished: he lands, walks on and reaches the flag', jumped[jumped.length - 1].level === 2 && (await page.evaluate(() => window.__game.flag().reached))));

  // ---- 4. Level 1 is still finished by walking right. ----
  await playLevel(page, 1);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__game.level.id === 1 && window.__game.flag().reached, null, { polling: 'raf', timeout: 10000 });
  await page.keyboard.up('ArrowRight');
  results.push(check('level 1 is still finished by walking to the flag', true));

  await context.close();

  // ---- 5. The recording: the same three moves again, on a page that is filmed and checked for nothing. ----
  const { context: filmed, page: film } = await openGame(browser, { port: PORT, video: videoFolder });
  await walkOffTheGapAndLetGo(film);
  await untilTheLevelStartsAgain(film);
  await hopOffTheEdgeAndStop(film);
  await untilTheLevelStartsAgain(film);
  await playLevel(film, 2);
  await film.keyboard.down('ArrowRight');
  await film.waitForFunction((takeOff) => window.__game.stickMan().feet.x >= takeOff, world.gap.from - 0.25 * (world.gap.to - world.gap.from), { polling: 'raf' });
  await film.keyboard.press('Space');
  await film.waitForFunction(() => window.__game.flag().reached, null, { polling: 'raf', timeout: 10000 });
  await film.keyboard.up('ArrowRight');
  await film.waitForTimeout(600);
  await filmed.close();

  // ---- 6. The pictures, on a page that is not being filmed: the game stops for each one. ----
  const { page: stills, pageErrors: stillsErrors } = await openGame(browser, { port: PORT, pixelRatio: 2 });
  report.shots = [
    ...(await shotsOfAFall(stills, { prefix: 'after-walk-off', depths: DEPTHS, fall: walkOffTheGapAndLetGo })),
    ...(await shotsOfAFall(stills, { prefix: 'after-straight-drop', depths: DEPTHS.slice(1), fall: hopOffTheEdgeAndStop })),
  ];
  await playLevel(stills, 2);
  await stills.keyboard.down('ArrowRight');
  await stills.waitForFunction((takeOff) => window.__game.stickMan().feet.x >= takeOff, world.gap.from - 0.25 * (world.gap.to - world.gap.from), { polling: 'raf' });
  await stills.keyboard.press('Space');
  report.shots.push({ name: 'after-jump-over-the-gap.png', stickMan: await shotWhen(stills, { name: 'after-jump-over-the-gap.png', condition: `(api) => api.stickMan().feet.x >= ${(world.gap.from + world.gap.to) / 2}` }) });
  await stills.keyboard.up('ArrowRight');
  results.push(check('a picture of every moment was taken', report.shots.length === 2 * DEPTHS.length, report.shots.map((shot) => shot.name).join(', ')));
  results.push(check('no page errors', pageErrors.length + stillsErrors.length === 0, [...pageErrors, ...stillsErrors].join(' | ')));
  await stills.context().close();
  const [recording] = readdirSync(videoFolder);
  // The recording as a file a pull request can show, and the three falls of it as a picture that plays by itself.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(videoFolder, recording), '-movflags', '+faststart', '-pix_fmt', 'yuv420p', path.join(PROOF, 'fall.mp4')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(videoFolder, recording), '-vf', 'fps=20,scale=640:-1:flags=lanczos', path.join(PROOF, 'fall.gif')]);
  results.push(check('the recording of the forward fall, the straight drop and the jump was written', true, 'proof/fall.mp4, proof/fall.gif'));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  devServer.stop();
  rmSync(videoFolder, { recursive: true, force: true });
}

report.results = results;
writeProof('01-fall.json', report);
process.exit(summarize(results) ? 0 : 1);
