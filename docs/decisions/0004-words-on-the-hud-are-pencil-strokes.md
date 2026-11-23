# 0004 - Words on the HUD are pencil strokes: a small alphabet of our own, no font

Status: accepted. Date: 2026-11-23.

## Context

Level 3 is the first time the game shows words: the letter's text and what the action keys would do. Everything else on screen is a pencil stroke drawn through `render/strokes/` (ADR 0002), with its wobble, its pressure and its boil.

## Decision

**Text is strokes. `client/src/hud/handwriting.ts` holds an alphabet in which each character is a few short paths, and `written(text, place)` turns a string into `Stroke`s, word-wrapped, for a stroke layer to draw.**

- He prints in capitals: A to Z, the digits and the marks a sentence needs. Capitals are straight pieces and shallow curves, which a path of a few points draws legibly at 15 pixels tall; the stroke layer's wobble does the rest. A character with no drawing leaves a space.
- What the words are stays where it belongs: a letter's text is a def in the sim, and it never names a key; the HUD's own words (what a key would do, what an empty list says) are in `hud/`.
- A Phaser `Text` object with a handwriting web font was not used: it would be the one thing on screen that does not wobble or boil, it would not get the pencil's weight at the level's zoom, and it would add a font to load. Hershey's single-stroke fonts were considered and not taken: a dependency (or a pasted table) for forty characters we can draw ourselves in the game's own hand.
- A page of writing is several hundred strokes. A stroke layer redraws when it is shown a new list, so the HUD keeps the list it made while nothing it was made from has changed (`hud/unchanged.ts`): writing is redrawn when it boils, eight times a second, not sixty.

## Consequences

- Any feature can put words on the HUD by asking `written` for strokes; nothing new is needed in `render/strokes/`.
- No lowercase, no accents. A language that needs them means more glyphs in one file, not a new technique.
- Letter spacing and line height are tuning in `handwriting.ts`; text is sized in the HUD camera's world pixels like every other HUD line.
- Long text costs strokes: a letter of a few sentences is fine, a page of small print would be the thing to measure first (ADR 0002's last consequence).
