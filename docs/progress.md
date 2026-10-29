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

- Phase 1 step 10 done (2026-10-29): your data. `imports-exports` module with the v1 archive (JSON, CSV views, manifest with SHA-256 per file), strict archive reading (size, file-name, checksum and record validation), import dry run and atomic apply with source-identity matching, exact-repeat refusal and keep-current policies (`docs/design.md`), and account deletion through a reviewed SECURITY DEFINER function (shared foods kept ownerless or removed, last admin protected, opaque deletion list for admins). API: `POST /api/v1/export`, `POST /api/v1/import[?apply=1]`, `DELETE /api/v1/account`, `GET`/`DELETE /api/v1/household/members`. Pages: Your data (`/settings/data`) and People and Deleted accounts on Household. Tests: 10 real-Postgres tests (export contents and isolation, tamper detection, round trip into another account and installation with semantic comparison, repeat and overlapping exports, keep-current, shared-food linking, failure leaves nothing, deletion cases and permissions) and 4 browser tests on both projects. Fixed along the way: a file picked before the page hydrated was ignored (the picker now waits).

- Phase 1 step 9 done (2026-10-26): offline create queue. Per-account IndexedDB queue for new diary entries (food and calories-only), water and weight, sent in creation order with the server's idempotent client IDs; "Waiting to sync" rows on meal, water and weight cards with a sheet to discard an unsent draft; refusals kept for review; sign-in prompt when the session expired; sign-out tries to send, then asks before discarding. Service worker (`src/service-worker.ts`): cache-first app shell, network-first pages/data with the saved copy as fallback and a "Showing the copy saved on this device" note, saved pages cleared on sign-out and when another person signs in; web app manifest and icons. Fixed along the way: the worker looked up saved pages by the wrong key; a refresh while unreachable caused a reload loop; a failed retry threw because reactive state cannot be stored in IndexedDB (which made sign-out silently do nothing). Browser tests on both projects; the half of the sign-out test that needs request interception runs in Chromium only (Playwright cannot intercept requests from a service-worker-controlled page in WebKit).

- Phase 1 step 8 done (2026-10-26): progress. Pure calendar rules with tests (month grid with Monday or profile first day, target in force per day, status per day: green only for complete days at or under budget, full red when over, neutral when logged but incomplete or without a budget, track only when unlogged, future disabled; summary of past days only), database aggregates for energy per logged day and counted activity per day (with tests), Progress page with the month calendar (accessible day names, key, summary, month navigation capped at the current month, tap opens the day) and basic weight history (raw readings, dots for actual readings, last 90 days). Browser tests on both projects and calendar screenshots.

- Phase 1 step 7 done (2026-10-26): goals. Formulas with fixture tests (Mifflin–St Jeor, Katch–McArdle, × 1.2, 7,700 kcal/kg deficit capped at 1 kg and 1 % of body weight per week, editable floor 1,500/1,200, WHO adult BMI categories, macro targets), profile and append-only target versions with RLS (private even from admins), calculated/manual/none modes, no calculated targets for under-18s, pregnancy or breastfeeding (manual professional targets allowed), manual activity counted toward the budget (imported activity recorded but uncounted), day completion. Onboarding page (BMI with the muscle caveat, waist-to-height ratio, base burn with an own-number option, goal weight, capped pace, floor, budget preview, "not medical advice"), Profile page with recalculation nudge, budget ring with the base + activity − goal equation and floor note, activity sheet, macro targets on the nutrient bars, "Mark day complete". Tests: 13 formula/budget unit tests, 8 goals and 3 activity/completion DB tests, browser journeys on both projects.

- Phase 1 step 6 done (2026-10-25): weight and water. Body module with weight (kg) and water (ml) readings keeping the intended local date and zone, never merged when values match, idempotent client-ID creates, 30-day trash with restore, RLS with immutable ownership, and database range checks; API under `/api/v1/body/{weight,water}`; Today cards (water total with +250/+500 ml, weight input with decimal comma, last reading, "Same as last time" recording a fresh reading) with Undo toasts. Tests: 6 real-Postgres body tests and browser tests on both projects; screenshots regenerated.

- Phase 1 step 5 done (2026-10-25): diary and the Pazar screens. Diary entries with independent food snapshots (re-scaling uses the entry's own snapshot), intended local date/meal/zone, calories-only quick adds, versioned corrections, Move to, a 30-day trash with restore, idempotent client-ID creates (retry returns the original; reused ID with different content is a conflict; another person's ID leaks nothing), recent foods, and RLS with immutable ownership, kind, food link and zone. App shell (phone tab bar, desktop side nav), Today (day header, budget ring placeholder, nutrients with partial totals, meal cards), Log (search, recent on focus, Speak/Scan "Coming soon", quick add, preset pill), amount/edit/quick-add sheets on a native dialog, toasts with Undo, More/Settings with theme choice and sign-out. Tests: 14 diary DB tests, shared-rule unit tests (diary rules, unit options, formatting), and browser journeys on both projects plus light/dark screenshot baselines. Fixed along the way: `formatDecimal` turned 200 into "2" (regression test added); the request fingerprint ignored a quick add's calories; recent foods were cached stale in the Log panel; the desktop panel kept the old query after saving.

