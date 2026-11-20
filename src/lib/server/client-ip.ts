// The address sign-in limits are counted by (modules/auth). Every documented way to reach obur from outside (Cloudflare
// Tunnel, Tailscale Serve, Caddy) puts a proxy in front of it, so the connection's own address is the proxy's, the
// same for everyone. The proxy's X-Forwarded-For is trusted only from a trusted proxy: loopback, and either the
// addresses in OBUR_TRUSTED_PROXIES or, without it, this machine's own networks and Docker's address range
// (172.16.0.0/12), where a proxy on the host or in any container connects from. A phone on the home network
// (192.168.x.x, 10.x.x.x) is not a proxy, so it can't choose the address it is counted under (2026-11-20 audit, R07;
// before, every private address was trusted).
import { BlockList, isIP } from 'node:net';
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';

/** An IPv4 address written as IPv6 (::ffff:10.0.0.1, as Node reports it on a dual-stack socket) as plain IPv4. */
const plain = (address: string) => address.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');

/** One OBUR_TRUSTED_PROXIES entry (an address, or a network as address/prefix), or null when it is not one. */
export function parseProxy(entry: string): { address: string; prefix: number; v: 4 | 6 } | null {
	const [address, prefixText, extra] = entry.trim().split('/');
	const v = isIP(address ?? '');
	if (!v || extra !== undefined) return null;
	const max = v === 4 ? 32 : 128;
	if (prefixText !== undefined && !/^\d{1,3}$/.test(prefixText)) return null;
	const prefix = prefixText === undefined ? max : Number(prefixText);
	if (prefix > max) return null;
	return { address: address!, prefix, v: v as 4 | 6 };
}

/**
 * The trusted proxies: loopback, plus `setting` (comma-separated), or else Docker's range and every network of
 * `interfaces`.
 */
export function trustedProxies(
	setting: string | null,
	interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()
): BlockList {
	const list = new BlockList();
	list.addSubnet('127.0.0.0', 8, 'ipv4');
	list.addAddress('::1', 'ipv6');
	const add = (p: { address: string; prefix: number; v: 4 | 6 }) =>
		list.addSubnet(p.address, p.prefix, p.v === 4 ? 'ipv4' : 'ipv6');
	if (setting) {
		for (const entry of setting.split(',').filter((e) => e.trim())) {
			const proxy = parseProxy(entry);
			if (!proxy)
				throw new Error(`OBUR_TRUSTED_PROXIES: not an address or network: ${entry.trim()}`);
			add(proxy);
		}
		return list;
	}
	list.addSubnet('172.16.0.0', 12, 'ipv4');
	for (const info of Object.values(interfaces).flat()) {
		if (!info || info.internal || !info.cidr) continue;
		const proxy = parseProxy(info.cidr);
		// Link-local IPv6 (fe80::/64 on every interface) is never where a proxy connects from.
		if (proxy && !(proxy.v === 6 && proxy.address.toLowerCase().startsWith('fe80'))) add(proxy);
	}
	return list;
}

function fromProxy(address: string, proxies: BlockList): boolean {
	const version = isIP(address);
	return version !== 0 && proxies.check(address, version === 4 ? 'ipv4' : 'ipv6');
}

/**
 * The client's address: the last X-Forwarded-For entry (the one the nearest proxy added) when the connection comes
 * from a trusted proxy, otherwise the connection's own.
 */
export function clientAddress(
	peer: string,
	forwardedFor: string | null,
	proxies: BlockList
): string {
	const own = plain(peer);
	if (!fromProxy(own, proxies)) return own;
	const last = forwardedFor
		?.split(',')
		.map((part) => plain(part.trim()))
		.at(-1);
	return last && isIP(last) ? last : own;
}
