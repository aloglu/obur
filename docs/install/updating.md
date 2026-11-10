# Updating obur

An update replaces the program, never your data. Before changing the database, obur takes a backup by itself, and
if the database change fails, nothing is changed and the error is in the log.

## Docker Compose (VPS, Unraid's Compose Manager)

In the folder with `compose.yaml`:

```bash
docker compose pull
docker compose up -d
```

If `.env` sets `OBUR_VERSION` (as it must for a test release such as `1.0.0-beta.8`, which is never `latest`),
change it to the new version first, or `pull` fetches the same version again.

`docker image prune` afterwards removes the old downloads.

## Unraid (obur only)

The Docker tab shows **update ready** next to obur: click it.

## TrueNAS

Use the app's **Update**, or **Edit** and **Save** it again.

## Staying on a version

Every release is also published under its number, e.g. `ghcr.io/aloglu/obur:1.0.0`. Set `OBUR_VERSION=1.0.0` in
`.env` (Compose) or change the repository's tag (Unraid, TrueNAS) to stay on it.

## Going back to an older version

Run the older version's image. If the newer one had changed the database, the older one says so in its log and
starts without touching the database; features it doesn't know stay unused. If that is not enough, restore the
backup obur took before the update (`docker exec obur obur backup info` lists it; see [Restoring](../restore.md)).
