#!/bin/bash
# Starts an obur image with an empty data folder and checks the basics: it becomes healthy, serves the sign-in page,
# prints a first-account link, survives badly encoded addresses, has taken its first backup, refuses the administrator
# to the app's user, is not ready without the app's database role, does not open on a newer database, recovers from a failed restore (retry and cancel, with and without a database before it), and
# stops cleanly. Usage: deploy/obur/smoke-test.sh <image>
set -euo pipefail
image=${1:?usage: smoke-test.sh <image>}
name=obur-smoke-$$
data=$(mktemp -d)
fresh=$(mktemp -d)
half=$(mktemp -d)
cleanup() {
	docker rm -f "$name" >/dev/null 2>&1 || true
	for d in "$data" "$fresh" "$half"; do
		docker run --rm -v "$d:/d" --entrypoint bash "$image" -c 'rm -rf /d/*' >/dev/null 2>&1 || true
		rm -rf "$d"
	done
}
trap cleanup EXIT
# The whole log first: with pipefail, `docker logs | grep -q` fails when grep stops reading at a match while the log
# is still being written to the pipe.
logs() { docker logs "$name" 2>&1 || true; }
fail() {
	echo "smoke test failed: $*" >&2
	docker logs "$name" 2>&1 | tail -40 >&2
	exit 1
}

# Without a mounted /data, obur stops at once instead of starting an installation inside the container (A13).
out=$(timeout 60 docker run --rm -e PUBLIC_ORIGIN=http://localhost:3199 \
	-e OBUR_BACKUP_PASSPHRASE=smoke-test-passphrase "$image" 2>&1) && fail "obur started without a mounted /data"
[[ $out == *'/data is not a mounted folder, so obur does not start'* ]] || fail "no mount: $out"

docker run -d --name "$name" -p 127.0.0.1:3199:3000 -v "$data:/data" \
	-e PUBLIC_ORIGIN=http://localhost:3199 -e OBUR_BACKUP_PASSPHRASE=smoke-test-passphrase "$image" >/dev/null
for _ in $(seq 90); do
	[[ $(docker inspect -f '{{.State.Health.Status}}' "$name") == healthy ]] && break
	[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "the container stopped"
	sleep 2
done
[[ $(docker inspect -f '{{.State.Health.Status}}' "$name") == healthy ]] || fail "not healthy after 3 minutes"
[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3199/login) == 200 ]] || fail "no sign-in page"
[[ $(logs) == *'http://localhost:3199/setup#'* ]] || fail "no first-account link in the log"
# Badly encoded addresses get an error page, and obur keeps running (SvelteKit 3.1.0 crashed on them, which stopped
# the whole container; GHSA-mw6w-2fmv-pvw3).
for path in '/%E0%A4%A' '/%' '/api/v1/%E0'; do
	curl -s -o /dev/null "http://127.0.0.1:3199$path" || true
done
sleep 2
[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "a badly encoded address stopped obur"
[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3199/login) == 200 ]] ||
	fail "no sign-in page after badly encoded addresses"
for _ in $(seq 30); do
	docker exec "$name" test -f /data/backups/backup/obur/backup.info && break
	sleep 2
done
[[ $(docker exec "$name" obur backup info) == *'full backup'* ]] || fail "no first backup"
# The status says the scheduler is alive and how many changes wait to be archived (A12). Read as the web app's user,
# as the Server page reads it: a fresh install once wrote it readable by the database's user only (2026-11-22, A03).
for _ in $(seq 30); do
	docker exec "$name" jq -e '.scheduler.at and (.archive.waiting | type == "number")' /data/status/backup.json \
		>/dev/null 2>&1 && break
	sleep 2
done
docker exec -u node "$name" jq -e '.scheduler.at and (.archive.waiting | type == "number")' /data/status/backup.json \
	>/dev/null || fail "the web app's user cannot read the backup status, or it lacks the scheduler time or backlog"
# The web app and the worker run as different users, and neither can read the other's settings (A32).
owner() {
	docker exec "$name" bash -c "for p in /proc/[0-9]*; do grep -qa '$1' \$p/cmdline 2>/dev/null && stat -c %U \$p && break; done"
}
[[ $(owner server.js) == node && $(owner scripts/worker.ts) == obur-worker ]] ||
	fail "web app runs as $(owner server.js), worker as $(owner scripts/worker.ts)"
