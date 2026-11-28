// Drinks.
import { P, line, shaded, svg } from '../lib.ts';

export const drinks: Record<string, string> = {};

// --- Pilot (2026-11-27) ---

drinks.turkish_coffee = svg(
	`<circle cx="800" cy="545" r="82" fill="none" stroke="${P.porcelain.deep}" stroke-width="44"/>` +
		shaded(
			'M110 820C110 770 290 735 512 735C734 735 914 770 914 820C914 880 734 915 512 915C290 915 110 880 110 820Z',
			P.porcelain.base,
			P.porcelain.deep!,
			0,
			-30
		) +
		shaded(
			'M240 420H784C780 640 690 800 512 800C334 800 244 640 240 420Z',
			P.porcelain.hi,
			P.porcelain.dark,
			-80,
			0
		) +
		`<ellipse cx="512" cy="420" rx="272" ry="64" fill="${P.porcelain.dark}"/>` +
		`<ellipse cx="512" cy="424" rx="240" ry="48" fill="${P.coffee.base}"/>` +
		`<ellipse cx="500" cy="420" rx="200" ry="34" fill="${P.coffee.hi}"/>` +
		line('M300 520C320 620 370 700 440 740', '#C0392B', 22, ' opacity=".85"') +
		line('M440 330C400 270 480 230 440 160M580 330C540 270 620 230 580 160', P.porcelain.deep!, 24)
);
