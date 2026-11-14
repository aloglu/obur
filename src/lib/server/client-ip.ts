// The address sign-in limits are counted by (modules/auth). Every documented way to reach obur from outside (Cloudflare
// Tunnel, Tailscale Serve, Caddy) puts a proxy in front of it, so the connection's own address is the proxy's, the
// same for everyone. The proxy's X-Forwarded-For is trusted only when the connection comes from a loopback or private
// address, where the proxy sits; a request straight from the internet can't choose its address this way.
import { BlockList, isIP } from 'node:net';

const PROXIES = new BlockList();
PROXIES.addSubnet('127.0.0.0', 8, 'ipv4');
PROXIES.addSubnet('10.0.0.0', 8, 'ipv4');
PROXIES.addSubnet('172.16.0.0', 12, 'ipv4');
PROXIES.addSubnet('192.168.0.0', 16, 'ipv4');
PROXIES.addSubnet('169.254.0.0', 16, 'ipv4');
PROXIES.addAddress('::1', 'ipv6');
PROXIES.addSubnet('fc00::', 7, 'ipv6');
PROXIES.addSubnet('fe80::', 10, 'ipv6');

/** An IPv4 address written as IPv6 (::ffff:10.0.0.1, as Node reports it on a dual-stack socket) as plain IPv4. */
const plain = (address: string) => address.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');

function fromProxy(address: string): boolean {
	const version = isIP(address);
	return version !== 0 && PROXIES.check(address, version === 4 ? 'ipv4' : 'ipv6');
}

/**
 * The client's address: the last X-Forwarded-For entry (the one the nearest proxy added) when the connection comes
 * from a proxy's address, otherwise the connection's own.
 */
export function clientAddress(peer: string, forwardedFor: string | null): string {
	const own = plain(peer);
	if (!fromProxy(own)) return own;
	const last = forwardedFor
		?.split(',')
		.map((part) => plain(part.trim()))
		.at(-1);
	return last && isIP(last) ? last : own;
}

/** clientAddress for a request. */
export const clientIp = (event: { getClientAddress(): string; request: Request }): string =>
	clientAddress(event.getClientAddress(), event.request.headers.get('x-forwarded-for'));
