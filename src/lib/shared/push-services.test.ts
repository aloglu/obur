import { describe, expect, it } from 'vitest';
import { isPushService } from './push-services.ts';

describe('isPushService', () => {
	it('accepts the browsers’ push services', () => {
		for (const url of [
			'https://fcm.googleapis.com/fcm/send/abc:def',
			'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
			'https://web.push.apple.com/QGuQ',
			'https://wns2-par02p.notify.windows.com/w/?token=AwYA'
		])
			expect(isPushService(url)).toBe(true);
	});

	it('refuses anything else, look-alikes included', () => {
		for (const url of [
			'https://192.168.1.10/hook',
			'https://localhost/push',
			'http://fcm.googleapis.com/fcm/send/x',
			'https://fcm.googleapis.com:8443/x',
			'https://fcm.googleapis.com.evil.example/x',
			'https://evilpush.apple.com.example/x',
			'https://user@fcm.googleapis.com/x',
			'not a url'
		])
			expect(isPushService(url)).toBe(false);
	});
});
