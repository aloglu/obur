#!/bin/bash
# A lost server restored from the off-site copy alone (docs/restore.md, "New server only"): the first installation
# backs up to a folder standing in for the off-site store; a second, with an empty data folder and only that store,
# must wait for a restore instead of starting a new database, restore it, reopen with the data, and back up locally.
# Before 1.0.0-rc.6 it started a new database, whose local backups then refused the restored one (2026-11-20 audit).
# Usage: deploy/obur/offsite-restore-test.sh <image>
set -euo pipefail
image=${1:?usage: offsite-restore-test.sh <image>}
name=obur-offsite-restore-$$
first=$(mktemp -d)
second=$(mktemp -d)
offsite=$(mktemp -d)
cleanup() {
	docker rm -f "$name" >/dev/null 2>&1 || true
	for d in "$first" "$second" "$offsite"; do
		docker run --rm -v "$d:/d" --entrypoint bash "$image" -c "rm -rf /d/*; chown $(id -u) /d" >/dev/null 2>&1 || true
		rm -rf "$d"
	done
}
trap cleanup EXIT
logs() { docker logs "$name" 2>&1 || true; }
fail() {
	echo "off-site restore test failed: $*" >&2
	docker exec "$name" cat /data/status/backup.json >&2 || true
	logs | grep -v '^Applied' | tail -40 >&2
	exit 1
}
sql() { docker exec "$name" gosu postgres psql -X -q -t -A -h /var/run/postgresql -U obur_admin -d obur -c "$1"; }
status() { docker exec "$name" jq -c "$1" /data/status/backup.json 2>/dev/null || true; }
run() {
	docker run -d --name "$name" -p 127.0.0.1:3197:3000 -v "$1:/data" -v "$offsite:/offsite" \
		-e PUBLIC_ORIGIN=http://localhost:3197 -e OBUR_BACKUP_PASSPHRASE=offsite-restore-passphrase \
		-e PGBACKREST_REPO2_TYPE=posix -e PGBACKREST_REPO2_PATH=/offsite "$image" >/dev/null
}
ready() {
	for _ in $(seq 90); do
		[[ $(logs) == *'ready on port 3000'* ]] && return 0
		[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "the container stopped"
		sleep 2
	done
	fail "$1"
}

docker run --rm -v "$offsite:/o" --entrypoint chown "$image" postgres:postgres /o
run "$first"
ready "the first installation did not start"
for _ in $(seq 60); do
	[[ $(status '.lastBackup.repos["2"]') == true ]] && break
	sleep 2
done
[[ $(status '.lastBackup.repos["2"]') == true ]] || fail "no first backup off site"
sql "create table restore_marker (note text); insert into restore_marker values ('kept')" >/dev/null
# The marker reaches the off-site store as archived WAL, as a lost server's last changes would.
segment=$(sql 'select pg_walfile_name(pg_switch_wal())')
for _ in $(seq 60); do
	[[ $(sql "select coalesce(last_archived_wal, '') >= '$segment' from pg_stat_archiver") == t ]] && break
	sleep 1
done
docker exec "$name" bash -c "find /offsite/archive -name '$segment*' | grep -q ." || fail "the marker's WAL is not off site"
docker rm -f "$name" >/dev/null

echo "a new server with only the off-site copy"
run "$second"
for _ in $(seq 60); do
	[[ $(logs) == *'the off-site copy has backups'* ]] && break
	sleep 2
done
[[ $(logs) == *'the off-site copy has backups'* ]] || fail "the new server did not wait for a restore"
docker exec "$name" test -e /data/postgres/18/docker/PG_VERSION && fail "the new server made a database"
docker exec "$name" test -e /data/backups/backup && fail "the new server made a local backup repository"
out=$(docker exec "$name" obur restore start --repo=2 2>&1) || fail "restore start: $out"
out=$(docker exec "$name" obur restore finish --none 2>&1) || fail "restore finish: $out"
ready "not ready after the restore"
[[ $(sql 'select note from restore_marker') == kept ]] || fail "the restored data is missing"
[[ -z $(docker exec "$name" ls /data/status/restore-pending 2>/dev/null) ]] || fail "the restore is still pending"
[[ $(docker exec "$name" obur backup info) == *'full backup'* ]] || fail "no local backup after the restore"
out=$(docker exec "$name" obur backup now 2>&1) || fail "a backup after the restore: $out"
[[ $(status '.lastBackup.repos') == '{"1":true,"2":true}' ]] || fail "the backup after the restore: $(status '.lastBackup')"
for _ in $(seq 10); do
	[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3197/login) == 200 ]] && break
	sleep 1
done
[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3197/login) == 200 ]] || fail "no sign-in page"
docker stop -t 60 "$name" >/dev/null
echo "off-site restore test passed"
