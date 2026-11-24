/* global window */
/**
 * E. Try again without the chores.
 *
 * Level 3 with real keys. Checked: once he has an airplane, the outline of one is drawn on the ground at the edge,
 * where it is boarded from, until he has boarded once. Also: the letter he has read is gone once he puts it away, since what it taught he
 * knows for good; after a flight that is lost the level starts again with the airplane in his hand at once, no letter falls, and the retry
 * is a walk and two presses; and when he loses the airplane without dying, with nothing left, a sheet of paper
 * falls from the sky to where he stands, in view, and one press picks it up.
 */
import { ROOT } from './lib.mjs';
import { fly, gapOf, putTheCarriedAirplaneOnTheEdge, readTheLetter, round, verify } from './play.mjs';

/** The outline as small as the portrait window draws it, with the view pulled back, is this many pixels of pencil at the least; bare ground is none. */
const LEAST_INK_OF_THE_OUTLINE = 5;

await verify({ name: '04-e-retry', port: 5917, cwd: ROOT }, async ({ size, open, expect }) => {
  const report = {};
  const folder = `after/${size.name}`;
  const game = await open({ level: 3, proofFolder: folder });
  const gap = gapOf(await game.levelData());
  // By name, from the game's own defs. The recipe is named after what it makes, so the item is the first of that name: items have the lower ids.
  const names = Object.fromEntries((await game.page.evaluate(() => window.__game.defs)).sort((one, other) => other.id - one.id).map((def) => [def.name, def.id]));

  // The letter is read once.
  await readTheLetter(game);
  await game.shot('e-reading-the-letter');
  await game.tap('k');
  await game.seconds(0.3);
  const putAway = await game.state();
  await game.shot('e-letter-put-away');
  expect('a letter he has read is gone once he puts it away, and what it taught stays: J would fold', putAway.letter === null && putAway.interaction === null && putAway.itemUse === 'craft' && putAway.itemSlots[0].itemDefId === names.paper);

  // The first flight, with no key held: lost.
  // The helper's first press is the one that puts the letter away, which is done: fold, set down and lift follow here.
  const beforeTheFold = await game.state();
  await game.tap('j');
  const folded = await game.state();
  for (const key of ['j', 'k']) await game.tap(key);
  await game.seconds(0.3);

  // Where it goes: a dotted outline of the airplane on the ground at the edge, from the moment he has one. Seen as he carries it there.
  await game.walkRightTo(gap.from - 3);
  await game.seconds(1.2);
  const carrying = await game.state();
  const outlineOf = (spot) => game.regionOf({ left: spot.at.x - spot.length / 2 - 0.05, right: spot.at.x + spot.length / 2 + 0.05, top: -spot.height - 0.06, bottom: -0.05 });
  const whereItGoes = carrying.boardingSpot;
  const inkOfTheOutline = whereItGoes ? await game.inkIn(await outlineOf(whereItGoes)) : 0;
  await game.shot('e-the-outline-of-where-the-airplane-goes');
  report.outline = { at: whereItGoes?.at ?? null, edge: gap.from, ink: inkOfTheOutline };
  expect('nothing shows where an airplane goes until he has one', beforeTheFold.boardingSpot === null && folded.boardingSpot !== null);
  expect('once he has one, its outline is drawn on the ground at the edge of the gap, nose out over it', whereItGoes && whereItGoes.at.x < gap.from && whereItGoes.at.x + whereItGoes.length / 2 > gap.from && inkOfTheOutline > LEAST_INK_OF_THE_OUTLINE, `at ${round(whereItGoes?.at.x ?? 0)} m, the edge is at ${gap.from} m; ${inkOfTheOutline} pixels of pencil there`);
  const carried = await putTheCarriedAirplaneOnTheEdge(game);
  const onTheEdge = await game.state();
  expect('put down in the outline it sits on the edge, K boards it, and the outline has nothing left to show', carried && onTheEdge.interaction === 'board' && onTheEdge.boardingSpot === null && Math.abs(onTheEdge.airplane.at.x - whereItGoes.at.x) < 0.6, `the airplane's middle is at ${round(onTheEdge.airplane.at.x)} m`);
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
  const noLetterFell = await game.state();
  await game.seconds(1);
  const inkWhereTheOutlineWas = await game.inkIn(await outlineOf(whereItGoes));
  expect('he has boarded once: on the retry no outline is drawn, he knows where it goes', noLetterFell.boardingSpot === null && inkWhereTheOutlineWas === 0, `${inkWhereTheOutlineWas} pixels of pencil where it was`);
  await game.tap('j');
  const setDown = await game.state();
  await game.shot('e-retry-airplane-set-down-on-the-edge');
  await game.tap('k');
  const seated = await game.state();
  report.retry = { presses: 2, seconds: round((seated.tick - retryStartedAt) / 60), walkedMetres: round(edgeSpot - restarted.stickMan.feet.x) };
  expect('a retry is walk, set down, board: two presses', setDown.airplane?.onAnEdge && setDown.interaction === 'board' && seated.stickMan.action === 'seated', `${report.retry.seconds} s from the restart to the seat, ${report.retry.walkedMetres} m of it walking`);
  expect('nothing fell, and no letter lies there: he has nothing to read again', noLetterFell.letter === null && noLetterFell.fallenItem === null);
  await game.until((state) => state.stickMan.action !== 'seated');
  await game.until((state) => state.stickMan.feet.x < gap.from && state.stickMan.action === 'standing' && state.airplane === null);

  // Losing it without dying: set down too far past the edge, it falls into the gap. Now he has nothing, and a sheet of paper falls.
  await game.walkRightTo(gap.from - 0.2);
  await game.tap('j');
  await game.until((state) => state.airplane === null);
  const withNothing = await game.state();
  expect('an airplane set down past the edge is lost, and he is left with nothing', withNothing.itemSlots[0].itemDefId === null && withNothing.stickMan.feet.x > gap.from - 1);
  const fallsAfter = await game.until((state) => state.fallenItem !== null, 300);
  await game.seconds(1);
  const falling = await game.state();
  await game.shot('e-a-sheet-of-paper-falls-for-him-who-has-nothing');
  await game.until((state) => state.fallenItem.height === 0, 600);
  const landed = await game.state();
  expect('with neither paper nor airplane a sheet of paper falls from the sky, and no letter', fallsAfter >= 0 && falling.fallenItem.height > 0 && falling.fallenItem.itemDefId === names.paper && landed.letter === null, `it started ${round(fallsAfter / 60)} s after the airplane was lost`);
  const landedOnScreen = await game.onScreen(landed.fallenItem.at);
  expect('it comes down where he stands, in view, and can be picked up without a step', Math.abs(landed.fallenItem.at.x - landed.stickMan.feet.x) < 0.01 && landedOnScreen.x > 0 && landedOnScreen.x < size.width && landed.interaction === 'pickUp', `at ${round(landed.fallenItem.at.x)} m, he stands at ${round(landed.stickMan.feet.x)} m; pixel ${Math.round(landedOnScreen.x)} of ${size.width}`);
  // A step aside, so that the sheet is not behind his legs when it is measured.
  await game.holdUntil('ArrowLeft', (state) => state.stickMan.feet.x < landed.fallenItem.at.x - 0.6);
  // It lies on the floor, drawn: pencil where it is, between his feet and his knees.
  const where = await game.regionOf({ left: landed.fallenItem.at.x - 0.4, right: landed.fallenItem.at.x + 0.5, top: -0.35, bottom: -0.04 });
  const inkOfTheSheet = await game.inkIn(where);
  await game.shot('e-the-sheet-of-paper-on-the-floor');
  await game.tap('k');
  const given = await game.state();
  report.fallenPaper = { fellAfterSeconds: round(fallsAfter / 60), inkOnTheFloor: inkOfTheSheet };
  expect('it lies there, drawn, and one press picks it up into his hand: nothing is read', inkOfTheSheet > 15 && given.fallenItem === null && given.letter === null && given.itemSlots[0].itemDefId === names.paper && given.itemSlots[0].selected && given.itemUse === 'craft', `${inkOfTheSheet} pixels of pencil where it lay; J would "${given.itemUse}"`);
  await game.close();
  return report;
});
