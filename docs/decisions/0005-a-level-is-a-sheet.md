# 0005 - A level is a sheet: notes in its data, a page turned between two, a camera that looks ahead, a game that can be played again

Status: accepted. Date: 2026-11-23.

## Context

The first UX review (`docs/reviews/ux-review-1.md`) found that the three levels read as one: a finished level cut to the next in one frame, nothing on screen said what to do or where he was going, a lost flight cost a wait and five presses, and the end answered no key. Ticket #17 fixes five of its findings at once. Four of the fixes are choices the next agent would otherwise have to rediscover, because each could have been put on either side of the line between the sim and the view.

## Decision

**1. What a level says to the player is level data, and the sim rubs it out.** A level may have `notes` (`content/levels/types.ts`): where a note is, its words, whether it is a `title`, what it is `about` (`'walking'`, `'jumping'`) and the x he has to stand past for it to be rubbed out (`rubbedOutPast`). The `note` feature keeps, per note, the tick it was rubbed out on; `notesOf(sim)` gives a view the notes with how long ago that was.

- A note never names a key. The client draws the keys for what a note is about from `client/src/input/` (`MOVE_KEY_NAMES`), in the same boxes the HUD's prompts use (`hud/keysAndWords.ts`).
- That he has done what a note says is the sim's, not the view's: it is a fact about the game, it has to be there again when the level starts again (he fell into the gap the jump note is about), and a view that remembered it would be state outside the snapshot. One rule covers both notes so far: he stands on the floor past an x.
- HUD prompts for walking and jumping were not used: a prompt that is always there teaches nothing by going away, and the review's point was that the sheet itself was empty.

**2. A level is drawn as a `Sheet`, and the page turn is the view's alone.** `scenes/Sheet.ts` draws one sheet from one sim: paper, what is written on it, floor, flag, letter, airplane, stick man. The level being played is one (`LevelScene`); the sheet that is turned away is another (`TurnedSheetScene`), drawn from the sim as it was on the last tick of the finished level, in a camera whose viewport slides off to the left. `render/pageTurn.ts` is the turn's state, shared by the scenes; the HUD draws the pencil line and the hatched shadow at the sheet's edge.

- The sim still starts the next level in one tick, and it is played from that tick on under the leaving sheet. The sim was not made to wait for the turn: how long a sheet takes to slide is how a thing looks (rule 8), and a sim that paused for it would make every level test wait too.
- To draw the level that was left, `GameLoop` keeps a snapshot of the tick before each step and, when the step changed the level, hands a sim restored from it to the view (`takeFinishedLevel`). That sim is never stepped. A snapshot is a few hundred bytes of JSON, so one a tick costs nothing that can be measured; the alternative, a fact in the sim that says "the level ends on the next tick", would be view timing leaking into it.
- The scenes drawn over the level's do their work after every scene has updated (`scenes/afterTheLevel.ts`), because Phaser updates the top scene first: done in `update`, the leaving sheet was missing on the one frame the level changed, and the new level blinked through.
- A screenshot of the last frame into a texture was not used: Phaser takes one a frame late, by which time the level has changed, and a picture of pencil lines is the one thing on screen that would not boil.
- What the pause after a flag is for is the flag going up and a beat of cheering (`LEVEL_END.pauseBeforeNextLevel`, now 1.1 seconds). The turn itself is the rest of what used to be two seconds of nothing.

**3. The camera frames where he is going, by one rule, and the HUD does not follow it.** `render/levelCamera.ts`: the view is centred on him and as wide as it is at rest, unless he is at an edge with floor further on, carries the airplane or is seated in it. Then he stands three tenths of the way across it, and it is pulled back as far as it takes to show the start of the next floor line, up to a most. Both ease; a level that starts cuts. At rest the view is six stick men tall, or twelve metres across where the window is too narrow for that to show twelve.

- `framingWanted` is a plain function of what the sim says of him and the level's floor, and is tested as one. Nothing about it is level data: a level does not say where the camera looks.
- The HUD's camera keeps the zoom the level has at rest (`zoomAtRest`), so a HUD line is as heavy as a line of the level, and nothing on the HUD shrinks when the level's view pulls back.
- What is written on a sheet is sized in metres and scrolls with it (the game's name, a level's name, the notes). The page number is the exception: it is the sheet's, so it leaves with the sheet that is turned away, but it is pinned to a corner of the view and written larger as the camera pulls back, so it is always the same size on the screen.

**4. Playing again is a command of its own, and it starts over.** `'game/playAgain'` belongs to a `game` feature, which also says when the game is over and when playing again is offered (`gameOf`). Once offered, the command calls `Sim.startOver()`: the first level, with the slices that carry across levels back at their initial values.

- It is not an answer to `'world/interact'` (ADR 0003). That command is about the thing next to him, its answers are skipped once a level is finished, and "play again" is said to the game, not to something on the floor. The key is Enter, named to the HUD by `input/gameKeys.ts`.
- `startOver` is new in `core/sim.ts` because `startLevel` is defined to keep what carries. The seed, the rng and the tick count go on: a recorded game that ends and is played again still replays.
- After the end he is not held in a cheer. When playing again is offered he walks and jumps again, and the ends of the floor line he is on stop him (`keptOverTheLine`): the game is over, so nothing he does may start the level again and take the end back.

**5. What a letter teaches is kept; what he can lose is given back as what it is.** The `letter` feature: a letter he has read is gone once he puts it away. When a level starts again for him who has read its letter and has nothing left of what it was for, `init` gives him what its recipe makes, in his hand. When he loses everything without dying, the item the letter gave falls from the sky to where he stands, so he sees it come and has it at his feet, and `'world/interact'` next to it picks it up (`fallenItemInteraction`, `'pickUp'`).

- Before this, a new letter fell and had to be read again to get the paper. The fold is learned once and cannot be lost, so what falls is the material and not the lesson.
- Leaving the read letter on the floor, opened, to be read again was built and taken out again for the same reason: it had nothing left to do, and it put a prompt in his way on every retry.
- Giving the airplane, and not the paper, is what makes a retry "walk, set down, board". He has not lost what he learned, and folding again is a press that teaches nothing.

## Consequences

- A level can now say things: a new note is data, and a new thing to be `about` is one entry in `MOVE_KEY_NAMES` (or its like) and one union member. The first note that is rubbed out by something other than standing past an x needs a second rule in the `note` feature.
- Anything drawn on a level must be drawn by `Sheet`, or it will be missing from the sheet that is turned away.
- `render/` now uses `hud/handwriting.ts`, `hud/keysAndWords.ts` and `hud/unchanged.ts` for what is written on a sheet. They stay where they are; a third user is the moment to move them to a folder of their own.
- The client now holds two sims for the length of a turn, one of them frozen. Only `GameLoop` steps, and only the one being played.
- A view's width is no longer one number per window: code that lays something out against the level's camera has to read it each frame (`worldSeenBy`), and the HUD has to use its own.
- Level data that places things in the upper part of the sheet shares it with the level's name, which is written above where he starts for its first seconds.
- A game played again is a fresh one. A level that should remember something across games (a best time) needs state that `startOver` keeps, which does not exist yet.
