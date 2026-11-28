# Style guide for obur's icons

Every icon in the set follows these rules, so the 300th matches the first. The look was chosen by the owner
(2026-11-27; `docs/ui.md`, "Our own food icon set"). Where a rule and a drawing disagree, fix the drawing.

## The look

- **Flat colour, no outlines.** Shapes meet edge to edge. No strokes around shapes, no gradients, no filters, no
  blur, no text.
- **Two or three tones per hue**, from one ramp in `P` (`lib.ts`): `base` for the body, `dark` for the shadow, `hi` for
  the highlight. Never type a colour into a drawing; add or retune a ramp instead.
- **Light from the upper left.** Every solid form gets the house shading, `ramp()` or `shaded()`: the dark tone shows
  as a crescent on the lower right. The usual offset is (-70, -55) for a large form; smaller forms use a smaller one
  (about a quarter of the radius). A form lit from elsewhere (a banana's curve) may change the direction, never the
  idea.
- **One small highlight per form**, `highlight()`: an ellipse in the ramp's `hi` tone, upper left, turned along the
  form. Not on every grape of a bunch if it gets busy; on the larger ones.
- **At most four hues** in one icon, leaves and stems included.

## Shapes

- Drawn on a 1024 grid, centred near (512, 560). Size doesn't matter much: `build.ts` fits every drawing to its square
  with a 2% margin, measured from the rendered pixels.
- **Draw the real thing.** Start from what the food actually looks like (its true outline, proportions and parts), not
  from the last drawing or the last note alone. A banana is a gently curved band that tapers at both ends and has
  a stalk; a lemon is an oval with a small nub at each end; a pomegranate is nearly round with a crown of sepals.
  `polar()` and `band()` in `lib.ts` draw such outlines from a radius or a centre line.
- Few confident shapes. A food is recognised by its silhouette first, then one telling detail (a seed pattern, a crown,
  a stone). Drop anything that doesn't help recognise it.
- Cut it open when the inside is what identifies it (kiwi, avocado, citrus, melon, coconut). Put a whole one behind
  the cut half when the outside matters too (kiwi, coconut).
- Leaves are `leaf()` in `P.leaf`; stems are `line()` in `P.stem` or `P.leaf.dark`, 30–44 units wide, round caps.
- Small details at least 16 units across (about half a pixel at row size) and spaced so they don't merge.

## Checks before a batch goes to the owner

- At row size: 29 px on the 40 px tile, on the light tile (`#f3ece3`) and the dark tile (`#332c26`). The icon must
  read on both; there are no separate dark files.
- In greyscale: the silhouette and tones should still tell it apart from its neighbours (lemon and lime, apple and
  green apple may share a shape; they differ by colour, and their names sit beside them).
- Beside the icons already kept, for size and weight.
- An icon marked Redo comes back as **three versions** to pick from (`pick.ts`), never a single new guess (owner,
  2026-11-28, after two single redraws of five fruits missed).
- The owner's review page: the Foods rows at real size and keep or redo per icon. No guessing round (owner,
  2026-11-28: unnecessary; never add one).

## Code

- One file per family in `icons/` (fruit, vegetables, dishes, drinks, …), each exporting a `Record` of icons.
- Names are English, lower case, words joined by `_` (`green_apple`, `turkish_coffee`); one name per drawing.
  `build.ts` refuses bad and duplicate names.
- Shapes used more than once (an apple body, a citrus oval) get a constant; variations get a small function.
- After a change run `node assets/food-icons/build.ts` and look at what changed before committing. Never edit `svg/`
  by hand.
