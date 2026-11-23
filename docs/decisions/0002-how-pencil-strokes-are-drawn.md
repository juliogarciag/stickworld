# 0002 - How pencil strokes are drawn: Phaser Graphics lines with a dab on every joint, under the paper's tooth

Status: accepted. Date: 2026-11-22.

## Context

Everything in Stickworld is pencil on a sheet of paper, so one question decides the look of the whole game: what turns "a line from here to there" into pixels. Issue #1 built the first look (the paper, level 1's floor, the stick man walking) to answer it, trying three techniques in a fixed order and stopping at the first that looked right. Phaser 4 stays whichever wins.

A stroke has to look like graphite (a grain, never a flat colour), have round ends and corners at any thickness, press harder in some places than others, "boil" slightly like hand animation, and cost little enough that a level full of lines still runs at 60 frames a second on a Retina screen.

## Decision

**A stroke is drawn with Phaser Graphics: a straight piece between each two points of its path and a filled circle (a dab) stamped on every point. The graphite's grain is not part of the stroke: it is the paper's tooth, one tiled texture laid over everything drawn on the sheet.**

- **One door.** `packages/client/src/render/strokes/` is the only place a stroke is drawn. A caller makes a layer once and shows it strokes:

  ```ts
  const floor = createStrokeLayer(scene);
  floor.show([{ points: [from, to], thickness: PENCIL.thickness }]);
  ```

  A `Stroke` is a list of points and a thickness in world pixels, and `closed: true` for a loop. `show` replaces what the layer showed before; a layer shown once keeps boiling by itself. Lint rejects the Phaser factories that draw lines and shapes (`add.graphics()`, `make.graphics()`, `add.rope()`, the shape factories, `new Graphics`) anywhere else in the client; it cannot see a factory called through another name, so the rule still needs a reviewer.
- **The hand, separate from the technique.** `handDrawn.ts` turns the exact path into the path a hand would draw: points every 6 world pixels, strayed sideways by smooth noise, pressed lighter at both ends and unevenly along the way, a loop carried a little past its start. It is plain arithmetic without Phaser, tested headless, and the same whichever technique paints it. Its tuning is in `pencil.ts`.
- **The boil.** The noise is seeded by the stroke and by a redraw number that goes up 8 times a second, so every line is redrawn a little differently 8 times a second and is identical between redraws. Nothing is random at run time: the same stroke at the same moment is the same pixels.
- **The technique.** `graphicsLayer.ts` paints that path: a circle of the pressed width on each point and a line to the next. The circles are what hide the chipped corners of thick lines and what let the width change along a line. Points far off screen are skipped.
- **The grain.** `render/paper.ts` lays two tiled textures: the sheet under everything, and over everything its tooth, which is the paper's colour: strong at the specks a pencil does not reach and a faint haze elsewhere (graphite is never solid). Over bare paper the tooth is all but invisible; over a solid line it is what makes the line graphite. It is laid from the world's origin, so the grain stays on the paper when the camera moves. Everything drawn on the paper sits between the sheet's depth and the tooth's; what is not on the paper (a HUD) goes above the tooth.

### The techniques tried, in the ticket's order

Screenshots of each are in `verifications/1-look-test/proof/` (`01-technique-*`), taken at commit `6321917`, where all three sat behind the same `StrokeLayer` and drew the same hand-drawn path.

1. **Phaser Rope with a pencil-grain texture: lost.** The grain came out right only by accident of length. Rope stretches its texture from the first point to the last, so the same grain was smeared into dashes along the 12 m floor and squeezed into cross-hatching on a forearm. The strip's ends are cut square, it pinches at knees and elbows, its width is the texture's height (one texture per thickness, and no change of pressure along a line), and Rope has no Canvas renderer.
2. **Graphics lines with circles stamped on the joints: flat on its own, chosen with the tooth.** Round ends, clean corners, pressure along the line, drawn by the GPU. As the ticket describes it, it looked like a marker: one flat colour. The grain it lacked does not have to come from the stroke, and taking it from the paper's tooth made it look right.
3. **A Canvas 2D surface shown as a texture: looked right, cost too much.** Drawing with the browser's lines and erasing the tooth out of them looked like pencil at once. But the surface has to be sent to the GPU every time it changes, which is every frame while anything moves, and that costs time in proportion to its area. Measured on an M1 Max at 2880x1800: 52 ms a frame for one surface the size of the screen (19 frames a second); 6 to 8 ms a frame after shrinking each layer's surface to the rectangle its strokes cover, most of it filling the grain pattern in software. The chosen technique measured 0.07 ms a frame for the same picture.

rough.js was not tried: `handDrawn.ts` is short, has no dependency, and gives the boil control over exactly when a line changes.

## Consequences

- A feature that draws something asks for strokes; it never touches Graphics. Swapping the technique later means rewriting `graphicsLayer.ts` (and, if the grain moves with it, the tooth in `paper.ts`), not the callers.
- The grain is the paper's, so everything on the sheet gets it, including things that are not pencil. That is right for paper objects; anything that must stay clean has to be drawn above the tooth.
- Where two lines cross, the crossing is not darker, as it would be with real graphite. Nobody is likely to notice at these thicknesses; getting it would mean per-stroke transparency.
- Strokes are world pixels and so is the tooth: lines and grain keep the same proportions at every window size and pixel ratio. The sheet's own grain is in screen pixels, as fine as the screen.
- A stroke costs a circle and a line per 6 world pixels of its length that is on screen, rebuilt when it changes or boils. Long lines are fine; thousands of separate strokes at once would be the thing to measure first.
- How something looks cannot be asserted, only shown. The checks in a ticket's verification can prove a line is where the level says, that it has a grain and that it boils; whether it looks right is for a person looking at the screenshots.
