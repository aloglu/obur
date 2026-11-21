# Restoring obur from a backup

For whoever runs the server. Use it when the database is damaged or lost, when the server is replaced, or to go back
to a moment before a bad change. Commands run on the server with `docker exec obur obur …` (`obur` is the
container's name; use yours if it differs). On Unraid, the container's **Console** gives the same prompt: there,
leave out `docker exec obur`.

A restore takes two steps on purpose. After `obur restore start`, obur says "being restored" until
`obur restore finish` has signed everyone out, cancelled pending links, deleted again the accounts deleted after the
backup, and taken a fresh full backup. obur never reopens with restored sessions or deleted accounts.

## What you need, kept off the server

- **The backup passphrase** (`OBUR_BACKUP_PASSPHRASE`). Without it no backup can be read.
- **The off-site credentials** (`OBUR_OFFSITE_*`), if the server's own backups are lost too.
- **The secrets file** `data/secrets/obur.env` (in obur's data folder; readable by root only). It holds the key
  that encrypts people's own AI keys for Speak and Scan, and the Web Push keys for reminders. It is never in the
  backups, on purpose. Copy it off the server once, and again only if you change those keys. Without it a new
  server still restores everything else: people enter their AI keys again, and each device turns its reminders on
  again (Settings → Reminders).
- **The deleted-accounts list** from Members → Backups → Deleted accounts. Copy it whenever an account is deleted
  (**Copy list** gives the entries in the form `finish` takes below). Each entry is an account ID and the date. It
  never contains diary content.

Deleted accounts remain in backups until those expire (`OBUR_BACKUP_KEEP_WEEKS`, 5 weeks by default). That is why
their deletions are applied again after every restore.

## Choose the moment

- **Latest** (the default): everything up to the last archived change, normally at most five minutes before the
  loss (`OBUR_ARCHIVE_TIMEOUT`, 300 seconds by default).
- **A point in time**, before a bad change: `--type=time "--target=2026-10-29 21:00:00+03" --target-action=promote`.
- **The end of one backup**: `--set=<label> --type=immediate --target-action=promote`.

`docker exec obur obur backup info` lists the backups and their labels.

## Steps

1. **New server only.** Install obur as in its guide (`docs/install/`) with the same `PUBLIC_ORIGIN`,
   `WEBAUTHN_RP_ID`, `OBUR_BACKUP_PASSPHRASE` and `TZ` (backups are named by local time: with an earlier time zone,
   new backups fail until the clock passes the old ones), and put the old backups where its backups go (`OBUR_BACKUP_DIR`,
   or `data/backups`) before the first start. Put the copied secrets file at `data/secrets/obur.env` before the
   first start too (folder `700`, file `600`, both owned by root). With backups there and no database, obur waits for a restore instead
   of starting empty. To restore from the off-site copy instead, set the `OBUR_OFFSITE_*` values and leave the
   backups folder empty: obur finds the off-site backups and waits for a restore ("the off-site copy has backups").
   If the store can't be reached, obur also waits and tries again every minute; check the `OBUR_OFFSITE_*` values.

2. **Restore.**
   ```
   docker exec obur obur restore start
   ```
   Add options for anything other than the latest local backup: `--repo=2` restores from the off-site copy, and the
   options under "Choose the moment" pick another moment. When going back to a moment before an earlier restore, add
   `--target-timeline=current`: a restore starts a new branch of history, and PostgreSQL otherwise follows the newest
   branch ("requested timeline … is not a child of this server's history").

   obur stops, moves the current database aside to `data/postgres-before-restore-<date>` (nothing is deleted),
   restores, and starts again showing "obur is being restored from a backup". If the restore fails, obur stays
   stopped: fix the cause and run it again (what the failed attempt left is cleared first), or run
   `obur restore cancel` to go back to how it was: the old database, or none if there was none.

3. **Finish.** Pass every entry from the deleted-accounts list, as `<ID>`, optionally followed by `@<date>`. If the
   list is empty, pass `--none`: finish refuses to run with neither, so a forgotten list never brings a deleted
   account back. (Lists copied before 2026-11-17 may mark some entries `:shared`; pass them as they are.)
   Deletions made before the moment you restore to are in the restored database already; the list matters for
   the ones after it, so use the copy you made after the latest deletion.
   ```
   docker exec obur obur restore finish 2b7c…e1@2026-10-20 9f41…0a@2026-10-27
   ```
   It first waits until the restored database has finished replaying its history (it is read-only until then).
   This signs everyone out, cancels unused recovery links, invites and setup links, deletes those accounts again,
   takes a full backup of the new history, and reopens obur. If the off-site store can't be reached then, obur
   reopens anyway after the local backup, says so, and the off-site copy gets its full backup with the next nightly
   backup.

4. **Check.**
   ```
   docker exec obur obur backup restore-check
   ```
   Then look at Members → Backups. Everyone signs in again with their passkey: passkeys and recovery codes are
   unchanged. obur needs a connection, so nothing waits on the phones: entries made while the server was down were
   never saved and must be logged again.

5. **Clean up.** Once you are satisfied, delete the folder moved aside in step 2.

## Starting fresh on purpose

If the database folder is empty while backups exist, obur refuses to start, so that a missing folder is never
mistaken for a new installation. To really start a new, empty database, move the old backups aside and set
`OBUR_ALLOW_NEW_DATABASE=1` for that start.

## Rehearsals

Restores before 2026-11-07 ran on the earlier layout (separate database, web and worker containers) with the same
backup tooling.

| Date | Where | What was proved |
| --- | --- | --- |
| 2026-10-29 | Desktop, a scratch stack with test data | Latest restore after the data folder was destroyed: changes made after the last backup came back; the app stayed closed (503) until `finish`; sessions revoked. A point-in-time restore before an earlier restore needed `--target-timeline=current` (now documented). A restore to the end of a backup brought back an account deleted later, with its entry; `finish` deleted it again and recorded it. The database refused to start empty while backups existed. The restore check passed afterwards. |
| 2026-10-29 | Owner's Unraid, real data | Weekly restore check (backup plus archived WAL into a throwaway copy): recovered past its target, all tables read. A full restore of the live stack has not been rehearsed there. |
| 2026-11-07 | Owner's Unraid, real data (pre-release check) | Restore check from the local repository and from the off-site R2 copy: each restored the latest backup plus archived WAL into a throwaway copy, replayed past the position taken at the start (local B/A606AD30 → B/A7000028; R2 B/A7000E10 → B/A8000028) and read all 47 tables, 20,017 rows. A full restore of the live stack (start and finish) has still only been rehearsed on the desktop. |
| 2026-11-07 | Owner's Unraid, real data (pre-release rehearsal, run by the owner) | Full live-stack restore to the latest moment: a backup at 20:11, then a marker (one glass of water) and a wait past the archive timeout; the live data folder moved aside, `obur-restore start` from the local repository, then the database replayed archived WAL B4–B8 past the backup and switched to timeline 2. The app said "obur is being restored from a backup" until `finish`; after it everyone signed in again with their passkey, the marker was there, and fresh full backups of the new history were taken to both repositories (20:31 local, 20:32 R2). The restore check passed. |
