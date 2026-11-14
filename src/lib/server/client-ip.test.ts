import { describe, expect, it } from 'vitest';
import { clientAddress } from './client-ip.ts';

describe('clientAddress', () => {
	it('takes the address the nearest proxy added when the connection is from a local proxy', () => {
		expect(clientAddress('127.0.0.1', '203.0.113.7')).toBe('203.0.113.7');
		expect(clientAddress('::ffff:172.18.0.3', '198.51.100.1, 203.0.113.7')).toBe('203.0.113.7');
		expect(clientAddress('::1', '2001:db8::5')).toBe('2001:db8::5');
		expect(clientAddress('192.168.1.10', '100.101.102.103')).toBe('100.101.102.103');
	});

	it('ignores the header on a connection straight from the internet', () => {
		expect(clientAddress('203.0.113.9', '127.0.0.1')).toBe('203.0.113.9');
		expect(clientAddress('::ffff:203.0.113.9', '198.51.100.1')).toBe('203.0.113.9');
	});

	it('falls back to the connection without a usable header', () => {
		expect(clientAddress('127.0.0.1', null)).toBe('127.0.0.1');
		expect(clientAddress('127.0.0.1', 'unknown')).toBe('127.0.0.1');
		expect(clientAddress('10.0.0.2', '')).toBe('10.0.0.2');
	});
});
