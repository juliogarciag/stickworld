# 0010 - A struck enemy is torn in two, and its scraps leave the sheet: the sim times all of it

Status: accepted. Date: 2026-11-28. Supersedes one parenthesis of 0008 ("it is rubbed out"): what being struck does to an enemy is this. The rest of 0008 stands.

## Context

ADR 0008 left what a struck enemy does to the feature that owns it and guessed that it would be rubbed out, and the first version of #44 did that: its drawing went line by line with `getRubbedOutSoFar`. The owner found it wrong once it was on screen. Rubbing out is done to the drawing from outside it, by an eraser the stick man does not have, and the game already uses it for a note the stick man has walked past.

Five replacements were built as drawings and tried in the real game beside the rubbing out, switched with a key in a dev build: it drops and unfolds, it topples, it crumples, it is torn, it is scribbled over. The owner chose the tear ("Tearing it looks more fun"), and raised what all five had in common: the remains stay on the sheet, which does not scale to a level with many enemies. The tryout, its switch and the other five were taken out before the branch reached `main`.

## Decision

**The enemy is paper, and the spear tears it. It tears in two, its halves and its club lie where they fell for a moment, and then they leave the sheet as scraps. The sim owns every duration and says how far along each part is; the view draws from that alone.**

- Being struck is still one number in the enemy's state, `ticksSinceStruck`. From the tick it is set the enemy does nothing, is not solid and hurts nobody, as ADR 0008 and the first version had it.
- What follows has three parts, each a named tuning value in `ENEMY` (`features/enemy/defs.ts`): `tearSeconds`, `lieSeconds`, `leaveSeconds`. `features/enemy/torn.ts` turns the ticks into which part it is at and how far along, and the enemy's view carries that as `torn: { action, progress } | null`.
- When the three are over the enemy is taken off the level's list. Nothing of it stays in the state or on the sheet, however many enemies a level has. A level that starts again has it back.
- Everything about how it looks is the client's (`render/tornClubEnemy.ts`): where the tear runs, how the upper half falls off, where the club comes to lie, and how the scraps are carried off. The client keeps no clock for it. A sheet being turned away, a restored snapshot and a recording replayed all show the same tear at the same tick.
- The scraps have to be out of sight before the sim has them gone, since the sim removes the enemy on a tick and the drawing stops there. The client's numbers for how far the wind carries a scrap are chosen against the widest view the camera takes, and a test holds that.
- The club needs no rule of its own: it falls with the halves and leaves with them.

## What was considered and not done

- The other four ways, and the rubbing out. Tried and not chosen; the scribble was the weakest read, since the body stayed standing while the stick man walked through it.
- Remains that stay. They read well for one enemy and were the owner's concern for many. Keeping them would mean a struck enemy that is never removed: one state entry and one drawing per enemy killed, for the rest of the level.
- Remains that fade or are rubbed out after a while. Fading is not something a pencil drawing does, and rubbing out is what was just taken away.
- The view timing the tear itself, as the tryout did. The view would then need to remember enemies the sim had already removed, which is what the page turn needs a second sim for (ADR 0005), and a snapshot restored in the middle of a tear would show nothing.
- Remains with rules: halves the stick man trips on, a club that can be picked up. Nothing asked for it.

## Consequences

- From the thrust that reaches it to the tick it is gone, an enemy is on the list for `tearSeconds + lieSeconds + leaveSeconds` (2.2 s now) with `torn` set. Anything that counts or looks for enemies has to decide whether a torn one counts; `strikeEnemiesWith` already skips it, and so do its body and its club.
- A second kind of enemy gets the same three parts and its own drawing of them, picked where its drawing is picked (`scenes/Sheet.ts`).
- Changing how the scraps leave, or whether they leave at all, is small. The durations are three numbers. Leaving them lying for good is `leaveSeconds` gone and the removal with it, at the cost above. A different way of leaving is the one function in the client that moves a scrap.
- `getRubbedOutSoFar` is again only for what is written on a sheet.
