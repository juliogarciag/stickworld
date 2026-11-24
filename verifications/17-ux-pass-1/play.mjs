/* global window, document, Image */
/**
 * Playing the real app one frame at a time, for the scripts of this folder.
 *
 * Playwright's `page.clock` holds the page's clock still: every `frames(n)` lets exactly n frames of a sixtieth of
 * a second pass, so a key is held for a known number of ticks, a screenshot is of a known frame and a clip plays at
 * the game's true speed. Keys are real key presses. What the game is doing is read through `window.__game`, and
 * what is on the screen is measured from screenshots (`inkIn`).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROOF } from './lib.mjs';

/** The three windows everything is verified at, in CSS pixels. */
export const WINDOWS = [
  { name: 'wide', width: 1600, height: 900 },
  { name: 'narrow', width: 820, height: 760 },
  { name: 'portrait', width: 480, height: 860 },
];

const FRAME_MS = 1000 / 60;

/**
 * Opens the game at `url` in a window of `size`, with its clock held still on level `level`'s first frame.
 * `proofFolder` is where its screenshots go, under ./proof.
 */
export async function openGame({ browser, url, size, level, proofFolder }) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && pageErrors.push(message.text()));
  await page.clock.install();
  await page.goto(url);
  await page.waitForFunction(() => window.__game && window.__game.sim.tick > 3, null, { timeout: 15000 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const folder = path.join(PROOF, proofFolder);
  mkdirSync(folder, { recursive: true });
  const measuring = await context.newPage();

  let recording;
  const game = {
    page,
    size,
    pageErrors,

    /** Lets `count` frames pass, one sixtieth of a second each. */
    async frames(count) {
      for (let frame = 0; frame < count; frame += 1) {
        await page.clock.runFor(FRAME_MS);
        if (recording && (recording.frame += 1) % recording.every === 0) {
          await page.screenshot({ path: path.join(recording.folder, `${String(recording.kept).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 });
          recording.kept += 1;
        }
      }
    },

    seconds(seconds) {
      return game.frames(Math.round(seconds * 60));
    },

    /** Plays level `number` from its start, as `VITE_LEVEL` would: for getting to a level without playing the ones before. */
    async loadLevel(number) {
      await page.evaluate((id) => window.__game.loadLevel(id), number);
      await game.frames(1);
    },

    /** What the sim and the cameras say right now. Whatever this build's debug API does not have yet is null. */
    state() {
      return page.evaluate(() => {
        const api = window.__game;
        const optional = (name) => (typeof api[name] === 'function' ? (api[name]() ?? null) : null);
        return {
          tick: api.sim.tick,
          level: api.level.id,
          stickMan: api.stickMan(),
          flag: api.flag() ?? null,
          letter: api.letter() ?? null,
          airplane: api.airplane() ?? null,
          itemSlots: api.itemSlots(),
          itemUse: api.itemUse(),
          interaction: api.interaction(),
          camera: api.camera() ?? null,
          levelInView: optional('levelInView'),
          hudCamera: optional('hudCamera'),
          pageTurn: optional('pageTurn'),
          notes: optional('notes'),
          ending: optional('ending'),
        };
      });
    },

    /** The level being played, as its data file has it. */
    levelData() {
      return page.evaluate(() => JSON.parse(JSON.stringify(window.__game.level)));
    },

    async down(key) {
      await page.keyboard.down(key);
      await game.frames(1);
    },

    async up(key) {
      await page.keyboard.up(key);
      await game.frames(1);
    },

    /** One press of `key`, as long as a quick finger makes it. */
    async tap(key) {
      await page.keyboard.down(key);
      await game.frames(3);
      await page.keyboard.up(key);
      await game.frames(2);
    },

    /** Holds `key` until `done(state)` holds, at most `mostFrames` frames, lets go and says whether it did. */
    async holdUntil(key, done, mostFrames = 1800) {
      await page.keyboard.down(key);
      let reached = false;
      for (let frame = 0; frame < mostFrames && !reached; frame += 1) {
        await game.frames(1);
        reached = Boolean(done(await game.state()));
      }
      await page.keyboard.up(key);
      await game.frames(1);
      return reached;
    },

    /** Lets frames pass until `done(state)` holds, at most `mostFrames`, and says how many passed, or -1 if it never did. */
    async until(done, mostFrames = 1800) {
      for (let frame = 0; frame <= mostFrames; frame += 1) {
        if (done(await game.state())) return frame;
        await game.frames(1);
      }
      return -1;
    },

    /** Walks him right until his feet are at `x` or past it. */
    walkRightTo(x) {
      return game.holdUntil('ArrowRight', (state) => state.stickMan.feet.x >= x);
    },

    /** A screenshot of the window as it is on this frame, into the proof folder. Returns its path under ./proof. */
    async shot(name) {
      await page.screenshot({ path: path.join(folder, `${name}.jpg`), type: 'jpeg', quality: 80 });
      return `${proofFolder}/${name}.jpg`;
    },

    /**
     * Records everything `play` does as a clip at the game's own speed, into the proof folder as a GIF: every fifth
     * frame, twelve a second, 640 pixels wide at most. The paper's grain is flattened to one colour first, which is
     * what keeps a GIF of it small; the screenshots show the grain.
     */
    async clip(name, play) {
      recording = { folder: mkdtempSync(path.join(os.tmpdir(), 'clip-')), every: 5, frame: 0, kept: 0 };
      try {
        await play();
        const smaller = size.width > 640 ? 'scale=640:-1:flags=area,' : '';
        const flatPaper = "curves=all='0/0 0.5/0.2 0.8/1 1/1',colorchannelmixer=rr=0.953:gg=0.933:bb=0.886";
        const fewColours = 'split[all][forPalette];[forPalette]palettegen=max_colors=5:stats_mode=full[palette];[all][palette]paletteuse=dither=none';
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', path.join(recording.folder, '%05d.jpg'), '-vf', `${smaller}${flatPaper},${fewColours}`, path.join(folder, `${name}.gif`)]);
      } finally {
        rmSync(recording.folder, { recursive: true, force: true });
        recording = undefined;
      }
      return `${proofFolder}/${name}.gif`;
    },

    /**
     * Where a point of the level (metres) is in the window (CSS pixels), by the level camera as it is right now.
     * The same arithmetic as the client's `worldSeenBy`, from what `camera()` reports.
     */
    async onScreen(point) {
      const { camera } = await game.state();
      const pixelsPerMetre = await page.evaluate(() => window.__game.pixelsPerMetre);
      const scale = size.width / camera.width;
      const seenWidth = camera.width / camera.zoom;
      const seenHeight = camera.height / camera.zoom;
      const seenX = camera.scrollX + (camera.width - seenWidth) / 2;
      const seenY = camera.scrollY + (camera.height - seenHeight) / 2;
      return { x: (point.x * pixelsPerMetre - seenX) * camera.zoom * scale, y: (point.y * pixelsPerMetre - seenY) * camera.zoom * scale };
    },

    /** The rectangle of the window (CSS pixels) that shows the part of the level between two corners given in metres. */
    async regionOf({ left, right, top, bottom }) {
      const topLeft = await game.onScreen({ x: left, y: top });
      const bottomRight = await game.onScreen({ x: right, y: bottom });
      return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
    },

    /**
     * How many pixels of `region` (CSS pixels of the window) are pencil on this frame: darker than the paper and its
     * grain ever are. Measured from a screenshot, so it is what the player sees. A region outside the window counts
     * only the part of it that is inside.
     */
    async inkIn(region) {
      const x = Math.max(0, Math.floor(region.x));
      const y = Math.max(0, Math.floor(region.y));
      const width = Math.min(size.width, Math.ceil(region.x + region.width)) - x;
      const height = Math.min(size.height, Math.ceil(region.y + region.height)) - y;
      if (width <= 0 || height <= 0) return 0;
      const png = await page.screenshot({ type: 'png', clip: { x, y, width, height } });
      return measuring.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, image.width, image.height);
        let dark = 0;
        for (let pixel = 0; pixel < data.length; pixel += 4) if (Math.max(data[pixel], data[pixel + 1], data[pixel + 2]) < 150) dark += 1;
        return dark;
      }, png.toString('base64'));
    },

    close: () => context.close(),
  };

  if (level !== undefined) await game.loadLevel(level);
  return game;
}

/** The gap of a level with two floor lines, from its data. */
export function gapOf(level) {
  return { from: level.floor[0].to.x, to: level.floor[1].from.x };
}

/** The flag's place in a level, from its data: the placement whose def is named "flag". */
export async function flagAt(game) {
  return (await game.state()).flag.at;
}

/**
 * Level 3 from its start as far as reading the letter and putting it away again: he stands next to it with the
 * paper in his hand. Two presses. Returns the screenshot names `shots` asked for.
 */
export async function readTheLetter(game) {
  await game.holdUntil('ArrowRight', (state) => state.interaction === 'read');
  await game.tap('k');
  await game.seconds(0.4);
}

/**
 * From standing next to the letter he has read: puts it away, folds the paper, sets the airplane down, lifts it,
 * carries it towards the gap and puts it down where it sits on the edge. Tries a little further on each time it does
 * not, so nothing about how far in front of him it lands is typed in here. `onTheWay` is called once he carries it.
 */
export async function carryTheAirplaneToTheEdge(game, onTheWay = async () => undefined) {
  const gap = gapOf(await game.levelData());
  for (const key of ['k', 'j', 'j', 'k']) await game.tap(key);
  await game.seconds(0.3);
  await onTheWay();
  for (let short = 1.5; short > 0.6; short -= 0.1) {
    await game.walkRightTo(gap.from - short);
    await game.tap('k');
    if ((await game.state()).airplane?.onAnEdge) return true;
    await game.tap('k');
  }
  return false;
}

/** From standing next to the airplane on the edge: boards it, holds the nose up for `climbFrames` frames and lets go. Returns once he is no longer seated. */
export async function fly(game, climbFrames) {
  await game.tap('k');
  if (climbFrames > 0) {
    await game.page.keyboard.down('ArrowUp');
    await game.frames(climbFrames);
    await game.page.keyboard.up('ArrowUp');
  }
  return game.until((state) => state.stickMan.action !== 'seated', 1200);
}

/** How long the nose is held up for a flight that crosses level 3's gap, in frames: inside the window its tests hold. */
export const CLIMB_THAT_CROSSES = 26;

/**
 * Runs `body` against a dev server this script starts on `port` from the checkout at `cwd`, in a Chromium of its
 * own, and writes `<name>.json` with every check and whatever `body` put in its report. Exits non-zero on a failure.
 */
export async function verify({ name, port, cwd }, body) {
  const { chromium } = await import('playwright');
  const { check, lastLinesOf, start, summarize, waitFor, waitForPort, writeProof } = await import('./lib.mjs');
  const results = [];
  const report = {};
  const expect = (what, pass, details) => {
    results.push(check(what, Boolean(pass), details));
    return Boolean(pass);
  };
  const devServer = start('pnpm', ['dev'], { cwd, env: { PORT: String(port) } });
  let browser;
  try {
    // The ready line proves the port is this run's server, not something that was already listening there.
    const ready = (await waitForPort(port)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${port}/`), until: Boolean }).catch(() => false));
    expect('dev server up, started by this run', ready, ready ? undefined : lastLinesOf(devServer.output));
    if (!ready) throw new Error('nothing to open');
    browser = await chromium.launch();
    const pageErrors = [];
    // ONLY_WINDOW=narrow runs one window while a script is being written; the proof is always all three.
    for (const size of WINDOWS.filter((each) => !process.env.ONLY_WINDOW || each.name === process.env.ONLY_WINDOW)) {
      console.log(`\n--- ${size.name} window, ${size.width} x ${size.height} ---`);
      const open = async (options) => {
        const game = await openGame({ browser, url: `http://localhost:${port}/`, size, ...options });
        pageErrors.push(game.pageErrors);
        return game;
      };
      report[size.name] = await body({ size, open, expect: (what, pass, details) => expect(`${size.name}: ${what}`, pass, details) });
    }
    expect('no page errors', pageErrors.flat().length === 0, pageErrors.flat().join(' | '));
  } catch (error) {
    expect(`run completed (${error.message})`, false, String(error.stack).split('\n').slice(1, 3).join(' '));
  } finally {
    await browser?.close();
    devServer.stop();
  }
  report.results = results;
  writeProof(`${name}.json`, report);
  process.exit(summarize(results) ? 0 : 1);
}

export const round = (number, places = 2) => Math.round(number * 10 ** places) / 10 ** places;
