# shellcheck shell=bash
# Settings shared by the obur container's start-up and its commands (sourced, as root). Everything lives in /data:
#   /data/postgres   the database          /data/backups   encrypted backups (may be its own mount, e.g. another disk)
#   /data/status     backup health and the restore mark, read by the web app
#   /data/secrets    database passwords and reminder keys, generated on first start (readable by root only)
# The person installing obur sets PUBLIC_ORIGIN and OBUR_BACKUP_PASSPHRASE; everything else has a default.

export PGDATA=/data/postgres/18/docker
export OBUR_STATUS_DIR=/data/status
OBUR_SECRETS=/data/secrets/obur.env
OBUR_RUN=/run/obur
OBUR_SOCKET=/var/run/postgresql

obur_fail() {
	printf 'obur: %s\n' "$*" >&2
	exit 1
}

# Passwords and keys this installation generated for itself. A value given in the environment wins (for a server
# that already had its own Web Push keys, so devices keep their reminders).
obur_secrets() {
	if [[ ! -s $OBUR_SECRETS ]]; then
		install -d -m 700 "$(dirname "$OBUR_SECRETS")"
		local keys
		keys=$(cd /app && node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)")
		# Only this file is private: in the shell itself the setting would reach everything started after it (the
		# backup status file the web app reads was then unreadable to it until a restart; 2026-11-22 audit, A03).
		(
			umask 077
			{
				for role in ADMIN MIGRATOR APP WORKER; do
					echo "OBUR_${role}_DB_PASSWORD=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
				done
				echo "OBUR_SECRETS_KEY=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
				echo "OBUR_VAPID_PUBLIC_KEY=${keys% *}"
				echo "OBUR_VAPID_PRIVATE_KEY=${keys#* }"
			} >"$OBUR_SECRETS.tmp"
		)
		mv "$OBUR_SECRETS.tmp" "$OBUR_SECRETS"
	fi
	if ! grep -q '^OBUR_SECRETS_KEY=' "$OBUR_SECRETS"; then
		echo "OBUR_SECRETS_KEY=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')" >>"$OBUR_SECRETS"
	fi
	# Read as plain shell settings, not exported: each process gets only what it needs, passed by name (the
	# database and the backup tool had every password and key in their environment; 2026-11-22 Gemini audit, G22).
	# shellcheck source=/dev/null
	. "$OBUR_SECRETS"
	VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY:-$OBUR_VAPID_PUBLIC_KEY}
	VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY:-$OBUR_VAPID_PRIVATE_KEY}
}

