#!/bin/bash
# Interrupts `obur restore start`, `finish` and `cancel` at every step and checks that the next command still does the
# right thing, with no data lost (2026-11-22 audit, A01: each audit had found one more interruption point that the
# restore's scattered state did not cover). A command run with OBUR_TEST_INTERRUPT=<point> stops there as if killed
# (env.sh, checkpoint). Some steps are also tested across a container restart.
#
# Each round takes a backup, then writes a row after it: the database from before the restore has that row, the
# restored one does not, so every check can tell which database is live.
# Usage: deploy/obur/restore-interrupt-test.sh <image>
set -euo pipefail
image=${1:?usage: restore-interrupt-test.sh <image>}
name=obur-interrupt-$$
data=$(mktemp -d)
cleanup() {
	docker rm -f "$name" >/dev/null 2>&1 || true
	docker run --rm -v "$data:/d" --entrypoint bash "$image" -c 'rm -rf /d/*' >/dev/null 2>&1 || true
	rm -rf "$data"
}
trap cleanup EXIT
logs() { docker logs "$name" 2>&1 || true; }
fail() {
	echo "restore interruption test failed: $*" >&2
	logs | grep -v '^Applied' | tail -40 >&2
	exit 1
}
sql() { docker exec "$name" gosu postgres psql -X -q -t -A -v ON_ERROR_STOP=1 -h /var/run/postgresql -U obur_admin -d obur -c "$1"; }
step() { docker exec "$name" bash -c 'jq -r .step /data/status/restore.json 2>/dev/null || echo none'; }
page() {
	docker exec "$name" node -e "fetch('http://127.0.0.1:3000/login').then((r) => console.log(r.status), () => console.log('none'))" 2>/dev/null || echo none
}
# The app answers normally (200), says it is being restored (503), or nothing runs (none).
wait_page() {
	local want=$1 got=''
	for _ in $(seq 150); do
		got=$(page)
		[[ $got == "$want" ]] && return 0
		sleep 2
	done
	fail "$2 (the sign-in page answered $got, not $want)"
}
restore() { docker exec "$name" obur restore "$@" 2>&1; }
# A command stopped at a point: it must say so and exit as a killed process would.
interrupted() {
	local point=$1 out
	shift
	out=$(docker exec -e OBUR_TEST_INTERRUPT="$point" "$name" obur restore "$@" 2>&1) && fail "$* did not stop at $point"
	[[ $out == *"stopped at $point"* ]] || fail "$* at $point: $out"
}

round=0 label='' marker=''
# A backup, then a row only the database from before a restore has.
new_round() {
	round=$((round + 1))
	marker="after-backup-$round"
	out=$(docker exec "$name" obur backup now 2>&1) || fail "backup for round $round: $out"
	label=$(docker exec "$name" obur backup info | grep -oE '(full|diff|incr) backup: [0-9A-Z_-]+' | tail -1 | awk '{print $3}')
	[[ -n $label ]] || fail "no backup label in round $round"
	sql "insert into users (id, display_name, role) values (gen_random_uuid(), '$marker', 'member')" >/dev/null
}
has_marker() { [[ $(sql "select count(*) from users where display_name = '$marker'") == 1 ]]; }
RESTORE_ARGS() { echo "--set=$label --type=immediate --target-action=promote"; }
# Back to the database from before: the marker is there, the app is open, no restore is pending.
expect_before() {
	wait_page 200 "not open again after $1"
	[[ $(step) == none ]] || fail "a restore is still recorded after $1: $(step)"
	has_marker || fail "the database from before is not back after $1"
}
# The restored database is live and open: the marker is gone.
expect_restored() {
	wait_page 200 "not open after $1"
	[[ $(step) == none ]] || fail "a restore is still recorded after $1: $(step)"
	has_marker && fail "the restored database is not the live one after $1"
	return 0
}

docker run -d --name "$name" -v "$data:/data" -e PUBLIC_ORIGIN=http://localhost:3195 \
	-e OBUR_BACKUP_PASSPHRASE=interrupt-test-passphrase "$image" >/dev/null
wait_page 200 "not ready at first"

echo "start, interrupted at each step, then cancelled"
for point in start-prepared start-moved-unrecorded start-moved start-cleared start-restored-unrecorded; do
	new_round
	# shellcheck disable=SC2046
	interrupted "$point" start $(RESTORE_ARGS)
	out=$(restore cancel) || fail "cancel after start stopped at $point: $out"
	expect_before "cancel after start stopped at $point"
done

