# obur: instructions for an AI agent installing or maintaining it

You are helping a person run obur, a self-hosted calorie, weight and water tracker, on a server they control. This
page is for you. The step-by-step guides for people are in this folder; this page gives you the facts, the commands,
and above all **what you must never do without the person's explicit go-ahead**. Their health history lives in this
database; mistakes here can lose it.

Read the whole page before acting. When this page and a guide disagree, follow this page and tell the person.

## Never do these without asking the person first, in plain words, and getting a clear yes

- **Delete, move, empty or `chown -R` the data folder or the backups folder**, or remove the `obur` container's
  volumes (`docker compose down -v`, `docker volume rm`, `rm -rf data`). Removing the container itself is fine; its
  data lives in the folder.
- **Set `OBUR_ALLOW_NEW_DATABASE=1`.** obur refuses to start an empty database when backups exist, on purpose: the
  database folder is missing or wrong and a restore is needed. Overriding it starts over and loses the history. Stop
  and explain instead.
- **Change `PUBLIC_ORIGIN`, `WEBAUTHN_RP_ID` or `TZ` after the first start.** The first two are where everyone's
  passkeys belong: changing them means everyone enrols again. `TZ` names the backups: an earlier time zone makes new
  backups fail until the clock passes the old ones.
- **Change or lose `OBUR_BACKUP_PASSPHRASE`.** It is the only way to read the backups. obur can't show it. Make sure
  the person has saved it somewhere off the server (a password manager) before the first start.
- **Start a restore** (`obur restore start`), or finish one, without following `docs/restore.md` with the person. A
  restore replaces the live database.
- **Publish obur's port to the internet** (bind it to `0.0.0.0` on a server with a public address, or open it in the
  firewall). Only an HTTPS reverse proxy or tunnel should face the internet.
- **Edit the database directly** (`psql`), or run anything inside the container other than the `obur` commands below.
- **Turn on remote AI models for people, or enter API keys for them.** Each person does that themselves in the app
  (More → Speak and Scan), after agreeing to what is sent. Never put a key in a file or a command.

Don't print secrets back to the person or into logs: the passphrase, `.env` contents, `/data/secrets`, API keys,
or setup and recovery links in places other people can read.

## What obur is made of

- **`obur`** (`ghcr.io/aloglu/obur`): the app, its background jobs, PostgreSQL and the encrypted backups, in one
  container. It listens on port 3000 inside the container.
- **`obur-speech`** and **`obur-labels`** (optional): speech to text for Speak, and label reading for Scan. About
  1.5 GB of memory together. They have no internet access and keep nothing. Without them, people can still use Speak
  and Scan with their own OpenAI or OpenRouter key, if an admin allows it.
- **The data folder** (`OBUR_DATA_DIR`, default `./data`, mounted at `/data`): `postgres/` (the database),
  `backups/` (encrypted backups; ideally its own disk, `OBUR_BACKUP_DIR`), `status/` (backup health), `secrets/`
  (passwords and keys obur generated for itself; never copy these anywhere).
- **Settings:** `.env` next to `compose.yaml`. Required: `PUBLIC_ORIGIN` (the https address people open, no path) and
  `OBUR_BACKUP_PASSPHRASE`. Strongly advised: `TZ`. Everything else is explained in `deploy/.env.example`.

## Installing on a Linux server (a VPS)

Ask the person for, and confirm, before starting: the address (a domain or subdomain pointing at the server), their
time zone, whether they want Speak and Scan on the server (needs ~2.5 GB of RAM in total, else ~1 GB), and whether
backups should go to a second disk or an off-site bucket (S3-compatible, e.g. Cloudflare R2).

1. **Docker:** `docker compose version` must work. If not, install Docker Engine for the distribution
   (`curl -fsSL https://get.docker.com | sh` on Debian and Ubuntu).
2. **Folder and files** (as the user who will run it; any folder works):
   ```bash
   mkdir -p ~/obur && cd ~/obur
   curl -fsSLo compose.yaml https://raw.githubusercontent.com/aloglu/obur/main/deploy/compose.yaml
   curl -fsSLo .env https://raw.githubusercontent.com/aloglu/obur/main/deploy/.env.example
   chmod 600 .env
   ```
3. **`.env`:** set `PUBLIC_ORIGIN`, `OBUR_BACKUP_PASSPHRASE` (let the person choose it, or generate one with
   `openssl rand -base64 24` and **have them save it before you continue**) and `TZ`. For a test release, add
   `OBUR_VERSION=<version>` (e.g. `1.0.0-beta.2`); releases without a hyphen are also `latest`.
   Without Speak and Scan on the server: delete the `obur-speech` and `obur-labels` services from `compose.yaml` and
   add `SPEECH_URL=` and `LABELS_URL=` (empty) to `.env`.
4. **Start:** `docker compose up -d`, then `docker compose logs obur`. Expect `creating a new database`,
   `database ready`, `obur-backup: scheduler started` and `ready on port 3000`. `docker compose ps` should show `obur`
   as `healthy` within two minutes. The first backup runs straight away; `docker exec obur obur backup info` lists it
   a minute later.
