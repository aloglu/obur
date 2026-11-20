#!/bin/bash
# Starts an obur image with an empty data folder and checks the basics: it becomes healthy, serves the sign-in page,
# prints a first-account link, survives badly encoded addresses, has taken its first backup, refuses the administrator
# to the app's user, recovers from a failed restore (retry and cancel, with and without a database before it), and
# stops cleanly. Usage: deploy/obur/smoke-test.sh <image>
set -euo pipefail
image=${1:?usage: smoke-test.sh <image>}
name=obur-smoke-$$
data=$(mktemp -d)
fresh=$(mktemp -d)
cleanup() {
	docker rm -f "$name" >/dev/null 2>&1 || true
	for d in "$data" "$fresh"; do
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
if docker exec -u node "$name" psql -h 127.0.0.1 -U obur_admin -d obur -c 'select 1' </dev/null >/dev/null 2>&1; then
	fail "the app's user reached the database as administrator"
fi
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
[[ $out == *'did not complete; starting it again'* ]] || fail "a failed restore could not be retried: $out"
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
out=$(docker exec "$name" obur restore finish 2>&1) || fail "restore finish: $out"
ready_again 1 "not ready after restoring a lost database"
docker stop -t 60 "$name" >/dev/null
echo "smoke test passed"
