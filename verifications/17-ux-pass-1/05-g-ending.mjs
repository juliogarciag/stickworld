/* global window */
/**
 * G. An ending you can leave.
 *
 * Level 3 is finished with real keys. Checked: "THE END" is written a stroke at a time, more of it on every later
 * frame, and fits inside the window with room at both sides; a little later a key and "PLAY AGAIN" are under it and
 * he stops cheering; he walks about and cannot walk off the paper; Enter before that is offered does nothing, and
 * once it is, turns the page back to level 1 with nothing kept. A clip at the portrait window, where the end did not fit.
 */
import { ROOT } from './lib.mjs';
import { CLIMB_THAT_CROSSES, carryTheAirplaneToTheEdge, fly, readTheLetter, round, verify } from './play.mjs';

await verify({ name: '05-g-ending', port: 5917, cwd: ROOT }, async ({ size, open, expect }) => {
  const report = {};
  const folder = `after/${size.name}`;
  const game = await open({ level: 3, proofFolder: folder });
  const level = await game.levelData();
  await readTheLetter(game);
  await carryTheAirplaneToTheEdge(game);
  await fly(game, CLIMB_THAT_CROSSES);
  await game.walkRightTo((await game.state()).flag.at.x - 1.5);

  /**
   * The band of the window the end is written in, words and prompt: from under the item slot down to above his raised
   * arms and the flag, at every window. And the outermost part of it at both sides, outside of where the item slot is.
   */
  const band = { y: size.height * 0.15, height: size.height * 0.33 };
  const written = () => game.inkIn({ x: 0, width: size.width, ...band });
  const atTheSides = async () => (await game.inkIn({ x: 0, width: size.width * 0.02, ...band })) + (await game.inkIn({ x: size.width * 0.98, width: size.width * 0.02, ...band }));

  const play = async () => {
    await game.holdUntil('ArrowRight', (state) => state.flag.reached);
    await game.until((state) => state.flag.raised === 1);
    const inkBeforeTheWords = await written();

    // Written a stroke at a time: the pencil in the band of the words, every fifth of a second.
    const inkOverTime = [];
    for (let sample = 0; sample < 7; sample += 1) {
      await game.frames(12);
      inkOverTime.push((await written()) - inkBeforeTheWords);
      if (sample === 2) await game.shot('g-the-end-being-written');
    }
    report.inkOfTheEndEveryFifthOfASecond = inkOverTime;
    expect('"THE END" is written a stroke at a time: more of it on every later frame, until it is all there', inkOverTime[0] > 0 && inkOverTime.slice(0, 5).every((ink, sample) => sample === 0 || ink > inkOverTime[sample - 1] * 1.05) && inkOverTime[2] < inkOverTime[6] * 0.7, inkOverTime.join(', '));

    const inkOfTheWords = (await written()) - inkBeforeTheWords;
    await game.tap('Enter');
    const tooEarly = await game.state();
    expect('Enter does nothing before playing again is offered', tooEarly.level === 3 && tooEarly.ending.over && !tooEarly.ending.playingAgainOffered && tooEarly.stickMan.action === 'cheering');

    const offeredAfter = await game.until((state) => state.ending.playingAgainOffered, 300);
    const justBefore = (await written()) - inkBeforeTheWords;
    await game.seconds(0.4);
    const offered = await game.state();
    const sides = await atTheSides();
    // What is written once playing again is offered, less the words: the key and "PLAY AGAIN". The lines boil, so the same words are a few pixels more or less from frame to frame.
    const promptInk = (await written()) - inkBeforeTheWords - inkOfTheWords;
    report.theEnd = { inkOfTheWords, inkAtTheSides: sides, promptInk, secondsAfterTheFlag: round((offered.tick - (await flagReachedTick(game))) / 60) };
    await game.shot('g-the-end-with-play-again');
    expect('nothing but the words is written until playing again is offered', Math.abs(justBefore - inkOfTheWords) < 80, `${justBefore} pixels of pencil against ${inkOfTheWords} when the words were finished`);
    expect('the words fit the window: nothing of them reaches its sides', sides === 0 && inkOfTheWords > 500, `${inkOfTheWords} pixels of pencil, ${sides} of them in the outermost 2% of the window at either side`);
    expect('a little later a key and "PLAY AGAIN" are written under them', offeredAfter >= 0 && promptInk > 150, `${promptInk} more pixels of pencil, ${report.theEnd.secondsAfterTheFlag} s after the flag`);
    expect('he is not frozen in a cheer: he stands', offered.stickMan.action === 'standing');

    // He walks about, and the end of the paper stops him.
    const endOfThePaper = level.floor[level.floor.length - 1].to.x;
    await game.holdUntil('ArrowRight', () => false, 150);
    const walked = await game.state();
    await game.holdUntil('ArrowRight', () => false, 240);
    const atTheEnd = await game.state();
    await game.shot('g-walking-about-after-the-end');
    expect('he walks about under the words', walked.stickMan.feet.x > offered.stickMan.feet.x + 1);
    expect('he cannot walk off the paper after the end', atTheEnd.level === 3 && atTheEnd.stickMan.feet.y === 0 && atTheEnd.stickMan.feet.x < endOfThePaper && atTheEnd.stickMan.feet.x > endOfThePaper - 1 && atTheEnd.flag.reached, `he stands at ${round(atTheEnd.stickMan.feet.x)} m; the paper ends at ${endOfThePaper} m`);

    // Enter turns back to the first sheet.
    await game.tap('Enter');
    const turning = await game.state();
    await game.frames(22);
    await game.shot('g-the-page-turns-back-to-level-1');
    await game.until((state) => state.pageTurn === null, 200);
    await game.seconds(1.2);
    const again = await game.state();
    await game.shot('g-level-1-again');
    expect('Enter turns the page back to the first sheet', turning.level === 1 && turning.pageTurn !== null && again.level === 1 && again.stickMan.action === 'standing');
    expect('nothing is kept from the game before', again.itemSlots[0].itemDefId === null && !again.ending.over && again.notes.every((note) => note.rubbedOutFor === null));
    await game.holdUntil('ArrowRight', () => false, 60);
    expect('and it is played: he walks on level 1', (await game.state()).stickMan.feet.x > again.stickMan.feet.x + 1);
  };
  if (size.name === 'portrait') report.clip = await game.clip('g-the-end-and-play-again', play);
  else await play();
  await game.close();
  return report;
});

// ---- Helpers ----

/** The tick the flag was reached on, from how long it has been up and how long it takes to go up. */
async function flagReachedTick(game) {
  return game.page.evaluate(() => {
    const api = window.__game;
    const raiseSeconds = api.defs.find((def) => def.name === 'flag').raiseSeconds;
    return api.sim.tick - Math.round((api.flag().upFor + raiseSeconds) / api.sim.dt);
  });
}
