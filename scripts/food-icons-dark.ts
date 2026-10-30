// Writes the dark-theme food icons: OpenMoji's black outlines and details redrawn in a soft light tone, every other
// colour unchanged, so the icons sit on a dark tile (docs/ui.md, "Food icons"). Run after adding or changing icons:
//   node scripts/food-icons-dark.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'static/icons/food';
const TARGET = `${SOURCE}/dark`;
/** Close to the dark theme's text colour, a little softer so outlines don't glare. */
const OUTLINE = '#e6ddd2';

mkdirSync(TARGET, { recursive: true });
let count = 0;
for (const file of readdirSync(SOURCE).filter((f) => f.endsWith('.svg'))) {
	const svg = readFileSync(`${SOURCE}/${file}`, 'utf8').replace(
		/(stroke|fill)="#000(?:000)?"/g,
		(_, attr: string) => `${attr}="${OUTLINE}"`
	);
	writeFileSync(`${TARGET}/${file}`, svg);
	count += 1;
}
console.log(`${count} dark icons written to ${TARGET}`);
