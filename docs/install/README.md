# Installing obur

obur is a calorie, weight and water tracker for a small circle of people, such as family and friends. It runs on a server you
control and you use it in the browser on your phone, where it installs as an app. Nothing is sent anywhere else.

Every guide goes step by step and says what you should see.

## 1. Choose where obur runs

| Your situation | Follow |
| --- | --- |
| A rented server (VPS) or any Linux machine with Docker | [Docker](docker.md) |
| A home server running **Unraid** | [Unraid](unraid.md) |
| A NAS running **TrueNAS SCALE** | [TrueNAS](truenas.md) |

**What it needs:** Docker, about 1 GB of memory for obur itself, and 1.5 GB more for Speak and Scan (optional).
Two processor cores are enough; Speak answers faster with more.

**What you get:** three containers. `obur` is the app with its database and automatic, encrypted backups; it is all
you need. `obur-speech` (speaking an entry) and `obur-labels` (photographing a nutrition label) are optional
add-ons. They never reach the internet: audio and photos stay on your server, in memory only.

**Without the add-ons**, each person can still use Speak and Scan with their own OpenAI or OpenRouter key (More →
Speak and Scan), after allowing that company to receive their recordings or photos. They pay that company for what
they use. An admin can switch this off for everyone on Members.

## 2. Give it an https address

Passkeys, the way everyone signs in, work only over https. [Remote access](remote-access.md) shows three ways:
Cloudflare Tunnel, Tailscale, or a reverse proxy such as Caddy on a VPS. Decide on the address before the first
start: it becomes the passkeys' home, and moving it later means everyone enrols their passkeys again.

## 3. Use and look after it

- [First start and inviting people](first-start.md)
- [Backups and restoring](../restore.md)
- [Updating](updating.md)
- [Troubleshooting](troubleshooting.md)
- [For an AI assistant installing or maintaining obur](for-ai-agents.md)
