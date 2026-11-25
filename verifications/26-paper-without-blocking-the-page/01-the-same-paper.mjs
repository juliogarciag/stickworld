/* global window */
/**
 * The paper is the same paper. Runs the game twice with `pnpm dev`: once from
 * the repository as it was before this ticket, once from this worktree. Reads
 * the grain tile the game itself painted (the texture Phaser draws the sheet
 * from) out of each page and compares the two pixel for pixel, channel for
 * channel. Writes how many pixels differ and by how much, and a screenshot of
 * the game before and after.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { PROOF, ROOT, check, lastLinesOf, repositoryBefore, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

const PORTS = { before: 5926, after: 5927 };
const VIEWPORT = { width: 960, height: 540 };
/** The textures `render/paper.ts` paints: the sheet's grain, which this ticket paints differently, and its tooth, which it does not touch. */
const TEXTURES = ['paper-grain', 'paper-tooth'];
const results = [];
const report = {};
const pageErrors = [];

const before = repositoryBefore();
report.before = { commit: before.commit };
const repositories = { before: before.folder, after: ROOT };
let browser;
const servers = [];
try {
  browser = await chromium.launch();
  const painted = {};
  for (const which of ['before', 'after']) {
    const port = PORTS[which];
    const devServer = start('pnpm', ['dev'], { cwd: repositories[which], env: { PORT: String(port) } });
    servers.push(devServer);
    const ready = (await waitForPort(port)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${port}/`), until: Boolean }).catch(() => false));
    results.push(check(`${which}: dev server up, started by this run`, ready, ready ? undefined : lastLinesOf(devServer.output)));
    if (!ready) throw new Error('nothing to open');

    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => pageErrors.push(`${which}: ${error}`));
    page.on('console', (message) => message.type() === 'error' && pageErrors.push(`${which}: ${message.text()}`));
    await page.goto(`http://localhost:${port}/`);
    await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, { timeout: 30000 });
    painted[which] = {};
    for (const key of TEXTURES) painted[which][key] = await textureOf(page, key);
    // The level's name has been written and nothing moves: the two screenshots show the same moment of the same level.
    await page.waitForFunction(() => window.__game.sim.tick > 360, null, { timeout: 30000 });
    await page.screenshot({ path: path.join(PROOF, `01-the-game-${which}.png`) });
    await page.close();
    devServer.stop();
  }

  report.textures = {};
  for (const key of TEXTURES) {
    const old = painted.before[key];
    const now = painted.after[key];
    const sameSize = old.width === now.width && old.height === now.height && old.pixels.length === old.width * old.height * 4 && now.pixels.length === old.pixels.length;
    results.push(check(`${key}: both tiles were read whole and are the same size`, sameSize, `${old.width}x${old.height} before, ${now.width}x${now.height} after`));
    if (!sameSize) continue;
    // A blank or flat tile would compare equal and prove nothing: the tile must have the paper's unevenness in it.
    const levels = new Set();
    for (let index = 0; index < now.pixels.length; index += 4) levels.add((now.pixels[index] << 16) | (now.pixels[index + 1] << 8) | now.pixels[index + 2]);
    results.push(check(`${key}: the tile that was read is painted paper, not a blank`, key === 'paper-tooth' ? new Set(now.pixels.filter((_, index) => index % 4 === 3)).size > 50 : levels.size > 50, `${levels.size} different colours`));
    const difference = differenceBetween(old, now);
    report.textures[key] = { width: now.width, height: now.height, pixels: now.width * now.height, sha256Before: sha256(old.pixels), sha256After: sha256(now.pixels), ...difference };
    results.push(
      check(
        `${key}: the tile is the same before and after, pixel for pixel`,
        difference.pixelsThatDiffer === 0,
        `${difference.pixelsThatDiffer} of ${now.width * now.height} pixels differ; largest difference in a channel ${difference.largestDifference} of 255; sha256 ${sha256(now.pixels).slice(0, 16)}`,
      ),
    );
  }
  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await browser?.close();
  for (const server of servers) server.stop();
}

report.results = results;
writeProof('01-the-same-paper.json', report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** The pixels of the texture `key` as the game in `page` painted it: the canvas Phaser draws it from, read whole. */
async function textureOf(page, key) {
  const read = await page.evaluate((textureKey) => {
    const canvas = window.__game.game.textures.get(textureKey).getSourceImage();
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let binary = '';
    for (let from = 0; from < data.length; from += 0x8000) binary += String.fromCharCode(...data.subarray(from, from + 0x8000));
    return { width: canvas.width, height: canvas.height, base64: btoa(binary) };
  }, key);
  return { width: read.width, height: read.height, pixels: new Uint8Array(Buffer.from(read.base64, 'base64')) };
}

/** How two tiles of the same size differ: how many pixels, by how much at most, and how many channel values are off by each amount. */
function differenceBetween(old, now) {
  let pixelsThatDiffer = 0;
  let largestDifference = 0;
  const channelValuesOffBy = {};
  for (let pixel = 0; pixel < old.pixels.length; pixel += 4) {
    let differs = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const off = Math.abs(old.pixels[pixel + channel] - now.pixels[pixel + channel]);
      if (off === 0) continue;
      differs = true;
      largestDifference = Math.max(largestDifference, off);
      channelValuesOffBy[off] = (channelValuesOffBy[off] ?? 0) + 1;
    }
    if (differs) pixelsThatDiffer += 1;
  }
  return { pixelsThatDiffer, largestDifference, channelValuesOffBy };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
