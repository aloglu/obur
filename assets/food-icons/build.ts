// obur's own food icons, the 8-icon pilot of 2026-11-27 (docs/ui.md, "Our own food icon set"). Not used by the app
// yet: OpenMoji stays until the whole set replaces it. Each icon is drawn here as code; this script writes the SVGs
// to assets/food-icons/svg/ and fits each one's viewBox to its drawing in a browser. Run:
//   node assets/food-icons/build.ts
//
// The look: flat colour, no outlines, two or three tones per hue. A shape's shadow is a darker crescent on the lower
// right, made by clipping a copy of the shape moved up and left (`shaded`); a small light highlight sits upper left.
// Drawn on a 1024 grid; the fit step then makes each drawing fill its square with a 2% margin.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'assets/food-icons/svg';

const LEAF = '#7BAB55';
const LEAF_DARK = '#628D44';
const STEM = '#86542F';

let clipCount = 0;
/** A shape with its shadow crescent: the dark shape, then the base shape moved by (dx, dy), clipped to the shape. */
function shaded(d: string, base: string, dark: string, dx = -70, dy = -55, highlight = ''): string {
	const id = `c${++clipCount}`;
	return (
		`<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><path fill="${dark}" d="${d}"/>` +
		`<path fill="${base}" d="${d}" transform="translate(${dx} ${dy})"/></g>${highlight}`
	);
}

