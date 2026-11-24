/**
 * The game as it was before this ticket, for the "before" half of every before and after: the same moments the
 * other scripts capture, played the same way against the unchanged code, with the numbers the UX review reported
 * measured again. The unchanged code is the checkout of the branch this one starts from (`15-ux-review`, PR #16),
 * which `BEFORE_CHECKOUT` points at; left unset it is the worktree next to this one.
 *
 * Its checks pin what "before" was, so the other scripts' checks are known to be about something that changed.
 */
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { CLIMB_THAT_CROSSES, carryTheAirplaneToTheEdge, fly, gapOf, readTheLetter, round, verify } from './play.mjs';

const BEFORE_CHECKOUT = process.env.BEFORE_CHECKOUT ?? path.resolve(ROOT, '../15-ux-review');

await verify({ name: '00-before', port: 5916, cwd: BEFORE_CHECKOUT }, async ({ size, open, expect }) => {
  const report = {};
  const folder = `before/${size.name}`;

  // A and B: the first frame, the end of level 1 and the start of level 2.
  let game = await open({ level: 1, proofFolder: folder });
  await game.seconds(1.5);
  await game.shot('b-level-1-after-a-moment');
  const playLevel1 = async () => {
    await game.holdUntil('ArrowRight', (state) => state.flag.reached);
    const cheered = await game.until((state) => state.level === 2);
    return cheered;
  };
  let pauseFrames;
  if (size.name === 'wide') {
    await game.clip('a-level-1-ends-level-2-starts', async () => {
      await game.walkRightTo(8);
      pauseFrames = await playLevel1();
      await game.seconds(1.5);
    });
  } else {
    pauseFrames = await playLevel1();
    await game.seconds(1.5);
  }
  report.secondsFromFlagToNextLevel = round(pauseFrames / 60);
  expect('before: the next level starts two seconds after the flag, in one frame', Math.abs(pauseFrames / 60 - 2) < 0.1, `${report.secondsFromFlagToNextLevel} s`);
  await game.shot('a-level-2-a-moment-in');
  await game.close();

  game = await open({ level: 1, proofFolder: folder });
  await game.holdUntil('ArrowRight', (state) => state.flag.reached);
  await game.until((state) => state.flag.raised === 1);
  await game.seconds(1.3);
  await game.shot('a-level-1-last-frame');
  await game.frames(8);
  await game.shot('a-level-2-first-frame');
  await game.close();

  // C and E: level 3 from the edge, and what a lost flight costs.
  game = await open({ level: 3, proofFolder: folder });
  const level = await game.levelData();
  const gap = gapOf(level);
  await readTheLetter(game);
  await game.shot('e-reading-the-letter');
  await game.tap('k');
  await game.seconds(0.3);
  const afterReading = await game.state();
  await game.shot('e-letter-put-away');
  expect('before: a letter he has read is gone from the floor', afterReading.letter === null);
  await game.tap('k');
  expect('before: the first press after putting it away reads nothing', (await game.state()).letter === null);
  // That press did nothing, so the presses of the way to the edge follow as they would have: fold, set down, lift.
  for (const key of ['j', 'j', 'k']) await game.tap(key);
  await game.seconds(0.3);
  await game.walkRightTo(gap.from - 3);
  await game.shot('c-carrying');
  let onTheEdge = false;
  for (let short = 1.5; short > 0.6 && !onTheEdge; short -= 0.1) {
    await game.walkRightTo(gap.from - short);
    await game.tap('k');
    onTheEdge = Boolean((await game.state()).airplane?.onAnEdge);
    if (!onTheEdge) await game.tap('k');
  }
  await game.seconds(1);
  const atTheEdge = await game.state();
  const seenRight = (await game.onScreen({ x: gap.to, y: 0 })).x;
  report.farSideAtTheEdge = { atPixel: round(seenRight, 0), windowWidth: size.width };
  await game.shot('c-at-the-edge-before-boarding');
  expect('before: from the edge of level 3 the far side is not in view', onTheEdge && seenRight > size.width, `the far side begins at pixel ${round(seenRight, 0)} of ${size.width}`);
  report.metresAcross = round(size.width / ((await game.onScreen({ x: 1, y: 0 })).x - (await game.onScreen({ x: 0, y: 0 })).x));
  expect('before: he is in the middle of the view', Math.abs((await game.onScreen(atTheEdge.stickMan.feet)).x - size.width / 2) < 2);

  await fly(game, 0);
  await game.until((state) => state.stickMan.feet.x < gap.from && state.stickMan.action === 'standing' && state.airplane === null);
  await game.frames(2);
  const restarted = await game.state();
  await game.shot('e-level-starts-again-after-a-lost-flight');
  expect('before: after a lost flight the level starts again with an empty slot', restarted.itemSlots[0].itemDefId === null && restarted.itemUse === null);
  const waited = await game.until((state) => state.letter !== null && state.letter.height === 0, 600);
  report.secondsWaitingForANewLetter = round(waited / 60);
  await game.shot('e-the-new-letter-has-landed');
  expect('before: he waits for a new letter to fall before he can do anything', waited / 60 > 2, `${report.secondsWaitingForANewLetter} s`);

  // G: the end.
  await readTheLetter(game);
  await carryTheAirplaneToTheEdge(game);
  await fly(game, CLIMB_THAT_CROSSES);
  await game.holdUntil('ArrowRight', (state) => state.flag.reached);
  await game.until((state) => state.flag.raised === 1);
  await game.seconds(0.3);
  await game.shot('g-the-end-as-it-appears');
  await game.seconds(8);
  const longAfter = await game.state();
  const stoodAt = longAfter.stickMan.feet.x;
  for (const key of ['Enter', 'j', 'k', ' ']) await game.tap(key);
  await game.holdUntil('ArrowRight', () => false, 120);
  const afterKeys = await game.state();
  await game.shot('g-the-end-ten-seconds-later');
  expect('before: ten seconds after the end he still cheers, and no key does anything', longAfter.stickMan.action === 'cheering' && afterKeys.stickMan.action === 'cheering' && afterKeys.stickMan.feet.x === stoodAt && afterKeys.level === 3);
  const margins = (await game.inkIn({ x: 0, y: size.height * 0.15, width: 6, height: size.height * 0.25 })) + (await game.inkIn({ x: size.width - 6, y: size.height * 0.15, width: 6, height: size.height * 0.25 }));
  report.inkOfTheEndAtTheSidesOfTheWindow = margins;
  if (size.name === 'portrait') expect('before: on the portrait window the end is cut off at the sides', margins > 0, `${margins} pixels of pencil in the outermost 6 pixels`);
  await game.close();
  return report;
});
