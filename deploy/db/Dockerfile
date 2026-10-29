# obur database image: PostgreSQL with pgBackRest for encrypted backups, continuous WAL archiving and restore checks.
FROM postgres:18.6-trixie
RUN apt-get update \
	&& apt-get install -y --no-install-recommends pgbackrest jq ca-certificates \
	&& rm -rf /var/lib/apt/lists/* \
	&& install -d -o postgres -g postgres -m 700 /var/lib/pgbackrest /tmp/pgbackrest \
	&& install -d -o postgres -g postgres -m 755 /var/lib/obur-status
COPY obur-backup obur-restore pgbackrest-obur /usr/local/bin/
COPY obur-db-entrypoint /usr/local/bin/obur-db-entrypoint
ENTRYPOINT ["/usr/local/bin/obur-db-entrypoint"]
CMD ["postgres"]