5. **HTTPS** with Caddy on the same server (see `remote-access.md` for Cloudflare Tunnel or Tailscale instead):
   install Caddy from caddyserver.com/docs/install, put this in `/etc/caddy/Caddyfile`, and reload it:
   ```caddyfile
   obur.example.com {
   	reverse_proxy 127.0.0.1:8040
   }
   ```
   Keep `OBUR_BIND_ADDRESS` at its default `127.0.0.1`. Open only ports 80 and 443 (and SSH) in the firewall.
6. **Check:** `curl -sI https://<address>/login` returns `200`.
7. **First account:** the log printed a one-time setup link (`obur: no account exists yet …`), valid for 24 hours.
   Give it to the person privately. A new one: `docker exec obur obur setup-link`. Remind them to save the recovery
   codes the app shows after they create their passkey.
8. **Tell the person** where the folder is, that the passphrase must be kept safe, and whether there is an off-site
   copy (Members → Backups warns while there isn't).

## Routine maintenance

- **Health:** `docker compose ps` (obur `healthy`), `docker compose logs --tail 100 obur`, and in the app Members →
  Backups (last backup, last weekly restore check, last off-site restore check).
- **Update:** `docker compose pull && docker compose up -d`, then read the log. Before changing the database, obur
  takes a backup by itself; a failed upgrade changes nothing and stops with the reason in the log. Afterwards
  `docker image prune -f` removes old downloads. Don't update while a restore is pending.
- **Adding Speak and Scan later** (only if the person asks; ~1.5 GB more memory): put the `obur-speech` and
  `obur-labels` services back into `compose.yaml` from `deploy/compose.yaml`, remove empty `SPEECH_URL=` and
  `LABELS_URL=` lines from `.env`, then `docker compose up -d`. The data is untouched. Removing them is the reverse.
- **Back up now:** `docker exec obur obur backup now`. **List backups:** `docker exec obur obur backup info`.
  **Prove a restore works** (into a throwaway copy, nothing changes): `docker exec obur obur backup restore-check`.
- **Someone lost every passkey and recovery code:** `docker exec obur obur recovery-link "<their name>"` (one hour,
  works once). Only when the person running obur asks for it.
- **Disk space:** backups keep `OBUR_BACKUP_KEEP_WEEKS` (default 5) weekly full backups and everything between them.
  If the disk is filling, tell the person; don't delete backup files by hand.

## When something is wrong

Read `docker compose logs obur` first; obur's own lines start with `obur:`. Then:

- **"set PUBLIC_ORIGIN …" / "set OBUR_BACKUP_PASSPHRASE …":** a required setting is missing; add it and start again.
- **"OBUR_BACKUP_PASSPHRASE is still the example value":** let the person choose their own phrase (or generate one)
  and save it in their password manager; see `troubleshooting.md` if backups already exist.
- **"obur: slow: GET /path N ms"** (log): the server took over 300 ms on that request. Harmless by itself; if it
  repeats for the same path, report it with the path and times (never paste a query or personal data).
- **New versions:** obur does not look for them unless an admin turns on Members → Updates → "Check for new
  versions" (it then reads GitHub's public tag list once a day; `updates: the published versions could not be read`
  in the log means GitHub was unreachable, which is harmless). It never updates itself.
- **"the off-site store cannot be reached; WAL is waiting for it"** (log) or **"The off-site store can't be
  reached"** (Members → Backups): the off-site storage is not answering. Local backups continue; changes wait in
  `/data/offsite-queue` (limit `OBUR_OFFSITE_QUEUE_MAX_MB`, default 1024) and are sent when it answers ("the off-site
  store is back: N waiting WAL file(s) sent"). Check the `OBUR_OFFSITE_*` values and the server's connection. After
  "the off-site store has been away too long", run `docker exec obur obur backup now` once it is reachable.
- **"the off-site repository could not be set up … is or was the repo encrypted?":** the bucket folder holds another
  installation's backups. Ask the person whether those are still needed; never delete them on your own. Otherwise set
  `OBUR_OFFSITE_PATH` to a new folder.
- **"waiting: the database folder is empty but backups exist":** stop. The data folder is wrong or lost. Check that
  `OBUR_DATA_DIR` points where it used to. If the database really is gone, restoring is the person's decision; walk
  them through `docs/restore.md`. Never set `OBUR_ALLOW_NEW_DATABASE`.
- **"this obur is older than its database":** someone went back to an older version. It runs without changing the
  database; move forward to the newer version again when possible.
- **An upgrade or backup failed:** report the log lines to the person. More in `troubleshooting.md`.

## Moving to another server

Stop obur (`docker compose stop`), copy the data folder and backups as root keeping owners and permissions
(`rsync -a` or `cp -a`; the database files belong to the container's own user), `.env` and `compose.yaml`, keep `PUBLIC_ORIGIN`,
`WEBAUTHN_RP_ID`, `TZ` and the passphrase the same, start, and run `docker exec obur obur backup restore-check`.
Without the old data folder, restore from the backups instead (`docs/restore.md`, "New server only"). People's own
AI keys don't move with a restore onto a new server; they add them again.
