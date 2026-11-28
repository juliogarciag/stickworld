/* global window */
/**
 * The club enemy in the real app, from the player's side: it waits at its post, comes for the
 * stick man it sees, takes its club back, swings it over the top and down, and the stick man who
 * stayed is struck down, lies there deaf to the keys, and the level starts again.
 *
 * Every expected number comes from the page: the level's data, the enemy's def and the sim's view
 * functions through `window.__game`. Pictures are taken with the game stopped on the frame they
 * show, and the whole run is recorded as a video.
 */
import { check, summarize, writeProof } from './lib.mjs';
import { YARD, openYard, readGame, takePictureWhen, waitUntil } from './game.mjs';

/**
 * A port no other session uses, and not the one of the dev server left running for the human.
 */
const PORT = 5943;
const results = [];
const report = {};
let game;
try {
  game = await openYard(PORT);
  const { page } = game;

  const start = await readGame(page);
  const post = start.level.enemies[0].position;
  const def = start.enemyDef;
  results.push(
    check(
      'VITE_LEVEL=900 starts on the practice yard, which has one enemy',
      start.level.id === YARD && start.enemies.length === start.level.enemies.length,
      `level ${start.level.id} "${start.level.name}", ${start.enemies.length} enemy`,
    ),
    check(
      'the enemy waits at the post the level gives it, floating over the floor by what its def says',
      start.enemy.position.x === post.x &&
        Math.abs(start.enemy.position.y - (post.y - def.floatHeight)) < 1e-9 &&
        start.enemy.action === 'waiting',
      `at (${start.enemy.position.x}, ${start.enemy.position.y}), ${start.enemy.action}`,
    ),
    check(
      'it is a kind of enemy from the defs, with every number of how it fights',
      def.name === 'club enemy' &&
        [def.sightDistance, def.speed, def.swingDistance, def.windUpSeconds, def.swingSeconds].every(
          (value) => typeof value === 'number' && value > 0,
        ),
      `def ${def.id} "${def.name}"`,
    ),
  );

  // Walk at it, as a player would: with the right arrow held.
  await page.keyboard.down('ArrowRight');
  await waitUntil(page, () => window.__game.getEnemies()[0].action === 'approaching');
  const seen = await readGame(page);
  const seenFrom = seen.enemy.position.x - seen.stickMan.feet.x;
  results.push(
    check(
      'it sees the stick man from its sight distance, turns to it and comes towards it',
      Math.abs(seenFrom - def.sightDistance) < 0.3 && seen.enemy.facing === -1,
      `seen from ${seenFrom.toFixed(2)} m, sight distance ${def.sightDistance} m`,
    ),
  );
  const approaching = await takePictureWhen(
    page,
    '01-it-comes-for-the-stick-man.png',
    (post) => window.__game.getEnemies()[0].position.x < post - 1,
    post.x,
  );
  results.push(
    check(
      'it moves along the floor inside the stretch it guards',
      approaching.enemy.position.x < post.x &&
        approaching.enemy.position.x >= approaching.enemy.guardedStretch.start &&
        approaching.enemy.action === 'approaching',
      `at ${approaching.enemy.position.x.toFixed(2)}, guards ${approaching.enemy.guardedStretch.start} to ${approaching.enemy.guardedStretch.end}`,
    ),
  );

  const woundUp = await takePictureWhen(page, '02-the-club-goes-back.png', () => {
    const enemy = window.__game.getEnemies()[0];
    // Early in the wind-up: taking a picture costs a few frames, and the next one is of the blow.
    return enemy.action === 'windingUp' && enemy.progress > 0.25;
  });
  // How far in front of its shoulder the end of the club is, the way it faces.
  const getClubForward = (enemy) => (enemy.club.tip.x - enemy.club.shoulder.x) * enemy.facing;
  results.push(
    check(
      'it winds up before it swings: the club is on its way back from where it holds it, and the stick man is not hurt yet',
      getClubForward(woundUp.enemy) < getClubForward(start.enemy) - 0.3 &&
        woundUp.enemy.club.tip.y < woundUp.enemy.club.shoulder.y &&
        woundUp.stickMan.action !== 'struck',
      `club end ${getClubForward(start.enemy).toFixed(2)} m in front of its shoulder at rest, ${getClubForward(woundUp.enemy).toFixed(2)} m now, ${Math.round(woundUp.enemy.progress * 100)}% through the wind-up; stick man ${woundUp.stickMan.action}`,
    ),
  );

  // The swing is eleven ticks long and strikes within a few: the picture is of the tick it does.
  const struck = await takePictureWhen(
    page,
    '03-struck-by-the-swing.png',
    () => window.__game.getStickMan().action === 'struck',
  );
  await page.keyboard.up('ArrowRight');
  results.push(
    check(
      'the club strikes the stick man who stayed in its reach: struck down during the swing, knocked away from the enemy',
      struck.stickMan.action === 'struck' &&
        struck.stickMan.struckFor < 0.05 &&
        struck.enemy.action === 'swinging' &&
        struck.stickMan.struckDirection === Math.sign(struck.stickMan.feet.x - struck.enemy.position.x),
      `struck ${Math.abs(struck.stickMan.feet.x - struck.enemy.position.x).toFixed(2)} m from its middle, ${Math.round(struck.enemy.progress * 100)}% through the swing, the club ${(struck.enemy.position.y - struck.enemy.height - struck.enemy.club.tip.y).toFixed(2)} m above its top`,
    ),
    check(
      'struck down, neither action key would do anything',
      struck.itemUse === null && struck.interaction === null,
      `J: ${struck.itemUse}, K: ${struck.interaction}`,
    ),
  );

  // Every key a player has, pressed while the stick man is down.
  await page.keyboard.down('ArrowLeft');
  for (const key of ['Space', 'KeyJ', 'KeyK', 'Digit1']) {
    await page.keyboard.press(key);
  }
  const lying = await takePictureWhen(
    page,
    '05-lying-where-it-fell.png',
    () => window.__game.getStickMan().struckFor > 0.7,
  );
  await page.keyboard.up('ArrowLeft');
  results.push(
    check(
      'the stick man lies where it was struck whatever is pressed',
      lying.stickMan.action === 'struck' &&
        lying.stickMan.feet.x === struck.stickMan.feet.x &&
        lying.stickMan.feet.y === struck.stickMan.feet.y,
      `at ${lying.stickMan.feet.x.toFixed(2)} for ${lying.stickMan.struckFor.toFixed(2)} s`,
    ),
  );

  await waitUntil(page, () => window.__game.getStickMan().action !== 'struck');
  const again = await readGame(page);
  const lainFor = (again.tick - struck.tick) * again.dt;
  results.push(
    check(
      'after a pause the level starts again: the stick man at the start, the enemy back at its post',
      again.level.id === YARD &&
        Math.abs(again.stickMan.feet.x - again.level.start.x) < 0.2 &&
        again.stickMan.struckFor === null &&
        again.enemy.position.x === post.x &&
        again.enemy.action === 'waiting',
      `stick man at ${again.stickMan.feet.x.toFixed(2)}, enemy at ${again.enemy.position.x}`,
    ),
    check(
      'the pause is long enough to see what happened and short enough to try again at once',
      lainFor > 0.8 && lainFor < 2.5,
      `${lainFor.toFixed(2)} s from the blow to the new start`,
    ),
  );

  // Once more, for a picture of the stick man on its way down: taking a picture costs a few
  // frames, so this one cannot follow the picture of the blow itself.
  await page.keyboard.down('ArrowRight');
  const goingDown = await takePictureWhen(
    page,
    '04-going-down.png',
    () => (window.__game.getStickMan().struckFor ?? 0) > 0.13,
  );
  await page.keyboard.up('ArrowRight');
  results.push(
    check(
      'walking in again is struck down again: the stick man goes over, away from the enemy',
      goingDown.stickMan.action === 'struck' && goingDown.stickMan.struckFor < 0.3,
      `${goingDown.stickMan.struckFor.toFixed(2)} s after the blow`,
    ),
  );

  await page.waitForTimeout(600);
  results.push(check('no page errors', game.pageErrors.length === 0, game.pageErrors.join(' | ')));
  Object.assign(report, { def, start, seen, woundUp, struck, goingDown, lying, again });
} catch (error) {
  results.push(check(`run completed (${error.message})`, false));
} finally {
  await game?.close('01-the-swing.webm');
}

report.results = results;
writeProof('01-the-enemy-swings-and-strikes.json', report);
process.exit(summarize(results) ? 0 : 1);
