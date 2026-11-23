/* global window */
/**
 * The whole of level 3's second half, played with the real keyboard in
 * Chromium against `pnpm dev`, and recorded: he boards the airplane on the
 * edge, climbs for a moment, glides across the gap, lands on the far side,
 * walks to the last flag, and the game says it is the end.
 */
import path from 'node:path';
import { PROOF, check, summarize, writeProof } from './lib.mjs';
import { VIEWPORT, openLevel3, pencilPixelsIn, putTheAirplaneOnTheEdge, stateOf, untilTheSim } from './play.mjs';

/** A port no other session uses, and not the one of the dev server left running for the human (5205). */
const PORT = 5915;
const NAME = '01-full-flight';
const results = [];
const report = {};
let game;
try {
  game = await openLevel3({ port: PORT, name: NAME, results });
  const { page, pageErrors } = game;
  const first = await stateOf(page);
  results.push(check('the game starts on level 3, whose flag ends the game', first.level === 3 && first.flag?.endsTheGame === true && first.flag.reached === false, `level ${first.level}`));

  // ---- To the edge, as issue #4 left it ----
  const ready = await putTheAirplaneOnTheEdge(page);
  results.push(check('the airplane sits on the edge with its nose over the gap, and K would board it', ready.airplane?.state === 'resting' && ready.airplane.onAnEdge && ready.interaction === 'board', `airplane at x ${ready.airplane?.at.x.toFixed(2)}, edge at ${ready.gap.from}, K would ${ready.interaction}`));
  await page.screenshot({ path: path.join(PROOF, '01-ready-to-board.png') });

  // ---- Boarding ----
  await page.keyboard.down('k');
  await untilTheSim(page, 'him to be seated', (api) => api.stickMan().action === 'seated');
  // The nose goes up from the first moment of the flight.
  await page.keyboard.down('ArrowUp');
  await page.keyboard.up('k');
  const boarded = await stateOf(page);
  const launchSpeed = boarded.airplane.speed;
  results.push(check('K seats him in the airplane and launches it forward off the edge', boarded.stickMan.action === 'seated' && boarded.airplane.state === 'flying' && boarded.airplane.speed > 5 && boarded.airplane.at.x > ready.airplane.at.x, `flying at ${boarded.airplane.speed.toFixed(2)} m/s from x ${boarded.airplane.at.x.toFixed(2)}`));
  results.push(check('seated, he is where the airplane is', samePoint(boarded.stickMan.feet, boarded.airplane.at)));

  // ---- The climb: the nose held up until he is a good metre above the line, as a player does it by eye ----
  // A walk key does nothing while he is seated: held for the whole climb, he neither turns nor leaves his seat.
  await page.keyboard.down('ArrowLeft');
  await untilTheSim(page, 'it to be a metre above the line', (api) => api.airplane() && -api.airplane().at.y >= 1);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowLeft');
  const climbing = await stateOf(page);
  await page.screenshot({ path: path.join(PROOF, '02-climbing.png') });
  const climbed = -climbing.airplane.at.y;
  results.push(check('holding up turns its nose up and it climbs', climbing.airplane.state === 'flying' && climbing.airplane.pitch > 0.4 && climbed >= 1, `nose ${climbing.airplane.pitch.toFixed(2)} rad up, ${climbed.toFixed(2)} m above the line`));
  results.push(check('climbing costs speed: it is slower than it was launched', climbing.airplane.speed < launchSpeed - 0.5, `${launchSpeed.toFixed(2)} -> ${climbing.airplane.speed.toFixed(2)} m/s`));
  results.push(check('the walk key held while seated neither turned him nor moved him off the airplane', climbing.stickMan.action === 'seated' && climbing.stickMan.facing === 1 && samePoint(climbing.stickMan.feet, climbing.airplane.at)));

  // ---- The glide: nothing held, the nose sinks and it comes down across the gap, gaining speed ----
  await untilTheSim(page, 'the nose to point down', (api) => api.airplane()?.pitch < -0.2);
  const top = await stateOf(page);
  await page.screenshot({ path: path.join(PROOF, '03-gliding.png') });
  await untilTheSim(page, 'the far side to be under it', (api) => api.airplane() && api.airplane().at.x >= api.level.floor[1].from.x);
  const overTheFarSide = await stateOf(page);
  results.push(check('left alone its nose sinks and it glides down', top.airplane.state === 'flying' && top.airplane.pitch < 0 && -overTheFarSide.airplane.at.y < -top.airplane.at.y, `from ${(-top.airplane.at.y).toFixed(2)} m to ${(-overTheFarSide.airplane.at.y).toFixed(2)} m above the line`));
  results.push(check('diving gives speed back', overTheFarSide.airplane.speed > top.airplane.speed, `${top.airplane.speed.toFixed(2)} -> ${overTheFarSide.airplane.speed.toFixed(2)} m/s`));
  results.push(check('it never dropped below its stall speed', Math.min(climbing.airplane.speed, top.airplane.speed, overTheFarSide.airplane.speed) > top.airplane.stallSpeed, `stall speed ${top.airplane.stallSpeed} m/s`));
  results.push(check('it reaches the far side above the line, still flying, with him in it', overTheFarSide.airplane.state === 'flying' && overTheFarSide.airplane.at.y < 0 && overTheFarSide.stickMan.action === 'seated', `${(-overTheFarSide.airplane.at.y).toFixed(2)} m above the line at x ${overTheFarSide.airplane.at.x.toFixed(2)}`));
  results.push(check('no letter fell while he flew, and the level never started again', overTheFarSide.letter === null && overTheFarSide.tick > boarded.tick));
  await page.screenshot({ path: path.join(PROOF, '04-over-the-far-side.png') });

  // ---- Landing ----
  await untilTheSim(page, 'it to touch the line', (api) => api.airplane()?.state === 'landing' || api.airplane()?.state === 'resting');
  const touchedDown = await stateOf(page);
  await untilTheSim(page, 'him to stand up', (api) => api.stickMan().action === 'standing');
  const landed = await stateOf(page);
  results.push(check('it comes down on the line and slides, losing its speed', touchedDown.airplane.at.y === 0 && touchedDown.airplane.at.x > touchedDown.gap.to && landed.airplane.speed === 0 && (touchedDown.airplane.state === 'resting' || touchedDown.airplane.speed > 0), `${touchedDown.airplane.state} at ${touchedDown.airplane.speed.toFixed(2)} m/s at x ${touchedDown.airplane.at.x.toFixed(2)}, at rest at x ${landed.airplane.at.x.toFixed(2)}`));
  results.push(check('it lands on the far side: at rest on the line, and he stands up where it lies', landed.airplane.state === 'resting' && landed.airplane.speed === 0 && landed.airplane.at.y === 0 && landed.airplane.at.x > landed.gap.to && samePoint(landed.stickMan.feet, landed.airplane.at), `at x ${landed.airplane.at.x.toFixed(2)}, the far side is ${landed.gap.to} to ${landed.farEnd}`));
  results.push(check('the flag was not reached from the airplane: still seated on the line, it is not', touchedDown.stickMan.action !== 'seated' || touchedDown.flag.reached === false));
  await page.screenshot({ path: path.join(PROOF, '05-landed.png') });

  // ---- The last flag ----
  // The upper part of the page, right of the item slot: nothing is drawn there until the game is over.
  const upperPart = { x: 160, y: 0, width: VIEWPORT.width - 160, height: Math.round(VIEWPORT.height * 0.45) };
  await walkToTheFlag(page, landed);
  await untilTheSim(page, 'the flag to be reached', (api) => api.flag().reached);
  // Reached, the flag takes a moment to go up: until it has, nothing is written yet.
  const pencilBefore = await pencilPixelsIn(page, await page.screenshot({ clip: upperPart }));
  await untilTheSim(page, 'the flag to be all the way up', (api) => api.flag().raised === 1);
  await page.waitForTimeout(300);
  const pencilAfter = await pencilPixelsIn(page, await page.screenshot({ clip: upperPart }));
  const atTheFlag = await stateOf(page);
  results.push(check('he walks to the flag on his own feet and reaches it', atTheFlag.flag.reached && atTheFlag.flag.raised === 1 && atTheFlag.stickMan.action === 'cheering'));
  results.push(check('the game writes across the top of the page once the flag is up, where nothing was written before', pencilBefore < 20 && pencilAfter > 1000, `${pencilBefore} pencil-dark pixels in the upper part before, ${pencilAfter} after (the words are in 06-the-end.png)`));
  await page.screenshot({ path: path.join(PROOF, '06-the-end.png') });

  // Longer than the pause after which a next level would start: none does.
  await page.waitForTimeout(3000);
  const later = await stateOf(page);
  results.push(check('no level follows: it is still level 3, finished, and he still cheers', later.level === 3 && later.flag.reached && later.flag.endsTheGame && later.stickMan.action === 'cheering' && samePoint(later.stickMan.feet, atTheFlag.stickMan.feet), `${((later.tick - atTheFlag.tick) * later.dt).toFixed(1)} s later`));

  results.push(check('no page errors', pageErrors.length === 0, pageErrors.join(' | ')));
  Object.assign(report, { ready, boarded, climbing, top, overTheFarSide, touchedDown, landed, atTheFlag, later });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close();
}

report.results = results;
writeProof(`${NAME}.json`, report);
process.exit(summarize(results) ? 0 : 1);

// ---- Helpers ----

function samePoint(one, other) {
  return Math.abs(one.x - other.x) < 1e-9 && Math.abs(one.y - other.y) < 1e-9;
}

/** Holds the arrow key towards the flag until it is reached. He may have landed on either side of it, or within reach of it already. */
async function walkToTheFlag(page, { stickMan, flag }) {
  if (await page.evaluate(() => window.__game.flag().reached)) return;
  const key = flag.at.x > stickMan.feet.x ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(key);
  await untilTheSim(page, 'the flag to be reached', (api) => api.flag().reached);
  await page.keyboard.up(key);
}
