// Builds obur's own icons (docs/ui.md, "Our own food icon set"; the rules in STYLE.md). Not used by the app yet:
// OpenMoji stays until the whole set replaces it. Each icon is drawn as code in icons/*.ts; this script writes the
// SVGs to assets/food-icons/svg/ and fits each one's viewBox to its drawing in a browser. Run:
//   node assets/food-icons/build.ts
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { dishes } from './icons/dishes.ts';
import { drinks } from './icons/drinks.ts';
import { fruit } from './icons/fruit.ts';
import { vegetables } from './icons/vegetables.ts';

const OUT = 'assets/food-icons/svg';

const families = { fruit, vegetables, dishes, drinks };
const icons: Record<string, string> = {};
for (const [family, set] of Object.entries(families)) {
	for (const [name, source] of Object.entries(set)) {
		if (!/^[a-z]+(_[a-z]+)*$/.test(name)) throw new Error(`${family}: bad icon name "${name}"`);
		if (icons[name]) throw new Error(`${family}: "${name}" is drawn twice`);
		icons[name] = source;
	}
}

// Fit: draw each icon on a canvas covering -512..1536 (drawings may reach past the 1024 grid), find the painted
// pixels, and set a square viewBox around them with a 2% margin. Measuring pixels, not geometry, takes clipping
// and transforms into account.
const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(OUT))
	if (!icons[file.replace(/\.svg$/, '')]) rmSync(`${OUT}/${file}`);
for (const [name, source] of Object.entries(icons)) {
	const wide = source.replace('viewBox="0 0 1024 1024"', 'viewBox="-512 -512 2048 2048"');
	const box = await page.evaluate(async (svgText) => {
		const img = new Image();
		img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
		await img.decode();
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 2048;
		const g = canvas.getContext('2d')!;
		g.drawImage(img, 0, 0, 2048, 2048);
		const data = g.getImageData(0, 0, 2048, 2048).data;
		let [x0, y0, x1, y1] = [2048, 2048, -1, -1];
		for (let y = 0; y < 2048; y++)
			for (let x = 0; x < 2048; x++)
				if (data[(y * 2048 + x) * 4 + 3] > 8) {
					if (x < x0) x0 = x;
					if (x > x1) x1 = x;
					if (y < y0) y0 = y;
					if (y > y1) y1 = y;
				}
		// One canvas pixel is one grid unit; the canvas starts at -512.
		const [w, h] = [x1 - x0 + 1, y1 - y0 + 1];
		const side = Math.max(w, h) * 1.04;
		return [x0 - 512 + w / 2 - side / 2, y0 - 512 + h / 2 - side / 2, side, side].map(Math.round);
	}, wide);
	writeFileSync(
		`${OUT}/${name}.svg`,
		source.replace('viewBox="0 0 1024 1024"', `viewBox="${box.join(' ')}"`) + '\n'
	);
}
await browser.close();
console.log(`${Object.keys(icons).length} icons written to ${OUT}`);
