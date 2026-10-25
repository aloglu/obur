# Progress

Resumable status for obur. Update before each commit. Design: `docs/design.md`; working rules: `CLAUDE.md`.

## Current phase

**Phase 1 — Daily-use pilot**: approved by the owner on 2026-10-25. Phase 0 is complete.

The owner keeps using LoseIt until obur is complete and production-ready; Phase 1 and later builds are for testing, not daily reliance.

## Phase 1 plan

Scope from `docs/design.md` (Phase 1). Each step ends with passing checks and a commit; the step order lets a usable logging flow appear early.

1. **Scaffold.** SvelteKit + Svelte 5, strict TypeScript, Tailwind with the Pazar tokens, Paraglide message catalog, ESLint with module-boundary rules, Vitest, Playwright (phone WebKit and desktop Chromium), self-hosted fonts. Docker Compose with PostgreSQL for development. Verified commands recorded in `CLAUDE.md`.
2. **Database foundation.** Drizzle schema and migrations, a locked migration runner, a separate migration owner and runtime roles (non-superuser, no `BYPASSRLS`), and the transaction-local `app.user_id` wrapper. Real-Postgres tests for cross-user access, missing identity and connection reuse.
3. **Authentication.** One-time bootstrap admin, passkeys and YubiKeys (SimpleWebAuthn), Postgres sessions, invites, recovery codes and the operator recovery command, CSRF and CSP. Playwright with a virtual authenticator.
4. **Catalog.** Foods with the nutrient contract (basis, qualifiers, source definitions, unknown ≠ 0), servings and conversions, private/shared visibility, Turkish-aware and transliteration-aware search.
5. **Diary and the Pazar screens.** Today, Log (Speak and Scan as "Coming soon"), the amount sheet, entries with snapshots and intended day/meal/zone, edit, Move to, delete with Undo and trash, calories-only quick add.
6. **Weight and water.**
7. **Goals.** Onboarding with BMI and base burn, a versioned daily budget with manual activity calories, the deficit and floor, the no-target path for minors, pregnancy and breastfeeding, and day completion.
8. **Progress.** Daily totals, weight history and the month calendar (green only for complete days).
9. **Offline create queue.** Ordered, retry-safe, partitioned by account, with offline detection from failed requests and a cache-first app shell; re-test offline launch on the iPhone.
10. **Your data.** Export and import of every implemented entity, and account deletion.
11. **Operations.** Production Compose image (web and worker), deployment behind the existing Cloudflare Tunnel, pgBackRest with encrypted local and off-site backups, a weekly restore check, `docs/restore.md` with a rehearsed restore, and CI.

## Completed

- Phase 1 step 2 done (2026-10-25): database foundation. Roles `obur_migrator` (schema owner), `obur_app` and `obur_worker` (non-superuser, `NOBYPASSRLS`, `NOINHERIT`, own nothing) created by `npm run db:bootstrap`; a locked, single-transaction migration runner with checksum and newer-database checks (`npm run db:migrate`); `withUser()` sets `app.user_id` transaction-locally and rejects malformed identity; first table `users` (auth module) with forced RLS. 27 real-Postgres tests cover cross-user reads/writes/deletes, role escalation, missing/malformed identity, connection reuse (including after errors and under concurrency), a guard that every table forces RLS, and migration atomicity, locking and tamper detection.

- Phase 1 step 1 done (2026-10-25): SvelteKit 3 / Svelte 5.57 scaffold with strict TypeScript, Tailwind 4 and the Pazar tokens (contrast-tested in light and dark), self-hosted Inter and Bricolage Grotesque, Paraglide (English), ESLint with a local module-boundary rule (tested), Vitest, Playwright (iPhone 13 WebKit and desktop Chromium in the official Docker image), adapter-node, Drizzle with postgres.js, and a development PostgreSQL 18 in Compose. Verified commands are in `CLAUDE.md`.

- 2026-10-25: Repository initialised with `CLAUDE.md`, `docs/design.md`, this file and a `.gitignore` that excludes secrets and private data.

## In progress

