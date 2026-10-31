import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KILO_TINT_STEPS, kiloTint } from '#lib/shared/achievement-display.ts';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
	const start = css.indexOf(selector);
	if (start < 0) throw new Error(`Missing ${selector}`);
	const open = css.indexOf('{', start);
	const close = css.indexOf('}', open);
	const vars: Record<string, string> = {};
	for (const m of css.slice(open + 1, close).matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
		vars[m[1]] = m[2];
	}
	return vars;
}

function luminance(hex: string): number {
	const channel = (i: number) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** CSS `color-mix(in srgb, a p%, b)`. */
function mix(a: string, b: string, percent: number): string {
	const p = percent / 100;
	const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
	return `#${[1, 3, 5]
		.map((i) =>
			Math.round(ch(a, i) * p + ch(b, i) * (1 - p))
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

// Text (or meaningful icon) colour on the background it is used against, per docs/ui.md.
const TEXT_PAIRS: [string, string][] = [
	['text', 'bg'],
	['text', 'surface'],
	['text', 'surface2'],
	['muted', 'bg'],
	['muted', 'surface'],
	['muted', 'surface2'],
	['accent', 'surface'],
	['accent', 'soft'],
	['on-accent', 'accent'],
	['good', 'surface'],
	['bad', 'surface'],
	['warn', 'surface'],
	['warn', 'warn-soft'],
	['voice', 'voice-bg'],
	['scan', 'scan-bg'],
	['toast-text', 'toast-bg']
];

const themes = {
	light: block(':root {'),
	'dark (data-theme)': block(":root[data-theme='dark']")
};

describe('Pazar tokens', () => {
	it('defines the same colour roles in light and dark', () => {
		expect(Object.keys(themes['dark (data-theme)']).sort()).toEqual(
			Object.keys(themes.light).sort()
		);
	});

	it('keeps the system-dark block identical to the explicit dark theme', () => {
		const systemDark = block(":root:not([data-theme='light'])");
		expect(systemDark).toEqual(themes['dark (data-theme)']);
	});

	for (const [name, vars] of Object.entries(themes)) {
		it.each(TEXT_PAIRS)(`${name}: %s on %s meets WCAG AA (4.5:1)`, (fg, bg) => {
			expect(contrast(vars[fg], vars[bg])).toBeGreaterThanOrEqual(4.5);
		});

		it(`${name}: every kilo badge's number keeps large-text contrast (3:1) as its tint deepens`, () => {
			for (let step = 0; step < KILO_TINT_STEPS; step++) {
				const { percent, ink } = kiloTint(step * 10 + 2);
				const fill = mix(vars['badge-coral'], vars.surface, percent);
				expect(contrast(vars[`kilo-ink-${ink}`], fill), `${percent} %`).toBeGreaterThanOrEqual(3);
			}
		});

		it.each(['accent', 'good', 'bad', 'protein', 'carb', 'fat'])(
			`${name}: %s ring/bar fill is distinguishable from the track (3:1)`,
			(fill) => {
				expect(contrast(vars[fill], vars.track)).toBeGreaterThanOrEqual(3);
			}
		);
	}
});
