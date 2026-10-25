// Per-device preferences kept in cookies so the server can render the right theme and day without a flash.
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
