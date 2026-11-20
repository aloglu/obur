# obur

A self-hosted calorie, weight and water tracker for a small circle of people, such as family and friends. It runs on a server you
control (a VPS, Unraid, TrueNAS or any machine with Docker) and you use it on your phone, where it installs as an
app. Sign-in with passkeys, invite-only accounts and automatic encrypted backups. Nothing about anyone's diary leaves
your server unless someone chooses to use their own OpenAI or OpenRouter key for Speak and Scan. The https
address you put in front of it (for example a Cloudflare Tunnel) carries everyone's traffic. obur contacts
outside services only for what you turn on: an off-site copy of the encrypted backups, reminders (through the
phone's push service, with a generic message), and a daily check for new versions (GitHub's public release list).
Weights are in kilograms for now.

**Install:** [`docs/install/`](docs/install/README.md). Installing with an AI assistant? Point it at
[`docs/install/for-ai-agents.md`](docs/install/for-ai-agents.md).

For developers:

- Product and technical design: [`docs/design.md`](docs/design.md)
- Interface direction: [`docs/ui.md`](docs/ui.md)
- Current status: [`docs/progress.md`](docs/progress.md)
- Working rules and verified commands: [`CLAUDE.md`](CLAUDE.md)

Licence: MIT. The food icons are from [OpenMoji](https://openmoji.org) under CC BY-SA 4.0
([`static/icons/food/LICENSE.txt`](static/icons/food/LICENSE.txt)).
