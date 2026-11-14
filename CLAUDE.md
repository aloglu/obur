# CLAUDE.md

**obur** is a self-hosted calorie, weight and water tracker intended to replace LoseIt. It is a mobile-first PWA with an English interface and English, Turkish and mixed-language input. Typical use is a small circle of family and friends (up to about 20); accounts are invite-only, with no arbitrary user cap. MIT licence.

## Sources of truth

- `docs/design.md` is the canonical product and technical design, including scope, data rules, the roadmap and unresolved assumptions. This file governs how to work; do not duplicate the full design here.
- Keep agreed decisions in the repository. External chats and demos are discussion aids, not an additional source of truth.
- When the owner needs to choose a visual direction, or face another substantial experience decision, tell them clearly. They may explore it with demos in the Claude app; record the outcome here afterwards.
- Read the relevant design sections before changing a feature, and the full design when planning a new milestone. Read related modules and dependencies whenever needed to understand a change.
- Update the design in the same change when an implementation decision changes it. Clearly distinguish requirements, provisional choices and evidence still needed.

## Working with the owner

- The owner decides product priorities and experience. Own routine technical decisions and explain consequential trade-offs in plain language.
- Be candid about incorrect assumptions, unnecessary complexity and risks; propose a practical alternative. Treat illustrative examples and rough numbers as examples unless they are explicitly requirements.
- Show a short plan for substantial work, then carry out what the owner has authorized. Do not ask again for approval already given.
- Ask before a material change to scope, privacy, cost or a difficult-to-reverse decision that is not already authorized. An undocumented implementation detail alone is not a reason to stop: make a reasonable choice, record it and continue.
- If evidence invalidates a requirement, explain the finding and options. Continue independent work while a necessary product decision is pending.
- Keep changes small and reviewable. When using PRs, keep each focused on a coherent feature or fix.

## Starting and resuming work

- Read `docs/progress.md` if present, inspect the working tree and recent commits when Git is available, and preserve unrelated changes.
- Follow the roadmap in `docs/design.md`. First inspect a real LoseIt export and run the phone/server feasibility probes; do not silently turn estimates into measured claims.
- Deliver a usable logging flow early. Add only the deployment route and infrastructure required by the current milestone; do not build every future feature up front.
- Keep `docs/progress.md` current with completed work, current work, validation results, the exact next step and unresolved questions. Create it when implementation begins.
- Usage limits can end a session at any point. Work in small steps that each end in a passing state, commit after each one with a clear message, and update `docs/progress.md` before each commit, so an interrupted session loses at most one step.
- Do not put private exports, photos, recordings, credentials or real deployment hostnames in the public repository.

## Architecture and stack

