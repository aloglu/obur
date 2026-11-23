# Updating obur

An update replaces the program, never your data. Before changing the database, obur takes a backup by itself, and
if the database change fails, nothing is changed and the error is in the log.

## Knowing when there is a new version

obur can tell you: as an admin, turn on **More → Server → Updates → Check for new versions**. It then asks
GitHub once a day which versions are published (nothing about you or the other members is sent) and shows "Version … is
available" there, and "Update available" on More. It is off until you turn it on, and obur never updates itself.
You can also watch the repository's releases on GitHub.

## Docker Compose (VPS, Unraid's Compose Manager)

In the folder with `compose.yaml`:

If `.env` sets `OBUR_VERSION` (as it must for a test release such as `1.0.0-beta.8`, which is never `latest`),
change it to the new version first, or `pull` fetches the same version again.

```bash
docker compose pull
docker compose up -d
```

`docker image prune` afterwards removes the old downloads.

Keep `obur-speech` and `obur-labels` at the same version as obur: `compose.yaml` uses `OBUR_VERSION` for all three,
so `pull` updates them together. A different add-on version may not understand the app. For example, since the
release after 1.0.0-rc.8, Speak sends a WAV recording that only the new `obur-speech` reads, and the new
`obur-speech` reads nothing else.

## Unraid (obur only)

The Docker tab shows **update ready** next to obur: click it.

## TrueNAS

Use the app's **Update**, or **Edit** and **Save** it again.

## Staying on a version

Every release is also published under its number, e.g. `ghcr.io/aloglu/obur:1.0.0`. Set `OBUR_VERSION=1.0.0` in
`.env` (Compose) or change the repository's tag (Unraid, TrueNAS) to stay on it.

## Going back to an older version

Run the older version's image. If the newer version did not change the database, the older one starts as usual.

If the newer version changed the database, the older one does not open. Its log says "this obur is older than its
database", and it changes nothing. Then do one of these:

- **Start the newer version again.** Nothing is lost.
- **Restore the backup obur took before the update,** with the older version running. Changes made after the
  update are lost. `docker exec obur obur backup info` lists the backups; the one before the update is the last
  one taken before you updated. Then follow [Restoring](../restore.md) with
  `--set=<its label> --type=immediate --target-action=promote`.

(Versions before 1.0.0-rc.6 opened anyway on a newer database, which could fail or write wrong data.)
