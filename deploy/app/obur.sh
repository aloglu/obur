#!/bin/sh
# Commands of the obur application image.
set -eu
cd /app
case "${1:-web}" in
web) exec node server.js ;;
worker) exec node scripts/worker.ts ;;
migrate)
	# Roles and ownership (idempotent, superuser), schema migrations (owner), background jobs and curated foods
	# (owner).
	node scripts/db-bootstrap.ts
	node scripts/migrate.ts
	node scripts/jobs-setup.ts
	node scripts/curated-load.ts
	;;
setup-link) exec node scripts/admin-setup-link.ts ;;
recovery-link)
	shift
	exec node scripts/admin-recovery-link.ts "$@"
	;;
*)
	echo "usage: obur web|worker|migrate|setup-link|recovery-link <name or ID>" >&2
	exit 2
	;;
esac