- Phase 1 step 4 done (2026-10-25): catalog. Tables for foods, nutrient values (code, value, qualifier), named portions and household measures, with forced RLS (shared visible to all, private to the owner; only the creator or an admin edits shared foods; ownership and provenance immutable; nothing deleted through the app) and database constraints for basis, codes, qualifiers and non-negative values. Pure shared modules with tests: Turkish-aware search folding, comma/dot decimals without thousands guessing, the nutrient registry and derivations (kcal⇄kJ, salt from sodium, carbohydrate excluding fibre as an estimate), unit conversion that refuses unknown density or serving mass, and warning-only plausibility checks. Catalog service with versioned edits, archive/restore, "Make my own variant" and ranked search (pg_trgm). Food API and provisional food screens (listed in `docs/ui.md` for owner review). Tests: 98 more unit, 23 more real-Postgres catalog tests and browser tests on both projects; e2e fixtures now create sessions directly in the test database (no app change).

- Phase 1 step 3 done (2026-10-25): authentication. Tables for credentials, sessions, invites, recovery codes, recovery links and the setup token with forced RLS; reviewed SECURITY DEFINER functions for the pre-identity steps (first admin, invite redemption, sign-in lookup, session lookup, recovery begin/complete); SimpleWebAuthn ceremonies with user verification and user-handle checks; recent-passkey checks for sensitive actions; idle/absolute session expiry; in-memory rate limits; same-origin CSRF check, CSP, HSTS (https), no-referrer; operator commands for the setup link and recovery links (token in the URL fragment); Pazar-styled sign-in, setup, join, recovery, security and household pages with all strings in `messages/en.json`. Tests: 19 more real-Postgres auth tests (single use under concurrency, expiry, revocation, admin-only invites, isolation, last-credential guard, recovery revoking everything), 12 helper unit tests, and Chromium virtual-authenticator journeys (setup, sign-in, adding a security key, invite and join, recovery, old passkey rejected) plus header/CSRF checks.

- Phase 1 step 2 done (2026-10-25): database foundation. Roles `obur_migrator` (schema owner), `obur_app` and `obur_worker` (non-superuser, `NOBYPASSRLS`, `NOINHERIT`, own nothing) created by `npm run db:bootstrap`; a locked, single-transaction migration runner with checksum and newer-database checks (`npm run db:migrate`); `withUser()` sets `app.user_id` transaction-locally and rejects malformed identity; first table `users` (auth module) with forced RLS. 27 real-Postgres tests cover cross-user reads/writes/deletes, role escalation, missing/malformed identity, connection reuse (including after errors and under concurrency), a guard that every table forces RLS, and migration atomicity, locking and tamper detection.

- Phase 1 step 1 done (2026-10-25): SvelteKit 3 / Svelte 5.57 scaffold with strict TypeScript, Tailwind 4 and the Pazar tokens (contrast-tested in light and dark), self-hosted Inter and Bricolage Grotesque, Paraglide (English), ESLint with a local module-boundary rule (tested), Vitest, Playwright (iPhone 13 WebKit and desktop Chromium in the official Docker image), adapter-node, Drizzle with postgres.js, and a development PostgreSQL 18 in Compose. Verified commands are in `CLAUDE.md`.

- 2026-10-25: Repository initialised with `CLAUDE.md`, `docs/design.md`, this file and a `.gitignore` that excludes secrets and private data.

## In progress

- Phase 1 step 11 (operations), started 2026-10-29. Owner chose restricted deploy access (option C): `deploy/unraid/obur-ctl` (forced-command script, tested in `deploy/unraid/obur-ctl.test.ts`) and `deploy/unraid/README.md`. Deploy key `~/.ssh/obur_deploy` and SSH alias `obur-host` exist on the desktop; waiting for the owner to install the script and key on the Unraid host. Owner decisions (2026-10-29): backups live in `appdata/obur/backups` (path configurable for other installations); `.env` stays in `appdata/obur` and is excluded from the owner's weekly appdata-to-Dropbox copy, with the location configurable and the pitfall documented. Done: pg-boss worker (`scripts/worker.ts`, `npm run worker`) and job setup as the schema owner (`scripts/jobs-setup.ts`, `npm run jobs:setup`; queue `purge-trash`, daily 03:30 in `TZ`); `app_purge_trash` removes trash older than 30 days and leaves a `purged_records` marker, so late retries get 410 `gone` and the offline queue drops them (3 DB tests). Done: application image (`Dockerfile`, entrypoint `deploy/app/obur.sh` with `web`, `worker`, `migrate`, `setup-link`, `recovery-link`; build-only placeholder settings, verified absent from the image). Next: database image with pgBackRest, production Compose file, then deploy.

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