echo "start, interrupted at each step, then started again and finished"
for point in start-prepared start-moved-unrecorded start-moved start-cleared start-restored-unrecorded; do
	new_round
	# shellcheck disable=SC2046
	interrupted "$point" start $(RESTORE_ARGS)
	# Finish is refused until a restore completed.
	if [[ $point != start-restored-unrecorded ]]; then
		out=$(restore finish --none) && fail "finish ran after start stopped at $point"
		[[ $out == *'did not complete'* ]] || fail "finish after start stopped at $point: $out"
	fi
	# shellcheck disable=SC2046
	out=$(restore start $(RESTORE_ARGS)) || fail "start again after $point: $out"
	wait_page 503 "not saying 'being restored' after start again ($point)"
	out=$(restore finish --none) || fail "finish after start again ($point): $out"
	expect_restored "start stopped at $point, started again and finished"
done

echo "start interrupted, then the container restarted: nothing runs on the folder until start or cancel"
for point in start-moved start-cleared; do
	new_round
	# shellcheck disable=SC2046
	interrupted "$point" start $(RESTORE_ARGS)
	docker restart -t 60 "$name" >/dev/null
	for _ in $(seq 60); do
		[[ $(logs | tail -5) == *"waiting: a restore stopped at"* ]] && break
		sleep 2
	done
	[[ $(logs | tail -5) == *"waiting: a restore stopped at"* ]] || fail "no waiting line after a restart at $point"
	[[ $(page) == none ]] || fail "something answers after a restart at $point"
	docker exec "$name" pg_isready -q -h /var/run/postgresql && fail "PostgreSQL started on the folder after a restart at $point"
	out=$(restore cancel) || fail "cancel after a restart at $point: $out"
	expect_before "a restart at $point, then cancel"
done

echo "finish, interrupted at each step: cancel is refused, finish again completes, and a later write stays"
for point in finish-started finish-signed-out finish-done-unrecorded; do
	new_round
	# shellcheck disable=SC2046
	out=$(restore start $(RESTORE_ARGS)) || fail "start before finish at $point: $out"
	wait_page 503 "not saying 'being restored' before finish at $point"
	interrupted "$point" finish --none
	[[ $(step) == finishing ]] || fail "after finish stopped at $point the step is $(step)"
	[[ $(page) == 503 ]] || fail "the app opened while finish was incomplete ($point)"
	out=$(restore cancel) && fail "cancel ran after finish stopped at $point"
	[[ $out == *'being finished'* ]] || fail "cancel after finish stopped at $point: $out"
	if [[ $point == finish-signed-out ]]; then
		# Also across a restart: the restored database comes back saying it is being restored.
		docker restart -t 60 "$name" >/dev/null
		wait_page 503 "not saying 'being restored' after a restart during finish"
	fi
	out=$(restore finish --none) || fail "finish again after $point: $out"
	expect_restored "finish stopped at $point and run again"
	# The audit's case: once open, no restore command may replace the live database.
	sql "insert into users (id, display_name, role) values (gen_random_uuid(), 'written-after-$point', 'member')" >/dev/null
	out=$(restore cancel) && fail "cancel ran after a finished restore ($point)"
	[[ $out == *'no restore is pending'* ]] || fail "cancel after a finished restore ($point): $out"
	[[ $(sql "select count(*) from users where display_name = 'written-after-$point'") == 1 ]] ||
		fail "a write after the finished restore was lost ($point)"
done

echo "cancel of a completed restore, interrupted at each step, then cancelled again"
for point in cancel-started cancel-cleared cancel-back-unrecorded; do
	new_round
	# shellcheck disable=SC2046
	out=$(restore start $(RESTORE_ARGS)) || fail "start before cancel at $point: $out"
	wait_page 503 "not saying 'being restored' before cancel at $point"
	interrupted "$point" cancel
	out=$(restore finish --none) && fail "finish ran after cancel stopped at $point"
	out=$(restore cancel) || fail "cancel again after $point: $out"
	expect_before "cancel stopped at $point and run again"
done

echo "a restore left by an older version (separate mark files) goes on after the update"
new_round
# shellcheck disable=SC2046
out=$(restore start $(RESTORE_ARGS)) || fail "start for the older marks: $out"
wait_page 503 "not saying 'being restored' before the older marks"
aside=$(docker exec "$name" jq -r .aside /data/status/restore.json)
docker exec "$name" bash -c "rm /data/status/restore.json &&
	echo '{\"startedAt\": \"2026-11-22T10:00:00Z\", \"restoredAt\": \"2026-11-22T10:01:00Z\"}' >/data/status/restore-pending &&
	echo '$aside' >/data/status/restore-aside"
docker restart -t 60 "$name" >/dev/null
wait_page 503 "the older restore mark did not keep the app closed"
[[ $(step) == restored ]] || fail "the older marks became step $(step)"
out=$(restore cancel) || fail "cancel of a restore from the older marks: $out"
expect_before "cancel of a restore from the older marks"

echo "restore interruption test passed ($round rounds)"
