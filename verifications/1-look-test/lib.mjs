/* global window */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const PROOF = path.join(HERE, 'proof');
mkdirSync(PROOF, { recursive: true });

/** Writes a proof file. Absolute paths under the repo are relativised so proof is machine-independent. */
export function writeProof(name, data) {
  const file = path.join(PROOF, name);
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n';
  writeFileSync(file, text.split(ROOT).join('<repo>'));
  return file;
}

/** Starts a long-running command in its own process group, so `stop()` takes its children too, also when this script dies. */
export function start(command, args, { cwd = ROOT, env = {} } = {}) {
  stopEverythingOnExit();
  // No colours: the scripts look for plain text, such as a ready line, in what the command prints.
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env, NO_COLOR: '1', FORCE_COLOR: undefined }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  const server = {
    get output() {
      return output;
    },
    stop() {
      runningServers.delete(server);
      if (!child.pid) return;
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
    },
  };
  runningServers.add(server);
  return server;
}

export async function waitForPort(port, timeoutMs = 20000) {
  return waitFor(`port ${port}`, { read: () => isPortOpen(port), until: Boolean, timeoutMs }).catch(() => false);
}

/** Polls `read` until `until` holds for what it returned, and returns that. Throws on timeout, naming `what`. */
export async function waitFor(what, { read, until, timeoutMs = 8000 }) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await read();
    if (until(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for: ${what} (last: ${String(JSON.stringify(last)).slice(0, 200)})`);
}

/** The end of what a command printed, on one line and without stack frames: why a server did not start. */
export function lastLinesOf(output) {
  const lines = output.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('    at '));
  return lines.slice(-5).join(' | ');
}

/** Prints one PASS/FAIL line and returns the result for the report. */
export function check(name, pass, details) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${details ? `  (${details})` : ''}`);
  return { name, pass, details };
}

/** Prints the closing line and says whether every check passed. */
export function summarize(results) {
  const failed = results.filter((result) => !result.pass);
  console.log(failed.length === 0 ? `\nALL ${results.length} CHECKS PASSED` : `\n${failed.length} OF ${results.length} CHECKS FAILED`);
  return failed.length === 0;
}

// ---- Helpers ----

const runningServers = new Set();
let stopOnExitInstalled = false;

function stopEverythingOnExit() {
  if (stopOnExitInstalled) return;
  stopOnExitInstalled = true;
  const stopAll = () => {
    for (const server of runningServers) server.stop();
  };
  process.on('exit', stopAll);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      stopAll();
      process.exit(1);
    });
  }
}

function isPortOpen(port) {
  // Vite binds "localhost", which may be ::1 or 127.0.0.1 depending on the machine.
  const answers = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host });
      socket.once('connect', () => (socket.destroy(), resolve(true)));
      socket.once('error', () => resolve(false));
    });
  return Promise.all([answers('127.0.0.1'), answers('::1')]).then((answered) => answered.some(Boolean));
}

/**
 * What is on screen, as numbers. Takes a screenshot of `page` and, for each
 * rectangle asked for (CSS pixels), says how light its pixels are and where
 * the dark ones (pencil) are. The page itself decodes the picture, so no
 * image library is needed.
 */
