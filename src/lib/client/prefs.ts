// Settings follow the account (shared/preferences.ts; saved with savePreferences). The look is also kept in cookies, so
// pages before signing in look the same, and applied to the page at once when changed. The time zone cookie is the
// device's own.
import { api } from './api.ts';
import type { Preferences } from '#lib/shared/preferences.ts';
import { DEFAULT_PALETTE, paletteOf, type PaletteId } from '#lib/shared/themes.ts';
import {
	DEFAULT_APP_ICON,
	appIconFile,
	manifestHref,
	type AppIconId
} from '#lib/shared/app-icons.ts';

const YEAR = 365 * 24 * 3600;
const secure = () => (location.protocol === 'https:' ? '; secure' : '');

export type ThemeChoice = 'system' | 'light' | 'dark';

export function currentTheme(): ThemeChoice {
	const value = document.documentElement.dataset.theme;
	return value === 'light' || value === 'dark' ? value : 'system';
}

export function setTheme(choice: ThemeChoice): void {
	if (choice === 'system') {
		document.cookie = `obur_theme=; path=/; max-age=0; samesite=lax${secure()}`;
		delete document.documentElement.dataset.theme;
	} else {
		document.cookie = `obur_theme=${choice}; path=/; max-age=${YEAR}; samesite=lax${secure()}`;
		document.documentElement.dataset.theme = choice;
	}
}

export function setPalette(id: PaletteId): void {
	if (id === DEFAULT_PALETTE) {
		document.cookie = `obur_palette=; path=/; max-age=0; samesite=lax${secure()}`;
		delete document.documentElement.dataset.palette;
	} else {
		document.cookie = `obur_palette=${id}; path=/; max-age=${YEAR}; samesite=lax${secure()}`;
		document.documentElement.dataset.palette = id;
	}
	// The browser's own bars follow the page colour.
	const [light, dark] = paletteOf(id).bg;
	document
		.querySelector('meta[name="theme-color"][media*="light"]')
		?.setAttribute('content', light);
	document.querySelector('meta[name="theme-color"][media*="dark"]')?.setAttribute('content', dark);
}

/** The Home Screen icon: read when obur is added to the Home Screen, so the page's links change at once. */
export function setAppIcon(id: AppIconId): void {
	document.cookie =
		id === DEFAULT_APP_ICON
			? `obur_icon=; path=/; max-age=0; samesite=lax${secure()}`
			: `obur_icon=${id}; path=/; max-age=${YEAR}; samesite=lax${secure()}`;
	document
		.querySelector('link[rel="apple-touch-icon"]')
		?.setAttribute('href', appIconFile(id, 'icon-180.png'));
	document.querySelector('link[rel="manifest"]')?.setAttribute('href', manifestHref(id));
}

export type TimeFormat = 'device' | '24' | '12';

export function setTimeFormat(choice: TimeFormat): void {
	document.cookie =
		choice === 'device'
			? `obur_time=; path=/; max-age=0; samesite=lax${secure()}`
			: `obur_time=${choice}; path=/; max-age=${YEAR}; samesite=lax${secure()}`;
}

/** Saves settings to the account; rejects when it couldn't (offline, say). */
export async function savePreferences(change: Partial<Preferences>): Promise<void> {
	await api('PATCH', '/api/v1/profile/preferences', change);
}

/** Brings this page and this browser's cookies in line with the account's look. */
export function applyLook(
	theme: ThemeChoice,
	palette: PaletteId,
	icon: AppIconId,
	time: TimeFormat
): void {
	if (currentTheme() !== theme) setTheme(theme);
	if ((document.documentElement.dataset.palette ?? DEFAULT_PALETTE) !== palette)
		setPalette(palette);
	const cookie = (name: string) =>
		document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];
	if ((cookie('obur_icon') ?? DEFAULT_APP_ICON) !== icon) setAppIcon(icon);
	if ((cookie('obur_time') ?? 'device') !== time) setTimeFormat(time);
	if ((cookie('obur_theme') ?? 'system') !== theme) setTheme(theme);
	if ((cookie('obur_palette') ?? DEFAULT_PALETTE) !== palette) setPalette(palette);
}

/** A clock time in the chosen format; "device" leaves it to the browser's locale. */
export function clockTime(iso: string, format: TimeFormat): string {
	return new Date(iso).toLocaleTimeString(format === 'device' ? undefined : 'en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		...(format === 'device' ? {} : { hourCycle: format === '12' ? 'h12' : 'h23' })
	});
}

/** Stores the device's time zone; returns true if it changed (so the page should reload its data). */
export function syncZoneCookie(): boolean {
	const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const current = document.cookie.match(/(?:^|; )obur_zone=([^;]*)/)?.[1];
	if (current === encodeURIComponent(zone)) return false;
	document.cookie = `obur_zone=${encodeURIComponent(zone)}; path=/; max-age=${YEAR}; samesite=lax${secure()}`;
	return true;
}

export function deviceZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
