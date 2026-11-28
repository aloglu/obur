// Shared drawing helpers and the palette for obur's own icons (assets/food-icons/STYLE.md). Icons are SVG strings on a
// 1024 grid; build.ts later fits each to its square.

/** A colour family: highlight, base and shadow tones (plus a deeper one where a family needs it). */
export interface Ramp {
	hi: string;
	base: string;
	dark: string;
	deep?: string;
}

/** Every colour an icon uses comes from here, so a family can be retuned for the whole set at once. */
export const P = {
	red: { hi: '#EE6767', base: '#DB374A', dark: '#A51D33' },
	ruby: { hi: '#E8656C', base: '#D23345', dark: '#A51D33', deep: '#8E1A2C' },
	scarlet: { hi: '#F27466', base: '#E5392F', dark: '#B3202B' },
	strawberry: { hi: '#F47D80', base: '#E8414A', dark: '#BF2738' },
	flesh: { hi: '#F7878A', base: '#F0545A', dark: '#D33A44' },
	apricot: { hi: '#FBC871', base: '#F6A73C', dark: '#DE7F28' },
	orange: { hi: '#FBB860', base: '#F7941D', dark: '#DB6E10' },
	cantaloupe: { hi: '#FCCB90', base: '#FAB36B', dark: '#EF8F42' },
	mango: { hi: '#FCD27A', base: '#F9B233', dark: '#E0801F' },
	pineapple: { hi: '#FAD17A', base: '#F4B23A', dark: '#D98A1E', deep: '#C27416' },
	banana: { hi: '#FBE38A', base: '#F7CE3E', dark: '#D9A21C' },
	lemon: { hi: '#FDE78A', base: '#FAD02C', dark: '#E0A812' },
	pear: { hi: '#E2E68F', base: '#C9D04A', dark: '#A3AE2E' },
	lime: { hi: '#B9DE7A', base: '#8CC63F', dark: '#5E9A2A' },
	greenApple: { hi: '#C6E487', base: '#9CCB4B', dark: '#6E9E2E' },
	kiwiFlesh: { hi: '#E9F1C2', base: '#8CC63F', dark: '#6FAA2C' },
	avocadoFlesh: { hi: '#EEF2B8', base: '#D9E49A', dark: '#B8D06A' },
	avocadoSkin: { hi: '#5F8D3E', base: '#3F6B2A', dark: '#2C4F1D' },
	rind: { hi: '#A8D67A', base: '#3E8E3A', dark: '#2C6E2B' },
	leaf: { hi: '#A3C97E', base: '#7BAB55', dark: '#628D44', deep: '#5D8A3E' },
	blueberry: { hi: '#8290CC', base: '#5060A8', dark: '#36427E', deep: '#2A3366' },
	grape: { hi: '#A57BC2', base: '#7D4A9E', dark: '#5A2F78' },
	purple: { hi: '#9C62AE', base: '#7D4290', dark: '#57286A' },
	brown: { hi: '#B48352', base: '#9A6E3E', dark: '#76532B', deep: '#5C3F20' },
	coconut: { hi: '#9A6A44', base: '#7A4E2D', dark: '#5C3920' },
	pit: { hi: '#B07A4C', base: '#8A5A33', dark: '#6B4224' },
	cream: { hi: '#FFFDF7', base: '#FBF6EC', dark: '#EADFCB' },
	meat: { hi: '#C27A50', base: '#A65A33', dark: '#7A3E22', deep: '#6A341C' },
	steel: { hi: '#C9CED4', base: '#AEB4BC', dark: '#8D949D' },
	porcelain: { hi: '#F3F5F6', base: '#E9ECEE', dark: '#CDD4DA', deep: '#C9D0D6' },
	coffee: { hi: '#A4693D', base: '#5A3220', dark: '#3E2215' },
	seed: '#2B2321',
	stem: '#86542F'
} as const;

export const svg = (body: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${body}</svg>`;

export const circle = (cx: number, cy: number, r: number) =>
	`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
	`M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

let clipCount = 0;

/** Anything drawn inside the outline of `d` only. */
export function clipped(d: string, inner: string): string {
	const id = `c${++clipCount}`;
	return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`;
}

/**
 * The house shading: the shape in its dark tone, then in its base tone moved up and left by (dx, dy), both inside the
 * outline. What shows of the dark tone is a crescent on the lower right. `extra` is drawn on top, still inside.
 */
export const shaded = (d: string, base: string, dark: string, dx = -70, dy = -55, extra = '') =>
	clipped(
		d,
		`<path fill="${dark}" d="${d}"/><path fill="${base}" d="${d}" transform="translate(${dx} ${dy})"/>${extra}`
	);

/** `shaded` with a ramp's tones. */
export const ramp = (d: string, r: Ramp, dx = -70, dy = -55, extra = '') =>
	shaded(d, r.base, r.dark, dx, dy, extra);

/** The small light highlight, upper left, turned along the form. */
export const highlight = (
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	angle: number,
	fill: string
) =>
	`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${angle} ${cx} ${cy})"/>`;

/** A round-capped line, for stems, stalks, steam and handles. */
export const line = (d: string, stroke: string, width: number, extra = '') =>
	`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"${extra}/>`;

/** The standard leaf: a pointed oval from (x1, y1) to (x2, y2), bulging by `bulge` on each side. */
export function leaf(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	bulge: number,
	fill: string
): string {
	const mx = (x1 + x2) / 2;
	const my = (y1 + y2) / 2;
	const len = Math.hypot(x2 - x1, y2 - y1);
	const nx = (-(y2 - y1) / len) * bulge;
	const ny = ((x2 - x1) / len) * bulge;
	const r = (n: number) => Math.round(n);
	return `<path fill="${fill}" d="M${x1} ${y1}Q${r(mx + nx)} ${r(my + ny)} ${x2} ${y2}Q${r(mx - nx)} ${r(my - ny)} ${x1} ${y1}Z"/>`;
}
