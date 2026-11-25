import { execFileSync, spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
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

/**
 * The repository as it was before this ticket (where the branch left `origin/main`), in a folder of its own with its
 * dependencies installed: the "before" every comparison here is made against is the real code, not a copy of it.
 * Made once and kept in the system's temporary folder; `commit` is what it holds.
 */
export function repositoryBefore() {
  const commit = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const folder = path.join(os.tmpdir(), `stickworld-26-before-${commit.slice(0, 12)}`);
  if (!existsSync(path.join(folder, 'node_modules'))) {
    mkdirSync(folder, { recursive: true });
    execFileSync('sh', ['-c', `git archive ${commit} | tar -x -C "${folder}"`], { cwd: ROOT });
    execFileSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], { cwd: folder, stdio: 'ignore' });
  }
  return { folder, commit };
}

/** Builds the client of the repository at `repository` for production into `into`. `minify: false` keeps function names, for a CPU profile. */
export function buildClient({ repository, into, minify }) {
  const args = ['--filter', '@stickworld/client', 'exec', 'vite', 'build', '--outDir', into, '--emptyOutDir', '--logLevel', 'warn'];
  if (!minify) args.push('--minify', 'false');
  execFileSync('pnpm', args, { cwd: repository, stdio: 'ignore' });
  return into;
}

/** Serves the files of `folder` on `port`, as a host of the built game would. Resolves once it listens; `close()` stops it. */
export function serveFolder(folder, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer((request, response) => {
    const asked = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.join(folder, path.normalize(asked === '/' ? '/index.html' : asked));
    if (!file.startsWith(folder) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, 'localhost', () => resolve({ close: () => server.close() }));
  });
}

/** The middle value of `numbers`. */
export function medianOf(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
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
