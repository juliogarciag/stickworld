/**
 * A. Turn the page between levels.
 *
 * Level 1 is played to its flag with real keys. Checked: the pause after the flag is about a second and no longer
 * two; the finished sheet then slides off to the left over most of a second, never back, with the next level
 * already under it; the new sheet has its number and name written above him, rubbed out a few seconds later; a
 * page number is in the bottom right corner on both levels. Screenshots of each moment, and a clip at the wide window.
 */
import { ROOT } from './lib.mjs';
import { round, verify } from './play.mjs';

await verify({ name: '01-a-page-turn', port: 5917, cwd: ROOT }, async ({ size, open, expect }) => {
  const report = {};
  const folder = `after/${size.name}`;
  const game = await open({ level: 1, proofFolder: folder });
  const corner = { x: size.width * 0.8, y: size.height * 0.85, width: size.width * 0.2, height: size.height * 0.15 };

  await game.seconds(2);
  expect('level 1 has a page number in the bottom right corner', (await game.inkIn(corner)) > 20, `${await game.inkIn(corner)} pixels of pencil`);

  const play = async () => {
    await game.holdUntil('ArrowRight', (state) => state.flag.reached);
    const cheered = await game.until((state) => state.level === 2);
    report.secondsFromFlagToNextLevel = round(cheered / 60);
    expect('the next level starts about a second after the flag: the dead part of the pause is gone', cheered / 60 > 0.9 && cheered / 60 < 1.3, `${report.secondsFromFlagToNextLevel} s, where it was 2`);

    // The turn, frame by frame.
    const edges = [];
    let levelDuringTheTurn = 2;
    for (let frame = 0; frame < 120; frame += 1) {
      const state = await game.state();
      if (!state.pageTurn) break;
      edges.push(state.pageTurn.edgeAt);
      if (state.level !== 2) levelDuringTheTurn = state.level;
      if (edges.length === 28) report.midTurnShot = await game.shot('a-the-page-being-turned');
      if (edges.length === 42) await game.shot('a-the-page-almost-gone');
      await game.frames(1);
    }
    report.turnSeconds = round(edges.length / 60);
    report.edgeAtEveryTenthFrame = edges.filter((_, frame) => frame % 10 === 0).map((edge) => round(edge));
    expect('the finished sheet is turned away over most of a second, not cut', edges.length >= 40 && edges.length <= 70, `${edges.length} frames`);
    expect('it covers the whole view as the turn starts', edges[0] > 0.99, `its edge is at ${round(edges[0], 3)} of the width`);
    expect('it only ever moves left, slowly at first, and ends out of view', edges.every((edge, frame) => frame === 0 || edge < edges[frame - 1]) && edges[5] > 0.95 && edges[edges.length - 1] < 0.15, `edge after 5 frames ${round(edges[5], 3)}, last ${round(edges[edges.length - 1], 3)}`);
    expect('the next level is already being played under it', levelDuringTheTurn === 2);
    await game.seconds(1.2);
  };
  if (size.name === 'wide') {
    await game.shot('a-level-1-before-the-flag');
    report.clip = await game.clip('a-level-1-ends-the-page-turns', async () => {
      await game.walkRightTo(8);
      await play();
      await game.seconds(1);
    });
  } else {
    await play();
    await game.seconds(1);
  }

  // The new sheet: its number and name above where he starts, for a few seconds.
  const level = await game.levelData();
  const title = await game.regionOf({ left: level.start.x - 3, right: level.start.x + 3, top: -4.6, bottom: -3.7 });
  const written = await game.inkIn(title);
  await game.shot('a-level-2-with-its-name');
  expect('the new sheet has its number and name written above him', written > 150, `${written} pixels of pencil where "2. A GAP" is`);
  expect('level 2 has its page number in the corner too', (await game.inkIn(corner)) > 20);
  await game.seconds(3.5);
  const rubbedOut = await game.inkIn(await game.regionOf({ left: level.start.x - 3, right: level.start.x + 3, top: -4.6, bottom: -3.7 }));
  await game.shot('a-level-2-name-rubbed-out');
  expect('the name is rubbed out a few seconds later, and the page number stays', rubbedOut === 0 && (await game.inkIn(corner)) > 20, `${rubbedOut} pixels of pencil left of the name`);
  report.inkOfTheLevelName = { written, rubbedOut };
  await game.close();
  return report;
});
