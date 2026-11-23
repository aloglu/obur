# obur

A self-hosted calorie, weight and water tracker for a small circle of people, such as family and friends. It runs on a server you
control (a VPS, Unraid, TrueNAS or any machine with Docker) and you use it on your phone, where it installs as an
app. Sign-in with passkeys, invite-only accounts and automatic encrypted backups. Nothing about anyone's diary leaves
your server unless someone chooses to use their own OpenAI or OpenRouter key for Speak and Scan. The https
address you put in front of it (for example a Cloudflare Tunnel) carries everyone's traffic. obur contacts
outside services only for what you turn on: an off-site copy of the encrypted backups, reminders (through the
phone's push service, with a generic message), and a daily check for new versions (GitHub's public release list).
Weights in kilograms or pounds, height in centimetres or feet and inches, and water in millilitres or US fluid ounces, chosen by each person.

**Install:** [`docs/install/`](docs/install/README.md). Installing with an AI assistant? Point it at
[`docs/install/for-ai-agents.md`](docs/install/for-ai-agents.md).

For developers:

- Product and technical design: [`docs/design.md`](docs/design.md)
- Interface direction: [`docs/ui.md`](docs/ui.md)
- Current status: [`docs/progress.md`](docs/progress.md)
- Working rules and verified commands: [`CLAUDE.md`](CLAUDE.md)

Licence: MIT. The food icons and achievement pictures are from [OpenMoji](https://openmoji.org) under CC BY-SA 4.0
([`static/icons/food/LICENSE.txt`](static/icons/food/LICENSE.txt),
[`static/icons/achievements/LICENSE.txt`](static/icons/achievements/LICENSE.txt)). The fonts (Inter, Bricolage
Grotesque) are under the SIL Open Font License 1.1. Every bundled package's licence is listed at
`/third-party-notices.txt` on a running obur (written by `npm run build`). The optional label image (`obur-labels`) lists its
parts, among them LGPL libraries in OpenCV and Shapely, in [`labels/THIRD-PARTY-NOTICES.md`](labels/THIRD-PARTY-NOTICES.md). The optional speech image (`obur-speech`) lists its
parts, among them Intel's oneMKL under the Intel Simplified Software License, in
[`speech/THIRD-PARTY-NOTICES.md`](speech/THIRD-PARTY-NOTICES.md); it has no FFmpeg and no GPL code.
