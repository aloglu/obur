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
		umask 077
		{
			for role in ADMIN MIGRATOR APP WORKER; do
				echo "OBUR_${role}_DB_PASSWORD=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
			done
			echo "OBUR_SECRETS_KEY=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
			echo "OBUR_VAPID_PUBLIC_KEY=${keys% *}"
			echo "OBUR_VAPID_PRIVATE_KEY=${keys#* }"
		} >"$OBUR_SECRETS.tmp"
		mv "$OBUR_SECRETS.tmp" "$OBUR_SECRETS"
	fi
	if ! grep -q '^OBUR_SECRETS_KEY=' "$OBUR_SECRETS"; then
		echo "OBUR_SECRETS_KEY=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')" >>"$OBUR_SECRETS"
	fi
	set -a
	# shellcheck source=/dev/null
	. "$OBUR_SECRETS"
	set +a
	export VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY:-$OBUR_VAPID_PUBLIC_KEY}
	export VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY:-$OBUR_VAPID_PRIVATE_KEY}
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
	obur_secrets
	local db=127.0.0.1:5432/obur
	OBUR_ADMIN_URL=postgres://obur_admin:$OBUR_ADMIN_DB_PASSWORD@$db
	OBUR_MIGRATOR_URL=postgres://obur_migrator:$OBUR_MIGRATOR_DB_PASSWORD@$db
	OBUR_APP_URL=postgres://obur_app:$OBUR_APP_DB_PASSWORD@$db
	OBUR_WORKER_URL=postgres://obur_worker:$OBUR_WORKER_DB_PASSWORD@$db
}

# Runs an app script as the app's user with only the settings it needs.
obur_node() {
	local script=$1
	shift
	(cd /app && env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp TZ="${TZ:-UTC}" NODE_ENV=production \
		PUBLIC_ORIGIN="$PUBLIC_ORIGIN" WEBAUTHN_RP_ID="$WEBAUTHN_RP_ID" \
		DATABASE_ADMIN_URL="$OBUR_ADMIN_URL" DATABASE_MIGRATOR_URL="$OBUR_MIGRATOR_URL" \
		DATABASE_URL="$OBUR_APP_URL" DATABASE_WORKER_URL="$OBUR_WORKER_URL" \
		gosu node node "scripts/$script" "$@")
}

obur_psql() {
	gosu postgres psql -X -q -t -A -v ON_ERROR_STOP=1 -h "$OBUR_SOCKET" -U obur_admin -d obur "$@"
}
