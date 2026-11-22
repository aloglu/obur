// The browsers' push services a reminder subscription may point at (docs/design.md, "Reminders"). The worker sends to
// the subscription's address, so without this list a member could make it send to any server, including ones on the
// server's own network. Chrome, Edge, Firefox and Safari cover the phones and computers obur supports.
const HOSTS = [
	/^fcm\.googleapis\.com$/, // Chrome, Android browsers built on it
	/^updates\.push\.services\.mozilla\.com$/, // Firefox
	/^(?:[a-z0-9-]+\.)*push\.apple\.com$/, // Safari (web.push.apple.com)
	/^(?:[a-z0-9-]+\.)*notify\.windows\.com$/ // Edge on Windows
];

/** Whether a push subscription's address belongs to a known browser push service (https, default port). */
export function isPushService(endpoint: string): boolean {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return false;
	}
	return (
		url.protocol === 'https:' &&
		url.port === '' &&
		url.username === '' &&
		url.password === '' &&
		HOSTS.some((h) => h.test(url.hostname))
	);
}
