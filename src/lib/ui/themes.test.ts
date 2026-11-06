import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KILO_TINT_STEPS, kiloTint } from '#lib/shared/achievement-display.ts';
import { PALETTES } from '#lib/shared/themes.ts';

const themes = readFileSync(new URL('./themes.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function vars(css: string, selector: string): Record<string, string> {
	const start = css.indexOf(selector);
	if (start < 0) throw new Error(`Missing ${selector}`);
	const open = css.indexOf('{', start);
	const out: Record<string, string> = {};
	for (const m of css
		.slice(open + 1, css.indexOf('}', open))
		.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
		out[m[1]] = m[2].toLowerCase();
	}
	return out;
}

function luminance(hex: string): number {
	const channel = (i: number) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

function mix(a: string, b: string, percent: number): string {
	const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
	return `#${[1, 3, 5]
		.map((i) =>
			Math.round((ch(a, i) * percent + ch(b, i) * (100 - percent)) / 100)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;
}

// Text or meaningful icons on the background they are used against.
const TEXT: [string, string][] = [
	['text', 'bg'],
	['text', 'surface'],
	['text', 'surface2'],
	['muted', 'bg'],
	['muted', 'surface'],
	['muted', 'surface2'],
	['accent', 'bg'],
	['accent', 'surface'],
	['accent', 'soft'],
	['on-accent', 'fill'],
	['good', 'surface'],
	['bad', 'surface'],
	['bad', 'surface2'],
	['warn', 'surface'],
	['warn', 'warn-soft'],
	['voice', 'voice-bg'],
	['scan', 'scan-bg'],
	['toast-text', 'toast-bg']
];

const extra = PALETTES.filter((p) => p.id !== 'pazar');
const base = {
	light: vars(tokens, ':root {'),
	dark: vars(tokens, ":root[data-theme='dark']")
};

describe.each(extra)('$name', ({ id, bg }) => {
	const light = vars(themes, `:root[data-palette='${id}']`);
	const dark = vars(themes, `:root[data-theme='dark'][data-palette='${id}']`);

	it('defines every colour role the default theme has, in light and dark', () => {
		for (const mode of [light, dark]) {
			expect(Object.keys(base.light).filter((k) => !(k in mode))).toEqual([]);
		}
	});

	it('keeps the system-dark block identical to the explicit dark theme', () => {
		expect(vars(themes, `:root:not([data-theme='light'])[data-palette='${id}']`)).toEqual(dark);
	});

	it('names the same page colours as the browser theme colour', () => {
		expect([light.bg, dark.bg]).toEqual([...bg]);
	});

	for (const [mode, v] of [
		['light', light],
		['dark', dark]
	] as const) {
		const colours: Record<string, string> = { ...v, fill: v.fill ?? v.accent };

		it.each(TEXT)(`${mode}: %s on %s meets WCAG AA (4.5:1)`, (fg, back) => {
			expect(contrast(colours[fg], colours[back])).toBeGreaterThanOrEqual(4.5);
		});

		it.each(['good', 'bad', 'protein', 'carb', 'fat'])(
			`${mode}: %s bar stands out from the track (3:1)`,
			(fill) => {
				expect(contrast(colours[fill], colours.track)).toBeGreaterThanOrEqual(3);
			}
		);

		it(`${mode}: every kilo badge's number keeps large-text contrast (3:1)`, () => {
			for (let step = 0; step < KILO_TINT_STEPS; step++) {
				const { percent, ink } = kiloTint(step * 10 + 2);
				const back = mix(colours['badge-coral'], colours.surface, percent);
				expect(contrast(colours[`kilo-ink-${ink}`], back), `${percent} %`).toBeGreaterThanOrEqual(
					3
				);
			}
		});
	}
});
