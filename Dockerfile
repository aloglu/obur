# The obur image: the web app, the background worker, PostgreSQL and its encrypted backups in one container
# (docs/design.md, "Distribution"). Each runs as its own user; the database listens only inside the container.
# Speak and Scan use the optional obur-speech and obur-labels images.
FROM node:24.22.3-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# SvelteKit validates the settings while analysing the build. These placeholders exist only for this step; the
# real values are read when the app starts and are never part of the image.
RUN DATABASE_URL=postgres://build:build@localhost/build PUBLIC_ORIGIN=https://build.invalid \
	WEBAUTHN_RP_ID=build.invalid npm run build \
	&& npm prune --omit=dev --no-audit --no-fund \
	&& find src/lib/server src/lib/shared -name '*.test.ts' -delete \
	&& find drizzle/meta -name '*_snapshot.json' -delete
# Above: tests and drizzle-kit's schema snapshots stay in Git, not in the image; migrations need only the SQL and the
# journal (db/migrator.ts).

FROM node:24.22.3-trixie-slim AS node

FROM postgres:18.7-trixie
# Where the source and the licences are, next to the image on the registry (2026-11-22 Gemini audit, G30).
LABEL org.opencontainers.image.source="https://github.com/aloglu/obur" \
	org.opencontainers.image.licenses="MIT AND CC-BY-SA-4.0 AND OFL-1.1" \
	org.opencontainers.image.description="obur: calorie, weight and water tracker (web app, worker, PostgreSQL and backups); notices at /third-party-notices.txt"
RUN apt-get update \
	&& apt-get install -y --no-install-recommends pgbackrest jq ca-certificates tini \
	&& rm -rf /var/lib/apt/lists/* \
	&& useradd --uid 1000 --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin node \
	&& useradd --uid 1001 --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin obur-worker \
	&& useradd --uid 1002 --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin obur-ops \
	&& install -d -o postgres -g postgres -m 700 /var/lib/pgbackrest /tmp/pgbackrest
COPY --from=node /usr/local/bin/node /usr/local/bin/node
# Node.js's own licence travels with its binary; obur's licence and the bundled packages' notices are in /app
# (build/prerendered/third-party-notices.txt, served at /third-party-notices.txt).
COPY --from=node /usr/local/LICENSE /usr/share/doc/nodejs/LICENSE

ENV PGDATA=/data/postgres/18/docker \
	PGBACKREST_STANZA=obur \
	PGBACKREST_PG1_PATH=/data/postgres/18/docker \
	PGBACKREST_PG1_SOCKET_PATH=/var/run/postgresql \
	PGBACKREST_PG1_USER=obur_admin \
	PGBACKREST_LOCK_PATH=/tmp/pgbackrest \
	PGBACKREST_LOG_LEVEL_CONSOLE=warn \
	PGBACKREST_LOG_LEVEL_FILE=off \
	PGBACKREST_START_FAST=y \
	PGBACKREST_COMPRESS_TYPE=zst \
	PGBACKREST_REPO1_BUNDLE=y \
	PGBACKREST_REPO1_BLOCK=y \
	PGBACKREST_REPO1_PATH=/data/backups \
	PGBACKREST_REPO1_CIPHER_TYPE=aes-256-cbc \
	OBUR_STATUS_DIR=/data/status \
	POSTGRES_DB=obur

WORKDIR /app
COPY --from=build /app/package.json /app/LICENSE ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/server.js ./server.js
# The operator, migration and worker commands run as TypeScript directly (Node 24 strips types).
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/src/lib/server ./src/lib/server
COPY --from=build /app/src/lib/shared ./src/lib/shared
# Reminder wording for the worker comes from the message catalog.
COPY --from=build /app/messages ./messages

COPY deploy/obur/conf/ /etc/obur/
COPY deploy/obur/env.sh deploy/obur/obur-init /usr/local/lib/obur/
COPY deploy/obur/obur deploy/obur/obur-backup deploy/obur/obur-restore deploy/obur/pgbackrest-obur /usr/local/bin/

EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 \
	CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/obur"]
CMD ["start"]
