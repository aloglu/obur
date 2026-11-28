// Dishes.
import { P, circle, ramp, svg } from '../lib.ts';

export const dishes: Record<string, string> = {};

/** A piece on the skewer (drawn horizontally, then the group is turned): dark block, lighter block on top. */
const chunk = (x: number, w: number, h: number, base: string, dark: string) =>
	`<rect x="${x}" y="${512 - h / 2}" width="${w}" height="${h}" rx="46" fill="${dark}"/>` +
	`<rect x="${x}" y="${512 - h / 2}" width="${w - 22}" height="${h - 34}" rx="42" fill="${base}"/>`;
const GRILL = `stroke="${P.meat.deep}" stroke-width="20" stroke-linecap="round"`;

// --- Pilot (2026-11-27) ---

dishes.kebab = svg(
	'<g transform="rotate(-45 512 512)">' +
		`<path d="M60 512H1090" stroke="${P.steel.base}" stroke-width="34" stroke-linecap="round"/>` +
		`<circle cx="30" cy="512" r="60" fill="none" stroke="${P.steel.dark}" stroke-width="32"/>` +
		chunk(150, 250, 310, P.meat.base, P.meat.dark) +
		`<path d="M215 425V585M295 425V585" ${GRILL}/>` +
		chunk(415, 140, 270, P.leaf.base, P.leaf.deep) +
		chunk(570, 250, 310, P.meat.base, P.meat.dark) +
		`<path d="M635 425V585M715 425V585" ${GRILL}/>` +
		ramp(circle(945, 512, 125), P.scarlet, -35, -30) +
		'</g>'
);
