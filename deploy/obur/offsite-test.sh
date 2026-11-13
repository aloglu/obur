#!/bin/bash
# Checks that the local backups never wait for the off-site store. Starts an obur image with a second repository in
# a folder standing in for the off-site store, takes that folder away, and checks that WAL keeps reaching the local
# repository, that what the store missed waits and is sent when it returns, that restores from both then pass, and
# that a queue over its limit is dropped and reported until the next off-site backup.
# Usage: deploy/obur/offsite-test.sh <image>
set -euo pipefail
image=${1:?usage: offsite-test.sh <image>}
name=obur-offsite-$$
data=$(mktemp -d)
offsite=$(mktemp -d)
cleanup() {
	docker rm -f "$name" >/dev/null 2>&1 || true
	docker run --rm -v "$data:/d" -v "$offsite:/o" --entrypoint bash "$image" -c "chown $(id -u) /o; chmod 700 /o; rm -rf /d/* /o/*" >/dev/null 2>&1 || true
	rm -rf "$data" "$offsite"
}
trap cleanup EXIT
fail() {
	echo "off-site test failed: $*" >&2
	docker logs "$name" 2>&1 | tail -40 >&2
	exit 1
}
sql() { docker exec "$name" gosu postgres psql -X -q -t -A -h /var/run/postgresql -U obur_admin -d obur -c "$1"; }
status() { docker exec "$name" jq -c "$1" /data/status/backup.json; }
waiting() { docker exec "$name" bash -c 'find /data/offsite-queue -name "*.gz" | wc -l'; }
# Writes about $1 MB that does not compress (always something: with nothing written PostgreSQL does not close the
# WAL file), closes the WAL file and prints its name once PostgreSQL has archived it.
write_wal() {
	local segment
	sql "insert into offsite_test select gen_random_bytes(1024) from generate_series(0, $1 * 1024)" >/dev/null
	segment=$(sql 'select pg_walfile_name(pg_switch_wal())')
	for _ in $(seq 60); do
		[[ $(sql "select coalesce(last_archived_wal, '') >= '$segment' from pg_stat_archiver") == t ]] && break
		sleep 1
	done
	[[ $(sql "select coalesce(last_archived_wal, '') >= '$segment' from pg_stat_archiver") == t ]] ||
		fail "PostgreSQL could not archive $segment"
	echo "$segment"
}
in_repo() { docker exec "$name" bash -c "find $1/archive -name '$2-*' | grep -q ."; }

docker run -d --name "$name" -v "$data:/data" -v "$offsite:/offsite" \
	-e PUBLIC_ORIGIN=http://localhost:3198 -e OBUR_BACKUP_PASSPHRASE=offsite-test-passphrase \
	-e PGBACKREST_REPO2_TYPE=posix -e PGBACKREST_REPO2_PATH=/offsite \
	-e OBUR_OFFSITE_QUEUE_MAX_MB=2 -e OBUR_OFFSITE_RETRY_SECONDS=3 "$image" >/dev/null
docker exec "$name" chown postgres:postgres /offsite
for _ in $(seq 120); do
	[[ $(status '.lastBackup.repos["2"]' 2>/dev/null) == true ]] && break
	[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "the container stopped"
	sleep 2
done
[[ $(status '.lastBackup.repos' 2>/dev/null) == '{"1":true,"2":true}' ]] || fail "no first backup in both repositories"
sql 'create extension if not exists pgcrypto; create table offsite_test (b bytea)' >/dev/null
first=$(write_wal 0)
in_repo /offsite "$first" || fail "WAL did not reach the off-site store while it was reachable"

echo "the off-site store goes away"
docker exec "$name" chmod 000 /offsite
failed_before=$(sql 'select failed_count from pg_stat_archiver')
for _ in 1 2 3; do segment=$(write_wal 0); done
in_repo /data/backups "$segment" || fail "WAL stopped reaching the local repository"
[[ $(sql 'select failed_count from pg_stat_archiver') == "$failed_before" ]] || fail "PostgreSQL's archiving failed"
(($(waiting) >= 3)) || fail "nothing waits for the off-site store"
sleep 4
[[ $(status '.offsiteQueue.waiting >= 3') == true ]] || fail "the status does not show what waits"
if docker exec "$name" obur backup now >/dev/null 2>&1; then fail "a backup claimed to reach the off-site store"; fi
[[ $(status '.lastBackup.repos') == '{"1":true,"2":false}' ]] || fail "the local backup did not finish on its own"

echo "the off-site store returns"
docker exec "$name" chmod 700 /offsite
for _ in $(seq 30); do
	(($(waiting) == 0)) && break
	sleep 1
done
(($(waiting) == 0)) || fail "the waiting WAL was not sent"
in_repo /offsite "$segment" || fail "the waiting WAL is not in the off-site store"
docker exec "$name" obur backup restore-check >/dev/null 2>&1 || fail "restore check after the outage"
[[ $(status '[.lastRestoreCheck.ok, .lastOffsiteRestoreCheck.ok]') == '[true,true]' ]] || fail "restore check results"

echo "an outage longer than the queue holds"
docker exec "$name" chmod 000 /offsite
segment=$(write_wal 3)
in_repo /data/backups "$segment" || fail "WAL stopped reaching the local repository at the limit"
(($(waiting) == 0)) || fail "the queue was not emptied at its limit"
sleep 4
[[ $(status '.offsiteQueue.gapAt != null') == true ]] || fail "the gap is not reported"
docker exec "$name" chmod 700 /offsite
docker exec "$name" obur backup now >/dev/null 2>&1 || fail "the backup after the gap"
sleep 4
[[ $(status '.offsiteQueue.gapAt') == null ]] || fail "the gap is still reported after an off-site backup"
docker exec "$name" obur backup restore-check >/dev/null 2>&1 || fail "restore check after the gap"
echo "off-site test passed"
