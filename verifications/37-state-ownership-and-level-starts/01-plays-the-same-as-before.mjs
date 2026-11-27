/**
 * The game plays the same as before this ticket, tick for tick.
 *
 * Builds the sim twice, from the commit this branch was cut from (`git
 * merge-base HEAD origin/main`) and from the working tree, and plays the same
 * games on both: a scripted player that reads the level, crafts the airplane,
 * dies in the gap, loses flights, crosses, reaches every flag and plays again,
 * and games of random keys. After every tick the two sims' whole state must
 * hash the same.
 *
 * The build from before still has its functions under their old names (`stickManOf`, `snapshot()`); this branch renamed
 * them (`getStickMan`, `takeSnapshot()`), so only what both are asked is spelled twice below.
 *
 * This branch also renamed fields of the sim's state, and a field's name is part of what a snapshot hashes, so the
 * snapshot from before is given the new field names before it is hashed (`renameStateFields`); its values are untouched.
 *
 * The scripted player decides from the sim built from the commit before, and
 * both sims are given the same commands, so a difference shows as a hash that
 * differs and not as two players who went different ways.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, check, summarize, writeProof } from './lib.mjs';

const results = [];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'stickworld-37-'));
try {
  const before = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const simBefore = await simBuiltFrom(treeOf(before), 'before');
  const simNow = await simBuiltFrom(ROOT, 'now');

  const games = [
    // What a level asks for, with the ways to fail it first: each caller of a level start is in here.
    { name: 'the whole game, played well, and again', from: 1, plan: { fallsIntoTheGap: 0, climbs: [30] }, laps: 2 },
    { name: 'falls into the gap of level 3 twice, then crosses', from: 1, plan: { fallsIntoTheGap: 2, climbs: [30] }, laps: 1 },
    { name: 'loses flights (no climb, climbing for ever), then crosses', from: 1, plan: { fallsIntoTheGap: 0, climbs: [0, 400, 30] }, laps: 1 },
    { name: 'falls, loses a flight, crosses, plays again and falls again', from: 1, plan: { fallsIntoTheGap: 1, climbs: [5, 24] }, laps: 2 },
    ...[16, 20, 26, 34, 42, 50, 70].map((climb) => ({ name: `level 3 with a climb of ${climb} ticks, however it ends`, from: 3, plan: { fallsIntoTheGap: 0, climbs: [climb, 30] }, laps: 1 })),
    { name: 'jumps out of the airplane over the gap', from: 3, plan: { fallsIntoTheGap: 0, climbs: [30, 30], jumpsOutAfter: 25 }, laps: 1 },
  ];
  const totals = { games: 0, ticks: 0, fallsToDeath: 0, lostFlights: 0, nextLevels: 0, playedAgain: 0 };
  const report = { before, games: [] };
  let firstDifference;

  for (const game of games) {
    const played = playBoth({ simBefore, simNow, from: game.from, seed: 1, mostTicks: 9000, commandsFor: scriptedPlayer(simBefore, game) });
    report.games.push({ name: game.name, ...played.counts, ticks: played.ticks, sameEveryTick: played.difference === undefined, endHash: played.endHash });
    firstDifference ??= played.difference && { game: game.name, ...played.difference };
    addTo(totals, played);
  }
  for (let seed = 1; seed <= 40; seed += 1) {
    const from = 1 + (seed % simBefore.levels.length);
    const played = playBoth({ simBefore, simNow, from, seed, mostTicks: 3000, commandsFor: randomKeys(seed) });
    report.games.push({ name: `random keys, seed ${seed}, from level ${from}`, ...played.counts, ticks: played.ticks, sameEveryTick: played.difference === undefined, endHash: played.endHash });
    firstDifference ??= played.difference && { game: `random keys, seed ${seed}`, ...played.difference };
    addTo(totals, played);
  }

  results.push(check('every tick of every game hashes the same on both builds', firstDifference === undefined, firstDifference ? JSON.stringify(firstDifference) : `${totals.games} games, ${totals.ticks} ticks`));
  // The comparison only means something if the games did what this ticket changed.
  results.push(check('he fell to his death and the level started again (the player asks)', totals.fallsToDeath > 0, `${totals.fallsToDeath} times`));
  results.push(check('a flight was lost with him in it and the level started again (the airplane asks)', totals.lostFlights > 0, `${totals.lostFlights} times`));
  results.push(check('a flag was reached and the next level started (the flag asks)', totals.nextLevels > 0, `${totals.nextLevels} times`));
  results.push(check('the game was finished and played again (the game asks to start over)', totals.playedAgain > 0, `${totals.playedAgain} times`));
  report.totals = totals;
  writeProof('01-plays-the-same-as-before.json', report);
} catch (error) {
  results.push(check(`run completed (${error.stack ?? error})`, false));
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

/** The sim package of commit `commit`, unpacked beside this run's other files. Its imports are found in this tree's node_modules: the sim has none of its own. */
function treeOf(commit) {
  const tree = path.join(work, 'tree-before');
  fs.mkdirSync(tree);
  const archive = execFileSync('git', ['archive', commit, 'packages/sim/src'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', tree], { input: archive });
  return tree;
}

/** The sim's package entry of the tree at `root`, bundled into one module and imported. */
async function simBuiltFrom(root, name) {
  const file = path.join(work, `sim-${name}.mjs`);
  const rolldown = path.join(ROOT, 'node_modules/.pnpm/node_modules/rolldown/bin/cli.mjs');
  const cli = fs.existsSync(rolldown) ? rolldown : fs.globSync(path.join(ROOT, 'node_modules/.pnpm/rolldown@*/node_modules/rolldown/bin/cli.mjs'))[0];
  execFileSync('node', [cli, path.join(root, 'packages/sim/src/index.ts'), '--file', file, '--format', 'esm', '--log-level', 'silent'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(file).href);
}

/**
 * Plays one game on both builds with the same commands, and says where their states first differed, if they did.
 * Counts what happened in it as the build from before saw it.
 */
function playBoth({ simBefore, simNow, from, seed, mostTicks, commandsFor }) {
  const a = simBefore.createSim({ level: from, seed });
  const b = simNow.createSim({ level: from, seed });
  const counts = { fallsToDeath: 0, lostFlights: 0, nextLevels: 0, playedAgain: 0 };
  let difference;
  let ticks = 0;
  for (; ticks < mostTicks; ticks += 1) {
    const commands = commandsFor(a);
    if (commands === 'done') break;
    const was = { level: a.level, man: simBefore.stickManOf(a), offered: simBefore.gameOf(a).playingAgainOffered };
    a.step(commands);
    b.step(commands);
    const start = simBefore.levelOf(a).start;
    const man = simBefore.stickManOf(a);
    const backAtTheStart = a.level === was.level && man.feet.x === start.x && man.feet.y === start.y && was.man.feet.y > start.y + 1;
    if (backAtTheStart && was.man.action === 'seated') counts.lostFlights += 1;
    else if (backAtTheStart) counts.fallsToDeath += 1;
    if (a.level !== was.level && !was.offered) counts.nextLevels += 1;
    if (was.offered && commands.some((command) => command.type === 'game/playAgain')) counts.playedAgain += 1;
    const [hashA, hashB] = [simNow.hashSnapshot(renameStateFields(a.snapshot())), simNow.hashSnapshot(b.takeSnapshot())];
    if (hashA !== hashB) {
      difference = { atTick: a.tick, before: renameStateFields(a.snapshot()), now: b.takeSnapshot() };
      break;
    }
  }
  return { ticks, counts, difference, endHash: simNow.hashSnapshot(b.takeSnapshot()) };
}

/**
 * This branch renamed fields of the sim's state (a boolean's name now says it is one), and the name of a field is part
 * of what a snapshot hashes. So the snapshot from before is given this branch's field names, and nothing else about it
 * is touched: every value, and every field not listed, has to be the same for the two hashes to be equal.
 */
function renameStateFields(value) {
  const renamed = {
    inWorld: 'isInWorld', carried: 'isCarried', falling: 'isFalling', flying: 'isFlying', sliding: 'isSliding', inLevel: 'isInLevel', beingRead: 'isBeingRead',
    ticksUntilItFalls: 'ticksUntilFall', onFloor: 'isOnFloor', jumpHeld: 'isJumpHeld', riseCut: 'isRiseCut', carrying: 'isCarrying', seated: 'isSeated',
  };
  if (Array.isArray(value)) return value.map(renameStateFields);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [renamed[key] ?? key, renameStateFields(inner)]));
}

function addTo(totals, played) {
  totals.games += 1;
  totals.ticks += played.ticks;
  for (const name of Object.keys(played.counts)) totals[name] += played.counts[name];
}

/**
 * A player that reads only what a view may read, and finishes the game the way it is meant to be finished, after
 * failing as `plan` says: it walks right, jumps the gaps a jump crosses, reads the letter, makes the airplane, sets it
 * on the edge of a gap too wide to jump, boards it and climbs for as many ticks as the plan says for that flight.
 */
function scriptedPlayer(build, { plan, laps }) {
  let lapsPlayed = 0;
  let waitUntilTick = 0;
  let fallsLeft = plan.fallsIntoTheGap;
  let flight = 0;
  let seatedFor = null;
  let ticksAfterTheEnd = 0;
  let countFallsFromTick = 0;
  return (sim) => {
    const commands = [];
    const man = build.stickManOf(sim);
    const { floor } = build.levelOf(sim);
    const walk = (direction) => direction !== man.walkDirectionAsked && commands.push({ type: 'player/walk', direction });
    const once = (command) => {
      if (sim.tick < waitUntilTick) return;
      commands.push(command);
      waitUntilTick = sim.tick + 12;
    };

    if (build.gameOf(sim).over) {
      walk(0);
      if (lapsPlayed + 1 >= laps) return (ticksAfterTheEnd += 1) > 240 ? 'done' : commands;
      if (build.gameOf(sim).playingAgainOffered) {
        commands.push({ type: 'game/playAgain' });
        lapsPlayed += 1;
        fallsLeft = plan.fallsIntoTheGap;
        flight = 0;
      }
      return commands;
    }

    if (man.action === 'seated') {
      seatedFor = seatedFor === null ? 0 : seatedFor + 1;
      const climb = plan.climbs[Math.min(flight, plan.climbs.length - 1)];
      const steer = seatedFor < climb ? 1 : 0;
      if (steer !== build.steeringAskedOf(sim)) commands.push({ type: 'airplane/steer', direction: steer });
      if (plan.jumpsOutAfter !== undefined && flight === 0 && seatedFor === plan.jumpsOutAfter) commands.push({ type: 'player/jump' }, { type: 'player/letGoOfJump' });
      return commands;
    }
    if (seatedFor !== null) {
      seatedFor = null;
      flight += 1;
    }

    // A fall he meant is counted once he is below the floor, and once: he is down there for more than a tick.
    if (fallsLeft > 0 && man.feet.y > 1 && sim.tick >= countFallsFromTick) {
      fallsLeft -= 1;
      countFallsFromTick = sim.tick + 120;
    }
    const interaction = build.interactionOf(sim);
    const itemUse = build.itemUseOf(sim);
    const line = floor.find(({ from, to }) => man.feet.x >= from.x && man.feet.x <= to.x);
    const next = line && floor.find(({ from }) => from.x > line.to.x);
    const gapAhead = line && next ? next.from.x - line.to.x : 0;
    const tooWideToJump = gapAhead > 2;
    const toTheEdge = line ? line.to.x - man.feet.x : Infinity;

    if (interaction === 'board') once({ type: 'world/interact' });
    else if (interaction === 'putDown') {
      // Carried to where it will sit on the edge: a little short of it.
      if (toTheEdge > 0.8) walk(1);
      else if (toTheEdge < 0.6) walk(-1);
      else {
        walk(0);
        once({ type: 'world/interact' });
      }
    } else if (interaction === 'lift' && tooWideToJump && fallsLeft === 0) {
      walk(0);
      once({ type: 'world/interact' });
    } else if (interaction !== null && interaction !== 'lift') {
      // The letter to read or put away, the sheet that fell to pick up.
      walk(0);
      once({ type: 'world/interact' });
    } else if (itemUse === 'craft') once({ type: 'item/use' });
    else if (tooWideToJump && fallsLeft > 0) walk(1);
    else if (tooWideToJump && itemUse === 'place') {
      if (toTheEdge > 0.8) walk(1);
      else if (toTheEdge < 0.6) walk(-1);
      else {
        walk(0);
        once({ type: 'item/use' });
      }
    } else if (tooWideToJump && toTheEdge < 1.5) walk(0);
    else {
      walk(1);
      if (line && next && !tooWideToJump && toTheEdge < 0.2 && man.action !== 'jumping') commands.push({ type: 'player/jump' });
    }
    return commands;
  };
}

/** A player that presses anything: every command the game has, at random moments, from a seed. */
function randomKeys(seed) {
  let state = seed * 2654435761;
  const random = () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) + 0x9e3779b9) | 0;
    return ((state >>> 0) % 100000) / 100000;
  };
  const any = (values) => values[Math.floor(random() * values.length)];
  return () => {
    const commands = [];
    if (random() < 0.05) commands.push({ type: 'player/walk', direction: any([1, 1, 1, 0, -1]) });
    if (random() < 0.03) commands.push({ type: 'player/jump' });
    if (random() < 0.03) commands.push({ type: 'player/letGoOfJump' });
    if (random() < 0.03) commands.push({ type: 'world/interact' });
    if (random() < 0.03) commands.push({ type: 'item/use' });
    if (random() < 0.01) commands.push({ type: 'inventory/select', slot: any([1, 2, 3]) });
    if (random() < 0.03) commands.push({ type: 'airplane/steer', direction: any([1, 0, -1]) });
    if (random() < 0.01) commands.push({ type: 'game/playAgain' });
    return commands;
  };
}
