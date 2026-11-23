# 0003 - Two fixed action keys: `item/use` and `world/interact` are each owned by a small feature that asks the others what the press means

Status: accepted. Date: 2026-11-23.

## Context

Level 3 gives the player two action keys with fixed meanings: J uses the held item, K interacts with the world. Each is one command (`'item/use'`, `'world/interact'`), because commands say what the player means and not what happens. What happens depends on things several features own: the paper opens the recipe list (`crafting`), the airplane item is set down (`airplane`), K reads a letter (`letter`), lifts or puts down the airplane (`airplane`), and later boards it.

If every feature handled the command itself, one press could do two things (lift the airplane and read the letter next to it), and nothing could say what a key would do right now, which the HUD has to show because K changes meaning with where he stands.

## Decision

**Each of the two commands is owned by a feature named after it (`features/item`, `features/world`) that knows nothing about items or things. It keeps an ordered list of answers, one exported by each feature that has a use for the command, and the first answer that is not `undefined` is what the press does.**

- An answer is a function of the sim that returns `{ means, perform }` or `undefined`: `means` is a word for what the press would do (`'lift'`, `'read'`, `'craft'`), `perform` does it. For example `airplaneInteraction` in `features/airplane/index.ts`.
- One press does one thing. The order of the list is the priority: what he holds up to look at (a letter, the recipe list) is put away first, then what he has in his hands comes before what lies next to him. Putting something away is an answer like any other, so the press that closes the recipe list does not also lift the airplane next to him.
- The same list answers the views: `itemUseOf(sim)` and `interactionOf(sim)` return the `means` of what a press would do now, or null. The HUD shows it beside the key; what the key is called comes from `client/src/input/`, and the words from `client/src/hud/prompts.ts`.
- A feature with a new use for either key exports an answer and adds it to that list: one line in `features/item/index.ts` or `features/world/index.ts`. The command, its validation and the rule that nothing happens once the level is finished stay in one place.

### The boarding key

K next to the airplane has to mean both "lift it" and, from issue #5 on, "board it". Two schemes were built and played in issue #4, and the human chose the first:

1. **One press, by where the airplane is (chosen).** An airplane that sits on an edge with its nose out over a gap is boarded; anywhere else, the end of the paper included, it is lifted. Every press acts the moment the key goes down, and the HUD can say which it will be. The cost: an airplane cannot be lifted back off such an edge.
2. **A held press boards (rejected and removed).** A short press always lifted and a press held for a third of a second boarded, so nothing was ever stuck on an edge. But a short press is only known to be short when the key comes up, so every lift and put-down waited for the release and felt late, and the HUD had to explain two presses of one key.

Boarding itself does nothing until issue #5; the press is taken so that it does not lift instead.

## Consequences

- Features do not import `item` or `world`; those two import the features that answer. A new interactive thing touches its own folder and one line of a list.
- The order of the lists is a rule of the game that lives in two short arrays, not spread over handlers.
- `means` is a string union that grows with every answer, and the HUD's table of words (`prompts.ts`) has to grow with it: TypeScript fails the build when a meaning has no words.
- An answer is asked for on every press and on every frame the HUD draws, so it must be cheap and must not change state: only `perform` does.
