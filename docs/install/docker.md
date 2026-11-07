# obur with Docker (a VPS or any Linux machine)

## What you will end up with

- obur running in the background and starting again by itself after a reboot.
- A folder `obur` with two files you write (`compose.yaml`, `.env`) and a `data` folder obur fills: the database,
  its backups and the passwords obur made for itself. As long as you keep `data` and your backup passphrase, you keep
  everything.

## Step 1: Install Docker

On Debian or Ubuntu, the short way is:

```bash
curl -fsSL https://get.docker.com | sh
```

Other systems: [docs.docker.com/engine/install](https://docs.docker.com/engine/install/). Check it with
`docker compose version`; you should see a version number.

## Step 2: Make a folder and download the two files

```bash
mkdir obur && cd obur
curl -fsSLo compose.yaml https://raw.githubusercontent.com/aloglu/obur/main/deploy/compose.yaml
curl -fsSLo .env https://raw.githubusercontent.com/aloglu/obur/main/deploy/.env.example
chmod 600 .env
```

## Step 3: Fill in `.env`

Open `.env` in an editor (`nano .env`) and set the two required lines:

```dotenv
PUBLIC_ORIGIN=https://obur.example.com
OBUR_BACKUP_PASSPHRASE=a-long-phrase-only-you-know
```

- `PUBLIC_ORIGIN` is the https address people will open (see [Remote access](remote-access.md)).
- `OBUR_BACKUP_PASSPHRASE` encrypts every backup. **Save a copy in your password manager now.** Without it no backup
  can be read, and obur cannot show it to you later.
- Set `TZ` to your time zone (for example `Europe/Istanbul`), so the nightly backup runs at night.

Everything else has a sensible default; the file explains each line.

**A test release** (a version with a hyphen, such as `1.0.0-beta.2`) is not published as `latest`: add
`OBUR_VERSION=1.0.0-beta.2` to `.env` to install it.

**Without Speak and Scan:** open `compose.yaml` and delete the `obur-speech` and `obur-labels` sections, and in
`.env` add `SPEECH_URL=` and `LABELS_URL=` (empty). obur then needs about 1 GB of memory instead of 2.5 GB.

## Step 4: Start it

```bash
docker compose up -d
docker compose logs obur
```

The first start downloads obur and creates the database. In the log, obur prints a one-time link for the first
account:

```
obur: no account exists yet. Open this link on the device you will use first (valid for 24 hours, works once):
https://obur.example.com/setup#…
```

Open it on your phone once the https address works, and follow [First start](first-start.md).

`docker compose ps` shows `obur` as `healthy` when all is well.

## Everyday commands

Run these in the `obur` folder:

| To | Run |
| --- | --- |
| See what obur is doing | `docker compose logs obur` |
| Stop it | `docker compose stop` |
| Start it again | `docker compose up -d` |
| Update it | `docker compose pull && docker compose up -d` (see [Updating](updating.md)) |
| A new first-account link | `docker exec obur obur setup-link` |
| Back up now | `docker exec obur obur backup now` |

## Backups on another disk

By default the backups live in `data/backups`, next to the database. A failing disk would take both. If the machine
has a second disk, set `OBUR_BACKUP_DIR` in `.env` to a folder on it, and set up an off-site copy (an S3-compatible
bucket such as Cloudflare R2; the `OBUR_OFFSITE_*` lines in `.env`). Household → Backups warns while there is no
off-site copy.

## Safety

`compose.yaml` makes obur listen on `127.0.0.1` only, which is right when a tunnel or reverse proxy on the same
machine puts it online. Never open obur's port to the internet directly: put https in front of it.