export async function lookAt(page, rectangles) {
  const screenshot = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ({ screenshot, rectangles, darkBelow }) => {
      const bitmap = await window.createImageBitmap(await (await window.fetch(`data:image/png;base64,${screenshot}`)).blob());
      const canvas = new window.OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const scale = bitmap.width / window.innerWidth;
      return rectangles.map(({ x, y, width, height }) => {
        const left = Math.max(0, Math.round(x * scale));
        const top = Math.max(0, Math.round(y * scale));
        const wide = Math.max(1, Math.min(bitmap.width - left, Math.round(width * scale)));
        const tall = Math.max(1, Math.min(bitmap.height - top, Math.round(height * scale)));
        const { data } = context.getImageData(left, top, wide, tall);
        const colours = new Set();
        let sum = 0;
        let sumOfSquares = 0;
        let dark = 0;
        let topDarkRow;
        let bottomDarkRow;
        let leftDarkColumn = Infinity;
        let rightDarkColumn = -Infinity;
        for (let pixel = 0; pixel < wide * tall; pixel += 1) {
          const red = data[pixel * 4];
          const green = data[pixel * 4 + 1];
          const blue = data[pixel * 4 + 2];
          const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
          colours.add((red << 16) | (green << 8) | blue);
          sum += luminance;
          sumOfSquares += luminance * luminance;
          if (luminance >= darkBelow) continue;
          dark += 1;
          const row = Math.floor(pixel / wide);
          topDarkRow ??= row;
          bottomDarkRow = row;
          leftDarkColumn = Math.min(leftDarkColumn, pixel % wide);
          rightDarkColumn = Math.max(rightDarkColumn, pixel % wide);
        }
        const count = wide * tall;
        const mean = sum / count;
        return {
          pixels: count,
          meanLuminance: mean,
          luminanceSpread: Math.sqrt(Math.max(0, sumOfSquares / count - mean * mean)),
          distinctColours: colours.size,
          darkShare: dark / count,
          /** CSS pixels from the top of the page, or undefined when nothing in the rectangle is dark. */
          topDarkY: topDarkRow === undefined ? undefined : (top + topDarkRow) / scale,
          bottomDarkY: bottomDarkRow === undefined ? undefined : (top + bottomDarkRow) / scale,
          /** How wide the dark pixels spread, in CSS pixels; 0 when nothing is dark. */
          darkWidth: dark === 0 ? 0 : (rightDarkColumn - leftDarkColumn + 1) / scale,
        };
      });
    },
    { screenshot, rectangles, darkBelow: DARK_BELOW },
  );
}

/** A pixel darker than this (luminance out of 255) is pencil; the paper is far lighter. */
const DARK_BELOW = 150;

/** How many pixels differ between two screenshots of `page`'s size inside each rectangle (CSS pixels). */
export async function differingPixels(page, { before, after, rectangles }) {
  return page.evaluate(
    async ({ before, after, rectangles }) => {
      const decode = async (png) => {
        const bitmap = await window.createImageBitmap(await (await window.fetch(`data:image/png;base64,${png}`)).blob());
        const context = new window.OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
        context.drawImage(bitmap, 0, 0);
        return { context, scale: bitmap.width / window.innerWidth };
      };
      const first = await decode(before);
      const second = await decode(after);
      return rectangles.map(({ x, y, width, height }) => {
        const box = [x, y, width, height].map((value) => Math.round(value * first.scale));
        const one = first.context.getImageData(...box).data;
        const other = second.context.getImageData(...box).data;
        let differing = 0;
        for (let pixel = 0; pixel < one.length; pixel += 4) {
          if (one[pixel] !== other[pixel] || one[pixel + 1] !== other[pixel + 1] || one[pixel + 2] !== other[pixel + 2]) differing += 1;
        }
        return differing;
      });
    },
    { before: before.toString('base64'), after: after.toString('base64'), rectangles },
  );
}

/** Where the game's world is on the page: turns metres into CSS pixels with the camera as it is now. `pose` is the stick man's at that same moment. */
export async function onScreen(page) {
  const view = await page.evaluate(() => {
    const { camera, pixelsPerMetre, walkDemo } = window.__game;
    return { camera: camera(), pixelsPerMetre, pixelRatio: window.devicePixelRatio, pose: walkDemo()?.pose() };
  });
  const { camera, pixelsPerMetre, pixelRatio } = view;
  return {
    ...view,
    /** CSS pixels per metre. */
    perMetre: (pixelsPerMetre * camera.zoom) / pixelRatio,
    x: (metres) => ((metres * pixelsPerMetre - camera.scrollX - camera.width / 2) * camera.zoom + camera.width / 2) / pixelRatio,
    y: (metres) => ((metres * pixelsPerMetre - camera.scrollY - camera.height / 2) * camera.zoom + camera.height / 2) / pixelRatio,
  };
}
