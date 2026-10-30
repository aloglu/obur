# Unraid: restricted deploy access

How an operator lets someone (or an assistant) build and run obur on an Unraid server without giving them a shell.
Example names are used throughout; the real hostname belongs only in your own configuration.

## The model

- The deploy key in root's `authorized_keys` is tied to one program, `obur-ctl`, with `command="…"` and `restrict`
  (no shell, no terminal, no forwarding). Whatever is typed after `ssh` is passed to `obur-ctl`, which accepts a fixed
  list of actions (`obur-ctl help`) and refuses everything else.
- `obur-ctl` acts only on Docker images named `obur-app`/`obur-db` and the Compose project `obur`. It has no action
  that deletes data, opens a database console or reads files.
- What the containers may mount is decided by `compose.yaml` in `/mnt/user/appdata/obur`. That folder and
  `obur-ctl` itself stay root-owned and out of the deploy key's reach; review any change to either before copying it
  to the server.
- Source to build is uploaded into a separate folder the uploader already controls; `obur-ctl build` refuses any
  other location.
- Every action is written to the system log with the tag `obur-ctl`.

Docker access in general is equivalent to root on the host, which is why the key never gets it directly.

## Setup

1. Check `docker compose version` on the server. If it is missing, install the Docker Compose Manager plugin from
   Community Applications.
2. Create `/boot/config/obur/` and copy `obur-ctl` into it. The flash drive does not run programs directly, so the
   key calls it through `/bin/bash`.
3. Create `/mnt/user/appdata/obur/` (owned by root). `compose.yaml` and `.env` go there once they exist.
4. Add the deploy key's public key to root's SSH authorized keys (Users → root in the web interface on Unraid 6.9
   and later), prefixed like this, on one line:

   ```
   command="/bin/bash /boot/config/obur/obur-ctl",restrict ssh-ed25519 AAAA… obur-deploy
   ```

5. Test from the deploying machine: `ssh -i <key> root@tower.local help` prints the actions, and
   `ssh -i <key> root@tower.local ls /` is refused.

## Settings and secrets

The top of `obur-ctl` names the project folder, the settings file and the upload folder. The settings file (`.env`)
holds the backup encryption passphrase and storage keys. If your appdata folder is copied somewhere else (many Unraid
users back up appdata to a cloud drive), either exclude `.env` from that copy or move it, for example to
`/boot/config/obur/.env`, and change `OBUR_ENV_FILE` to match. Otherwise the copy holds the encrypted backups and the
key that opens them side by side.

## Deploying from the development machine

`./deploy/pilot.sh` deploys the committed HEAD: it refuses uncommitted changes, uploads the source with `git archive`
(only committed files), then runs `build` and `deploy` (which backs up first). The SSH aliases default to `obur-lab`
(upload) and `obur-host` (forced command) and can be overridden with `OBUR_UPLOAD_HOST` and `OBUR_CTL_HOST`.

## Updating `compose.yaml` and `obur-ctl` on the server

Both live where the deploy key cannot write, so changes to them are copied by hand after review. After a deploy, the
uploaded source is in `/mnt/user/appdata/obur-lab/deploy/source`; on the Unraid host, as root:

1. Review what changed: `diff /boot/config/obur/obur-ctl /mnt/user/appdata/obur-lab/deploy/source/deploy/unraid/obur-ctl`
   and `diff /mnt/user/appdata/obur/compose.yaml /mnt/user/appdata/obur-lab/deploy/source/deploy/compose.yaml`.
2. Copy `obur-ctl` first (it can build images the old `compose.yaml` does not use yet):
   `cp /mnt/user/appdata/obur-lab/deploy/source/deploy/unraid/obur-ctl /boot/config/obur/obur-ctl`
3. Then `compose.yaml`:
   `cp /mnt/user/appdata/obur-lab/deploy/source/deploy/compose.yaml /mnt/user/appdata/obur/compose.yaml`
4. Deploy again (`./deploy/pilot.sh` from the development machine): the new `obur-ctl` builds every image the new
   `compose.yaml` needs before switching.

The speech service (added 2026-10-30) is the first change made this way: it adds the `obur-speech` image to `obur-ctl`
and the `speech` service and internal network to `compose.yaml`. The OCR service for Scan (added 2026-10-30) is the
second: the `obur-ocr` image, and the `ocr` service and internal network. Until both files are copied, Scan stays off.
