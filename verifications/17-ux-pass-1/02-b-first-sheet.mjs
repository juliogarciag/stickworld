/**
 * B. The first sheet says what to do.
 *
 * Checked on the screen and in the sim: level 1 has the game's name written on it and a walk note beside him, which
 * stays while he stands, jumps on the spot or walks the wrong way, and is rubbed out once he has walked on; level 2
 * has a jump note before its gap, which is still there after he falls in and is rubbed out once he has jumped it.
 * The notes are on the sheet, not the HUD: they move with it.
 */
import { ROOT } from './lib.mjs';
import { gapOf, verify } from './play.mjs';

await verify({ name: '02-b-first-sheet', port: 5917, cwd: ROOT }, async ({ size, open, expect }) => {
  const report = {};
  const folder = `after/${size.name}`;

  // Level 1: the game's name and the walk note.
  let game = await open({ level: 1, proofFolder: folder });
  await game.seconds(1.5);
  const first = await game.state();
  const name = first.notes.find((note) => note.large);
  const walk = first.notes.find((note) => note.about === 'walking');
  const around = (note, { across, up }) => game.regionOf({ left: note.at.x - across, right: note.at.x + across, top: note.at.y - up, bottom: note.at.y + 0.05 });
  const nameInk = await game.inkIn(await around(name, { across: 3.6, up: 0.85 }));
  const walkInk = await game.inkIn(await around(walk, { across: 1.3, up: 0.6 }));
  await game.shot('b-level-1-after-a-moment');
  report.level1 = { notes: first.notes, nameInk, walkInk };
  expect("the game's name is written on level 1, in view from the first moment", name && nameInk > 400 && (await game.onScreen(name.at)).y > 0, `"${name?.words}", ${nameInk} pixels of pencil`);
  expect('a walk note is beside him, with its keys drawn in boxes', walk && Math.abs(walk.at.x - first.stickMan.feet.x) < 1 && walkInk > 150, `"${walk?.words}", ${walkInk} pixels of pencil`);
  expect('no note names a key: the words are the level\'s, the keys are drawn by the client', first.notes.every((note) => /^[a-z ]+$/i.test(note.words)), first.notes.map((note) => note.words).join(', '));

  await game.tap(' ');
  await game.seconds(0.8);
  await game.holdUntil('ArrowLeft', () => false, 20);
  const stillThere = (await game.state()).notes.find((note) => note.about === 'walking');
  expect('the walk note stays while he jumps on the spot and walks the wrong way', stillThere.rubbedOutFor === null && (await game.inkIn(await around(walk, { across: 1.3, up: 0.6 }))) > 150);

  const before = await game.onScreen(walk.at);
  await game.walkRightTo(walk.rubbedOutPast + 0.05);
  const justPast = (await game.state()).notes.find((note) => note.about === 'walking');
  await game.frames(8);
  await game.shot('b-walk-note-being-rubbed-out');
  await game.seconds(0.8);
  const after = await game.onScreen(walk.at);
  const leftOfTheNote = await game.inkIn(await around(walk, { across: 1.3, up: 0.6 }));
  await game.shot('b-walk-note-rubbed-out');
  expect('once he has walked on, the walk note is rubbed out', justPast.rubbedOutFor !== null && leftOfTheNote === 0, `${leftOfTheNote} pixels of pencil left where it was`);
  expect('the notes are on the sheet and move with it', after.x < before.x - 20, `the place of the walk note moved ${Math.round(before.x - after.x)} pixels left as he walked right`);
  expect("the game's name stays", (await game.state()).notes.find((note) => note.large).rubbedOutFor === null);
  await game.close();

  // Level 2: the jump note.
  game = await open({ level: 2, proofFolder: folder });
  const gap = gapOf(await game.levelData());
  await game.seconds(1.5);
  const jump = (await game.state()).notes.find((note) => note.about === 'jumping');
  const jumpInk = await game.inkIn(await around(jump, { across: 1.1, up: 0.6 }));
  await game.shot('b-level-2-after-a-moment');
  report.level2 = { note: jump, jumpInk };
  expect('level 2 has a jump note before its gap', jump && jump.at.x < gap.from && jump.at.x > gap.from - 2.5 && jumpInk > 100, `at x ${jump?.at.x}, the gap is from ${gap.from} to ${gap.to}; ${jumpInk} pixels of pencil`);

  // Walking on, as a player who has not read it does: he falls in, the level starts again, and the note is still there.
  await game.holdUntil('ArrowRight', (state) => state.stickMan.feet.y > 1);
  await game.until((state) => state.stickMan.feet.y === 0 && state.stickMan.feet.x < gap.from);
  await game.seconds(0.5);
  const again = (await game.state()).notes.find((note) => note.about === 'jumping');
  expect('after a fall into the gap the jump note is still there', again.rubbedOutFor === null && (await game.inkIn(await around(jump, { across: 1.1, up: 0.6 }))) > 100);

  await game.walkRightTo(gap.from - 0.25);
  await game.page.keyboard.down('ArrowRight');
  await game.page.keyboard.down('ArrowUp');
  await game.frames(3);
  await game.page.keyboard.up('ArrowUp');
  await game.until((state) => state.stickMan.feet.x > gap.from + 0.3 && state.stickMan.feet.x < gap.to);
  const overTheGap = (await game.state()).notes.find((note) => note.about === 'jumping');
  await game.until((state) => state.stickMan.action !== 'jumping');
  await game.page.keyboard.up('ArrowRight');
  const landed = await game.state();
  await game.seconds(1);
  const leftOfTheJumpNote = await game.inkIn(await around(jump, { across: 1.1, up: 0.6 }));
  await game.shot('b-jump-note-rubbed-out');
  expect('the jump note is there while he is over the gap, and is rubbed out once he has landed past it', overTheGap.rubbedOutFor === null && landed.stickMan.feet.x > gap.to && leftOfTheJumpNote === 0, `landed at x ${landed.stickMan.feet.x.toFixed(2)}; ${leftOfTheJumpNote} pixels of pencil left where it was`);
  await game.close();
  return report;
});
