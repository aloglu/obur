# obur application image: one image, several commands (web, worker, migrate; see deploy/app/obur.sh).
FROM node:24.11.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# SvelteKit validates the settings while analysing the build. These placeholders exist only for this step; the
# real values are read when the app starts and are never part of the image.
RUN DATABASE_URL=postgres://build:build@localhost/build PUBLIC_ORIGIN=https://build.invalid \
	WEBAUTHN_RP_ID=build.invalid npm run build \
	&& npm prune --omit=dev --no-audit --no-fund

FROM node:24.11.0-bookworm-slim
ENV NODE_ENV=production \
	PORT=3000 \
	BODY_SIZE_LIMIT=21M
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# The operator, migration and worker commands run as TypeScript directly (Node 24 strips types).
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/src/lib/server ./src/lib/server
COPY --from=build /app/src/lib/shared ./src/lib/shared
COPY deploy/app/obur.sh /usr/local/bin/obur
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/obur"]
CMD ["web"]