- Keep the selected stack: SvelteKit/Svelte 5, strict TypeScript, Tailwind, Drizzle, Valibot, PostgreSQL, pg-boss, SimpleWebAuthn, and LayerChart when charts are built. Do not replace it without a concrete reason and approval for that change.
- One modular application, one database. One published `obur` image holds the web app, the worker and PostgreSQL with its backups; speech (`obur-speech`) and label reading (`obur-labels`) are separate optional images (owner's decision, 2026-11-07). Do not introduce microservices or Redis.
- Keep business logic under `src/lib/server/modules/`, with thin routes and public module entry points. Follow the ownership and transaction boundaries in the design; use lint rules to prevent accidental internal imports.
- Keep `label-parser` and `nl-parser` pure TypeScript with no database, SvelteKit or I/O dependencies. Resolve catalogs and perform writes outside them.
- Use PaddleOCR PP-OCRv6 small via ONNX Runtime for OCR and faster-whisper `small` for speech, as selected by the Phase 0 measurements in `docs/feasibility.md`. Change models only with new measured evidence on the target server.
- Keep sessions and jobs in PostgreSQL, paginate relevant lists and make worker concurrency configurable. Do not add speculative infrastructure for scale or native apps.

## Security and privacy invariants

- Every user-owned row must be isolated, including child records, queued work and stored parser results. Test isolation for reads and writes whenever adding or changing access paths.
- Runtime database roles must be non-superusers, must not own protected tables, and must not have `BYPASSRLS`. Migration privileges are separate. Enable RLS on user-owned tables, with `FORCE ROW LEVEL SECURITY` as an additional guard.
- Derive identity from the authenticated session and set it transaction-locally on the same connection as the protected queries. Use the same discipline for workers; missing identity must fail closed.
- Test connection reuse, absent identity and cross-user inserts/updates. Do not bypass RLS to make application features work.
- Hand-made foods and confirmed scans are shared on the server by default, with a private option; LoseIt-imported foods are private by default, with an opt-in share in the import preview. Shared visibility never includes diary activity, who logged a food, or private ingredients. Logging a shared food never creates a copy; "Make my own variant" creates a private one.
- Require recent passkey verification for sensitive actions. Follow the separately specified recovery flow for a lost credential; never add an undocumented recovery shortcut.
- Read public URL, WebAuthn RP ID, allowed origins and secrets from configuration. Use example values in documentation. No secrets or real private hostnames in source. The owner's own installation's real hostname and RP ID exist only in the owner's configuration.
- Enforce bounded upload sizes and retention, including abandoned and failed jobs. Keep production photos/audio out of backups and public fixtures; retain transcripts for regression only with the specified consent.
- No telemetry or external food/model lookups at runtime. Only explicitly configured infrastructure and optional integrations described in the design may contact third parties. Redact sensitive content from logs.

## Data correctness and safety invariants

- Preserve nutrient provenance, source definitions, units and qualifiers. Unknown is not zero; USDA and label carbohydrate definitions are not interchangeable without an explicit conversion policy.
- Never invent a food's weight, density or cooked recipe yield. Support source-backed per-100-g, per-100-ml or per-serving values and ask when a required conversion is unknown.
- Diary entries keep their own nutrient snapshots and the user's chosen diary day/time-zone context. Only an explicit diary correction may change an entry's nutrition; catalog edits must not silently rewrite history.
- Parsers propose actions; they never invent nutrients. Confirm inferred food, amount, unit and date before saving. Explicit calories-only input is handled as such, not fabricated catalog nutrition.
- Daily budget = base burn (BMR × about 1.2 from onboarding, or a fixed number the person sets) + manually entered activity calories (extra above an inactive day) − goal deficit. Imported or unclear activity is recorded but not added until its meaning is mapped. Targets are versioned; past days keep their budgets. No workout types or exercise library. No algorithmic targets for minors, pregnancy or breastfeeding.
- Offline support follows the bounded scope in the design: cached viewing and queued new records with account isolation, retry deduplication and server validation. Do not implement unspecified last-write-wins editing.
- Put invariants in database constraints as well as validation. Make each logical multi-row database operation atomic and preserve legitimate repeated entries.
- Imports require a dry run and both file-level retry protection and a defined overlapping-history policy. A file hash alone is not row-level deduplication.
- Exports must include the portable data and dependency closure defined in the design. Verify manifests and keep complex export/import round trips passing.
- Keep encrypted local backups (plus off-site when configured; optional per installation, R2 for the owner), monitored WAL archival and rehearsed restore ready before real reliance on the app. Warn plainly when no off-site copy exists. Test restores against the intended recovery point, not changing live counts.
- Run migrations through the controlled, backed-up upgrade procedure. Respect deletion retention and restore reconciliation; never promise that live deletion instantly erases retained backups.

## Language and interface

- Keep interface strings in the English message catalog. Preserve entered food names and support Turkish-aware casing, transliteration-aware search, and comma/dot decimal input.
- Build screens from `docs/ui.md` and the design tokens, created from the visual direction the owner picked among demos (Pazar, 2026-10-25). Follow the design's visual principles: cohesion, practical before fun, joy in short non-blocking moments, compact information with large tap targets. Extend shared components for routine needs; reserve owner decisions for substantial changes to the experience.
- Design for one-handed phone use, then desktop. Respect safe areas, sufficient touch targets, WCAG AA contrast, 200% text scaling and reduced motion. Provide menu alternatives to drag actions.
- Check light/dark mode and long Turkish names. Keep confirmations clear and logging fast; decorations must not block input.
- Deep links may prefill actions but never write on opening. Ship shortcuts only for implemented features. Notifications remain per-person and opt-in.

## Verification and handoff

- Write meaningful tests alongside behavior changes, with a regression test for a reproducible bug when practical. Avoid tests that merely repeat implementation or test trivial rendering.
- Test database behavior against real PostgreSQL. Test isolation, unit conversion, imports, snapshots, offline retries and recovery thoroughly, including failure cases: these are where real data gets lost or leaked.
- Use parser development and held-out fixtures separately. Report complete-result accuracy, serious errors, correction time and end-to-end latency, not only aggregate field scores. Audio fixtures are needed to evaluate speech changes.
- Test key UI flows with Playwright on phone-size WebKit and desktop Chromium, with accessible controls and selected visual comparisons. Use supported virtual WebAuthn tooling; never ship a test login bypass.
- Supplement browser emulation with real-phone checks for passkeys, installed PWA behavior, camera/microphone permissions and interrupted connectivity.
- Run the checks relevant to the change and required CI gates. Before release, satisfy the applicable definition-of-done checks and roadmap release gates. State what passed, what was not run and what remains uncertain; never claim unavailable CI results.
- Summarize the change, its purpose, validation and material limitations. Update resumable progress before handing back.

## Commands and scope

Verified on 2026-10-25 and 2026-11-07 (Node 24+, npm, Docker). Add commands here only after running them.

- Setup: `cp .env.example .env`, replace every `change-me-*` password (the URLs must match), then `npm install`.
- Development database (PostgreSQL 18, localhost only, data checksums on): `npm run db:start` / `npm run db:stop`.
- Roles and ownership, once per database (superuser via `DATABASE_ADMIN_URL`): `npm run db:bootstrap`.
- Generate a migration from module schemas: `npm run db:generate -- --name <name>`; hand-written SQL (RLS, grants): `npx drizzle-kit generate --custom --name <name>`. Never edit a migration that has been applied anywhere shared.
- Apply migrations (locked, one transaction, as the schema owner): `npm run db:migrate`.
- Database tests against real PostgreSQL (needs `npm run db:start`; uses a disposable database): `npm run test:db`.
- Development server: `npm run dev`.
- Type-check (compiles messages first): `npm run check`.
- Lint and formatting: `npm run lint`; fix formatting with `npm run format`.
- All Vitest projects (unit, rule and database tests): `npx vitest run` (or `npm run test:unit` for watch mode).
- End-to-end tests (phone WebKit and desktop Chromium in the official Playwright image, with host networking; needs `npm run db:start`; recreates the `obur_e2e` database each run): `npm run test:e2e`. Passkey journeys run in Chromium only (virtual authenticator). Screenshot baselines live next to the tests; after an intended visual change, regenerate them with `npm run test:e2e -- --update-snapshots` and review the new images before committing. `npm run test:e2e:local` runs desktop Chromium on the host only.
- Production build: `npm run build`.
- The `obur` image (app, worker, PostgreSQL and backups in one container; `deploy/obur/`): `docker build -t obur:test .`, then `deploy/obur/smoke-test.sh obur:test` (fresh start, sign-in page, setup link, first backup, administrator refused to the app's user, clean stop). `deploy/obur/offsite-test.sh obur:test` checks that local backups carry on while the off-site store is away (a folder stands in for it). Add-ons: `docker build -t obur-speech:test speech`, `docker build -t obur-labels:test labels`.
- Releases: `.github/workflows/release.yml` runs only on a `v*` tag or by hand (Actions credits are limited; never on every push). It checks, builds the three images, smoke-tests `obur` (and runs its off-site outage test) and publishes them to ghcr.io. Installing, updating and restoring for operators: `docs/install/`, `docs/restore.md` (commands are `docker exec obur obur …`). Before tagging a release, check `docs/install/for-ai-agents.md` still matches the commands, settings and log lines.
- First admin's one-time setup link (24 h): `npm run admin:setup-link`. Recovery link for someone who lost every passkey and code (1 h): `npm run admin:recovery-link -- "<display name or user ID>"`. Both need `PUBLIC_ORIGIN` and `DATABASE_MIGRATOR_URL`.
- Curated USDA foods: `npm run curated:build -- <sr_legacy .zip> <foundation .zip>` regenerates `src/lib/server/modules/catalog/curated/usda-foods.json` from the downloaded datasets (checksums pinned in the script); `npm run curated:load` loads it (idempotent; `obur migrate` runs it in production).
- Messages: edit `messages/en.json`; `npm run i18n` compiles them.
- Background jobs: `npm run jobs:setup` (schema owner; creates or upgrades the pg-boss schema and schedules, `TZ` sets the schedule zone), then `npm run worker` (worker role).

Use `docs/design.md` for milestone scope and deferred features. Native apps, health-platform integration, meal planning and social features are outside the initial releases. Open sign-up, billing and multi-organisation tenancy are not planned.
