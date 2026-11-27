# obur's own food icons

The source of obur's own food icon set. This folder holds the 8-icon pilot (2026-11-27): pear, cherries, apricot,
pomegranate, eggplant, chicken şiş (`kebab`), chili and Turkish coffee. The app does not use these icons yet: it shows
OpenMoji until the whole set replaces it in one switch. The plan, the look and the open questions are in `docs/ui.md`,
"Our own food icon set".

- `build.ts` draws every icon as code and writes `svg/`. Run `node assets/food-icons/build.ts` after changing it,
  then look at the result before committing.
- `svg/` holds the built files. Don't edit them by hand.

MIT, like the rest of obur. Drawn for obur; no other icon set is traced or copied.
