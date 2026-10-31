// This device's reminders (docs/ui.md, "Reminders"): whether Web Push works here, and turning it on or off for the
// signed-in person. On an iPhone it works only in the app added to the Home Screen.
import { api } from './api.ts';

export type PushState = 'unsupported' | 'install' | 'blocked' | 'off' | 'on';

const supported = () =>
	typeof window !== 'undefined' &&
	'serviceWorker' in navigator &&
	'PushManager' in window &&
	'Notification' in window;

/** iPhone and iPad Safari only offer push to the installed app. */
const needsInstall = () =>
	/iP(hone|ad|od)/.test(navigator.userAgent) &&
	!matchMedia('(display-mode: standalone)').matches &&
	!(navigator as Navigator & { standalone?: boolean }).standalone;

async function current(): Promise<PushSubscription | null> {
	const registration = await navigator.serviceWorker.ready;
	return registration.pushManager.getSubscription();
}

export async function pushState(): Promise<PushState> {
	if (!supported()) return needsInstall() ? 'install' : 'unsupported';
	if (Notification.permission === 'denied') return 'blocked';
	const sub = await current();
	if (!sub) return 'off';
	const { subscribed } = await api<{ subscribed: boolean }>(
		'GET',
		`/api/v1/reminders/subscription?endpoint=${encodeURIComponent(sub.endpoint)}`
	);
	return subscribed ? 'on' : 'off';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
	const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
		.replace(/-/g, '+')
		.replace(/_/g, '/');
	return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Asks for permission (from a tap), subscribes this device and tells the server. */
export async function startReminders(publicKey: string): Promise<PushState> {
	if ((await Notification.requestPermission()) !== 'granted') return pushState();
	const registration = await navigator.serviceWorker.ready;
	const sub =
		(await registration.pushManager.getSubscription()) ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: keyBytes(publicKey)
		}));
	await api('POST', '/api/v1/reminders/subscription', sub.toJSON());
	return 'on';
}

/** This device stops receiving the signed-in person's reminders (the browser subscription may serve others). */
export async function stopReminders(): Promise<void> {
	try {
		if (!supported()) return;
		const sub = await current();
		if (sub) await api('DELETE', '/api/v1/reminders/subscription', { endpoint: sub.endpoint });
	} catch {
		// Offline or already gone: the server drops it when the push service reports it gone.
	}
}
