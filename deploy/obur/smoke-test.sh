#!/bin/bash
# Starts an obur image with an empty data folder and checks the basics: it becomes healthy, serves the sign-in page,
# prints a first-account link, has taken its first backup, refuses the administrator to the app's user, and stops
# cleanly. Usage: deploy/obur/smoke-test.sh <image>
set -euo pipefail
image=${1:?usage: smoke-test.sh <image>}
name=obur-smoke-$$
data=$(mktemp -d)
cleanup() {
	docker rm -f "$name" >/dev/null 2>&1 || true
	docker run --rm -v "$data:/d" --entrypoint bash "$image" -c 'rm -rf /d/*' >/dev/null 2>&1 || true
	rm -rf "$data"
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
for _ in $(seq 30); do
	docker exec "$name" test -f /data/backups/backup/obur/backup.info && break
	sleep 2
done
[[ $(docker exec "$name" obur backup info) == *'full backup'* ]] || fail "no first backup"
if docker exec -u node "$name" psql -h 127.0.0.1 -U obur_admin -d obur -c 'select 1' </dev/null >/dev/null 2>&1; then
	fail "the app's user reached the database as administrator"
fi
docker stop -t 60 "$name" >/dev/null
[[ $(logs) == *'database system is shut down'* ]] || fail "the database did not shut down cleanly"
echo "smoke test passed"