docker exec -u node "$name" bash -c "for p in /proc/[0-9]*; do grep -qa scripts/worker.ts \$p/cmdline 2>/dev/null && cat \$p/environ; done" \
	2>/dev/null | grep -qa VAPID_PRIVATE_KEY && fail "the web app's user can read the worker's settings"
if docker exec -u node "$name" psql -h 127.0.0.1 -U obur_admin -d obur -c 'select 1' </dev/null >/dev/null 2>&1; then
	fail "the app's user reached the database as administrator"
fi
sql() { docker exec "$name" gosu postgres psql -X -q -t -A -v ON_ERROR_STOP=1 -h /var/run/postgresql -U obur_admin -d obur -c "$1"; }
health() {
	docker exec "$name" node -e "fetch('http://127.0.0.1:3000/api/v1/health').then((r) => console.log(r.status), () => console.log('none'))"
}
# Readiness needs the app's own database role (2026-11-20 audit, R12): the sign-in page alone never asked it.
[[ $(health) == 200 ]] || fail "not ready: $(health)"
sql "alter role obur_app nologin; select pg_terminate_backend(pid) from pg_stat_activity where usename = 'obur_app'" >/dev/null
[[ $(health) == 503 ]] || fail "ready while the app's database role cannot connect: $(health)"
sql 'alter role obur_app login' >/dev/null
for _ in $(seq 10); do
	[[ $(health) == 200 ]] && break
	sleep 1
done
[[ $(health) == 200 ]] || fail "not ready again once the app's database role can connect"
ready_again() {
	local want=$1
	for _ in $(seq 90); do
		[[ $(logs | grep -c "ready on port 3000") -ge $want ]] && return 0
		sleep 2
	done
	fail "$2"
}
# A failed restore can be tried again and cancelled (both were refused once a failed attempt left its mark, 2026-11-19
# audit). A backup set that doesn't exist makes pgBackRest fail.
docker exec "$name" obur restore start --set=does-not-exist >/dev/null 2>&1 && fail "a restore of no backup worked"
out=$(docker exec "$name" obur restore start --set=does-not-exist 2>&1) && fail "the second bad restore worked"
[[ $out == *'did not complete'*'starting it again'* ]] || fail "a failed restore could not be retried: $out"
# While another restore command runs, start and cancel are refused and change nothing (2026-11-20 audit).
docker exec -d "$name" flock /run/obur/restore.lock sleep 10
sleep 1
out=$(docker exec "$name" obur restore cancel 2>&1) && fail "cancel ran beside another restore command"
[[ $out == *'still running'* ]] || fail "cancel beside another restore command: $out"
out=$(docker exec "$name" obur restore start 2>&1) && fail "start ran beside another restore command"
[[ $out == *'still running'* ]] || fail "start beside another restore command: $out"
docker exec "$name" flock /run/obur/restore.lock true # waits for it to end
out=$(docker exec "$name" obur restore cancel 2>&1) || fail "cancel after a failed restore: $out"
[[ $out == *'from before the restore is back'* ]] || fail "cancel did not put the database back: $out"
ready_again 2 "not ready again after cancelling a failed restore"
# The ready line comes just before the web server listens: give it a few seconds.
signin_page() {
	for _ in $(seq 10); do
		[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3199/login) == 200 ]] && return 0
		sleep 1
	done
	return 1
}
signin_page || fail "no sign-in page after cancel"
# A restore stopped after it noted where the database goes but before it moved it (A04): cancel keeps the database.
docker exec "$name" bash -c 'echo /data/postgres-before-restore-never-moved >/data/status/restore-aside'
out=$(docker exec "$name" obur restore cancel 2>&1) || fail "cancel of a restore stopped before the move: $out"
[[ $out == *'still in place'* ]] || fail "cancel of a restore stopped before the move: $out"
ready_again 3 "not ready again after cancelling a restore stopped before the move"
signin_page || fail "no sign-in page after the second cancel"
# An obur older than its database does not open (R12): one database step this version doesn't know.
sql "insert into schema_migrations (name, checksum) values ('9999_from_a_newer_version', 'x')" >/dev/null
docker restart -t 60 "$name" >/dev/null
for _ in $(seq 60); do
	[[ $(logs) == *'is older than its database'* ]] && break
	sleep 2