const svg = (body: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${body}</svg>`;

const circle = (cx: number, cy: number, r: number) =>
	`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/** A kebab piece on the skewer (drawn horizontally, then the group is turned): dark block, lighter block on top. */
const chunk = (x: number, w: number, h: number, base: string, dark: string) =>
	`<rect x="${x}" y="${512 - h / 2}" width="${w}" height="${h}" rx="46" fill="${dark}"/>` +
	`<rect x="${x}" y="${512 - h / 2}" width="${w - 22}" height="${h - 34}" rx="42" fill="${base}"/>`;

const icons: Record<string, string> = {};

icons.pear = svg(
	`<path d="M512 240C512 180 530 120 566 70" fill="none" stroke="${STEM}" stroke-width="40" stroke-linecap="round"/>` +
		`<path fill="${LEAF}" d="M560 130C620 60 720 50 790 80C740 150 650 175 560 130Z"/>` +
		shaded(
			'M512 220C592 220 628 285 642 370C656 455 770 525 798 660C836 840 690 965 512 965C334 965 188 840 226 660C254 525 368 455 382 370C396 285 432 220 512 220Z',
			'#C9D04A',
			'#A3AE2E',
			-70,
			-55,
			'<ellipse cx="370" cy="700" rx="40" ry="80" fill="#E2E68F" transform="rotate(20 370 700)"/>'
		)
);

icons.cherries = svg(
	`<path d="M340 560C380 380 470 240 600 110M700 620C690 430 650 260 600 110" fill="none" stroke="${LEAF_DARK}" stroke-width="34" stroke-linecap="round"/>` +
		`<path fill="${LEAF}" d="M600 112C650 40 770 30 850 70C790 150 690 170 600 112Z"/>` +
		shaded(
			circle(330, 735, 215),
			'#DB374A',
			'#A51D33',
			-55,
			-45,
			'<ellipse cx="250" cy="680" rx="34" ry="58" fill="#EE6767" transform="rotate(25 250 680)"/>'
		) +
		shaded(
			circle(705, 770, 205),
			'#DB374A',
			'#A51D33',
			-55,
			-45,
			'<ellipse cx="630" cy="715" rx="32" ry="55" fill="#EE6767" transform="rotate(25 630 715)"/>'
		)
);

icons.apricot = svg(
	shaded(
		'M512 175C760 175 905 360 905 575C905 800 735 960 512 960C289 960 119 800 119 575C119 360 264 175 512 175Z',
		'#F6A73C',
		'#DE7F28',
		-70,
		-55,
		'<path d="M500 200C420 380 430 700 540 940" fill="none" stroke="#DE7F28" stroke-width="22" stroke-linecap="round" opacity=".8"/>' +
			'<ellipse cx="300" cy="420" rx="60" ry="100" fill="#FBC871" transform="rotate(30 300 420)"/>'
	) +
		`<path d="M512 210C515 160 530 120 555 90" fill="none" stroke="${STEM}" stroke-width="34" stroke-linecap="round"/>` +
		`<path fill="${LEAF}" d="M545 120C610 50 730 50 800 95C730 165 630 175 545 120Z"/>`
);

icons.pomegranate = svg(
	'<path fill="#A51D33" d="M395 290L405 140L465 205L512 105L559 205L619 140L629 290Z"/>' +
		shaded(
			circle(512, 590, 375),
			'#D23345',
			'#A51D33',
			-70,
			-55,
			'<ellipse cx="330" cy="470" rx="55" ry="95" fill="#E8656C" transform="rotate(30 330 470)"/>' +
				'<path fill="#8E1A2C" d="M440 255C470 235 554 235 584 255C560 275 464 275 440 255Z"/>'
		)
);

icons.eggplant = svg(
	shaded(
		'M720 250C850 320 860 520 760 660C640 830 440 965 270 905C130 855 140 690 260 600C380 510 480 470 560 330C600 270 650 235 720 250Z',
		'#7D4290',
		'#57286A',
		-70,
		-55,
		'<ellipse cx="330" cy="760" rx="38" ry="90" fill="#9C62AE" transform="rotate(55 330 760)"/>'
	) +
		`<path d="M760 245C780 180 820 130 880 100" fill="none" stroke="${LEAF_DARK}" stroke-width="44" stroke-linecap="round"/>` +
		`<path fill="${LEAF}" d="M585 345C615 255 690 215 760 222C830 230 880 280 900 345C850 318 812 330 790 362C770 312 710 300 670 335C640 360 610 362 585 345Z"/>`
);

icons.chili = svg(
	shaded(
		'M330 230C470 230 545 330 590 460C645 615 725 760 885 880C660 940 445 850 350 700C265 565 235 420 240 320C242 270 278 230 330 230Z',
		'#E5392F',
		'#B3202B',
		-45,
		-40,
		'<path d="M360 330C350 450 390 590 470 700" fill="none" stroke="#F27466" stroke-width="30" stroke-linecap="round"/>'
	) +
		`<path d="M300 265C280 200 240 150 170 130" fill="none" stroke="${LEAF_DARK}" stroke-width="42" stroke-linecap="round"/>` +
		`<path fill="${LEAF}" d="M240 330C240 255 300 222 360 240C400 252 420 285 420 320C390 300 360 300 335 320C300 300 265 305 240 330Z"/>`
);

const MEAT = ['#A65A33', '#7A3E22'] as const;
const GRILL = 'stroke="#6A341C" stroke-width="20" stroke-linecap="round"';
icons.kebab = svg(
	'<g transform="rotate(-45 512 512)">' +
		'<path d="M60 512H1090" stroke="#AEB4BC" stroke-width="34" stroke-linecap="round"/>' +
		'<circle cx="30" cy="512" r="60" fill="none" stroke="#8D949D" stroke-width="32"/>' +
		chunk(150, 250, 310, ...MEAT) +
		`<path d="M215 425V585M295 425V585" ${GRILL}/>` +
		chunk(415, 140, 270, '#7BAB55', '#5D8A3E') +
		chunk(570, 250, 310, ...MEAT) +
		`<path d="M635 425V585M715 425V585" ${GRILL}/>` +
		shaded(circle(945, 512, 125), '#E5392F', '#B3202B', -35, -30) +
		'</g>'
);

icons.turkish_coffee = svg(
	'<circle cx="800" cy="545" r="82" fill="none" stroke="#C9D0D6" stroke-width="44"/>' +
		shaded(
			'M110 820C110 770 290 735 512 735C734 735 914 770 914 820C914 880 734 915 512 915C290 915 110 880 110 820Z',
			'#E9ECEE',
			'#C9D0D6',
			0,
			-30
		) +
		shaded(
			'M240 420H784C780 640 690 800 512 800C334 800 244 640 240 420Z',
			'#F3F5F6',
			'#CDD4DA',
			-80,
			0
		) +
		'<ellipse cx="512" cy="420" rx="272" ry="64" fill="#CDD4DA"/>' +
		'<ellipse cx="512" cy="424" rx="240" ry="48" fill="#5A3220"/>' +
		'<ellipse cx="500" cy="420" rx="200" ry="34" fill="#A4693D"/>' +
		'<path d="M300 520C320 620 370 700 440 740" fill="none" stroke="#C0392B" stroke-width="22" stroke-linecap="round" opacity=".85"/>' +
		'<path d="M440 330C400 270 480 230 440 160M580 330C540 270 620 230 580 160" fill="none" stroke="#C9D0D6" stroke-width="24" stroke-linecap="round"/>'
);

// Fit: measure each drawing (clip paths aside) and set a square viewBox around it with a 2% margin.
const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
for (const [name, source] of Object.entries(icons)) {
	await page.setContent(source);
	const box = await page.evaluate(() => {
		const root = document.querySelector('svg')!;
		const g = document.createElementNS(root.namespaceURI, 'g');
		for (const n of [...root.childNodes]) if (n.nodeName !== 'clipPath') g.appendChild(n);
		root.appendChild(g);
		const r = g.getBBox();
		const side = Math.max(r.width, r.height) * 1.04;
		return [r.x + r.width / 2 - side / 2, r.y + r.height / 2 - side / 2, side, side].map(
			Math.round
		);
	});
	writeFileSync(
		`${OUT}/${name}.svg`,
		source.replace('viewBox="0 0 1024 1024"', `viewBox="${box.join(' ')}"`) + '\n'
	);
}
await browser.close();
console.log(`${Object.keys(icons).length} icons written to ${OUT}`);
