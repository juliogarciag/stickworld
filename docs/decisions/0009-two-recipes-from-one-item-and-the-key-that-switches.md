# 0009 - Two recipes from one item: one is chosen, and a key switches the use of the item

Status: accepted. Date: 2026-11-27.

## Context

Making a recipe is one press: J with an item a recipe is made from makes it (ADR 0003). That held while no two recipes were made from the same item, and AGENTS.md said the first two that were would need a list, with a way to move through it. Issue #44 is that case: the spear is rolled from a sheet of paper, as the airplane is folded from one. The owner's reason for paper, in their words: "Pencil being an ingredient breaks a bit with the paper analogy." The pencil is what the world is drawn with; paper is what the stick man makes things of. A first version of #44 made the spear from a pencil item to avoid the list; that was taken out before it reached `main`.

So J with the paper has two meanings for a stick man that knows both recipes, and something has to say which.

## Decision

**One recipe is the chosen one, J makes it, and a second key switches what the held item is used for. There is no list on screen.**

- Which recipe is chosen is sim state: `chosenRecipe` (`features/crafting/state.ts`), a def id that carries across levels and deaths with what the stick man knows. J makes the chosen recipe when it is made from the held item, and otherwise the last one learned that is (`findCraftableRecipe`).
- The default is the recipe learned last. Three things choose a recipe without the player: learning it (`teachRecipe`), a level starting with its letter already read, and picking up the sheet that falls for that letter (`selectRecipe`, called by the `letter` feature). So on the level whose letter teaches the spear, a player that never touches the second key rolls the spear, and on a replay of level 3 the paper is for the airplane again.
- Switching is a command of its own, `'item/switchUse'`, named for what the player means and owned by `features/item`, which already owns J. An answer in `ANSWERS` may carry a `switchUse` function beside `perform`; the command performs the one of the answer that J would perform right now. So the switch is offered exactly when J would make something and there is another thing to make, with the same "hands busy" rule as J (a letter being read, a flag reached, struck down), and no second place decides it. Crafting's answer is the only one with a `switchUse` so far: it chooses the next recipe the stick man learned that is made from the held item, and after the last, the first.
- The key is L, beside J and K (`client/src/input/actionKeys.ts`, the only place that knows). The HUD shows it under J only while `canSwitchItemUse(sim)` is true, with what would be made instead: "roll a spear" beside J, "fold a paper airplane instead" beside L. What making is called is the HUD's, by the recipe's id.
- One item slot stays. What a letter gives goes into the stick man's hand, and with the slot full it takes the place of what was there (`giveItemInHand`): an airplane is traded for the sheet. The same holds for the sheet that falls from the sky and for what a level that starts again gives back.

## What was considered and not done

- A list of recipes to open and move through, as AGENTS.md foresaw. With two recipes a list is a screen to open, read and close for a choice the default already makes right on every level that exists. Two prompts say the same in one glance. A third recipe from paper still works (L goes round all of them); a fifth is when a list earns its place, and it would replace only how the choice is shown.
- A different item for the spear (the pencil). Rejected by the owner, above.
- Choosing by level: the level says what paper is for. It is what the default already does, through the letter, without a level field; and it would take the choice away where two things are useful on one level.
- A second item slot, so that nothing is traded away. It changes the HUD of every level and adds a second choice (which slot) beside the first. One slot was kept by the owner.
- The switch as a command of `crafting` (`'crafting/switch'`). Then crafting would have to ask whether the stick man's hands are busy, which `item` already asks for J, and the two could disagree about when a key is live.

## Consequences

- `chosenRecipe` is a carried slice: it survives deaths and levels. `startOver` resets it with the rest.
- A recipe id in `chosenRecipe` may be made from an item the stick man does not hold; it is then ignored and the last learned recipe for the held item is made. Nothing has to keep the two in step.
- A feature whose item has two uses of its own returns `switchUse` from its answer and needs nothing else: the command, the key and the "busy" rule are there.
- A stick man that folds an airplane on the spear's level has spent its paper on the wrong thing. It is not stuck: a new sheet falls, picking it up takes the place of the airplane in the slot, and the sheet is for the spear again.
- A stick man holding the spear that reads another letter with its one slot full loses the spear, and nothing gives it back. No level of the game can reach that yet; the first level after the spear's that has a letter has to settle it, with a rule about what a letter may replace.
- Dev builds gain `window.__game.loadSnapshot(snapshot)` and `canSwitchItemUse()`: until a level follows level 3 (#45), a snapshot with both recipes known is the only way to see the choice in the app.
