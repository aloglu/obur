# Giving obur an https address

Passkeys only work over https, so obur needs an https address before anyone signs in. Pick one way. In every case,
set `PUBLIC_ORIGIN` to the exact address (for example `https://obur.example.com`) and never open obur's port to the
internet directly.

## Cloudflare Tunnel (home servers, no open ports)

You need a domain managed by Cloudflare.

1. In the Cloudflare dashboard, open **Zero Trust → Networks → Tunnels** and create a tunnel. Install its connector
   (`cloudflared`) on the machine running obur, as the dashboard shows (Unraid and TrueNAS have it as an app).
2. Add a **public hostname**, e.g. `obur.example.com`, with service `http://localhost:8040` (or the server's address
   and obur's port, if `cloudflared` runs in another container or machine; obur must then listen beyond loopback:
   `OBUR_BIND_ADDRESS=0.0.0.0`).
3. Open `https://obur.example.com`.

## Tailscale (only your own devices)

obur stays invisible to everyone else; each person installs Tailscale on their phone and joins your network.

1. Install Tailscale on the server and on your phone, signed in to the same account.
2. On the server: `tailscale serve --bg 8040`. It prints an address like
   `https://server.your-tailnet.ts.net`; use that as `PUBLIC_ORIGIN`.

## Caddy on a VPS

With a domain pointing at the VPS, [Caddy](https://caddyserver.com) gets https certificates by itself. Install it
([caddyserver.com/docs/install](https://caddyserver.com/docs/install)) and put this in `/etc/caddy/Caddyfile`:

```caddyfile
obur.example.com {
	reverse_proxy 127.0.0.1:8040
}
```

Then `sudo systemctl reload caddy` and open `https://obur.example.com`. Open ports 80 and 443 in the VPS firewall,
and nothing else for obur.

## The passkey domain

By default passkeys belong to the address's host (`obur.example.com`). Setting `WEBAUTHN_RP_ID=example.com` instead
lets obur move to another subdomain later without everyone enrolling again. Decide before the first account: changing
it afterwards means new passkeys for everyone.
