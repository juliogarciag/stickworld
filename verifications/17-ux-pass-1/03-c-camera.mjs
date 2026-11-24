/**
 * C. See where you are going.
 *
 * Level 3 is played from its start to the far side with real keys, and the level's camera is read on every frame.
 * Checked: the view never shows less than twelve metres across; he is in the middle of it while he walks along the
 * line; carrying the airplane, at the edge and in flight he is to one side of it with more of the level ahead of him
 * than behind; from the edge, before he boards, the far side is in view; the view never jumps, it eases (the frames
 * from the letter to the landing are all watched, so no level starts among them); after the
 * landing it eases back; and the HUD is the same size all the while. A clip of the carry and the flight at the
 * narrow window, where the view pulls back most.
 */
import { ROOT } from './lib.mjs';
import { CLIMB_THAT_CROSSES, carryTheAirplaneToTheEdge, gapOf, readTheLetter, round, verify } from './play.mjs';

/** The least the view may show across, in metres: the ticket's "about twelve". */
const LEAST_METRES_ACROSS = 12;

await verify({ name: '03-c-camera', port: 5917, cwd: ROOT }, async ({ size, open, expect }) => {
  const report = {};
  const folder = `after/${size.name}`;
  const game = await open({ level: 3, proofFolder: folder });
  const gap = gapOf(await game.levelData());

  // Every frame from here on is watched: how wide the view is, where he is in it, and how far it moved.
  const watched = { narrowest: Infinity, widest: 0, biggestJump: 0, hudZooms: new Set(), slotBoxes: new Set(), previous: undefined };
  const framesOf = game.frames;
  game.frames = async (count) => {
    for (let frame = 0; frame < count; frame += 1) {
      await framesOf(1);
      const { levelInView: view, hudCamera, itemSlots } = await game.state();
      const across = view.right - view.left;
      watched.narrowest = Math.min(watched.narrowest, across);
      watched.widest = Math.max(watched.widest, across);
      const middle = (view.left + view.right) / 2;
      if (watched.previous !== undefined) watched.biggestJump = Math.max(watched.biggestJump, Math.abs(middle - watched.previous.middle), Math.abs(across - watched.previous.across));
      watched.previous = { middle, across };
      watched.hudZooms.add(round(hudCamera.zoom, 6));
      watched.slotBoxes.add(JSON.stringify(Object.values(itemSlots[0].onPage).map((number) => round(number, 3))));
    }
  };
  /** Where he is across the view, from 0 at its left side to 1 at its right. */
  const whereHeIs = ({ levelInView: view, stickMan }) => (stickMan.feet.x - view.left) / (view.right - view.left);

  await game.seconds(1);
  const atTheStart = await game.state();
  report.metresAcrossAtRest = round(atTheStart.levelInView.right - atTheStart.levelInView.left);
  await game.shot('c-at-the-start');
  expect(`the view shows at least ${LEAST_METRES_ACROSS} metres across at rest`, report.metresAcrossAtRest >= LEAST_METRES_ACROSS - 0.01, `${report.metresAcrossAtRest} m`);
  expect('walking along the line, away from an edge, he is in the middle of the view', Math.abs(whereHeIs(atTheStart) - 0.5) < 0.01);
  // The item slot as it is on the screen at rest, to compare with when the level's view has pulled back.
  const slotOnPage = atTheStart.itemSlots[0].onPage;
  const slotAtRest = await game.inkIn(slotOnPage);

  await readTheLetter(game);
  const play = async () => {
    const carried = await carryTheAirplaneToTheEdge(game, async () => {
      await game.walkRightTo(gap.from - 3);
      const carrying = await game.state();
      report.carrying = { whereHeIs: round(whereHeIs(carrying)), metresAcross: round(carrying.levelInView.right - carrying.levelInView.left) };
      await game.shot('c-carrying');
      expect('carrying the airplane, more of the view is ahead of him than behind', carrying.stickMan.carrying && whereHeIs(carrying) < 0.4, `he is ${report.carrying.whereHeIs} of the way across it`);
    });
    await game.seconds(1.5);
    const atTheEdge = await game.state();
    report.atTheEdge = { view: atTheEdge.levelInView, farSideFrom: gap.to, whereHeIs: round(whereHeIs(atTheEdge)), metresAcross: round(atTheEdge.levelInView.right - atTheEdge.levelInView.left) };
    await game.shot('c-at-the-edge-before-boarding');
    report.atTheEdge.inkOfTheItemSlot = { atRest: slotAtRest, atTheEdge: await game.inkIn(slotOnPage) };
    expect('the airplane sits on the edge and K would board it', carried && atTheEdge.interaction === 'board');
    expect('at the edge he stands to one side of the view, with the gap ahead of him', whereHeIs(atTheEdge) < 0.4, `he is ${report.atTheEdge.whereHeIs} of the way across it`);
    expect('from the edge, before he boards, the far side is in view', atTheEdge.levelInView.right >= gap.to + 1 && atTheEdge.levelInView.left < atTheEdge.stickMan.feet.x, `the view is from ${round(atTheEdge.levelInView.left)} to ${round(atTheEdge.levelInView.right)} m and the far side begins at ${gap.to} m`);

    // The flight: boarding, a climb, the glide, the landing. On every frame over the gap the far side stays in view.
    let lostSightOfTheFarSide = false;
    await game.tap('k');
    await game.page.keyboard.down('ArrowUp');
    await game.frames(CLIMB_THAT_CROSSES);
    await game.page.keyboard.up('ArrowUp');
    for (let frame = 0; frame < 1200; frame += 1) {
      const state = await game.state();
      if (state.stickMan.action !== 'seated') break;
      if (state.stickMan.feet.x < gap.to && state.levelInView.right < gap.to + 1) lostSightOfTheFarSide = true;
      if (frame === 30) await game.shot('c-in-flight');
      await game.frames(1);
    }
    expect('in flight the far side stays in view all the way across', !lostSightOfTheFarSide);
    await game.seconds(2.5);
  };
  if (size.name === 'narrow') report.clip = await game.clip('c-carry-board-fly-land', play);
  else await play();

  const landed = await game.state();
  await game.shot('c-after-the-landing');
  expect('he landed on the far side, and the view has eased back to him in its middle, as wide as at rest', landed.stickMan.feet.x > gap.to && Math.abs(whereHeIs(landed) - 0.5) < 0.02 && Math.abs(landed.levelInView.right - landed.levelInView.left - report.metresAcrossAtRest) < 0.2, `he is ${round(whereHeIs(landed))} of the way across a view of ${round(landed.levelInView.right - landed.levelInView.left)} m`);

  report.watched = { narrowest: round(watched.narrowest), widest: round(watched.widest), biggestChangeInOneFrame: round(watched.biggestJump, 3), hudZooms: [...watched.hudZooms], slotBoxes: watched.slotBoxes.size };
  expect(`on no frame did the view show less than ${LEAST_METRES_ACROSS} metres across`, watched.narrowest >= LEAST_METRES_ACROSS - 0.01, `narrowest ${report.watched.narrowest} m, widest ${report.watched.widest} m`);
  expect('the view eases: it never jumped from one frame to the next, not even when he sits down in the airplane', watched.biggestJump < 0.6, `the most its middle moved or its width changed in one frame is ${report.watched.biggestChangeInOneFrame} m, of ${report.watched.narrowest} m or more across`);
  const slot = report.atTheEdge.inkOfTheItemSlot;
  expect('the level\'s camera did pull back on the way', watched.widest > watched.narrowest + 1, `from ${report.watched.narrowest} to ${report.watched.widest} m across`);
  expect('the HUD kept its own size all the while: one zoom, and the item slot drawn in the same place on the screen', watched.hudZooms.size === 1 && watched.slotBoxes.size === 1 && slot.atRest > 100 && Math.abs(slot.atTheEdge - slot.atRest) < slot.atRest * 0.25, `HUD zoom ${[...watched.hudZooms].join(', ')}; ${slot.atRest} pixels of pencil in the slot's box at rest and ${slot.atTheEdge} at the edge: the same box, a little different as its line boils`);
  await game.close();
  return report;
});