Phase 0 measurements: `docs/feasibility.md`. Phase 1 step 10 (2026-10-29): `npm run check` 0 errors; `npm run lint` clean; `npx vitest run` 274 passed; `npm run build` succeeded; `npm run test:e2e` 50 passed (twice), 1 skipped (as in step 9). Step 9 (2026-10-26): `npm run check` 0 errors; `npm run lint` clean; `npx vitest run` 264 passed; `npm run test:e2e` 42 passed, 1 skipped (WebKit half of the sign-out test, see above). Not yet checked on the owner's iPhone: the installed app opening offline and queued entries sending after Airplane Mode. Earlier: step 8 264 and 39; step 7 252 and 33; step 6 228 and 29; step 5 222 and 23; step 4 193 and 13; step 3 116 and 9; step 2 85 and 2. Phase 1 step 1: `npm run check` 0 errors; `npm run lint` clean; `npx vitest run` 58 passed; `npm run build` succeeded; `npm run test:e2e` 2 passed (phone WebKit, desktop Chromium), including no third-party requests.

## Exact next step

Phase 1 step 11: operations. Production image (web and worker commands) and Compose stack for the Unraid host behind the existing Cloudflare Tunnel (set `BODY_SIZE_LIMIT` ≥ 21M); pg-boss worker with the 30-day trash purge that keeps a minimal per-ID marker; pgBackRest with encrypted local backups, optional off-site (R2 for the owner) with a plain warning when absent, monitored WAL archival, and a weekly restore check; `docs/restore.md` including revoking restored sessions and reapplying deletions from the admin's off-server list (needs an operator command); CI.

Owner check when convenient (not blocking): on the iPhone, open the installed app once online, then in Airplane Mode reopen it, add water and a quick add, turn Airplane Mode off and confirm both arrive.

Deferred within Phase 1 (noted, not blocking): imperial display units (storage is metric, so this is display-only); a units and formats settings page (decimal mark and first day of week are stored in the profile with defaults "," and Monday).

Pending from step 5: purging trash entries older than 30 days needs the background worker (pg-boss), planned with operations (step 11); until then expired trash simply cannot be restored.

## Implementation notes

- SvelteKit 3 removed the `$lib` alias; use `#lib`. Import a module's public entry by its full path, `#lib/server/modules/<name>/index.ts` (TypeScript does not resolve a folder's index through the `#lib/*` mapping).
- Drizzle names every column in an `INSERT` (using `DEFAULT` for omitted ones), so column-level INSERT grants do not work; pin allowed values with the RLS `WITH CHECK` instead. Column-level UPDATE grants do work.
- Migrations reference the fixed role names `obur_app` and `obur_worker` created by the bootstrap script.
- FORCE ROW LEVEL SECURITY also applies to the schema owner, so SECURITY DEFINER functions (owned by `obur_migrator`) need an explicit `<table>_owner` policy on each table they touch. Always `SET search_path` on them.
- Drizzle's `sql` template expands JavaScript arrays into parameter lists; pass Postgres arrays with `textArrayLiteral()` (auth store) and an explicit cast.
- Playwright projects: `auth-journey` (Chromium, runs first on an empty database) and then `phone-webkit` and `desktop-chromium`. Other e2e tests sign in with `tests/e2e/fixtures.ts`, which writes a session row directly to the disposable database.
- Not yet verified on a real iPhone: the Phase 1 sign-in pages themselves (the Phase 0 probe verified passkeys, YubiKeys and the installed app on the owner's phone with the same library).

## Conventions for Phase 0

- Private inputs live outside the repo at `~/obur-private/` (see the plan for its layout). Nothing from it is committed.
- Throwaway probe scripts live in `spikes/` and never import from or get imported by `src/`. Their outputs that contain real data go to `~/obur-private/results/`; only aggregate numbers and redacted fixtures reach `docs/feasibility.md`.

## Unresolved questions


- Test phone: iPhone 13, iOS 27.0.1. Second authenticators for recovery tests: two YubiKeys.
- Pilot hostname chosen (a subdomain of the owner's domain); recorded only in the owner's `.env`, RP ID is the parent domain.
- Home server OS, Docker availability and exact CPU/storage (design assumes a 2-core/4-thread i3 with 16 GB RAM).

## Repository

- Local Git only; no remote yet. When a remote is added it must be **private** for now (owner decision, 2026-10-25). The rules about keeping private data and real hostnames out of the repo still apply as if it were public.