done
[[ $(logs) == *'is older than its database'* ]] || fail "an older obur did not say it is older than its database"
sleep 5
[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "an older obur stopped instead of waiting"
[[ $(health) == none ]] || fail "an older obur opened: $(health)"
sql "delete from schema_migrations where name = '9999_from_a_newer_version'" >/dev/null
docker restart -t 60 "$name" >/dev/null
ready_again 4 "not ready again with a database it knows"
# An upgrade with the local backups gone (a new backup disk) takes a full backup before it changes anything (A03).
# One database step only rebuilds an index, so it can run again: removing its row makes it pending.
sql "delete from schema_migrations where name = '0061_reindex_food_search_pg_18_7'" >/dev/null
docker stop -t 60 "$name" >/dev/null
docker run --rm -v "$data:/d" --entrypoint bash "$image" -c 'rm -rf /d/backups/*' || fail "removing the backups"
docker start "$name" >/dev/null
ready_again 5 "not ready after an upgrade with no local backups"
[[ $(logs) == *'taking a backup first'*'no prior backup exists, incr backup has been changed to full'* ]] ||
	fail "the upgrade did not take a full backup first"
[[ $(docker exec "$name" obur backup info) == *'full backup'* ]] || fail "no backup before the upgrade"
docker stop -t 60 "$name" >/dev/null
[[ $(logs) == *'database system is shut down'* ]] || fail "the database did not shut down cleanly"

# The same on a new installation with only the backups (a lost database): nothing to put back, so cancel returns to
# waiting for a restore, and a good restore then works.
docker rm "$name" >/dev/null
docker run --rm -v "$data:/from" -v "$fresh:/to" --entrypoint bash "$image" -c 'cp -a /from/backups /to/' ||
	fail "copying the backups"
docker run -d --name "$name" -p 127.0.0.1:3199:3000 -v "$fresh:/data" \
	-e PUBLIC_ORIGIN=http://localhost:3199 -e OBUR_BACKUP_PASSPHRASE=smoke-test-passphrase "$image" >/dev/null
for _ in $(seq 30); do
	[[ $(logs) == *'backups exist'* ]] && break
	sleep 2
done
[[ $(logs) == *'backups exist'* ]] || fail "a new installation with backups did not wait for a restore"
docker exec "$name" obur restore start --set=does-not-exist >/dev/null 2>&1 && fail "a restore of no backup worked"
out=$(docker exec "$name" obur restore cancel 2>&1) || fail "cancel with no database before: $out"
[[ $out == *'no database before it'* ]] || fail "cancel with no database before: $out"
out=$(docker exec "$name" obur restore start 2>&1) || fail "restore after a cancelled one: $out"
# Without the deleted-accounts list, or --none, finish refuses and changes nothing (A10).
out=$(docker exec "$name" obur restore finish 2>&1) && fail "restore finish ran without a deletion list"
[[ $out == *'or --none if that list is empty'* ]] || fail "restore finish without a list: $out"
out=$(docker exec "$name" obur restore finish --none 2>&1) || fail "restore finish: $out"
ready_again 1 "not ready after restoring a lost database"
docker stop -t 60 "$name" >/dev/null
docker rm "$name" >/dev/null

# A first start stopped after PostgreSQL was set up, before it made the app's database: the next start makes it
# (2026-11-25 audit: each later start failed).
docker run --rm -v "$half:/data" --entrypoint bash "$image" -c 'chmod a+x /data && install -d -o postgres -g postgres -m 700 /data/postgres /data/postgres/18 &&
	gosu postgres initdb -D /data/postgres/18/docker -U obur_admin --data-checksums --auth-local=peer --auth-host=scram-sha-256' \
	>/dev/null || fail "setting up the half-made database"
docker run -d --name "$name" -p 127.0.0.1:3199:3000 -v "$half:/data" \
	-e PUBLIC_ORIGIN=http://localhost:3199 -e OBUR_BACKUP_PASSPHRASE=smoke-test-passphrase "$image" >/dev/null
for _ in $(seq 90); do
	[[ $(docker inspect -f '{{.State.Health.Status}}' "$name") == healthy ]] && break
	[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "a half-made first start stopped obur"
	sleep 2
done
[[ $(docker inspect -f '{{.State.Health.Status}}' "$name") == healthy ]] || fail "not healthy after a half-made first start"
[[ $(logs) == *'http://localhost:3199/setup#'* ]] || fail "no first-account link after a half-made first start"
docker stop -t 60 "$name" >/dev/null
echo "smoke test passed"
