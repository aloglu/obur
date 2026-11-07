// Per-device preferences kept in cookies so the server can render the right theme and day without a flash.
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
