// The app icons people can choose on Appearance (docs/ui.md, "App icon"; owner, 2026-11-07: all nine, Pazar the
// default): the owner's artwork with the background and the O in a theme's colours. Files come from
// scripts/brand-icons.sh; Pazar's are the original icons at the site root.
export const DEFAULT_APP_ICON = 'pazar';

export const APP_ICONS = [
	{ id: 'pazar', name: 'Pazar', background: '#211d19' },
	{ id: 'pazar-light', name: 'Pazar, light', background: '#f6f3ee' },
	{ id: 'sade', name: 'Sade', background: '#111113' },
	{ id: 'zerde', name: 'Zerde', background: '#1c130a' },
	{ id: 'patlican', name: 'Patlıcan', background: '#1a0e19' },
	{ id: 'zeytin', name: 'Zeytin', background: '#15160a' },
	{ id: 'disko', name: 'Disko', background: '#120829' },
	{ id: 'kaset', name: 'Kaset', background: '#6fe3d6' },
	{ id: 'sinyal', name: 'Sinyal', background: '#c6ff00' }
] as const;

export type AppIconId = (typeof APP_ICONS)[number]['id'];

export function isAppIcon(value: string | null | undefined): value is AppIconId {
	return APP_ICONS.some((i) => i.id === value);
}

/** Where an icon's files are: `icon-180.png` (iPhone), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`. */
export const appIconDir = (id: AppIconId) => (id === DEFAULT_APP_ICON ? '' : `/app-icons/${id}`);
export const appIconFile = (id: AppIconId, file: string) => `${appIconDir(id)}/${file}`;
export const manifestHref = (id: AppIconId) =>
	id === DEFAULT_APP_ICON ? '/manifest.webmanifest' : `/manifest.webmanifest?icon=${id}`;
