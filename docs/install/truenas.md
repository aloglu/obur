# obur on TrueNAS SCALE

For TrueNAS SCALE 24.10 (Electric Eel) and later, which run apps with Docker. obur is installed as a custom app
from YAML.

## Step 1: Make two datasets

In **Datasets**, under your apps pool, create `obur` and inside it `data` (and, on another pool if you have one,
`obur-backups`). Use the **Apps** preset. Note their paths, for example `/mnt/tank/apps/obur/data`.

## Step 2: Install from YAML

1. Open **Apps** → **Discover Apps** → the **⋮** menu → **Install via YAML**.
2. Name it `obur` and paste the following, with your own address, passphrase, time zone and paths:

   ```yaml
   services:
     obur:
       image: ghcr.io/aloglu/obur:latest
       container_name: obur
       restart: unless-stopped
       environment:
         PUBLIC_ORIGIN: https://obur.example.com
         OBUR_BACKUP_PASSPHRASE: a-long-phrase-only-you-know
         TZ: Europe/Istanbul
         SPEECH_URL: http://obur-speech:8000
         LABELS_URL: http://obur-labels:8000
       ports:
         - '8040:3000'
       volumes:
         - /mnt/tank/apps/obur/data:/data
         # With a second pool: - /mnt/other/obur-backups:/data/backups
       shm_size: 256mb
       stop_grace_period: 60s
       networks: [default, addons]
     obur-speech:
       image: ghcr.io/aloglu/obur-speech:latest
       container_name: obur-speech
       restart: unless-stopped
       networks: [addons]
       read_only: true
       tmpfs: [/tmp]
       cap_drop: [ALL]
       security_opt: ['no-new-privileges:true']
       mem_limit: 2g
     obur-labels:
       image: ghcr.io/aloglu/obur-labels:latest
       container_name: obur-labels
       restart: unless-stopped
       networks: [addons]
       read_only: true
       tmpfs: [/tmp]
       cap_drop: [ALL]
       security_opt: ['no-new-privileges:true']
       mem_limit: 1g
   networks:
     addons:
       internal: true
   ```

   **Save the passphrase in your password manager.** Without it no backup can be read.

   Without Speak and Scan, delete the `obur-speech` and `obur-labels` sections and the two `_URL` lines.

3. Click **Save**. When the app shows **Running**, open its **Logs**: obur prints a one-time link for the first
   account. Open it on your phone once the https address works (see [Remote access](remote-access.md)), then follow
   [First start](first-start.md).

## Updating

Open the app's **Edit** page and **Save** it again, or use **Update** when TrueNAS offers one: it pulls the
`latest` images. See [Updating](updating.md).

## Commands

The app's **Shell** (pick the `obur` container) gives a prompt inside it: `obur setup-link`, `obur backup now`,
`obur backup info`.
