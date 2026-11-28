# Architecture decisions

One file per decision, numbered, never edited after the fact (write a new one that supersedes it). Keep them short: context, decision, consequences.

- [0001 - The sim and the view: a headless sim advanced in fixed steps, and a Phaser view that only draws it](0001-sim-and-view-with-a-fixed-step.md)
- [0002 - How pencil strokes are drawn: Phaser Graphics lines with a dab on every joint, under the paper's tooth](0002-how-pencil-strokes-are-drawn.md)
- [0003 - Two fixed action keys: `item/use` and `world/interact` are each owned by a small feature that asks the others what the press means](0003-fixed-keys-and-the-features-that-answer-for-them.md)
- [0004 - Words on the HUD are pencil strokes: a small alphabet of our own, no font](0004-words-on-the-hud-are-pencil-strokes.md)
- [0005 - A level is a sheet: notes in its data, a page turned between two, a camera that looks ahead, a game that can be played again](0005-a-level-is-a-sheet.md)
- [0006 - How he moves is sim state a dev build can tune while the game runs, and letting go of the jump is a command](0006-movement-tuning-is-sim-state.md)
- [0007 - A feature's state is its own, every slice says whether it carries, and a level starts between two ticks](0007-a-features-state-is-its-own-and-a-level-starts-between-two-ticks.md)
- [0008 - How things hurt the stick man and how it hurts them: the one who is struck owns the hit test](0008-how-things-hurt-the-stick-man-and-how-it-hurts-them.md)
