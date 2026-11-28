# obur's own food icons

The source of obur's own icon set. The app does not use these icons yet: it shows OpenMoji until the whole set
replaces it in one switch. The plan is in `docs/ui.md`, "Our own food icon set"; the rules for drawing are in
`STYLE.md`.

- `icons/*.ts` draw the icons as code, one file per family; `lib.ts` holds the shared helpers and the palette.
- `build.ts` writes `svg/` and fits each drawing to its square. Run `node assets/food-icons/build.ts` after a change,
  then look at the result before committing.
- `svg/` holds the built files. Don't edit them by hand.
- `review.ts` writes the owner's review page for a batch (keep or redo per icon, saved with the page).

So far: the 8-icon pilot (2026-11-27) and batch 1, the fruit (2026-11-28: all 21 kept, 5 of them after picks between versions).

MIT, like the rest of obur. Drawn for obur; no other icon set is traced or copied.
