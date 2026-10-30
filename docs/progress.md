# Progress

Resumable status for obur. Update before each commit. Design: `docs/design.md`; working rules: `CLAUDE.md`.

## Current phase

**Phase 2 — LoseIt replacement and early voice**: approved by the owner on 2026-10-30. Phase 1 is complete (deployed on the owner's Unraid, offline behaviour confirmed on the iPhone). The owner keeps using LoseIt until obur is production-ready.

## Phase 2 plan

1. **LoseIt reader** (pure parser, header-detected layout, redacted fixture with invented values for owner review).
2. **LoseIt import** with dry run, file hash, fingerprint-and-multiplicity matching for overlapping exports, daily-total reconciliation against `daily-calorie-summary.csv`, atomic apply; foods private with an opt-in share; budgets as manual target versions from the dates they changed; activity recorded but not counted; completions; weight unit asked in the preview.
3. **Owner's real import** through the app, with a reconciliation report.
4. **Automatic budget recalculation** (owner confirmed 2026-10-30, like LoseIt): a new calculated target version when a new weight changes the budget; past days never change.
5. **Saved meals** (snapshots, explicit refresh, in export/import).
6. **Curated generic foods and aliases** from USDA (public domain only), chosen from foods in the owner's history.
7. **Typed quick entry** (pure `nl-parser`, proposals confirmed before saving).
8. **Voice** (speech service with faster-whisper `small`; audio deleted after transcription); held-out set of about 30 owner clips and 15–20 from a second speaker.

Owner decisions (2026-10-30): LoseIt Morning and Afternoon Snacks map to Snacks; imported days keep LoseIt's budgets; generic foods from USDA only (no licensed sources; TürKomp is not public domain); held-out voice recordings possible but not guaranteed.

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

## In progress

- Phase 2 step 1 (LoseIt reader), 2026-10-30: `src/lib/server/modules/imports-exports/loseit.ts` (pure; exact header detection; deleted rows excluded; n/a unknown; thousands comma in Calories only; LoseIt's Morning/Afternoon Snacks to Snacks; units: grams and millilitres physical, others named portions; carbohydrate kept as the new `carbohydrate_unspecified` code, migration 0019). On the owner's real export (aggregates only, nothing stored): 2,420 active entries, 102 deleted, 147 custom foods, 150 weights, 268 water days, 55 activity rows, 270 completed days, 155 budget changes, and every one of 274 days reconciles exactly with LoseIt's daily food total. The 125 "kcal only" rows are the database food Walnuts, not quick adds (export notes corrected). Fixture `tests/fixtures/loseit/` (invented values, approved by the owner 2026-10-30) and `loseit.test.ts` (12 tests). Step 2 done (2026-10-30): `loseit-import.ts` planner and atomic apply, LoseIt preview on Your data (reconciliation line, deleted count, weight unit, share custom foods, trash missing rows), 8 real-Postgres tests and a browser test. Choices recorded in the module header: identities are content hash plus occurrence; diary rows link to a custom food only when exactly one has the name; LoseIt database foods become private foods from their latest diary row; custom foods per 100 g/ml when stated so, otherwise per serving; salt and kJ derived and marked; budgets as manual target versions only before the first obur target. Not imported: LoseIt serving definitions (investigated 2026-10-30: no usable portions) and recipes (headers only, no ingredients). Step 3 done (2026-10-30): the owner imported the real export on the server and spot-checked it; works. Follow-up from the owner: carbs were missing on imported days (LoseIt's carbohydrate is stored with an unstated definition), now shown on the Nutrients card with a note and never added to the excluding-fibre total (`carbohydrateDay`). Next: step 4, automatic budget recalculation (owner to confirm), or step 5, saved meals.

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

- Phase 1 step 11 (operations), started 2026-10-29. Owner chose restricted deploy access (option C): `deploy/unraid/obur-ctl` (forced-command script, tested in `deploy/unraid/obur-ctl.test.ts`) and `deploy/unraid/README.md`. Deploy key `~/.ssh/obur_deploy` and SSH alias `obur-host` exist on the desktop; waiting for the owner to install the script and key on the Unraid host. Owner decisions (2026-10-29): backups live in `appdata/obur/backups` (path configurable for other installations); `.env` stays in `appdata/obur` and is excluded from the owner's weekly appdata-to-Dropbox copy, with the location configurable and the pitfall documented. Done: pg-boss worker (`scripts/worker.ts`, `npm run worker`) and job setup as the schema owner (`scripts/jobs-setup.ts`, `npm run jobs:setup`; queue `purge-trash`, daily 03:30 in `TZ`); `app_purge_trash` removes trash older than 30 days and leaves a `purged_records` marker, so late retries get 410 `gone` and the offline queue drops them (3 DB tests). Done: application image (`Dockerfile`, entrypoint `deploy/app/obur.sh` with `web`, `worker`, `migrate`, `setup-link`, `recovery-link`; build-only placeholder settings, verified absent from the image). Done: database image with pgBackRest (`deploy/db`: `obur-backup` run/pre-upgrade/info/restore-check/scheduler, `pgbackrest-obur` for archive_command), production Compose file (`deploy/compose.yaml`: db, web, worker, admin tools) and `deploy/.env.example`; backup health on the Household page (`src/lib/shared/backup-health.ts`, 6 tests). Verified locally in a scratch stack: migrate, healthy web and worker, nightly-style full + differential backups, restore check recovering a row written after the backup. Not yet verified: the off-site (R2) repository, which needs the owner's credentials on the server. Deployed to the owner's Unraid on 2026-10-29 behind the existing tunnel (port 8040; data on the cache pool, backups in `appdata/obur/backups`, off-site on R2). Owner created the admin account with a passkey and checked navigation. First full backups local and R2 done; restore check passed on the server (recovered past its target, all tables read). Upgrade rehearsal: a deploy over real data took incremental backups to both repositories first, then switched images. Fixed on the server: missing CA certificates for R2, stanza-create has no per-repository option (local now created separately), hidden setup errors; R2 now uses bundling, block incremental and 4 processes. Restore (2026-10-29): `docs/restore.md`; `obur-restore start|finish` in the database image; the web app answers 503 while a restore is pending and fails closed if it cannot read the status folder; the deletion list records whether shared foods were removed and `app_reapply_deletion` (operator only) deletes again after a restore; the database refuses to start empty while backups exist or a restore is pending. Rehearsed on the desktop with test data (see the table in `docs/restore.md`). Found and fixed: the status folder was readable only by the database user, so the web app could not see backup health or the restore mark. CI stays local (see Repository). Owner's iPhone offline check (2026-10-29): water worked but was slow; Log tab did not open offline; a quick add on the Log tab showed no confirmation (hidden behind the sheet) and was entered twice. Fixed (see the offline section of `docs/design.md`) with two new browser tests: the reported path from a Today-only session, and a hanging connection (Chromium). Second iPhone check still failed: Cloudflare was serving a stale `service-worker.js` (cf-cache-status HIT, hours old), whose install failed. Fixed with `server.js` (no-store for the service worker and manifest; browser tests now run against it), a file-by-file install, and filling cache gaps at runtime. Running the production server in tests also exposed that the export download failed behind the tunnel (SvelteKit's form-CSRF check saw an http origin and a bodyless POST): the export request is now JSON, and the web container takes the protocol from `X-Forwarded-Proto`. Owner purged it; third iPhone check (Safari, 2026-10-29): offline navigation and syncing work, but each tab with page data waited about 4 seconds. Fixed with a one-minute unreachable memory in the service worker and a 3-second timeout, with a browser test (hanging connection, Chromium). Owner then saw the app jump to Today at random while offline (not reproducible on demand). Likely cause: the 30-second refresh of saved pages ran while offline, failed for addresses with a query (/log?meal=…), and SvelteKit reloaded the page, which the service worker answered with Today. Fixed: refresh only after a reachability check; Log keeps its own copy for query addresses; other unsaved pages show "Not available offline" (new route `/offline`); offline search says it needs a connection. Regression test added. Owner to confirm on the iPhone.

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

Phase 2 (2026-10-30, after saved meals): `npm run check` 0 errors; `npm run lint` clean; `npx vitest run` 337 passed; `npm run test:e2e` 65 passed, 3 skipped (Chromium-only offline tests in WebKit), with the one flake noted under In progress. Phase 0 measurements: `docs/feasibility.md`. Phase 1 step 10 (2026-10-29): `npm run check` 0 errors; `npm run lint` clean; `npx vitest run` 274 passed; `npm run build` succeeded; `npm run test:e2e` 50 passed (twice), 1 skipped (as in step 9). Step 9 (2026-10-26): `npm run check` 0 errors; `npm run lint` clean; `npx vitest run` 264 passed; `npm run test:e2e` 42 passed, 1 skipped (WebKit half of the sign-out test, see above). Not yet checked on the owner's iPhone: the installed app opening offline and queued entries sending after Airplane Mode. Earlier: step 8 264 and 39; step 7 252 and 33; step 6 228 and 29; step 5 222 and 23; step 4 193 and 13; step 3 116 and 9; step 2 85 and 2. Phase 1 step 1: `npm run check` 0 errors; `npm run lint` clean; `npx vitest run` 58 passed; `npm run build` succeeded; `npm run test:e2e` 2 passed (phone WebKit, desktop Chromium), including no third-party requests.

## Exact next step

Session order (2026-10-30, second session): issue 3 (done), Phase 2 step 4 (automatic recalculation, owner chose it 2026-10-30), issues 1–2 (water and weight edit/delete), issues 4–5 (desktop), then step 5 (saved meals). Step 4 done (2026-10-30): `goals.followWeight` and `followLatestWeight` (weight POST, delete and restore), toast detail, Profile note replacing the 3 kg nudge; 6 real-Postgres tests and an extended onboarding browser test. Issues 1–2 done (2026-10-30): `PATCH /api/v1/body/{weight,water}/<id>` with revision checks, keyset-paged weigh-ins (`GET /api/v1/body/weight?limit=&after=`), `ReadingsSheet` from Edit on the Water and Weight cards; weight edits, deletes and restores move a calculated budget too. 3 more real-Postgres tests, 2 browser tests on both projects. Not covered: activity entries still have only the toast's Undo (same gap; not reported). Issues 4–5 done (2026-10-30): desktop + pulses the pill and flashes the panel (live region for screen readers); the Log panel aligns with the Budget card (subgrid); alignment asserted in the diary browser test; desktop Today screenshots regenerated and reviewed. Step 5 (saved meals) in progress, 2026-10-30. 5a done: tables `saved_meals` and `saved_meal_items` (migrations 0020–0021; forced RLS, private to the owner, items tied to the meal's owner by a composite foreign key, only snapshot columns updatable), `createSavedMeals` in the diary module (save live entries in order, list, get, rename, delete, explicit refresh by serving ID then name, atomic idempotent logging through the shared `insertEntry`), 7 real-Postgres tests. 5b done: `/api/v1/saved-meals` (list, create, get, rename, delete, refresh, log), Save as a meal (bookmark on meal cards), saved meals in Log suggestions and search, `SavedMealSheet` (log and manage), Saved meals page from More/Settings; screens provisional in `docs/ui.md`. Browser journey on both projects; desktop Today screenshots regenerated (bookmark). Found: SvelteKit refuses a bodyless DELETE behind the proxy as a cross-site form post, so the client sends `{}`. 5c done: `data/saved-meals.json` in the archive (optional within version 1), foods referenced only by saved items in the dependency closure, import matching and writing with `saved_meal` identities (migration 0022), preview label; portability tests extended (round trip, re-import unchanged, changed kept, archive without the file). Deployed to the owner's Unraid on 2026-10-30 (commit f4f61ba; migrations 0020–0022 applied; web and worker healthy). Step 5 done. Observed once: `progress.e2e.ts` "weight history shows raw readings only" failed in phone WebKit during a full parallel run, then passed 16 of 16 repeats; watch for it. Step 6 done and deployed (2026-10-30; 102 curated foods added on the server): 102 curated USDA foods with Turkish aliases (see `docs/design.md`, catalog section), migration 0023 (`reference` portions, unique curated identity), `curated:build` and `curated:load` (run by `obur migrate`; also loaded into the e2e database), food page source line and labels for the extra nutrients. Fixed along the way: editing a food through the form dropped every value it does not show (minerals, fat types, starch) and turned portion sources into `user` (`shared/food-edit.ts`, tests). Owner's USDA files are in `~/obur-private/usda/` (SHA-256 in `scripts/curated-build.ts`). Tests: 4 mapping unit tests, 3 form-preservation unit tests, 5 real-Postgres curated tests, 1 browser journey. Owner follow-up (2026-10-30): USDA portion names were in US units (inches etc.); now metric (`metric-portion.ts`, 38 cases), the build refuses US measures in names, and `curated:load` updates untouched curated foods' portions too (on the dev database: 98 updated, then 102 unchanged). Deployed 2026-10-30 with the new `./deploy/pilot.sh` (98 updated on the server). Step 7 (typed quick entry) in progress, 2026-10-30. 7a done: pure `nl-parser` (see `docs/design.md`, typed and voice logging), 55 development tests; private check on the owner's 48 transcripts 47/48 (expected parses in `~/obur-private/results/nl-cases.json`, run `node scripts/nl-eval.ts ~/obur-private/results/nl-cases.json ~/obur-private/audio/transcripts.tsv`). 7b done: `POST /api/v1/entry/parse` (writes nothing) via `src/lib/server/typed-entry.ts`: day (sentence, else the viewed day, never future), meal, foods matched with `catalog.searchFoodsLoose` (every-word matches first, then the longest run of words that all match, recent foods boosted; never another person's private food), units through the pure `unitForFood` (count words to portions in both languages, a bare count to a medium portion or the food's serving, otherwise left for the person), water glasses as the seeded su bardağı. Tests: 4 unit, 2 real-Postgres. 7c done: Log as typed row in the Log panel (only for sentences with more than a food name), `EntrySheet` (Check and log), toast with one Undo; 2 browser journeys on both projects. Step 7 done and deployed (2026-10-30, 495601f). Step 8 (voice) started 2026-10-30. Recording guide `docs/voice-recordings.md` given to the owner (held-out clips to `~/obur-private/audio/heldout/`, scored once when voice is finished). Done: speech service `speech/` (stdlib HTTP + faster-whisper 1.1.1, model Systran/faster-whisper-small at a pinned revision with SHA-256 per file baked in at build, Turkish-or-English detection, prompt per request, temperature 0, beam 5, ≤30 s and ≤4 MB, one at a time with up to 3 waiting then 503 busy, no request logs, audio in memory only, runs as nobody, offline at runtime); checked locally with a Phase 0 dev clip (correct, 0.8 s on the desktop). App: optional `SPEECH_URL` (unset hides Speak), `POST /api/v1/speech` (prompt from the person's 30 most recent foods and brands, 40 clips per 10 minutes, writes nothing), Speak sheet (MediaRecorder: MP4 on Safari, WebM/Ogg elsewhere; 30 s cap; errors for mic blocked or missing, nothing heard, too long, busy, unreachable, offline), Check and log says "I heard". Browser tests use a stand-in speech service (`tests/e2e/speech-stub.ts`, test setup only) and Chromium's fake microphone. Done: `deploy/compose.yaml` speech service (internal network shared only with web, no internet, no port, read-only root, all capabilities dropped, no-new-privileges, 2 GB memory limit; `SPEECH_URL` defaults to it, empty switches Speak off), `obur-ctl` builds, switches and rolls back `obur-speech` (tests extended), copy procedure in `deploy/unraid/README.md`. Verified locally: the image transcribes correctly when fully locked down, and cannot reach the internet. Owner copied `obur-ctl` and `compose.yaml` (2026-10-30); deployed with the speech service (healthy). Owner's phone check: a long two-item Turkish sentence, about 2–3 s from Done to Check and log, right except one misheard food fixed with Read again. Held-out evaluation done once (46 clips, `docs/feasibility.md`, "Voice, held-out evaluation"): voice works but the parser's freer-phrasing gaps and brand names limit complete results. Improvement round done (owner agreed): parser ("bu akşam/öğlen", "bu gün", "öğle arası", "az önce", "N akşam önce", late eating to Snacks, "çeyrek", porsiyon/tabak and avuç, amounts after the verb, artı/üzerine/yanımda, more ignored verbs, "kilo geldim/çıktım", "tartı … gösterdi"; 80 development cases), and `SPEECH_VOCABULARY` (sentence-style meal and unit words before each person's foods). On the 46 clips as development data: owner same-as-typed 35% → 61%, numbers 84% → 97%; second speaker 20% → 33%, 73% → 93% (`docs/feasibility.md`). The owner's weight gap ("kilo geldim/çıktım") is closed. Step 8 done and deployed (2026-10-30, 66c1a72). Phase 2 review done (see "Before replacing LoseIt"): restore check extended to the off-site copy and the first R2 restore passed. Next: the owner's checks and decisions listed there; Phase 3 (recipes and label capture) only when the owner asks.

## Owner-reported issues to schedule (2026-10-30)

Reported for later; the assistant decides when to fit them in.

1. **Fixed 2026-10-30.** **Water can't be edited or deleted** after the Undo toast is gone. Add edit/delete for a day's water (the body module already has trash and restore).
2. **Fixed 2026-10-30.** **Weight likewise:** edit or delete a recorded weight for a date.
3. **Fixed 2026-10-30.** Unit choices now leave out a serving whose label only restates its size (`unitOptions`, with tests); it stays when editing an entry logged in it. Original report — **LoseIt-imported foods show a wrong extra unit:** in a food's amount sheet, under Unit, a per-100 g food (e.g. Lor Peyniri) shows both "g" and "100g", apparently because its basis amount is 100. Check the unit options for imported foods (basis serving shown as a unit).
4. **Fixed 2026-10-30 (owner to judge on desktop).** **Desktop "+" on a meal card** only adds a meal pill to the Log panel, which is easy to miss (the owner first thought nothing happened). Rethink adding to a meal on desktop; the phone behaviour (open Log) is acceptable but could adopt a better shared solution.
5. **Fixed 2026-10-30.** **Desktop Today layout:** the Log panel should align vertically with the Budget card, not with the top of the Today column.

## Before replacing LoseIt (Phase 2 review, 2026-10-30)

Phase 2 is built and deployed. The roadmap's gate for retiring LoseIt is historical migration plus daily-use acceptance.

**Done and verified:** the Phase 1 pilot; LoseIt import of the owner's history (274 of 274 days reconcile; owner
spot-checked); curated USDA foods; saved meals; automatic budget recalculation; water and weight editing; typed entry;
voice (held-out evaluation and an improvement round, `docs/feasibility.md`); nightly encrypted backups to local and R2;
the weekly restore check now restores from both, and the first R2 restore passed on the server (2026-10-30: 39 tables,
11,652 rows, past the recovery point). Investigated and closed: LoseIt's `active-food-servings.csv` adds no usable
portions (147 of 152 custom-food rows are grams or millilitres, 3 name a portion; database foods have no stated base).

**Owner checks on the iPhone (short):**
1. Done 2026-10-30: offline logging and sending work on the iPhone. Found: after sending, the entries vanished until the next navigation (the refresh met the service worker's saved copy during its one-minute hold). Fixed: the page tells the worker the server is back and waits for it before refreshing; the browser test is now strict (it reproduced the bug before the fix).
2. The core logging target: a familiar food logged in about 10 seconds; a correction in 3 taps or fewer.
3. Desktop: is the meal "+" now noticeable?

**Owner decisions:**
1. Done: a setting, default keep the deficit.
2. Done: macro defaults kept as Balanced (protein 1.2 g per kg, goal weight when lower; fat 30 %; carbohydrate the rest),
   plus own percentages on Profile.
3. Done: a setting for whether burned calories count (all activity); plus watch totals. Imported LoseIt rows stay uncounted history.
4. Done: voice accepted as is; the owner notes failing sentences during use.
5. Done: provisional screen review on an Artifact (private to the owner; the artifact link is in the session, not
   recorded here): phone screenshots in light and dark from `tests/e2e/review-screens.e2e.ts` (runs only with a
   `.review-shots` marker file), questions per screen, and per-screen verdict and notes saved in the artifact's
   `notes` collection for Claude to read back. Outcomes go into `docs/ui.md`.
6. Cut-over: the day to stop logging in LoseIt. On that day, a final LoseIt export imported into obur adds only the
   days since the first import (overlapping exports are matched).

**Later, not blocking:** a fresh 10–15 clip voice held-out set; the typed-entry gap list below; hosted CI stays off by
the owner's choice (checks run locally before each deploy).

Owner feedback 2026-10-30, done: the amount preview is now a shared `MacroPreview` (kcal headline, coloured Protein/Carbs/Fat, carbs fall back to the imported unstated value with a note instead of "?"), used in the amount, Check and log and edit sheets; browser test added.

Owner decisions 2026-10-30, done: budget settings on target versions (migration 0024: `count_activity`, `at_goal`; Profile card; `PATCH /api/v1/targets/settings`), maintenance at goal when chosen, watch totals (`activity_entries.kind`: `extra` adds, `day_total` newest replaces; `countedActivity` and the range SQL), export/import fields (optional for older archives). Tests: unit, 4 real-Postgres, 1 browser journey. Found while testing: the settings switch flipped back when the busy flag re-rendered it (fixed with local state). Owner's decision 2 (macro defaults) needs a plain explanation; decision 6 (cut-over day) is open.

## Owner's screen review (2026-10-30, notes read from the review artifact)

Marked good: onboarding, water and weigh-in editing, save as a meal, saved meals list, Check and log, Speak (with a
note), amount preview (with a note), food edit, USDA food, Your data, Household (with a note). Work list:

1. Small fixes (batch 1): water card takes any amount (end-of-day 3–4 l in one entry); weight card Save aligned with
   Edit; meal card header and items aligned, a lighter +, bookmark styled alike in another colour; Mark day complete as a
   full-width switch with space above its hint; Profile budget text without awkward breaks; never stack two choice chips
   (shorter labels, same text size) as a general rule; activity wording device-neutral and the two kinds clearer (keep
   the explanation); a better Turkish Speak example; amount preview with more space between kcal and macros, macros not
   moving with the kcal digits; food form "<" explained, optional "More nutrients" for existing extra codes; Household
   buttons of equal size.
2. Features: Profile shows and edits height, weight, goal and birth date; editable macro targets (Balanced default, or
   percentages of the budget); saved meals managed separately from logging (an editor: rename, amounts, add/remove
   foods, create from scratch; logging from Log).
3. Design decision: the Today budget circle (the owner is open to replacing it); alternatives as an Artifact first.

Batch 1 done (2026-10-30): water **Other** amount (ml or l, up to 10 l); meal card rows aligned with the title and
36 px round + / bookmark buttons; **Day complete** as a full-width switch; Profile's Current budget as a headline and
rows; two-choice chips always side by side (shared `Chips`, food form groups; basis chips one row of three); activity
kinds **One activity** / **Day total**, device-neutral; Turkish Speak example; amount preview kcal in a fixed column
with a divider; food form "<" explained and **More nutrients (optional)** for the nine existing extra codes (vitamins
and magnesium would need new nutrient codes: not added); Household row buttons one width. Rules recorded in
docs/ui.md. The weight card note was a misreading (the owner confirmed they align). Follow-up: every
clickable control shows a pointer cursor and disabled ones the arrow (one base rule in layout.css; Tailwind 4 had reset
buttons to the default cursor). Water reworked after the owner's second look: +250 / +500 full width, **Other
amount** below turning into a field with an ml / l suffix.

Batch 2, step 1 done (2026-10-30): Profile **Your details** card (rows; Edit in place; a new weight becomes today's
weigh-in; `goals.updateDetails` saves details and recalculates a calculated budget from today in one transaction,
`PATCH /api/v1/profile/details`). DB tests cover recalculation, no-op, minors, manual budgets, validation and
isolation; e2e covers the Profile flow. Batch 2, step 2 done (2026-10-30): macro targets on Profile: **Balanced** (default) or
**My own %** (whole percents adding to 100, any budget), a budget setting versioned from today (migration 0025:
`macro_mode`, `protein_share`, `carb_share`, with a sum check); exported and imported with the archive. 

Batch 2, step 3 done (2026-10-30): saved meal editor (`/saved-meals/[id]`, `/saved-meals/new`): rename, item amounts
and units, remove, add foods, create from scratch; one atomic `PUT /api/v1/saved-meals/[id]` (`saveContents`, revision
checked, idempotent create); Log's sheet is for logging with an Edit meal link. DB tests for replace/create/conflicts/
isolation; e2e for edit and create journeys. Budget circle alternatives published for the owner as an Artifact (2026-10-30): the current ring, A
"number and bar", B "the sum" (equation tiles), C "half gauge", each at phone size with morning/evening/over states,
a pick and notes. The owner picked A (2026-10-30) and asked to keep the
equation off the card face; built with the breakdown behind a tap on Budget. Next: the typed-entry gap list, a fresh
held-out voice set, and the cut-over day (owner undecided). A ring version of the card was previewed (two placements,
breakdown behind Budget); the owner found neither satisfying and set it aside for later (not urgent).
Typed-entry gap list: nothing open. Phase 2 work is complete pending the owner's phone checks 2–3 and the cut-over
day.

## Phase 3: recipes (owner chose recipes first, 2026-10-30; label photos to be gathered meanwhile)

Plan: a recipe is a food (origin `recipe`, per serving) whose values are its ingredients' pinned snapshots summed
and divided by servings; per-gram only with the cooked weight entered; ingredients visible to the owner only (shared
recipes show as plain foods); no nesting yet. Steps: 1 database and service; 2 editor and logging; 3 export/import.

Step 1 done: migrations 0026 (`recipes`, `recipe_ingredients`, owner columns cascading on account deletion) and 0027
(RLS: owner only, same-owner checks); `catalog/recipes.ts` (`save` create/replace with version check, `refresh`,
`get`); `shared/recipe.ts` (`recipeNutrients`: unknown unless every ingredient states it; derived or estimate);
`snapshotOf` moved to `shared/diary-rules.ts`; the food form refuses recipes. Tests: 4 unit, 6 real-Postgres
(values, pinning/refresh, edits/conflicts/nesting, privacy for members and admins, account deletion). 

Step 2 done: `/api/v1/recipes/[id]` (GET owner only, PUT create/replace) and `/refresh`; `recipes.list`; Recipes
page, editor (`ui/recipes/RecipeEditor.svelte`) and More entry; the saved meal editor's item list extracted to
`ui/items/` (drafts.ts, ItemsCard, AddFoodSheet) and shared by both editors; the food page sends owners to the recipe
editor and tells others it's a recipe. e2e: create, log by grams, edit without changing the diary, another member
sees totals only. 

Step 3 done: `data/recipes.json` (optional file in format version 1), ingredient foods in the dependency closure,
recipes attached on import only with the food the import creates. The round trip compares recipes field by field.
Recipes (Phase 3 part 1) complete and deployed. The owner approved the recipe screens (2026-10-30).

## Phase 3: label scanning (started 2026-10-30)

Data: the 10 Phase 0 labels (`~/obur-private/labels-prepared`, hand-read values) are the development set. The owner
added 12 new photos (`~/obur-private/labels/IMG_3675`–`IMG_3687`, 2026-10-30), some possibly repeating products: the
held-out set. Do not view, OCR or tune on them until the parser is frozen; then convert them (orientation-corrected,
metadata stripped), read their values by hand, and score once.

Plan: 1 pure `label-parser` (done, below); 2 an internal OCR service like speech (RapidOCR + ONNX Runtime,
PP-OCRv6 small at 1280 px, pinned and checksummed models, no network, telemetry off, the photo held in memory only);
3 `POST /api/v1/scan` and the Scan screen (downscale on the phone, the photo beside the proposal in the food form);
4 held-out evaluation, recorded in docs/feasibility.md.

Step 1 done: `label-parser` (table and running-text layouts; header columns per 100 g/ml, serving with its size,
%RI; drift-following row assignment; impossible values dropped; no fallback from a table to text). Development set,
PP-OCRv6 small at 1280 px (Phase 0 OCR output): 85 % of values right (72/85), 0 wrong, 13 missing (values the OCR
never read), basis right 10/10, 8/10 labels fully right. Noisier OCR (2000 px; tiny model) gives 2–13 wrong values,
mostly the tiny model's `%`→`9`: the warnings remain needed. `node scripts/label-eval.ts <ocr.jsonl> <truth.tsv>`.

Steps 2–3 done: OCR service `ocr/` (pinned PP-OCRv6 small, checked; reproduces the Phase 0 development scores
exactly; runs with no network; 0.3–0.6 s per label on the desktop); `OCR_URL`, `POST /api/v1/scan` (30 per 10
minutes, writes nothing), the Scan page and tile, `?food=` on Log to open the amount sheet; foods record
`label_scan`. Compose `ocr` service and `obur-ctl` (`obur-ocr` image, logs/restart ocr): the owner must copy both
files on the server (deploy/unraid/README.md) before Scan appears; until then it stays "Coming soon". Browser tests
use the stand-in service (answers keyed by photo width so the two browsers don't race). Next: freeze the parser and
run the held-out evaluation on the 12 new photos. Next: batch 2 features (Profile details, editable macro targets, saved meal
editor), then the budget circle alternatives Artifact.

## Typed entry gaps to close (owner, collected during use)

Owner's approach (2026-10-30): note phrasings that fail during real use and close them in batches; each fix gets a development test case written for it.

- Closed 2026-10-30: weight with a verb after "kilo" ("120 kilo geldim/çıktım", "tartıda 91 kilo çıktım", "tartı 88 gösterdi").

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

- When a calculated target's goal weight is reached, should the deficit stop (maintain)? Today it continues. Ask the owner when convenient.


- Test phone: iPhone 13, iOS 27.0.1. Second authenticators for recovery tests: two YubiKeys.
- Pilot hostname chosen (a subdomain of the owner's domain); recorded only in the owner's `.env`, RP ID is the parent domain.
- Home server OS, Docker availability and exact CPU/storage (design assumes a 2-core/4-thread i3 with 16 GB RAM).

## Repository

- Private GitHub repository `aloglu/obur` (created 2026-10-29), remote `origin`, branch `main`. Push after each commit so the off-machine copy stays current. The rules about private data and real hostnames still apply as if the repository were public.
- No hosted CI (owner decision, 2026-10-29: the account's Actions allowance is nearly used up). GitHub Actions is disabled in the repository settings and there are no workflow files; do not add any without asking. Checks run locally before every deploy: `npm run check`, `npm run lint`, `npx vitest run`, `npm run test:e2e`.
