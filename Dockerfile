# The obur image: the web app, the background worker, PostgreSQL and its encrypted backups in one container
# (docs/design.md, "Distribution"). Each runs as its own user; the database listens only inside the container.
# Speak and Scan use the optional obur-speech and obur-labels images.
FROM node:24.11.0-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# The lockfile is written by npm 11.19; the npm bundled with this Node (11.6) misreads its optional peer entries.
RUN npm install -g npm@11.19.0 --no-audit --no-fund && npm ci --no-audit --no-fund
COPY . .
# SvelteKit validates the settings while analysing the build. These placeholders exist only for this step; the
# real values are read when the app starts and are never part of the image.
RUN DATABASE_URL=postgres://build:build@localhost/build PUBLIC_ORIGIN=https://build.invalid \
	WEBAUTHN_RP_ID=build.invalid npm run build \
	&& npm prune --omit=dev --no-audit --no-fund

FROM node:24.11.0-trixie-slim AS node

FROM postgres:18.6-trixie
RUN apt-get update \
	&& apt-get install -y --no-install-recommends pgbackrest jq ca-certificates tini \
	&& rm -rf /var/lib/apt/lists/* \
	&& useradd --uid 1000 --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin node \
	&& install -d -o postgres -g postgres -m 700 /var/lib/pgbackrest /tmp/pgbackrest
COPY --from=node /usr/local/bin/node /usr/local/bin/node

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
COPY --from=build /app/package.json ./
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
	CMD node -e "fetch('http://127.0.0.1:3000/login').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/obur"]
CMD ["start"]
