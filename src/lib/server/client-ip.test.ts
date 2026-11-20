import { describe, expect, it } from 'vitest';
import { clientAddress, parseProxy, trustedProxies } from './client-ip.ts';

// A container on Docker's network, as obur runs: a proxy on the host or beside it connects from 172.18.0.0/16.
const container = {
	lo: [{ address: '127.0.0.1', cidr: '127.0.0.1/8', internal: true, family: 'IPv4' }],
	eth0: [
		{ address: '172.18.0.2', cidr: '172.18.0.2/16', internal: false, family: 'IPv4' },
		{
			address: 'fe80::42:acff:fe12:2',
			cidr: 'fe80::42:acff:fe12:2/64',
			internal: false,
			family: 'IPv6'
		}
	]
} as unknown as Parameters<typeof trustedProxies>[1];
const proxies = trustedProxies(null, container);

describe('clientAddress', () => {
	it('takes the address the nearest proxy added when the connection is from a trusted proxy', () => {
		expect(clientAddress('127.0.0.1', '203.0.113.7', proxies)).toBe('203.0.113.7');
		expect(clientAddress('::ffff:172.18.0.1', '198.51.100.1, 203.0.113.7', proxies)).toBe(
			'203.0.113.7'
		);
		expect(clientAddress('::1', '2001:db8::5', proxies)).toBe('2001:db8::5');
		// A tunnel connector in another Docker network (Unraid's app, another compose project).
		expect(clientAddress('172.17.0.5', '203.0.113.7', proxies)).toBe('203.0.113.7');
	});

	it('ignores the header from a phone on the home network or the internet', () => {
		// 2026-11-20 audit (R07): every private address was trusted, so a phone could choose its own address.
		expect(clientAddress('192.168.1.10', '100.101.102.103', proxies)).toBe('192.168.1.10');
		expect(clientAddress('10.0.0.2', '127.0.0.1', proxies)).toBe('10.0.0.2');
		expect(clientAddress('fe80::1', '2001:db8::5', proxies)).toBe('fe80::1');
		expect(clientAddress('203.0.113.9', '127.0.0.1', proxies)).toBe('203.0.113.9');
		expect(clientAddress('::ffff:203.0.113.9', '198.51.100.1', proxies)).toBe('203.0.113.9');
	});

	it('trusts only the configured proxies when OBUR_TRUSTED_PROXIES is set', () => {
		const set = trustedProxies('192.168.1.20, 10.8.0.0/24', container);
		expect(clientAddress('192.168.1.20', '203.0.113.7', set)).toBe('203.0.113.7');
		expect(clientAddress('10.8.0.9', '203.0.113.7', set)).toBe('203.0.113.7');
		expect(clientAddress('192.168.1.21', '203.0.113.7', set)).toBe('192.168.1.21');
		expect(clientAddress('172.18.0.1', '203.0.113.7', set)).toBe('172.18.0.1');
		expect(clientAddress('172.17.0.5', '203.0.113.7', set)).toBe('172.17.0.5');
		expect(clientAddress('127.0.0.1', '203.0.113.7', set)).toBe('203.0.113.7');
	});

	it('falls back to the connection without a usable header', () => {
		expect(clientAddress('127.0.0.1', null, proxies)).toBe('127.0.0.1');
		expect(clientAddress('127.0.0.1', 'unknown', proxies)).toBe('127.0.0.1');
		expect(clientAddress('172.18.0.1', '', proxies)).toBe('172.18.0.1');
	});
});

describe('parseProxy', () => {
	it('reads addresses and networks, and refuses anything else', () => {
		expect(parseProxy('10.0.0.5')).toEqual({ address: '10.0.0.5', prefix: 32, v: 4 });
		expect(parseProxy(' 172.18.0.0/16 ')).toEqual({ address: '172.18.0.0', prefix: 16, v: 4 });
		expect(parseProxy('2001:db8::/48')).toEqual({ address: '2001:db8::', prefix: 48, v: 6 });
		for (const bad of [
			'',
			'proxy.example.com',
			'10.0.0.0/33',
			'10.0.0.0/',
			'10.0.0.0/8/1',
			'10.0.0.0/x'
		])
			expect(parseProxy(bad), bad).toBeNull();
		expect(() => trustedProxies('10.0.0.5, nonsense', container)).toThrow(/nonsense/);
	});
});
