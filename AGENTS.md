**The project**

This is a 2d platformer drawn in pencil on a sheet of paper. The main character is a stick man; the floor is a pencil line; the things he finds and makes are paper. It starts as a three-level proof of concept and grows from there, mostly through AI agents working in parallel. The architecture below exists so that many agents can add things at once without breaking each other.

This file describes the structure the repository has and is growing into. A folder the layout names but no ticket has needed yet appears with the first ticket that needs it. Correct this file in the same PR whenever what you build differs from what it says.

**Development process**

- This is the repository: https://github.com/juliogarciag/stickworld.
- We're gonna use a GitHub project to manage tickets: https://github.com/users/juliogarciag/projects/2. Add every new ticket to it (`gh project item-add 2 --owner juliogarciag --url <issue url>`).
- You can create tickets on your own.
- The session where a request arrives never does the work itself, even when the human is in the middle of a conversation there. It creates the ticket, defines a short title for it (let's call it `ticketTitle`) and its kebab-case version (`ticketKebabTitle`), starts a new agent session named `[ticketNumber] - {ticketTitle}`, and stays in the conversation with the human. Questions and discussion go on there as before.
- The new session takes over the ticket: it assigns the ticket to itself and does everything below.
  - Size the ticket before any work starts. State Small, Medium or Large with a one-line reason as the first thing you do, then proceed; nobody has to confirm. A `size:S`, `size:M` or `size:L` label on the ticket overrides what you state. When a ticket fits no tier, pick the next one up.
    - Small is docs, config, a copied skill, or a data-only entry such as a new level, a new recipe or a tuning value. It gets 1 independent review (a sub-agent). Its verification is running the change once with proof: a screenshot, a command transcript or a test run.
    - Medium is a feature built the way "How to add a feature" describes: its own folder under `features/`, the one-line edits to the shared files that rule 10 lists, the export a view needs from `sim/src/index.ts`, and the client code that draws it. None of that counts as cross-package or core. It gets 2 independent reviews and the end-to-end verification the verifications bullet below describes.
    - Large is any other change under `packages/sim/src/core`, a change to how the packages talk to each other, a change to how strokes are drawn for the whole game, new architecture, or a choice that needs an ADR. It gets 3 independent reviews, an ADR, and the same end-to-end verification.
    - A security pass is added to any tier when the change adds a dependency, or reads anything from outside the game: browser storage, the URL, a file, the network.
  - Review rounds are capped for every tier: apply must-fix findings and re-review once. If the second round still finds a must-fix, fix it and say so in the PR; there is no third round, the human's PR review is the last check. Should-fix findings go into one follow-up commit, which is not reviewed, or into a ticket.
  - When you start to work, create a git worktree named `{ticketNumber}-{ticketKebabTitle}` with a branch of the same name, cut from `origin/main` after a fetch (never from local `main`, which may lag). A ticket that depends on an unmerged one starts from that ticket's branch instead of waiting for the merge.
  - Then, think of the verifications you need to run to be sure your work is complete, and store them in a folder called `verifications/{ticketNumber}-{ticketKebabTitle}`. You can use any code you want in these verifications. The verifications are very important and have to validate your work in its entirety, from the perspective of the highest-level user of the ticket, which means user-facing features need verifications that are equal in scope to end-to-end tests. A Small ticket's folder holds only the proof of running the change once; any other starts as a copy of `verifications/_template/`. The folder is proof for its own ticket and is frozen when the PR merges: nobody runs, repairs or reads another ticket's folder afterwards, and a frozen script that fails against a later `main` is expected, not a bug.
  - Then, they should work until the work is done. The work is only done when:
    - The verifications are true.
    - There's proof for the verifications. Proof consists of screen captures, reports, or any asset that verifies that the verification passed.
    - The independent code reviews (sub-agents) the ticket's size calls for have run and passed.
    - A security pass has been completed, when the change calls for one.
  - When the work is done, it should create a PR. Tickets should aim for a 1-to-1 relationship with PRs.
  - The PR body is `.github/pull_request_template.md` filled in. `gh pr create --body` does not apply the template by itself: read the file, keep its headings and their order, fill in the placeholders, replace each section's comment with what it asks for, and delete a section that does not apply. Lead with a plain summary of what changed and why before any file or mechanism.
  - When the PR is ready, the result must be ready to try, without being asked: leave a dev server running from the worktree on a pinned port (`PORT=<n> pnpm dev`, see "Worktrees and ports"), open it in the browser pane, and put the URL and the proof screenshots in the final message. The human should be able to play the change the moment they read the message. Keep the server running until the PR is merged or the human stops it.
  - The session then stays open for regular feedback loop with the human in charge.
  - Once the PR has been approved by a human, you merge it.

**Stack**

- TypeScript (strict), pnpm workspaces, Vite.
- Phaser 4: rendering and input only, in `packages/client`. The game keeps a game engine; do not replace it with a bare canvas.
- No physics library. The world is a line, gaps and a few objects: movement, jumping, carrying and the glide are plain arithmetic in `packages/sim`. Phaser Arcade/Matter physics are never used. Adding a physics library is a Large ticket with an ADR.
- Vitest: all tests. They run headless in Node.
- Playwright: the verification scripts that drive the real app.
- Look for a library or an engine feature before hand-writing infrastructure (loaders, tweening, input mapping); the sim's own rules are the part that is written by hand.

**Repository layout**

```
packages/
  sim/        All game logic and state. Plain TS. No Phaser, no DOM, no Node APIs.
    src/
      index.ts            Public API. The ONLY file the client may import from.
      core/               Sim, state slices, feature hooks, commands, rng, snapshot, view.
      content/            Data: the levels, the item and recipe defs, tuning values.
      features/<name>/    One folder per feature: state, defs, commands, systems, view, tests.
      features/index.ts   The list of features the sim runs (one line per feature).
  client/     Phaser app. Reads sim state, draws it, turns input into commands. No game rules.
    src/main.ts, src/loop/, src/debug.ts
    src/scenes/           Sheet.ts draws one level on its sheet of paper. LevelScene is the one being played, TurnedSheetScene the one
                          a finished level leaves behind while the page is turned, HudScene what is not on the paper.
    src/input/            The ONLY place that knows which keys there are: keys in, commands out.
    src/render/           What is drawn and where. paper.ts is the sheet and its tooth (the grain every line gets); levelCamera.ts is
                          how the view frames the level; notes.ts and sheetWords.ts are what is written on a sheet.
    src/render/strokes/   The ONLY place a pencil stroke is drawn. Everything else asks it for a line.
    src/hud/              The item slots, the letter text with what it taught, what the keys would do, the words that end the game with
                          the key that plays it again, the edge of a page being turned; view facts, never sim state.
                          Drawn by scenes/HudScene.ts, a scene of its own over the level's, so it does not move with the paper.
                          Words are pencil strokes too: handwriting.ts turns text into strokes (ADR 0004), and keysAndWords.ts is the
                          one way a key is shown, in a box with its words. Both, and unchanged.ts, are also used by what is written on a sheet.
docs/decisions/   Architecture decision records (ADRs).
docs/reviews/     Reviews of the game as it is played (UX), numbered. Each ends with proposed tickets; none is filed by the review.
verifications/    One folder per ticket with its verification scripts and proof, frozen when the ticket's PR merges.
                  _template/ is the maintained starting point for a new one.
```

Dependency versions live in one place: the `catalog` in `pnpm-workspace.yaml`. Packages reference them as `"catalog:"`.

**Architecture rules (non-negotiable)**

1. The sim is the single source of truth. The client is a view; it never decides anything about the game. Whether the stick man is alive, what he holds, whether the airplane has stalled, whether a level is complete: all of it is sim state.
2. Input reaches the sim only as serializable commands (`Command` in `sim/src/core/commands.ts`). No callbacks, no direct mutation of sim state from outside the sim. The client only ever holds a `SimHandle` (`step`, `snapshot`, read-only fields); the sim's internals are private to `packages/sim`.
3. State is serializable. `sim.snapshot()` must keep capturing everything: never keep game state outside the sim's state and its rng. A snapshot can be loaded back, which is how a level restarts and how a test starts in the middle of one.
4. The sim advances only through `step(commands)`, one fixed tick of `FIXED_DT` at a time. The client turns real time into whole ticks with `takeWholeTicks` and carries the leftover to the next frame; commands wait in a buffer until the next earned tick. Nothing else may call `step`.
5. Determinism: same seed + same commands = identical state. In `packages/sim` there is no `Math.random`, `Date`, `crypto`, timers, Node modules or I/O. Randomness goes through `sim.rng`. Lint enforces this. This is what lets a test prove a level can be finished: a recorded list of commands that reaches the flag.
6. State is plain numbers and ids. Static or rich data (names, sizes, speeds, recipe ingredients, letter text) lives in definition files keyed by a numeric `defId`; state references it by id. Ids are forever: never reuse or renumber.
7. Content is data: levels, items, recipes, letters and tuning values live in data files (`sim/src/content/`, `features/<feature>/defs.ts`), not in logic. A new level is a new file, not new code.
8. How a thing looks is the client's business and never the sim's. The sim knows the stick man's position, facing, what he is doing (walking, jumping, carrying, seated) and how far along that action he is; the client turns that into limbs. The line wobble, the paper grain and the limb angles are view detail and must not reach the sim.
9. Package boundaries are enforced by lint (`eslint.config.js`) and by the sim's `tsconfig` (no DOM lib, no Node types). `sim` imports nothing from `client`; `client` imports `@stickworld/sim` through its package entry only, never deep paths.
10. Feature-oriented folders. New behaviour goes in `sim/src/features/<feature>/`; parallel agents should rarely touch the same files. The shared files a feature may touch, one line each: `features/index.ts` (register), `content/defs.ts` (spread in the feature's defs and claim an id block), `core/commands.ts` (add the command union), `src/index.ts` (expose something to views), `content/levels/index.ts` (list a new level; the level itself is a new file in `content/levels/`), `content/levels/types.ts` (an optional field for what the feature needs a level to say, such as `flagGivesItem` or `notes`), `features/item/index.ts` and `features/world/index.ts` (add the feature's answer to `ANSWERS`, see "The two action keys").
11. Command handlers are the validation boundary: validate every field, ignore what is malformed, never throw. `Sim.step` drops values that are not objects with a string `type`.
12. Every pencil stroke on screen goes through `client/src/render/strokes/`: a caller makes a layer with `createStrokeLayer(scene)` and shows it strokes (points and a thickness, in world pixels). The technique behind it (Phaser Graphics lines with a dab stamped on every joint, grain from the paper's tooth; ADR 0002) can be swapped there without touching what calls it. Lint rejects the Phaser factories that draw lines and shapes (`add.graphics()`, `make.graphics()`, `add.rope()`, the shape factories, `new Graphics`) anywhere else in the client; a factory called through another name gets past it, so reviews still check. Everything drawn on the paper sits between the sheet's depth and its tooth's (`render/paper.ts`); what is not on the paper, such as a HUD, goes above the tooth: the HUD is a scene of its own (`scenes/HudScene.ts`) drawn after the level's, with its own stroke layers. Everything on a level's sheet is drawn by `scenes/Sheet.ts`, so that the sheet a finished level leaves behind has it too.

**Naming**

- Name things by what the caller gets, not by how it works inside. The test: the call site must read as a plain sentence without opening the function. `const { ticks, leftover } = takeWholeTicks(...)` passes. `const { ticks, accumulator } = advanceFixedStep(...)` fails, because "advance" and "accumulator" describe the technique and you have to read the body to learn it returns a count.
- The same rule applies to result fields and to state. Store the leftover frame time as `leftover`, not under the name of the pattern it belongs to.
- If you cannot name a function by its result, it is probably doing two things. Split it, then name each half.
- Spell names out: `pendingCommands`, not `pending`; `renderable`, not `r`; `translation`, not `t`. A name must say what the value is without the reader looking at where it came from. The domain terms this file defines are the only short forms: `sim`, `dt` (tick length in seconds), `rng`, `def`.
- Commands are named `'<feature>/<verb>'` and features by their domain noun (`player`, `inventory`, `airplane`), never by the ticket or the agent that made them.
- Commands say what the player means, not which key was pressed: `'inventory/select'`, `'item/use'`, `'world/interact'`. The mapping from keys (1, J, K, arrows, space, Enter) to commands lives in `client/src/input/` only, and so does what a key is called on screen (`ACTION_KEY_NAMES`, `FLIGHT_KEY_NAMES`, `MOVE_KEY_NAMES`, `GAME_KEY_NAMES`). One key may mean two things only there, and only by what the sim says he is doing: the up keys are a jump on his feet and the airplane's nose up while he is seated (`stickManOf(sim).action`), where only the jump key itself jumps him out. Text in the sim's data (a letter, a note on a level) never names a key: a note says what it is `about`, and the client draws the keys for that beside it.

**Functions and exports**

- A function with four or more arguments takes an options object with named fields instead: `takeWholeTicks({ leftover, deltaSeconds, dt, maxFrameSeconds })`. A leading subject such as `sim` may stay positional.
- Anything exported only so tests can reach it goes through a single `export const __testing__ = { ... }` at the bottom of the module, never as a loose export. Lint rejects `import { __testing__ }` outside `*.test.ts`. The public surface of a module is what remains.

**The two action keys**

- J is `'item/use'` and K is `'world/interact'`, always. What a press does depends on things several features own, so each command belongs to a small feature named after it (`features/item`, `features/world`) that keeps an ordered list of answers, `ANSWERS`, and performs the first one that applies (ADR 0003). One press does one thing.
- A feature with a use for either key exports an answer, a function of the sim that returns `{ means, perform }` or `undefined` (`airplaneInteraction`, `letterInteraction`, `craftingUse`, `letterBeingRead`), and adds it to the list: never a second handler for the command. The order of the list is the priority.
- `itemUseOf(sim)` and `interactionOf(sim)` say what a press would do right now; the HUD shows it beside the key (`client/src/hud/prompts.ts`, which needs words for every new meaning). The words name the thing they are done to ("lift the airplane", never "lift it"), and a key that would do nothing is not shown.
- Making a recipe is one press: J with an item that a recipe he knows is made from makes it (`'craft'`), and the prompt names what (`craftingOf(sim).canMake`). There is no list to open while no two recipes are made from the same item; the first that are need one, with a way to move through it. Reading a letter says what it taught on the sheet and puts the item the recipe is made from in his hand, so the next prompt is the fold. While he reads, J does nothing and K puts the letter away: back on the floor, opened, where K reads it again.
- K next to the airplane lifts it, except where it sits on an edge with its nose out over a gap (floor further on): there K boards it, which seats him in it and launches it. A held press to board was tried and rejected (ADR 0003).

**Commands**

```
pnpm install
pnpm dev          # client dev server. PORT=5180 pnpm dev to pin a port (needed when several worktrees run at once). VITE_LEVEL=<n> starts on that level
pnpm test         # all tests in all packages, headless
pnpm typecheck    # tsc for every package
pnpm lint         # eslint, including the boundary rules
pnpm check        # test + typecheck + lint, what CI runs
pnpm build        # the client bundle
```

Before opening a PR: `pnpm install && pnpm test && pnpm typecheck && pnpm lint` must pass.

**How to add a feature without breaking the rules**

Example: an `airplane` feature where the stick man places a paper airplane and flies it.

1. Create `packages/sim/src/features/airplane/`.
2. `state.ts`: declare the feature's slices of sim state with `defineSlice(key, initialFor)` (`core/slice.ts`): numbers and ids only, plain JSON, with the value each starts at on a level. Pass `{ carriesAcrossLevels: true }` for state that survives starting or restarting a level (the paper from level 2). List the slices in the feature's `slices` so the sim creates and snapshots them, and read them in the feature with `sim.stateOf(slice)`.
3. `defs.ts`: export the feature's def ids and defs (the airplane item, its glide numbers). Claim the next free block of 100 ids in the comment at the top of `content/defs.ts` and spread your list in there. Something that is just "another kind of" an existing thing is only a new entry in a def list.
4. `commands.ts` (only if the player can do something new): declare command interfaces with a `type` literal named `'<feature>/<verb>'` and plain JSON fields. Add the union to `Command` in `core/commands.ts`. Validate every field in the handler and ignore bad input. Reuse an existing command when the player's intent is the same: boarding the airplane is `'world/interact'` next to an airplane, not a new command.
5. `index.ts`: export a `Feature` object (`core/feature.ts`) with `slices`, `init` (set up what the level says exists at start), `handleCommand`, and `update` (one tick of this feature's rules). Starting or restarting a level is `sim.startLevel(id)`; `sim.startOver()` starts the game again from its first level with nothing kept, which only `'game/playAgain'` does.
6. Register it in `features/index.ts`. Order matters only if your feature depends on another feature's work within the same tick.
7. Tests next to the code (`*.test.ts`): create a sim on a level, drive `sim.step(commands)` for N ticks, assert on `sim.snapshot()` or on what the view functions return. Every feature needs at least one headless test that proves it works, and nothing you add may break `core/determinism.test.ts`.
8. Every level needs two headless tests that play it with a list of commands: one that reaches the flag the intended way, and one for each shortcut that must not work (level 3's gap cannot be crossed by jumping). Tuning that breaks a level then fails a test instead of being found by hand. Where a level asks for skill, a test also holds how much: level 3's keeps the window of climbs that cross its gap (`CLIMB_THAT_CROSSES` in `level3.test.ts`).
9. If a view needs something new, write a view function in the feature's `view.ts` that takes a `SimHandle` and returns plain data (`stickManOf(sim)` in `features/player/view.ts`), export it from `sim/src/index.ts` and consume it in `packages/client`. The client only draws; if you are tempted to put an `if` about game rules in the client, it belongs in the sim.
10. A level is a data file in `sim/src/content/levels/`: the floor as a list of line segments in metres (a gap is the space between two segments), where the stick man starts, and what is placed on it (a flag, a letter) by def id and position. It may have `notes`, what is written on its sheet for the player: where, the words, whether it is a `title`, what a note is `about` and the x he has to stand past for it to be rubbed out (the `note` feature, ADR 0005). A feature that needs its own things placed in a level adds an optional field to the level type for them and reads it in its `init`, or in its `update` when the field is a rule rather than a thing (`flagGivesItem`). Tuning numbers that are global go in `content/tuning.ts`; feature-specific ones go in the feature's `defs.ts`.
11. Run `pnpm check`. Lint will tell you if you crossed a boundary.

**Game feel belongs in tuning**

- Jump height, walk speed, how much the keys steer him as he falls off an edge, the forgiveness around a jump (pressing just before landing, or just after leaving an edge), the glide's speed loss and stall speed: all are named values in data files, never numbers inside logic.
- Falling off an edge the stick man has a sideways speed of his own: he keeps the speed he walked off with, and a held key only steers it (`PLAYER.airSteering`). On the floor and in a jump he is at walk speed, or still, at once.
- The glide is an exchange, not aerodynamics: climbing costs speed, diving gains it, and below the stall speed the airplane falls. Keep it that simple unless an ADR says otherwise. Every number of it is `FLIGHT` in `features/airplane/defs.ts`, and the rules are `features/airplane/flight.ts`: `'airplane/steer'` turns its nose, it goes where its nose points, each metre climbed costs speed and each metre dived gives less back, a little is lost all the time, and left alone its nose sinks. A floor line stops it from below as well as from above. It is the sim's only trigonometry (`Math.sin`, `Math.cos`), which engines may round differently in the last bit: recorded flights are replayed exactly within one engine, which is what the tests and a restored snapshot need. Level 3's gap and `FLIGHT` are tuned together: doing nothing sinks short, climbing too long stalls, and a climb of the right length crosses.
- Seated in the airplane (`seated` in the player's state, set by the `airplane` feature) he neither walks nor falls and is where the airplane is; a flag is not reached from a seat. A jump stands him up and jumps him out as from the floor, and the airplane falls on without him; a jump that arrives on the tick he sits down, or under a floor line, is dropped. With him in it, the airplane out of sight below the floor (`FLIGHT.lostBelowFloor`) starts the level again. An airplane that comes down on a floor line slides to a stop (`FLIGHT.landingSlowdown`), and then he stands up where it lies.
- Carrying has its own jump height (`PLAYER.jumpHeightCarrying`), and how the airplane is put down, lifted and lost is `AIRPLANE` in `features/airplane/defs.ts`: it rests wherever its middle has floor under it, a little past the end of a line it is pulled back onto the edge, further out it falls. An airplane that falls over a gap is lost; one that falls over a floor line comes down on it. The letter's fall is `LETTER` in `features/letter/defs.ts`.
- Other features read and change what he holds through `features/inventory/held.ts` and `give.ts`, never through the inventory's slice. The airplane is an item of the inventory's block (201) while it is in a slot, and the `airplane` feature's while it is in the world; that feature sets `carrying` in the player's state, which is how the player's jump and the stick man's arms know.
- A flag he has reached goes up its stick while he cheers under it, and the next level starts `LEVEL_END.pauseBeforeNextLevel` after he reached it (`features/flag/defs.ts`). The sim starts it in one tick; the page that is turned between the two is the view's (below).
- The flag of the last level ends the game: no level follows it, `flagOf(sim).endsTheGame` and `gameOf(sim).over` say so, and once it is up the HUD writes the end across the sheet, a stroke at a time and never wider than the view (`client/src/hud/theEnd.ts`). `GAME_END.playAgainAfter` (`features/game/defs.ts`) after he reached it playing again is offered (`gameOf(sim).playingAgainOffered`): he stops cheering and walks and jumps again, the ends of the floor line he is on stop him so that nothing takes the end back, and `'game/playAgain'` (Enter, `client/src/input/gameKeys.ts`) starts the first level with nothing kept (the `game` feature, `sim.startOver()`). J and K have no use after any flag.
- Trying again costs no chores, and he can never be left without a way on (the `letter` feature). A letter he has read lies where it lay, opened, and can be read again. An airplane left in the world is lost when he dies, like everything else that is not in a slot, but a level that starts again for him who has read its letter and has nothing left of what it was for gives him what its recipe makes at once, in his hand: a retry of level 3 is walk, set down, board. And whenever he loses the paper and the airplane without dying, a new letter falls on to the old one and reading it gives the paper (reading the opened one does too).
- The stick man is a controlled body with limbs drawn from code, not a ragdoll. The sim keeps the end of a floor line out of his outline as he drops past it (`STICK_MAN_WIDTH`, `PLAYER.fullWidthAbove`); the view keeps his arms, body and head from being drawn across a line (`keptOffTheFloor` in `client/src/render/stickMan.ts`). Both assume flat floors at one height with gaps wider than he is, which tests on every level check (`content/levels/levels.test.ts`).

**Verifying work**

- Agents verify headlessly: sim tests are the proof that a feature works. The browser is for humans, and for the proof that the real app shows it.
- Test files read top-down: imports, then the `describe` blocks, then fixtures, fakes and helper functions at the bottom under a `// ---- Helpers ----` comment. A reader should see what is being asserted before how it is set up. Function declarations hoist, so this is always safe for them; `const` helpers and fixtures are fine too as long as they are only used inside `it`, `beforeAll` and similar callbacks, never in a `describe` body.
- For user-facing changes, the ticket's `verifications/<ticket>/` folder holds scripts that exercise the real app (Playwright against `pnpm dev`) and the proof they produced (screenshots, logs, JSON reports). Start from a copy of `verifications/_template/` (its README has the steps).
- How the game looks cannot be asserted, only shown: a ticket that changes the look puts before and after screenshots in its proof, and a short screen recording when the change is in how something moves.
- Dev builds expose `window.__game` (`sim`, `game`, `snapshot()`, `hash()`, `level`, `defs`, `pixelsPerMetre`, `stickManHeight`, `stickManWidth`, `camera()` (the level's), `hudCamera()`, `levelInView()` (the part of the level the level's camera shows, in metres), `pageTurn()` (where the edge of the sheet being turned away is, or null), `stickMan()`, `flag()`, `notes()` and `ending()` (each as the sim's view functions give it; `ending()` is `gameOf`), `itemSlots()` (each slot as the sim has it, with the rectangle of the page the HUD draws it in), `letter()`, `crafting()` and `airplane()` (each as the sim's view functions give it; in flight the airplane's `state`, `speed`, `pitch` and `stallSpeed` are how a check follows it), `itemUse()` and `interaction()` (what J and K would do right now, or null), `queueCommand(command)`, `loadLevel(n)`) so browser checks can read sim state and derive expectations from content instead of hardcoding numbers. It is stripped from production builds. Add to it when a check needs something new, and list the addition here.
- A `verifications/<ticket>/` folder is proof for that ticket only and is frozen when its PR merges. Nobody runs, repairs or reads another ticket's folder afterwards. `verifications/_template/` is the only folder kept working: never copy from a frozen one, and a ticket that changes what the template relies on (its README lists it) updates the template in the same PR.
- Content search (`rg`, the Grep tool) skips every folder under `verifications/` except `_template` (the root `.ignore`), your own ticket's folder included. To search yours, name it as the path: `rg <pattern> verifications/<ticket>/`.
- Units: the sim works in metres, y pointing down, from an origin at the start of each level's floor. The stick man's height and width in metres are tuning values and everything else is sized against them. The client converts metres to pixels with `PIXELS_PER_METRE` in `client/src/render/units.ts`; on-screen size comes from the camera's zoom, never from that ratio.

**The sheet, the camera and the page turn**

- The level's camera (`client/src/render/levelCamera.ts`) is centred on him and, at rest, shows six stick men of height, or twelve metres across where the window is too narrow for that (`FRAMING`). At an edge with floor further on, while he carries the airplane and while he is seated in it, it eases ahead of him and pulls back until the start of the next floor line is in view, up to `FRAMING.mostMetresAcross`. `framingWanted` is the rule, a plain function of `stickManOf` and the level's floor. A level never says where the camera looks.
- The HUD's camera keeps the zoom the level has at rest (`zoomAtRest`): the HUD does not shrink when the level's view pulls back. Lay HUD things out against the HUD's own camera (`worldSeenBy`), never the level's.
- What is written on a sheet is in metres and moves with it: the level's notes, and the level's number and name, which `render/sheetWords.ts` writes above where he starts for the sheet's first seconds. The page number is pinned to a corner of the level's view and is the same size on screen at any zoom.
- When the sim moves on to another level, `GameLoop.takeFinishedLevel()` gives the view the level that was left as a sim of its own, never stepped, and `render/pageTurn.ts` slides that sheet away over the level already being played (ADR 0005). How long it takes is view detail (`TURN`). A death is not a page turn.
- Words and lines that are written or rubbed out over time are cut down by `render/strokes/partly.ts` (`writtenSoFar`, `rubbedOutSoFar`) before a layer is shown them. How far along they are comes from the sim when the sim knows (`flagOf(sim).upFor`, a note's `rubbedOutFor`), and from the view's own clock only for what is the view's (a level's name, the turn).

**Worktrees and ports**

- Every ticket is worked on in its own git worktree under `.worktrees/` (gitignored) on a branch with the same name. Each worktree needs its own `pnpm install`.
- Nothing hardcodes a port. `PORT=<n> pnpm dev` pins the dev server (and fails if `<n>` is busy); unset, Vite picks a free one starting at 5173. Only the shell environment counts: `.env` files are not read for this.
- `.claude/launch.json` lets the desktop app preview the client from the main checkout; it lists 5173 as the port to open. Worktrees are previewed by starting `PORT=<n> pnpm dev` and opening that URL.
- Pick a port for the ticket that no other session is likely to use (for example `5200 + ticketNumber`), start the server in the background so it outlives the command, and mention the exact `PORT=<n> pnpm dev` line in the final message so the human can restart it in their own terminal. If they do, stop yours first: a pinned port refuses to start twice.

**Decisions**

Significant architectural choices are recorded in `docs/decisions/` as numbered ADRs. Add a new one when you make a choice the next agent would otherwise have to rediscover; never edit an accepted one, supersede it. So far: the sim and view split with a fixed step (0001), how pencil strokes are drawn (0002), the two action keys and the features that answer for them (0003), words on the HUD as pencil strokes (0004), and a level as a sheet: notes in its data, the page turned between two, the camera's rule and the game played again (0005).
