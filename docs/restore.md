# Restoring obur from a backup

For the operator. Use it when the database is damaged or lost, when the server is replaced, or to go back to a moment
before a bad change. Commands run in the folder that holds `compose.yaml` and `.env` (on the owner's Unraid:
`/mnt/user/appdata/obur`). The restricted deploy key cannot restore; the operator runs these steps.

A restore takes two steps on purpose. After `obur-restore start`, the app stays closed ("restore in progress") until
`obur-restore finish` has signed everyone out, cancelled pending links, deleted again the accounts deleted after the
backup, and taken a fresh full backup. A database never reopens with restored sessions or deleted accounts.

## What you need, kept off the server

- **The `.env` file**, or at least `OBUR_BACKUP_PASSPHRASE`. Without the passphrase no backup can be read.
- **The off-site credentials** (`OBUR_OFFSITE_*`) if the local backups are lost too.
- **The deleted-accounts list** from Household → Deleted accounts. Copy it whenever an account is deleted. Each entry
  is an account ID, the date and whether shared foods were removed. It never contains diary content.
- **The source code** (the private GitHub repository), to rebuild the images on a new machine.

Deleted accounts remain in backups until those expire (`OBUR_BACKUP_KEEP_WEEKS`, 5 weeks by default). That is why
their deletions are applied again after every restore.

## Before you start

- **Stop the old server** if it still runs, so two databases never write into the same backup storage:
  `docker compose stop`. On a replacement machine, make sure the old one is off or its stack is stopped.
- **Choose the moment to restore to:**
  - **Latest** (the default): everything up to the last archived change, normally at most a few minutes before the
    loss (`OBUR_ARCHIVE_TIMEOUT`, 5 minutes by default).
  - **A point in time**: before a bad change, for example `--type=time "--target=2026-10-29 21:00:00+03"`.
  - **The end of one backup**: `--set=<label> --type=immediate`.
- **List the backups** (works while the database is stopped):
  `docker compose run --rm --no-deps --entrypoint gosu db postgres obur-backup info`. Add `--repo=2` before `info`
  for the off-site copy.

## Steps

1. **New machine only.** Install Docker with Compose and clone the repository. Build the images:
   ```
   docker build -t obur-app:current .
   docker build -t obur-db:current deploy/db
   ```
   Create the stack folder with `deploy/compose.yaml` as `compose.yaml` and your saved `.env`. To restore from the
   off-site copy, an empty local backup folder is fine.

2. **Move the old data folder aside.** Don't delete it yet:
   ```
   docker compose stop
   mv data/postgres data/postgres.before-restore-$(date +%F)
   ```
   Use the path of `OBUR_DATA_DIR` if it is set (on the owner's Unraid, `/mnt/cache/appdata/obur/data`).

3. **Restore.**
   ```
   docker compose run --rm --no-deps --entrypoint obur-restore db start
   ```
   Add options for anything other than the latest local backup:
   - `--repo=2` restores from the off-site copy.
   - `--type=time "--target=…" --target-action=promote` restores to a point in time.
   - When going back to a moment before an earlier restore, add `--target-timeline=current`. A restore starts a new
     branch of history, and PostgreSQL otherwise follows the newest branch, failing with "requested timeline … is
     not a child of this server's history".
   - `--set=<label> --type=immediate --target-action=promote` restores to the end of one backup.

   It ends with "restored". If it fails, nothing has started; fix the cause and run it again. The database container
   refuses to create an empty database while a restore is pending.

4. **Start the database only.**
   ```
   docker compose up -d db
   ```
   If the web app is running, it answers "obur is being restored from a backup" until step 5.

5. **Finish.** Pass every entry from the deleted-accounts list, as `<ID>`, `<ID>:shared` when shared foods were
   removed, optionally followed by `@<date>`. Entries already in the restored list are harmless.
   ```
   docker compose exec db obur-restore finish 2b7c…e1:shared@2026-10-20 9f41…0a@2026-10-27
   ```
   This signs everyone out, cancels unused recovery links, invites and setup links, deletes those accounts again,
   takes a full backup of the new history, and reopens the app.

6. **Start everything and verify.**
   ```
   docker compose up -d
   docker compose exec db gosu postgres obur-backup restore-check
   ```
   Then check Household → Backups. Everyone signs in again with their passkey: passkeys and recovery codes are
   unchanged. Entries a phone queued while the server was down are sent after its owner signs in.

7. **Clean up.** Once you are satisfied, delete the folder moved aside in step 2.

## If the `.env` is lost but you still have the passphrase

Write a new `.env` from `deploy/.env.example` with the same `OBUR_BACKUP_PASSPHRASE` and new database passwords, and
restore as above. After step 4, before step 5, set the restored roles to the new passwords. Inside the container the
database accepts the operator without a password:

```
docker compose exec db psql -U obur_admin -d obur -c "alter role obur_admin password '<new OBUR_ADMIN_DB_PASSWORD>'"
docker compose --profile tools run --rm admin migrate
```

`migrate` sets the other roles' passwords from `.env` and changes nothing else in a database that is already current.

## Starting fresh on purpose

If the data folder is empty while backups exist, the database container refuses to start, so that a missing data
folder is never mistaken for a new installation. To really start a new, empty database, set
`OBUR_ALLOW_NEW_DATABASE=1` in `.env` for that start, and move the old backups aside.

## Rehearsals

| Date | Where | What was proved |
| --- | --- | --- |
| 2026-10-29 | Desktop, a scratch stack with test data | Latest restore after the data folder was destroyed: changes made after the last backup came back; the app stayed closed (503) until `finish`; sessions revoked. A point-in-time restore before an earlier restore needed `--target-timeline=current` (now documented). A restore to the end of a backup brought back an account deleted later, with its entry; `finish` deleted it again and recorded it. The database refused to start empty while backups existed. The restore check passed afterwards. |
| 2026-10-29 | Owner's Unraid, real data | Weekly restore check (backup plus archived WAL into a throwaway copy): recovered past its target, all tables read. A full restore of the live stack has not been rehearsed there. |
| 2026-11-07 | Owner's Unraid, real data (pre-release check) | Restore check from the local repository and from the off-site R2 copy: each restored the latest backup plus archived WAL into a throwaway copy, replayed past the position taken at the start (local B/A606AD30 → B/A7000028; R2 B/A7000E10 → B/A8000028) and read all 47 tables, 20,017 rows. A full restore of the live stack (start and finish) has still only been rehearsed on the desktop. |