- Phase 0 plan approved by the owner (2026-10-25).
- Owner has supplied the LoseIt export, 11 label photos and a favourite-foods list in `~/obur-private/`.
- 48 voice clips recorded (m4a) in `~/obur-private/audio/raw/`, matching `~/obur-private/audio/transcripts.tsv` (25 tr, 13 en, 10 mixed; 13 in harder conditions).
- Server access ready: SSH alias `obur-lab` (desktop `~/.ssh/config`) into the unprivileged `obur-lab` container; only `/work` (its appdata folder) is mounted. The owner's existing Cloudflare tunnel routes the pilot hostname to server port 8040 (done 2026-10-25); the container must be recreated with `-p 8040:8040` for the phone probe.
- Step 0 done: hardware recorded in `docs/feasibility.md`.
- Owner decisions (2026-10-25): off-site backups use Cloudflare R2 for the owner and are optional per installation (local backups and restore checks stay mandatory, with a plain warning when off-site is absent). Work proceeds through Phase 1 steps without check-ins, stopping only for owner decisions or problems. The Phase 1 test build runs as a Docker Compose stack on the Unraid host. Speak/Scan tiles show disabled "Coming soon" until each feature works; Phase 1 approved. Speech uses faster-whisper `small`; OCR uses PP-OCRv6 small; calendar shows green only for complete days at or under budget (day-completion marker added to the design). Recorded in `docs/design.md`, `CLAUDE.md` and `docs/ui.md`.
- Step 5 done (2026-10-25): owner chose the Pazar UI direction; `docs/ui.md` and `docs/ui/pazar-demo.dc.html` added, `docs/design.md` updated for the Log-screen decisions.
- Step 4 done (2026-10-25): owner ran the phone checklist; results in `docs/feasibility.md`. Probe stopped and its passkeys, sessions, logs and start script deleted from obur-lab; timing data kept in `~/obur-private/results/probe/`.
- Steps 2–3 done: speech and OCR benchmarked on desktop and server (`docs/feasibility.md`). Server OCR environment in `/work/ocr`, speech in `/work/speech`, probe and Node 24.11.0 (checksum-verified) in `/work/probe` and `/work/node`.
- Phone probe built and tested in desktop Chromium with a virtual authenticator (`spikes/phone-probe/`); waiting for server benchmarks to finish before the owner recreates the container with port 8040.
- A non-label photo (payment card) was found among the label photos; derived copies were deleted and the owner was told.
- Step 1 done: LoseIt export inspected (`docs/loseit-export.md`, summary in `docs/feasibility.md`). Aggregate output in `~/obur-private/results/`.

## Validation results

Phase 0 measurements: `docs/feasibility.md`. Phase 1 step 2 (2026-10-25): `npm run check` 0 errors; `npm run lint` clean; `npx vitest run` 85 passed (27 against real PostgreSQL 18.6); `npm run build` succeeded; `npm run test:e2e` 2 passed. Phase 1 step 1: `npm run check` 0 errors; `npm run lint` clean; `npx vitest run` 58 passed; `npm run build` succeeded; `npm run test:e2e` 2 passed (phone WebKit, desktop Chromium), including no third-party requests.

## Exact next step

Phase 1 step 3: authentication. One-time bootstrap admin, passkeys and YubiKeys with SimpleWebAuthn, Postgres sessions, invites, recovery codes and the operator recovery command, CSRF and CSP; Playwright with a virtual authenticator. Auth bootstrap paths need deliberately reviewed database interfaces (the app role can only create its own `users` row as a member).

## Implementation notes

- SvelteKit 3 removed the `$lib` alias; use `#lib`. Import a module's public entry by its full path, `#lib/server/modules/<name>/index.ts` (TypeScript does not resolve a folder's index through the `#lib/*` mapping).
- Drizzle names every column in an `INSERT` (using `DEFAULT` for omitted ones), so column-level INSERT grants do not work; pin allowed values with the RLS `WITH CHECK` instead. Column-level UPDATE grants do work.
- Migrations reference the fixed role names `obur_app` and `obur_worker` created by the bootstrap script.

## Conventions for Phase 0

- Private inputs live outside the repo at `~/obur-private/` (see the plan for its layout). Nothing from it is committed.
- Throwaway probe scripts live in `spikes/` and never import from or get imported by `src/`. Their outputs that contain real data go to `~/obur-private/results/`; only aggregate numbers and redacted fixtures reach `docs/feasibility.md`.

## Unresolved questions


- Test phone: iPhone 13, iOS 27.0.1. Second authenticators for recovery tests: two YubiKeys.
- Pilot hostname chosen (a subdomain of the owner's domain); recorded only in the owner's `.env`, RP ID is the parent domain.
- Home server OS, Docker availability and exact CPU/storage (design assumes a 2-core/4-thread i3 with 16 GB RAM).

## Repository

- Local Git only; no remote yet. When a remote is added it must be **private** for now (owner decision, 2026-10-25). The rules about keeping private data and real hostnames out of the repo still apply as if it were public.
