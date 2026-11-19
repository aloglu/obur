#!/bin/bash
# Checks an update over real data, and a restore of a backup an older version made, with the new image: the older
# image takes a backup holding shared foods (from before foods became private, 2026-11-17); the new image upgrades
# it (each member gets their own copy); then that older backup is restored and `obur restore finish` reapplies a
# deletion list with and without ":shared", which the older database's own function handles before the upgrade
# that follows.
# Usage: deploy/obur/upgrade-test.sh <older image> <new image>
set -euo pipefail
old=${1:?usage: upgrade-test.sh <older image> <new image>}
new=${2:?usage: upgrade-test.sh <older image> <new image>}
name=obur-upgrade-$$
data=$(mktemp -d)
cleanup() {
	docker rm -f "$name" >/dev/null 2>&1 || true
	docker run --rm -v "$data:/d" --entrypoint bash "$new" -c 'rm -rf /d/*' >/dev/null 2>&1 || true
	rm -rf "$data"
}
trap cleanup EXIT
logs() { docker logs "$name" 2>&1 || true; }
fail() {
	echo "upgrade test failed: $*" >&2
	logs | grep -v '^Applied' | tail -40 >&2
	exit 1
}
sql() { docker exec "$name" gosu postgres psql -X -q -t -A -v ON_ERROR_STOP=1 -h /var/run/postgresql -U obur_admin -d obur -c "$1"; }
start() {
	docker run -d --name "$name" -v "$data:/data" -e PUBLIC_ORIGIN=http://localhost:3197 \
		-e OBUR_BACKUP_PASSPHRASE=upgrade-test-passphrase "$1" >/dev/null
}
ready() {
	for _ in $(seq 120); do
		[[ $(logs) == *"ready on port 3000"* ]] && return
		[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "the container stopped"
		sleep 2
	done
	fail "not ready after 4 minutes"
}

ayse=11111111-1111-4111-8111-111111111111
mehmet=22222222-2222-4222-8222-222222222222
gone_shared=33333333-3333-4333-8333-333333333333
gone_kept=44444444-4444-4444-8444-444444444444
soup=55555555-5555-4555-8555-555555555555
bread=66666666-6666-4666-8666-666666666666
ayran=77777777-7777-4777-8777-777777777777
entry() {
	echo "insert into diary_entries (id, user_id, local_date, meal, zone, kind, food_id, food, amount, unit, nutrients)
		values (gen_random_uuid(), '$mehmet', '2026-11-01', 'lunch', 'Europe/Istanbul', 'food', '$1',
		'{\"name\": \"$2\", \"brand\": null, \"basis\": \"100g\", \"servingLabel\": null, \"servingSize\": null,
		\"servings\": [], \"basisNutrients\": [{\"code\": \"energy_kcal\", \"value\": 50, \"qualifier\": \"reported\"}]}',
		100, '{\"kind\": \"mass\", \"unit\": \"g\"}', '{\"energy_kcal\": {\"value\": 50, \"qualifier\": \"reported\"}}');"
}

echo "the older version, with shared foods"
start "$old"
ready
sql "insert into users (id, display_name, role) values ('$ayse', 'Ayşe', 'admin'), ('$mehmet', 'Mehmet', 'member'),
	('$gone_shared', 'Gone one', 'member'), ('$gone_kept', 'Gone two', 'member');
insert into foods (id, owner_id, visibility, name, search_key, basis, origin) values
	('$ayran', '$ayse', 'shared', 'Ayran', 'ayran', '100g', 'manual'),
	('$soup', '$gone_shared', 'shared', 'Soup', 'soup', '100g', 'manual'),
	('$bread', '$gone_kept', 'shared', 'Bread', 'bread', '100g', 'manual');
$(entry "$ayran" Ayran) $(entry "$soup" Soup) $(entry "$bread" Bread)" >/dev/null
out=$(docker exec "$name" obur backup now 2>&1) || fail "backup with the older version: $out"
label=$(docker exec "$name" obur backup info | grep -oE '(full|diff|incr) backup: [0-9A-Z_-]+' | tail -1 | awk '{print $3}')
[[ -n $label ]] || fail "no backup label"
docker stop -t 60 "$name" >/dev/null
docker rm "$name" >/dev/null

echo "the new version upgrades it"
start "$new"
ready
[[ $(sql "select count(*) from information_schema.columns where table_name = 'foods' and column_name = 'visibility'") == 0 ]] ||
	fail "the upgrade left the shared column"
copies=$(sql "select string_agg(name, ',' order by name) from foods where owner_id = '$mehmet'")
[[ $copies == 'Ayran,Bread,Soup' ]] || fail "Mehmet's copies after the upgrade: $copies"
[[ $(sql "select count(*) from diary_entries d join foods f on f.id = d.food_id where d.user_id = '$mehmet' and f.owner_id = '$mehmet'") == 3 ]] ||
	fail "Mehmet's entries do not point at his copies"

echo "the older backup is restored, and its deletions reapplied"
# Replay pauses once the database is consistent, so it stays read-only for as long as a long replay would: obur must
# keep running and say it is being restored (start-up once stopped on a write here, 2026-11-19 audit).
out=$(docker exec "$name" obur restore start --set="$label" --type=immediate --target-action=pause 2>&1) ||
	fail "restore start: $out"
for _ in $(seq 60); do
	[[ $(sql "select pg_is_wal_replay_paused()" 2>/dev/null) == t ]] && break
	sleep 2
done
[[ $(sql "select pg_is_wal_replay_paused()") == t ]] || fail "the restored database did not pause its replay"
sleep 10
[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "obur stopped while the restore was replaying"
code=$(docker exec "$name" node -e "fetch('http://127.0.0.1:3000/login').then((r) => console.log(r.status), () => console.log('none'))")
[[ $code == 503 ]] || fail "the page while the restore replays: $code"
sql "select pg_wal_replay_resume()" >/dev/null
for _ in $(seq 60); do
	[[ $(sql "select not pg_is_in_recovery()" 2>/dev/null) == t ]] && break
	sleep 2
done
[[ $(sql "select count(*) from information_schema.columns where table_name = 'foods' and column_name = 'visibility'") == 1 ]] ||
	fail "the restored database is not the older one"
out=$(docker exec "$name" obur restore finish "$gone_shared:shared@2026-11-02" "$gone_kept@2026-11-03" 2>&1) ||
	fail "restore finish with an older backup: $out"
for _ in $(seq 120); do
	[[ $(logs | grep -c "ready on port 3000") -ge 2 ]] && break
	sleep 2
done
[[ $(logs | grep -c "ready on port 3000") -ge 2 ]] || fail "not ready again after the restore"
[[ $(sql "select count(*) from users where id in ('$gone_shared', '$gone_kept')") == 0 ]] || fail "the deletions were not reapplied"
# The one deleted with its shared foods took the soup; the bread it kept became Mehmet's copy in the upgrade.
copies=$(sql "select string_agg(name, ',' order by name) from foods where owner_id = '$mehmet'")
[[ $copies == 'Ayran,Bread' ]] || fail "Mehmet's foods after the restore: $copies"
[[ $(sql "select count(*) from foods where owner_id is null and origin <> 'curated'") == 0 ]] || fail "foods without an owner"
[[ $(sql "select count(*) from diary_entries where user_id = '$mehmet'") == 3 ]] || fail "Mehmet's diary changed"
[[ $(sql "select count(*) from account_deletions") == 2 ]] || fail "the deletion list"
echo "upgrade test passed"
