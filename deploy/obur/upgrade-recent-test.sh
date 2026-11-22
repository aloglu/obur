#!/bin/bash
# Checks the most common upgrade: from the last published release to this one, over real data (audit D07, 2026-11-22).
# The older image gets people, a profile, weigh-ins, water, a private food and a diary entry, and takes a backup. The
# new image upgrades it: every record must be unchanged and every migration applied. Then the older backup is restored
# with the new image: the database goes back to that moment (a weigh-in made after it is gone), obur upgrades it again
# when the restore is finished, and the records are still unchanged.
# Usage: deploy/obur/upgrade-recent-test.sh <older image> <new image>
set -euo pipefail
old=${1:?usage: upgrade-recent-test.sh <older image> <new image>}
new=${2:?usage: upgrade-recent-test.sh <older image> <new image>}
name=obur-recent-$$
data=$(mktemp -d)
cleanup() {
	docker rm -f "$name" >/dev/null 2>&1 || true
	docker run --rm -v "$data:/d" --entrypoint bash "$new" -c 'rm -rf /d/*' >/dev/null 2>&1 || true
	rm -rf "$data"
}
trap cleanup EXIT
logs() { docker logs "$name" 2>&1 || true; }
fail() {
	echo "recent upgrade test failed: $*" >&2
	logs | grep -v '^Applied' | tail -40 >&2
	exit 1
}
sql() { docker exec "$name" gosu postgres psql -X -q -t -A -v ON_ERROR_STOP=1 -h /var/run/postgresql -U obur_admin -d obur -c "$1"; }
start() {
	docker run -d --name "$name" -v "$data:/data" -e PUBLIC_ORIGIN=http://localhost:3196 \
		-e OBUR_BACKUP_PASSPHRASE=recent-upgrade-test "$1" >/dev/null
}
# Ready for the n-th time in this container's log (a finished restore starts the app again).
ready() {
	local times=${1:-1}
	for _ in $(seq 150); do
		[[ $(logs | grep -c "ready on port 3000") -ge $times ]] && return
		[[ $(docker inspect -f '{{.State.Running}}' "$name") == true ]] || fail "the container stopped"
		sleep 2
	done
	fail "not ready after 5 minutes"
}
# Every record written below, as one value: the same before and after means nothing was lost or changed.
records() {
	sql "select md5(coalesce(string_agg(x, '|' order by x), '')) from (
		select 'u:' || id || ':' || display_name || ':' || role from users
		union all select 'p:' || user_id || ':' || height_cm || ':' || birth_date || ':' || sex from profiles
		union all select 'w:' || id || ':' || local_date || ':' || kg from weight_entries where deleted_at is null
		union all select 'a:' || id || ':' || local_date || ':' || ml from water_entries where deleted_at is null
		union all select 'f:' || id || ':' || owner_id || ':' || name from foods where origin <> 'curated'
		union all select 'd:' || id || ':' || food_id || ':' || amount from diary_entries where deleted_at is null
	) t(x)"
}
migrations() { sql 'select count(*) from schema_migrations'; }

ayse=11111111-1111-4111-8111-111111111111
mehmet=22222222-2222-4222-8222-222222222222
ayran=77777777-7777-4777-8777-777777777777

echo "the older version ($old), with records"
start "$old"
ready
sql "insert into users (id, display_name, role) values ('$ayse', 'Ayşe', 'admin'), ('$mehmet', 'Mehmet', 'member');
insert into profiles (user_id, height_cm, birth_date, sex) values ('$mehmet', 178.5, '1990-04-15', 'male');
insert into weight_entries (id, user_id, local_date, zone, kg) values
	(gen_random_uuid(), '$mehmet', '2026-11-01', 'Europe/Istanbul', 84.35),
	(gen_random_uuid(), '$mehmet', '2026-11-08', 'Europe/Istanbul', 83.9);
insert into water_entries (id, user_id, local_date, zone, ml) values
	(gen_random_uuid(), '$mehmet', '2026-11-01', 'Europe/Istanbul', 750);
insert into foods (id, owner_id, name, search_key, basis, origin) values
	('$ayran', '$mehmet', 'Ayran', 'ayran', '100g', 'manual');
insert into diary_entries (id, user_id, local_date, meal, zone, kind, food_id, food, amount, unit, nutrients)
	values (gen_random_uuid(), '$mehmet', '2026-11-01', 'lunch', 'Europe/Istanbul', 'food', '$ayran',
	'{\"name\": \"Ayran\", \"brand\": null, \"basis\": \"100g\", \"servingLabel\": null, \"servingSize\": null,
	\"servings\": [], \"basisNutrients\": [{\"code\": \"energy_kcal\", \"value\": 38, \"qualifier\": \"reported\"}]}',
	250, '{\"kind\": \"mass\", \"unit\": \"g\"}', '{\"energy_kcal\": {\"value\": 95, \"qualifier\": \"reported\"}}');" >/dev/null
before=$(records)
older_migrations=$(migrations)
out=$(docker exec "$name" obur backup now 2>&1) || fail "backup with the older version: $out"
label=$(docker exec "$name" obur backup info | grep -oE '(full|diff|incr) backup: [0-9A-Z_-]+' | tail -1 | awk '{print $3}')
[[ -n $label ]] || fail "no backup label"
docker stop -t 60 "$name" >/dev/null
docker rm "$name" >/dev/null

echo "the new version upgrades it"
start "$new"
ready
[[ $(records) == "$before" ]] || fail "records changed in the upgrade"
upgraded=$(migrations)
((upgraded >= older_migrations)) || fail "migrations: $older_migrations before, $upgraded after"
# "ready" is logged when the web app is started, not when it answers: ask until it does.
code=none
for _ in $(seq 60); do
	code=$(docker exec "$name" node -e "fetch('http://127.0.0.1:3000/login').then((r) => console.log(r.status), () => console.log('none'))")
	[[ $code == 200 ]] && break
	sleep 1
done
[[ $code == 200 ]] || fail "the sign-in page after the upgrade: $code"
# Made with the new version, after the backup: the restore must take it away.
sql "insert into weight_entries (id, user_id, local_date, zone, kg)
	values (gen_random_uuid(), '$mehmet', '2026-11-15', 'Europe/Istanbul', 83.1)" >/dev/null

echo "the older version's backup is restored with the new one"
out=$(docker exec "$name" obur restore start --set="$label" --type=immediate --target-action=promote 2>&1) ||
	fail "restore start: $out"
for _ in $(seq 90); do
	[[ $(sql "select not pg_is_in_recovery()" 2>/dev/null) == t ]] && break
	sleep 2
done
[[ $(sql "select not pg_is_in_recovery()") == t ]] || fail "the restored database is still replaying"
[[ $(migrations) == "$older_migrations" ]] || fail "the restored database is not the older one"
out=$(docker exec "$name" obur restore finish --none 2>&1) || fail "restore finish: $out"
ready 2
[[ $(records) == "$before" ]] || fail "records after the restore differ from the backup's"
[[ $(migrations) == "$upgraded" ]] || fail "the restored database was not upgraded again"
echo "recent upgrade test passed ($old → $new)"