obur_env() {
	[[ -n ${PUBLIC_ORIGIN:-} ]] || obur_fail "set PUBLIC_ORIGIN to the address people open, e.g. https://obur.example.com"
	PUBLIC_ORIGIN=${PUBLIC_ORIGIN%/}
	export PUBLIC_ORIGIN
	# The passkey domain: the address's host unless set (a parent domain keeps passkeys when the address moves).
	local host=${PUBLIC_ORIGIN#*://}
	host=${host%%[:/]*}
	export WEBAUTHN_RP_ID=${WEBAUTHN_RP_ID:-$host}
	# The contact the push services see for reminders: the https address, or a placeholder for a local http test.
	local subject=$PUBLIC_ORIGIN
	[[ $subject == https://* ]] || subject=mailto:obur@localhost
	export VAPID_SUBJECT=${VAPID_SUBJECT:-$subject}
	[[ -n ${OBUR_BACKUP_PASSPHRASE:-} ]] ||
		obur_fail "set OBUR_BACKUP_PASSPHRASE: it encrypts the backups. Keep a copy off this server; without it no backup can be read."
	# The examples in .env.example and the install guides would encrypt the backups with a phrase anyone can read.
	case $OBUR_BACKUP_PASSPHRASE in
	change-me* | a-long-phrase-only-you-know)
		obur_fail "OBUR_BACKUP_PASSPHRASE is still the example value: choose your own long phrase and keep a copy off this server." ;;
	esac
	export PGBACKREST_REPO1_CIPHER_PASS=$OBUR_BACKUP_PASSPHRASE
	export PGBACKREST_REPO1_RETENTION_FULL=${OBUR_BACKUP_KEEP_WEEKS:-5}
	export PGBACKREST_PROCESS_MAX=${OBUR_BACKUP_PROCESSES:-4}
	obur_backup_times
	obur_offsite_env
	obur_secrets
	local db=127.0.0.1:5432/obur
	OBUR_ADMIN_URL=postgres://obur_admin:$OBUR_ADMIN_DB_PASSWORD@$db
	OBUR_MIGRATOR_URL=postgres://obur_migrator:$OBUR_MIGRATOR_DB_PASSWORD@$db
	OBUR_APP_URL=postgres://obur_app:$OBUR_APP_DB_PASSWORD@$db
	OBUR_WORKER_URL=postgres://obur_worker:$OBUR_WORKER_DB_PASSWORD@$db
}

# The nightly backup's hour (0-23; "08" is 8, not an octal error that skipped every nightly backup) and the weekdays
# (1-7) of the weekly full backup and restore check (2026-11-22 Gemini audit, G24).
obur_backup_times() {
	local hour=${OBUR_BACKUP_HOUR:-2} day name
	[[ $hour =~ ^[0-9]{1,2}$ ]] && ((10#$hour <= 23)) ||
		obur_fail "OBUR_BACKUP_HOUR must be an hour from 0 to 23, not '$hour'"
	export OBUR_BACKUP_HOUR=$((10#$hour))
	for name in OBUR_FULL_BACKUP_DAY OBUR_RESTORE_CHECK_DAY; do
		day=${!name:-7}
		[[ $day =~ ^0?[1-7]$ ]] || obur_fail "$name must be a weekday from 1 (Monday) to 7 (Sunday), not '$day'"
		export "$name=$((10#$day))"
	done
}

# The off-site repository, from OBUR_OFFSITE_*, for every process that reaches it: the backup tool, and PostgreSQL
# itself, whose restore_command after `obur restore start --repo=2` fetches WAL from it (2026-11-22 Gemini audit, G01:
# only the backup tool had these settings, so a restore from the off-site copy could not replay its history). Only
# when OBUR_OFFSITE_TYPE is set: pgBackRest refuses empty settings. Type s3 (R2 and other S3-compatible stores) needs
# all four of endpoint, bucket, key and secret; type posix (a mounted folder, used by the tests) needs a path. A
# setting given straight as PGBACKREST_REPO2_* is left as it is.
obur_offsite_env() {
	[[ -n ${OBUR_OFFSITE_TYPE:-} && -z ${PGBACKREST_REPO2_TYPE:-} ]] || return 0
	local v
	case $OBUR_OFFSITE_TYPE in
	s3)
		for v in OBUR_OFFSITE_ENDPOINT OBUR_OFFSITE_BUCKET OBUR_OFFSITE_KEY OBUR_OFFSITE_SECRET; do
			[[ -n ${!v:-} ]] || obur_fail "OBUR_OFFSITE_TYPE is s3 but $v is empty: set it, or remove the OBUR_OFFSITE_* settings"
		done
		export PGBACKREST_REPO2_S3_ENDPOINT=$OBUR_OFFSITE_ENDPOINT
		export PGBACKREST_REPO2_S3_BUCKET=$OBUR_OFFSITE_BUCKET
		export PGBACKREST_REPO2_S3_REGION=${OBUR_OFFSITE_REGION:-auto}
		export PGBACKREST_REPO2_S3_KEY=$OBUR_OFFSITE_KEY
		export PGBACKREST_REPO2_S3_KEY_SECRET=$OBUR_OFFSITE_SECRET
		export PGBACKREST_REPO2_S3_URI_STYLE=path
		;;
	posix)
		[[ -n ${OBUR_OFFSITE_PATH:-} ]] || obur_fail "OBUR_OFFSITE_TYPE is posix but OBUR_OFFSITE_PATH is empty"
		;;
	*) obur_fail "OBUR_OFFSITE_TYPE must be s3, not '$OBUR_OFFSITE_TYPE'" ;;
	esac
	export PGBACKREST_REPO2_TYPE=$OBUR_OFFSITE_TYPE
	export PGBACKREST_REPO2_PATH=${OBUR_OFFSITE_PATH:-/obur}
	export PGBACKREST_REPO2_CIPHER_TYPE=aes-256-cbc
	export PGBACKREST_REPO2_CIPHER_PASS=$PGBACKREST_REPO1_CIPHER_PASS
	export PGBACKREST_REPO2_RETENTION_FULL=${PGBACKREST_REPO1_RETENTION_FULL:-5}
	export PGBACKREST_REPO2_BUNDLE=y
	export PGBACKREST_REPO2_BLOCK=y
}

# Runs an operator script (migrations, jobs, curated foods, setup and recovery links) with only the settings it reads,
# as its own system user: these hold the schema owner's password, which the web app's user must never be able to read
# from them while they run (2026-11-22 Gemini audit, G11).
obur_node() {
	local script=$1
	shift
	(cd /app && env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp TZ="${TZ:-UTC}" NODE_ENV=production \
		PUBLIC_ORIGIN="$PUBLIC_ORIGIN" WEBAUTHN_RP_ID="$WEBAUTHN_RP_ID" DATABASE_MIGRATOR_URL="$OBUR_MIGRATOR_URL" \
		gosu obur-ops node "scripts/$script" "$@")
}

obur_psql() {
	gosu postgres psql -X -q -t -A -v ON_ERROR_STOP=1 -h "$OBUR_SOCKET" -U obur_admin -d obur "$@"
}

# A restore's state: one file, one step at a time (2026-11-22 audit, A01: the state had been spread over several
# files, and each audit found another interruption that left them disagreeing). Only `obur restore …` changes it;
# obur-init, the backup tool and the web app only read it. No file: no restore. The steps, in order:
#   preparing   obur is stopped; `aside` names where the current database goes ("" when there is none)
#   moved       the database is at `aside` (or there was none): the database folder holds nothing to keep
#   restoring   pgBackRest writes the database folder
#   restored    the restored database runs; the app says "being restored" until `restore finish`
#   finishing   sign-outs, deletions and the new backup: from here the restored database is the one kept
#   cancelling  the database from before is being put back
# Each step is on disk before what it names begins, so an interruption anywhere leaves a step that says what to do.
RESTORE_STATE=$OBUR_STATUS_DIR/restore.json

restore_step() { jq -r '.step // ""' "$RESTORE_STATE" 2>/dev/null || true; }
restore_field() { jq -r --arg f "$1" '.[$f] // ""' "$RESTORE_STATE" 2>/dev/null || true; }

# Moves to step $1, keeping the other fields; more jq arguments and a filter may follow (`--arg k v '. + {k: $k}'`).
restore_set() {
	local step=$1 filter='.'
	shift
	if (($#)); then
		filter=${*: -1}
		set -- "${@:1:$#-1}"
	else
		set --
	fi
	local current='{}'
	[[ -s $RESTORE_STATE ]] && current=$(cat "$RESTORE_STATE")
	jq --arg step "$step" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$@" \
		"($filter) + {step: \$step, (\$step + \"At\"): \$at}" <<<"$current" >"$RESTORE_STATE.new"
	chmod 644 "$RESTORE_STATE.new"
	sync "$RESTORE_STATE.new"
	mv "$RESTORE_STATE.new" "$RESTORE_STATE"
	sync "$OBUR_STATUS_DIR"
}

restore_clear() {
	rm -f "$RESTORE_STATE"
	sync "$OBUR_STATUS_DIR"
}

# Versions before 1.0.0-rc.9 kept the state in several files: an unfinished restore from one of them goes on in the
# one file. restore-pending with restoredAt was a finished copy; without it, an attempt that did not complete.
restore_migrate_marks() {
	local pending=$OBUR_STATUS_DIR/restore-pending note=$OBUR_STATUS_DIR/restore-aside old_note=$OBUR_RUN/aside
	[[ -f $pending || -f $note || -f $old_note ]] || return 0
	if [[ ! -f $RESTORE_STATE ]]; then
		local aside step
		aside=$(cat "$note" 2>/dev/null || cat "$old_note" 2>/dev/null || true)
		if [[ -f $pending ]] && jq -e '.restoredAt' "$pending" >/dev/null 2>&1; then
			step=restored
		elif [[ -f $pending ]]; then
			step=restoring
		elif [[ -n $aside && -d $aside ]]; then
			step=moved
		else
			step=preparing
		fi
		restore_set "$step" --arg aside "$aside" '. + {aside: $aside}'
	fi
	rm -f "$pending" "$note" "$old_note"
}

# For the interruption test (deploy/obur/restore-interrupt-test.sh): a command run with OBUR_TEST_INTERRUPT=<point>
# stops there, as if the process had been killed. It only ever stops a command early.
checkpoint() {
	if [[ ${OBUR_TEST_INTERRUPT:-} == "$1" ]]; then
		printf 'obur: (test) stopped at %s\n' "$1" >&2
		exit 99
	fi
}
