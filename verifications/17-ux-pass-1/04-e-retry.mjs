/* global window */
/**
 * E. Try again without the chores.
 *
 * Level 3 with real keys. Checked: the letter he has read stays on the floor, opened, and can be read again; after a
 * flight that is lost the level starts again with the airplane in his hand at once, no letter falls, and the retry
 * is a walk and two presses; and when he loses the airplane without dying, with nothing left, a new letter still
 * falls and reading it gives the paper.
 */
import { ROOT } from './lib.mjs';
import { carryTheAirplaneToTheEdge, fly, gapOf, readTheLetter, round, verify } from './play.mjs';

await verify({ name: '04-e-retry', port: 5917, cwd: ROOT }, async ({ size, open, expect }) => {
  const report = {};
  const folder = `after/${size.name}`;
  const game = await open({ level: 3, proofFolder: folder });
  const gap = gapOf(await game.levelData());
  // By name, from the game's own defs. The recipe is named after what it makes, so the item is the first of that name: items have the lower ids.
  const names = Object.fromEntries((await game.page.evaluate(() => window.__game.defs)).sort((one, other) => other.id - one.id).map((def) => [def.name, def.id]));

  // The letter stays.
  await readTheLetter(game);
  await game.shot('e-reading-the-letter');
  await game.tap('k');
  await game.seconds(0.3);
  const putAway = await game.state();
  await game.shot('e-letter-put-away');
  expect('a letter he has read stays on the floor, opened', putAway.letter !== null && putAway.letter.opened && !putAway.letter.beingRead && putAway.letter.height === 0);
  expect('K next to it reads it again', putAway.interaction === 'read');
  await game.tap('k');
  const readAgain = await game.state();
  expect('read again, it says the same and gives nothing more', readAgain.letter.beingRead && readAgain.itemSlots[0].itemDefId === names.paper);

  // The first flight, with no key held: lost.
  const carried = await carryTheAirplaneToTheEdge(game);
  const edgeSpot = (await game.state()).stickMan.feet.x;
  await game.seconds(0.5);
  await fly(game, 0);
  await game.until((state) => state.stickMan.feet.x < gap.from && state.stickMan.action === 'standing' && state.airplane === null);
  await game.frames(2);
  const restarted = await game.state();
  await game.shot('e-level-starts-again-after-a-lost-flight');
  expect('the first flight was flown from the edge and lost', carried && restarted.stickMan.feet.x < gap.from - 5);
  expect('the level starts again with the airplane in his hand at once', restarted.itemSlots[0].itemDefId === names['paper airplane'] && restarted.itemSlots[0].selected && restarted.itemUse === 'place', `slot 1 holds def ${restarted.itemSlots[0].itemDefId}, J would "${restarted.itemUse}"`);

  // The retry: a walk and two presses. Counted in frames from the restart to being seated again.
  const retryStartedAt = restarted.tick;
  await game.walkRightTo(edgeSpot);
  const noLetterFell = (await game.state()).letter;
  await game.tap('j');
  const setDown = await game.state();
  await game.shot('e-retry-airplane-set-down-on-the-edge');
  await game.tap('k');
  const seated = await game.state();
  report.retry = { presses: 2, seconds: round((seated.tick - retryStartedAt) / 60), walkedMetres: round(edgeSpot - restarted.stickMan.feet.x) };
  expect('a retry is walk, set down, board: two presses', setDown.airplane?.onAnEdge && setDown.interaction === 'board' && seated.stickMan.action === 'seated', `${report.retry.seconds} s from the restart to the seat, ${report.retry.walkedMetres} m of it walking`);
  expect('no new letter fell: the opened one lay there all the while', noLetterFell.opened && noLetterFell.height === 0);
  await game.until((state) => state.stickMan.action !== 'seated');
  await game.until((state) => state.stickMan.feet.x < gap.from && state.stickMan.action === 'standing' && state.airplane === null);

  // Losing it without dying: set down too far past the edge, it falls into the gap. Now he has nothing, and a letter falls.
  await game.walkRightTo(gap.from - 0.2);
  await game.tap('j');
  await game.until((state) => state.airplane === null);
  const withNothing = await game.state();
  expect('an airplane set down past the edge is lost, and he is left with nothing', withNothing.itemSlots[0].itemDefId === null && withNothing.stickMan.feet.x > gap.from - 1);
  const fallsAfter = await game.until((state) => state.letter.height > 0, 300);
  await game.seconds(1);
  const falling = await game.state();
  await game.shot('e-a-new-letter-falls-for-him-who-has-nothing');
  await game.until((state) => state.letter.height === 0, 600);
  const landed = await game.state();
  expect('with neither paper nor airplane a new letter still falls, not opened', fallsAfter >= 0 && falling.letter.height > 0 && !landed.letter.opened, `it started ${round(fallsAfter / 60)} s after the airplane was lost`);
  await game.holdUntil('ArrowLeft', (state) => state.interaction === 'read');
  await game.tap('k');
  const given = await game.state();
  expect('reading it gives the paper again', given.letter.beingRead && given.itemSlots[0].itemDefId === names.paper && given.itemSlots[0].selected);
  await game.close();
  return report;
});
