/* global window */
/**
 * The paper is the same paper. Runs the game twice with `pnpm dev`: once from
 * the repository as it was before this ticket, once from this worktree. Reads
 * the grain tile the game itself painted (the texture Phaser draws the sheet
 * from) out of each page and compares the two pixel for pixel, channel for
 * channel, in both of Playwright's Chromium builds. Writes how many pixels differ and by how much, and a screenshot of
 * the game before and after.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PROOF, ROOT, check, lastLinesOf, repositoryBefore, start, summarize, waitFor, waitForPort, writeProof } from './lib.mjs';

const PORTS = { before: 5926, after: 5927 };
const VIEWPORT = { width: 960, height: 540 };
/** The textures `render/paper.ts` paints: the sheet's grain, which this ticket paints differently, and its tooth, which it does not touch. */
const TEXTURES = ['paper-grain', 'paper-tooth'];
/** Chromium both ways Playwright has it: the headless shell, and Chromium itself in its new headless mode, the same engine as Chrome. */
const ENGINES = [
  { name: 'headless shell', launch: {} },
  { name: 'chromium', launch: { channel: 'chromium' } },
];
const results = [];
const report = {};
const pageErrors = [];
const notFound = [];

const before = repositoryBefore();
report.before = { commit: before.commit };
const repositories = { before: before.folder, after: ROOT };
// Were the two the same code, the tiles would be equal and prove nothing.
const paperSource = (repository) => readFileSync(path.join(repository, 'packages/client/src/render/paper.ts'), 'utf8');
results.push(check('the code that paints the paper is not the same before and after', paperSource(repositories.before) !== paperSource(repositories.after), `before is ${before.commit.slice(0, 7)}`));

const servers = [];
let browser;
try {
  for (const which of ['before', 'after']) {
    const port = PORTS[which];
    const devServer = start('pnpm', ['dev'], { cwd: repositories[which], env: { PORT: String(port) } });
    servers.push(devServer);
    const ready = (await waitForPort(port)) && (await waitFor("the dev server's ready line", { read: () => devServer.output.includes(`localhost:${port}/`), until: Boolean }).catch(() => false));
    results.push(check(`${which}: dev server up, started by this run`, ready, ready ? undefined : lastLinesOf(devServer.output)));
    if (!ready) throw new Error('nothing to open');
  }

  report.engines = {};
  for (const engine of ENGINES) {
    browser = await chromium.launch(engine.launch);
    const painted = {};
    for (const which of ['before', 'after']) {
      const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      page.on('pageerror', (error) => pageErrors.push(`${which}: ${error}`));
      // A file the server does not have is named by its address; the console's own line for it has no address and is left out.
      page.on('response', (response) => response.status() >= 400 && notFound.push(`${which}: ${response.status()} ${new URL(response.url()).pathname}`));
      page.on('console', (message) => message.type() === 'error' && !message.text().startsWith('Failed to load resource') && pageErrors.push(`${which}: ${message.text()}`));
      await page.goto(`http://localhost:${PORTS[which]}/`);
      await page.waitForFunction(() => window.__game && window.__game.sim.tick > 10, null, { timeout: 30000 });
      painted[which] = {};
      for (const key of TEXTURES) painted[which][key] = await textureOf(page, key);
      if (engine === ENGINES[0]) {
        // The level's name has been written and nothing moves: the two screenshots show the same moment of the same level.
        await page.waitForFunction(() => window.__game.sim.tick > 360, null, { timeout: 30000 });
        await page.screenshot({ path: path.join(PROOF, `01-the-game-${which}.png`) });
      }
      await page.close();
    }
    const textures = {};
    report.engines[engine.name] = { version: browser.version(), textures };
    await browser.close();

    for (const key of TEXTURES) {
      const old = painted.before[key];
      const now = painted.after[key];
      const sameSize = old.width === now.width && old.height === now.height && old.pixels.length === old.width * old.height * 4 && now.pixels.length === old.pixels.length;
      results.push(check(`${engine.name}, ${key}: both tiles were read whole and are the same size`, sameSize, `${old.width}x${old.height} before, ${now.width}x${now.height} after`));
      if (!sameSize) continue;
      // A blank or flat tile would compare equal and prove nothing: the tile must be uneven, in its colours or in how much of it is missing.
      const values = valuesIn(now);
      results.push(check(`${engine.name}, ${key}: the tile that was read is painted paper, not a blank`, values.colours > 1 || values.alphas > 1, `${values.colours} different colours, ${values.alphas} different alphas`));
      const difference = differenceBetween(old, now);
      textures[key] = { width: now.width, height: now.height, pixels: now.width * now.height, sha256Before: sha256(old.pixels), sha256After: sha256(now.pixels), ...difference };
      results.push(
        check(
          `${engine.name}, ${key}: the tile is the same before and after, pixel for pixel`,
          difference.pixelsThatDiffer === 0,
          `${difference.pixelsThatDiffer} of ${now.width * now.height} pixels differ; largest difference in a channel ${difference.largestDifference} of 255; sha256 ${sha256(now.pixels).slice(0, 16)}`,
        ),
      );
    }
  }
  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
  // Chromium itself asks for an icon for the tab, which the game has never had; the headless shell does not ask.
  const unexpected = notFound.filter((line) => !line.endsWith(' 404 /favicon.ico'));
  results.push(check('nothing the page asked for was missing, but the icon of the tab', unexpected.length === 0, notFound.join(' | ')));
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

/** How many different colours and how many different alphas the pixels of a tile have. */
function valuesIn(tile) {
  const colours = new Set();
  const alphas = new Set();
  for (let index = 0; index < tile.pixels.length; index += 4) {
    colours.add((tile.pixels[index] << 16) | (tile.pixels[index + 1] << 8) | tile.pixels[index + 2]);
    alphas.add(tile.pixels[index + 3]);
  }
  return { colours: colours.size, alphas: alphas.size };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
