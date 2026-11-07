# Troubleshooting

Start with the log: `docker compose logs obur` (Compose), or the container's **Logs** on Unraid and TrueNAS. obur's
own lines start with `obur:`.

**"set PUBLIC_ORIGIN …" or "set OBUR_BACKUP_PASSPHRASE …", then it stops.** One of the two required settings is
missing. Add it and start again.

**"WARNING: /data is not a mounted folder."** The data folder isn't mapped, so everything would be lost with the
container. Add the volume (`/data`) and start again.

**"waiting: the database folder is empty but backups exist".** obur found backups but no database, so it waits for
a restore instead of starting empty and losing your history: see [Restoring](../restore.md). If you really want a
new, empty database, move the backups aside and set `OBUR_ALLOW_NEW_DATABASE=1` for that start.

**The passkey prompt never appears, or says the site is not allowed.** The address in the browser must be exactly
`PUBLIC_ORIGIN`, over https. Passkeys created on another address don't work here.

**"Speak can't be reached right now" or "Label reading isn't available right now".** The add-on isn't running or
isn't on obur's private network:
`docker compose ps` should list `obur-speech` and `obur-labels`. Without them, set `SPEECH_URL=` and `LABELS_URL=`
(empty) and the buttons disappear.

**"denied" when downloading on Unraid.** Unraid may hold old credentials for GitHub's registry: run
`docker logout ghcr.io` in its terminal and try again.

**Household → Backups shows a failed backup.** The log shows why (`obur-backup:` lines). A full disk is the usual
cause. `docker exec obur obur backup now` tries again.

**An update failed.** obur stops and the log says which step failed. The database change runs as one step, so a
failure leaves the database as it was. Go back to the previous version ([Updating](updating.md)) and report the log
lines.
