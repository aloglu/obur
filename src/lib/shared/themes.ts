// The app's themes (docs/ui.md, "Themes"). Colours live in ui/tokens.css (Pazar) and ui/themes.css (the rest);
// `bg` repeats the page colour for the browser's theme-color, and `swatch` the two colours shown in the picker.
export const DEFAULT_PALETTE = 'pazar';

export const PALETTES = [
	{ id: 'pazar', name: 'Pazar', bg: ['#f6f3ee', '#161310'], swatch: ['#c2410c', '#f6f3ee'] },
	{ id: 'sade', name: 'Sade', bg: ['#f6f5f4', '#111113'], swatch: ['#2563eb', '#f6f5f4'] },
	{ id: 'zerde', name: 'Zerde', bg: ['#fbefcb', '#1c130a'], swatch: ['#f5b301', '#fbefcb'] },
	{ id: 'patlican', name: 'Patlıcan', bg: ['#f5e8e2', '#1a0e19'], swatch: ['#5b1f52', '#f5e8e2'] },
	{ id: 'zeytin', name: 'Zeytin', bg: ['#efead2', '#15160a'], swatch: ['#55600f', '#efead2'] },
	{ id: 'disko', name: 'Disko', bg: ['#ffd9ef', '#120829'], swatch: ['#ff2e9a', '#120829'] },
	{ id: 'kaset', name: 'Kaset', bg: ['#6fe3d6', '#12103a'], swatch: ['#5b1fbf', '#6fe3d6'] },
	{ id: 'sinyal', name: 'Sinyal', bg: ['#c6ff00', '#0a0b08'], swatch: ['#0e0f0a', '#c6ff00'] }
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

export function isPalette(value: string | undefined): value is PaletteId {
	return PALETTES.some((p) => p.id === value);
}

export function paletteOf(id: PaletteId) {
	return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
