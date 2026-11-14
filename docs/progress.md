# Progress

Resumable status for obur. Update before each commit. Design: `docs/design.md`; working rules: `CLAUDE.md`.

## Pre-release audit fixes (2026-11-14)

Audit of sign-in, isolation, diary retries, offline sync, service worker, imports, reminders, uploads, search and
page loads. Fixing everything found (owner, 2026-11-14):

- Done: a retried food entry logged by serving or household measure was refused as a conflict (jsonb reorders the
  unit's keys; `sameRequest` now compares with sorted keys). Regression test in `diary.db.test.ts` (fails without
  the fix).
- Done: speech requests were logged as slow (`SLOW_BY_NATURE` named `/speak`).
- Done: More's counts are counted in the database (`trashCount`, `recipes.count`, `savedMeals.count`) instead of
  loading the trash, every recipe and every saved meal with its items after each page change and save.
- Next: sign-in limits per real client behind a trusted proxy (all documented remote-access setups share one IP
  now); a bound on the device's saved pages.

## Owner's Turkish fixes released (2026-11-14), as `v1.0.0-beta.16`

Checks before the tag: type-check, lint, 1113 unit and database tests, e2e 246 passed (18 skipped by design; one
intermittent failure, below), image built, smoke test, off-site outage test. No new migration. Tag pushed; the
release workflow published all three images.

## Owner's Turkish fixes (2026-11-14)

- Done: the meal picker says Öğle, Akşam (full names everywhere else; `mealShortName`). Buttons and toasts that name a
  meal as a destination use a fixed dative per meal: "Öğle yemeğine 1 yiyecek kaydet", "Kahvaltıya taşı" (`mealNameTo`;
  English unchanged). The amount's macro preview says "Karb." in Turkish (it ran into "Yağ"; full word for screen
  readers and large text). No zooming: `user-scalable=no`, `touch-action: manipulation`, Safari's pinch stopped in
  `static/text-scale.js`; the axe `meta-viewport` rule is off for it. Stored meals are keys, so no data changes.
- Checks: type-check, lint, 1111 unit and database tests, e2e 244 passed (18 skipped by design) before the axe rule
  change, then accessibility and large-text rerun and passing; new Turkish logging test on phone WebKit and desktop
  Chromium. Intermittent: `turkish.e2e.ts` "no main screen scrolls sideways" on phone WebKit failed 2 of about 40 runs
  with "navigation to /achievements interrupted by another navigation to /help" (passed 16 of 16 before the change
  and 12 of 12 after; not traced).
- Done (owner agreed, 2026-11-14): any food's portion or serving label that is an everyday portion word alone (or
  after a count) shows in Turkish, "Slice" → "Dilim", "1 cup" → "1 bardak" (`GENERIC_PORTIONS`); the parser also
  matches that Turkish word. Display only; stored names unchanged ("Bar" stays). Checks: type-check, lint, 1113 unit
  and database tests, e2e 246 passed (18 skipped by design), one phone-WebKit `saved-meals.e2e.ts` failure that
  passed when run alone (English-only test; not traced).
- Next: whatever the owner asks next.

## Turkish released (2026-11-14), as `v1.0.0-beta.15`

Checks before the tag: type-check, lint, 1111 unit and database tests, e2e 242 passed (18 skipped by design; one
intermittent failure, see below), image built, smoke test, off-site outage test. No new migration. Published 2026-11-14 (all three images). Also in it: Turkish
names for built-in portions when typing or speaking.

## Turkish interface (2026-11-14), released as `v1.0.0-beta.14` (Turkish in preview only)

Checks before the tag: type-check, lint, 1109 unit and database tests, e2e 239 passed (18 skipped by design), image
built, smoke test, off-site outage test. Migrations 0050–0052 run on update. Published 2026-11-14 (all three images; obur-labels needed one re-run after a registry "unknown blob" on upload). The owner keeps English; to read Turkish,
`OBUR_PREVIEW_LANGUAGES=tr` in `.env`, then More → Settings → Language.

- Agreed plan: design.md, "Interface language". Nothing built in the app.
- Done (owner, 2026-11-14): Household renamed Members (friends aren't a household); Turkish "Kullanıcılar". About 80
  strings rewritten around members ("Shared by another member", "An admin can …"), page at `/members` (`/household`
  redirects, e2e), admin APIs under `/api/v1/admin/`, code names follow; the table stays `household_settings`.
  Household measures unchanged. Docs, install guides and deploy messages follow. Checks: type-check, lint (outside
  the stray `.claude/worktrees` copy, which Prettier also scans), 1096 unit and database tests, e2e 227 passed (18
  skipped by design).
- Done (2026-11-13, overnight cloud session): review page published to the existing review artifact
  (https://claude.ai/artifact/1D6vQwDnAYtRhHLxccs5ii, version 10, db collection `review`). Source:
  `docs/ui/review-2026-11/turkish.html`. Old Scan docs left untouched; the page reads only `tr-` docs.
- Stop doc ids: `tr-tabs`, `tr-today`, `tr-names`, `tr-dates`, `tr-foods`, `tr-numbers`, `tr-help`, `tr-glossary`.
  Fields `stop`, `verdict` (`ok` / `change` / `dealbreaker`), `note`, `at`.
- Choices made (listed on the page too): Log tab "Ekle" (Kaydet is Save); Journal tab "Takvim" (günlük = daily);
  meals in full (Öğle yemeği, Akşam yemeği, Ara öğün); placeholders after a colon or before "için"; Turkish percent
  first (%30); no thousands separator in either language; English switches from 72,5 to 72.5 (help text and USDA
  portion names included); "kcal" kept; smoothed weight "Dengelenmiş kilo"; household "Ev halkı"; built-in names
  follow the values (Çedar peyniri, not Kaşar; Halibut, not Pisi balığı; rice "haşlanmış", not pilav).
- Found: the household measures are seeded with Turkish names only (`drizzle/0006_catalog_rls.sql`); English names
  are part of the plan's measure step.
- Checked: every stop, screen, Phone/Desktop, Light/Dark and Both/Türkçe view walked in headless Chromium at 390 and
  1280 px: no script errors, no page overflow, no clipped text. Saving verdicts verified only by reading the
  collection (no test write); the real save runs when the owner taps a verdict.
- Review done (owner, 2026-11-14, https://claude.ai/artifact/1D6vQwDnAYtRhHLxccs5ii, collection `review`, ids `tr-*`):
  no dealbreaker, so it goes ahead. Six stops right with small wording fixes, two to change (tab bar wording, Help
  text). Glossary approved and saved with the fixes: `docs/tr-glossary.md`.
- Settled 2026-11-14 (glossary): "Aktivite" fits the pill as it is (measured); water "Miktar gir"; Progress switch
  "Son kilo"; both Help answers in the owner's wording with the agreed fixes.
- Done (2026-11-14): language setting, hidden (design.md, "Interface language"). Migrations 0050 (profiles.language,
  'en' default) and 0051 (grant). `npm run i18n` now passes the same strategy as the Vite plugin. Tests:
  `languages.test.ts`, settings and export round trip (a stored 'tr' travels), `language.e2e.ts` (a hidden language
  never shows). Checks: type-check, lint, 1100 unit and database tests, build, e2e 231 passed (18 skipped by design);
  one earlier run had the phone-WebKit offline test (offline.e2e.ts:237) fail once and pass on retry.
- Done (2026-11-14): full Turkish catalog (glossary terms, no suffix on a placeholder, the owner's Help wording),
  dates and numbers per language (English shows 72.5 now; e2e expectations and the Today screenshots updated, only
  the decimal marks changed), reminders in the person's language, passkey names and manifest from the catalog.
  Checks: type-check, lint, 1106 unit and database tests, e2e 231 passed (18 skipped by design).
- Done (2026-11-14): built-in foods' Turkish names and portions, a `curated` marker on their diary copies (migration
  0052, display only; tested that nothing else in a row changes), household measures per language (English now says
  "Water glass"), US cup labelled with its size. Checks: type-check, lint, 1109 unit and database tests, e2e 231
  passed (18 skipped by design).
- Done (2026-11-14): Turkish preview on a server (`OBUR_PREVIEW_LANGUAGES=tr`, in `.env.example`), Language in
  Settings, Turkish screen tests (Today pictures phone/desktop light/dark, 20 screens without sideways scrolling,
  built-in portions). Found and fixed: "Karbonhidrat" ran into its bar (the three nutrient rows now share one label
  column; English pictures unchanged). Checks: type-check, lint, 1109 unit and database tests, e2e 239 passed
  (18 skipped by design).
- Done (2026-11-14, after beta.14): typed and spoken portions find a built-in food's portion by its Turkish name,
  and two-word portions work ("1 yemek kaşığı zeytinyağı"). Checks: lint, 1111 unit and database tests, e2e 242
  passed; the phone offline test (offline.e2e.ts:237) failed once in the full run and passed in three runs on its own
  (seen once before; intermittent, not identified yet).
- Done (2026-11-14): Turkish released for everyone (`ENABLED_LANGUAGES` = en, tr). The owner tried the beta.14
  preview and asked for no changes; least certain, if wording comes up later: achievement quips, budget setup and
  BMI text, Help answers beyond the two the owner rewrote, error messages. Checks: type-check, lint, 1111 unit and
  database tests, e2e 242 passed; accessibility.e2e.ts failed once on phone in the full run and passed three times on
  its own (like offline.e2e.ts:237: intermittent, to investigate).
- Next: nothing open for Turkish. Back to the last item before version 1: the whole-codebase review.

## After beta.12 (2026-11-13), released as `v1.0.0-beta.13`

Checks before the tag: type-check, lint, 1096 unit and database tests, e2e 227 passed (18 skipped by design), image
built, smoke test, off-site outage test. No migration. The owner checks the tab slide on their iPhone.

- Done: page changes, second round. Owner on beta.12: liked only the push into More's sections; disliked the tab
  dissolve, and that desktop dissolved every change. A wider demo (same artifact, version 4: none, dissolve, slide
  by tab order, follow the menu, push, small shift, zoom, grow from the tap, cascade, focus pull). Owner's picks:
  phone tabs "Slide by tab order", sections "Push", other deeper screens like More's; desktop none for tabs and
  sections. `pageDirection` now gives `right`/`left` by tab (`tabOf`) or null (no movement); desktop has no view
  transition. docs/ui.md, "Page changes". Checks: type-check, lint, 1096 unit and database tests, e2e 227 passed (18 skipped by design).

## After beta.11 (2026-11-13), released as `v1.0.0-beta.12`

Checks before the tag: type-check, lint, 1094 unit and database tests, e2e 227 passed (18 skipped by design), image
built, smoke test, off-site outage test. No migration. The owner checks the page changes on their iPhone.

- Done: page changes (owner's report: going into More's sections and deeper felt inconsistent and not in line with
  Stageshow). Found by filming: an empty frame between pages, the title blinking, and no difference between going in
  and coming out. Demo artifact https://claude.ai/artifact/CHUPNz27wfDy4sP4tUUHdr (Current / A Dissolve / B Push);
  owner picked B. Built with view transitions: push on phones down and up `shared/page-tree.ts` (unit tests), dissolve
  for everything else and on desktop. docs/ui.md, "Page changes".

## Owner's reports on beta.10 (2026-11-13), released as `v1.0.0-beta.11`

Checks before the tag: type-check, lint, 1089 unit and database tests, e2e 227 passed (18 skipped by design), image
built, smoke test, off-site outage test. No migration. Owner on their iPhone after updating (2026-11-13): "night and day"; option 3 not needed.

- Done (owner's choice, 2026-11-13: options 2 and 5 of six laid out; easy to reverse): pages prepared ahead in the
  service worker, so every tab and More section opens at once with data seconds old, and nothing changes on screen
  after it appears; lists in Household, Your data and Passkeys come with the page; food and saved-meal details are
  prepared when a finger touches the row. Server timing on every answer and slow requests logged. See design.md,
  "Page changes and the saved copies". Tests: `prepare.test.ts`, `prepared.e2e.ts` (fast tab with the server held
  back 5 s; a save never hidden behind a prepared copy, checked to fail without the protection; Household listed on
  arrival), offline hanging-connection test reworded to "at most one page change waits". Not yet on a real iPhone.
  If the owner still finds screens slow, the agreed next step is option 3 (show the saved copy, then update) for
  those screens only.

- Fixed: Today's date title flashed on every visit, desktop too. Cause (mine, in beta.10): the shared-data refresh a
  moment after each page change also reloaded Today (its load read today's date from the layout), and the title's
  animation class was worked out again on every refresh. Page loads now work out today themselves; the shared data
  refreshes after a page change only once it is 30 s old, and when the app returns to the foreground; the title
  decides once, as it appears, whether to move in (only when the day changes).
- Fixed: Log fetched Recent from empty on every visit (also before beta.10). It keeps recent foods and saved meals
  per account between visits, shows them at once and updates them behind. e2e: `app-shell.e2e.ts` (Recent shows
  within 1.5 s with the server slowed to 4 s; the title does not animate on arrival, re-tap or refresh, and does on
  moving a day).

## Before version 1 (owner agreed 2026-11-13), one commit each, `main`; released as `v1.0.0-beta.10`

Checks before the tag (2026-11-13): type-check, lint, 1080 unit and database tests, e2e 220 passed (17 skipped by
design), image built, smoke test, off-site outage test. Migrations 0046–0049 run on update (upgrade from beta.9
rehearsed earlier the same day). The owner checks page speed and headers on their iPhone after updating.
Published 2026-11-13 (all three images). The first release run failed on a LoseIt test that compared two zips built a
moment apart (zip stores the time, so their hashes could differ); a re-run of the same tag passed. The test zips now
carry a fixed time (`1cae1ca`, after the tag; app code unchanged). One more unexplained local run had 2 failing tests
that 26 later full runs never repeated; not identified yet, watch for it.

- Last item before getting ready for production (owner, 2026-11-13): a review of the whole codebase, done after
  every other change so it also catches what those changes break.

- Done: local backups no longer wait for the off-site store (the issue open since 2026-11-09). `obur-backup
  archive-push` sends each WAL file to the local repository first; one the off-site store cannot take waits in
  `/data/offsite-queue` (gzip, 1 GB limit, dropped and reported over it) and a loop beside the scheduler sends it
  when the store answers. Off-site backups and restore checks send what waits first. Household: "can't be reached"
  after an hour of waiting, "misses some changes" after a drop until the next off-site backup.
  `deploy/obur/offsite-test.sh` (passes on the new image, fails on beta.6; in the release workflow),
  `backup-health.test.ts`. Not checked against a real S3 store going away (a folder stands in for it); a store that
  hangs rather than refuses holds PostgreSQL's archiver for pgBackRest's 60 s timeout once, then files queue.
- Fixed (older than today, found by repeating the outage test): the restore check failed on a quiet database whose
  WAL position sat exactly at the start of a file ("WAL up to … was not archived within two minutes": closing the
  file does nothing when nothing was written). It now writes a restore-point marker first. The queue listing also
  tolerates files arriving or leaving while it looks. Outage test repeated 8 times on the fixed image, all passed.
- Done: goal weight reached offers "Switch to maintain". The setting already existed on the Goal page ("When I
  reach my goal weight", default Keep deficit); the offer flips it at the right moment and never by itself. A card
  on Today and a button in the goal's celebration (`MaintainOffer.svelte`, `Celebration.svelte`,
  `client/maintain.ts`, rule `maintainOffer` in `shared/goals.ts`, worked out in the app layout's load). Declined:
  remembered by goal weight on the profile (migrations 0046–0047), exported and imported. A Help answer. Tests:
  `goals.test.ts`, `goals.db.test.ts`, `goals.e2e.ts` (two journeys, both browsers).
- Done: Household → Updates tells admins when a newer version is published (it did not exist before). Off until
  an admin turns on "Check for new versions"; then GitHub's public tag list is read at most once a day, when an
  admin opens Household or More (no background job). The notice links to the updating guide; More's Household row
  says "Update available". `shared/version.ts` (full releases hear of full releases only), `modules/updates`
  (answer kept in `household_settings`, migrations 0048–0049; only admins can store it), route
  `PUT /api/v1/household/update-check`, version from `package.json` at build (`__OBUR_VERSION__`). Tests:
  `version.test.ts`, `updates.db.test.ts`, `updates.e2e.ts` (desktop Chromium only: one installation-wide switch;
  GitHub played by the stand-in through `UPDATES_TEST_URL`). The real tag list was read once from the
  development machine with the same request (beta.8 is told of beta.9; beta.9 and 1.0.0 of nothing).
  It reads tags, not GitHub Releases (the release workflow creates none); past 100 tags it would need paging.

- Done (owner's report, 2026-11-13: "on mobile it behaves as though I am on a very slow connection"; "the headers
  of sections don't line up", also within More). Measured, not assumed: with 150 ms added to every request,
  phone-size Chromium at a 4x slower CPU, every page change took about 205 ms, all of it one trip to the server,
  because both layouts reloaded their data on every page change. The code was not the cause: it is cached and
  read in quickly. Now a page change loads only the page; the layouts' data (`obur:account`, which now also carries
  More's counts and Settings' Goal row) refreshes 250 ms later in the background. Log, More, Settings, Help,
  Appearance, Units, Your data, Passkeys and the new-food form open in about 65 ms there; pages with their own data
  still take one trip. The tab bar marks the tapped tab at once. Service worker: answers before writing its copy,
  builds saved page data up part by part (`shared/page-data-copy.ts`, unit tests), and answers a failed background
  refresh with "nothing new", so it can never replace or reload a page (the first version could; the offline test
  caught it). Every page's code is read in ahead of the first visit. More asks about updates after it opens
  (`GET /api/v1/household/update-check`, `updates.known`). Headers: Today, Log, Progress and Passkeys sat 3–8 px
  off the rest; all titles now share one height, and titles no longer rise with the page (that 8 px rise, on every
  page change, was most of the jump people saw). `app-shell.e2e.ts` checks both. Not yet on a real iPhone.

Checked 2026-11-13 after the three changes: type-check, lint, 1069 unit and database tests, e2e 218 passed (17
skipped by design), image built, smoke test, off-site outage test, and an upgrade from the published beta.9 image
(backup first, migrations 0046–0049 applied). Not released yet; the owner has a question and a request first.

## Owner's reports, 2026-11-13 (released as `v1.0.0-beta.9`, no migration)

Checks before the tag: type-check, lint, 1057 unit and database tests, e2e 213 passed (16 skipped by design). The owner
checks it on their phone after updating.

- Back button: one `ui/PageHead.svelte` on every nested page, an accent "<" beside the title (was a text link above
  it, hand-copied on some pages, a grey circle on Achievements, missing on Help). e2e: `diary.e2e.ts`.
- Celebration: the page behind is held still (no scroll bar showing through); confetti is a small physics pile on a
  canvas (`client/confetti.ts`, unit tests; e2e in `achievements.e2e.ts`): falls in from off-screen, stays, and a
  tap on the background throws it up. Tilt and shake were built and removed (owner, 2026-11-13: too much friction).
- Rolling numbers no longer snap sideways when the digit count changes (`ui/Roll.svelte`).
- Budget card: equal room above and below.

## In daily use since 2026-11-08

The owner imported their LoseIt export on the VPS and uses obur as their real tracker from 2026-11-08; their data
there is real. Cloudflare Bot Fight Mode is off (the free plan cannot exempt one hostname; plain curl to `/login` gets
200). The role-membership warnings are fixed in `main` (108b4b4) and reach the server with the next release.

The owner runs `1.0.0-beta.4` on the VPS (2026-11-08) and confirmed both voice sentences now work; whether to archive
the LoseIt foods is the owner's call as they go. First-day reports (2026-11-08), all fixed and released as `v1.0.0-beta.4` (beta.3 published only its add-on images: the `obur` smoke test failed on a `docker logs | grep -q` race under pipefail, fixed in `deploy/obur/smoke-test.sh`):

- Fixed (voice): a weight-only serving ("40 g", typical of LoseIt foods logged in grams) is proposed in grams ("two"
  of it is 80 g); a food named without an amount is proposed as one serving; the sheet asks for a unit it doesn't
  offer. Tests in `nl-parser/units.test.ts` and `shared/unit-options.test.ts`.
- Added: Your data → "Archive N foods from LoseIt" (and "Bring back"), only the person's own imported foods;
  `catalog.setImportedArchived`, DB test in `catalog.db.test.ts`.
- Fixed: Journal highlight icons now match the achievement badges (40 px); focus outlines inside collapsing rows
  (Check and log's amount field) are no longer cut at the sides (`layout.css`, `.collapse-row`).
- Added: More → Settings (Profile, Goal, Units, Appearance, Reminders, Speak and Scan, Your data, Security); More
  keeps Foods, Recipes, Saved meals, Recently deleted, Household, Help and Sign out. `/settings` → `/more/settings`.
- Decided: LoseIt foods stay (voice fixed instead); the owner can archive them all at once.

Off-site backup on the VPS (2026-11-08): Cloudflare R2, restore check passed from both copies (51 tables, 12,752
rows); the passphrase is in the owner's password manager. Released as `v1.0.0-beta.5` (2026-11-08):

- Household → Backups shows "Last off-site restore check" with its time instead of the ambiguous "Off-site copy: Set up".
- `OBUR_BACKUP_PASSPHRASE` set to the example value (`change-me…`, `a-long-phrase-only-you-know`) stops obur with a
  clear message (`deploy/obur/env.sh`); `OBUR_OFFSITE_PATH` documented in `deploy/.env.example`, troubleshooting and
  the agent guide, with the "is or was the repo encrypted?" error (a bucket left with an earlier install's backups).
- Speak and Scan page: the second card is titled "Scan"; without an add-on, "On this server" says why (members: the
  admin can add it; admins: which add-on, and "Adding Speak and Scan later" in the Docker, Unraid, TrueNAS and agent
  guides). The owner's VPS runs without the add-ons; adding them is the owner's step, data untouched.
- Decided: backup status stays in Household (installation-wide, admins only), not in Your data (per person).

## Owner's reports, 2026-11-09

Agreed and being fixed one commit at a time (`main`, next release):

- Done: an empty Other amount or New weigh-in closes when its check is tapped (`WaterCard`, `WeighIn`; `body.e2e.ts`).
- Done: name fields (food, brand, recipe, saved meal) ask phone keyboards to capitalise each word.
- Fixed: Household's Personal AI keys switch failed more than 10 minutes after signing in. Its route let the
  "recent passkey needed" error through as a 500 (now `respond`), and the page now asks for the passkey
  (`withRecentAuth`). Passkey journey test in `auth.e2e.ts`.
- Fixed: logging several items at once (saved meal, Type it, Speak) highlights every new row on Today, not only
  the first (`highlight` takes a list; `saved-meals.e2e.ts`).
- Changed: a scanned label no longer adds a portion; a per-serving size is kept only as the basis of per-serving
  values (owner: every scanned portion was wrong). `scan.e2e.ts`, parser notes.
- Fixed: Type it and Speak read fractions ("1/3s of a container", "a third", "two thirds", "⅓", "1 1/2") and
  a portion named by its own word ("2 cups" → the food's "Cup"). Parser cases in `fixtures.ts`, `units.test.ts`,
  `typed-entry.e2e.ts`. "2 × Cup" on Today stays as it is (owner, 2026-11-09).
- Fixed: signing in on a new device with a chosen app icon asked for the passkey twice (the account's icon arrived
  on the sign-in page, which reloaded for the Home Screen icon). Sign-in now loads Today once, the button busy
  until it arrives; `/login` forwards a signed-in visitor to Today. Journey test in `auth.e2e.ts`.
- Changed: Help has no topic chips; answers slide open and shut (`help.e2e.ts`).
- Changed: Today's Activity pill has a flame in the accent colour, so it reads as a button.
- Added (was in the approved demo, missed in the build): tapping an earned badge replays its celebration
  (`achievements.e2e.ts`).
- Added (owner agreed 2026-11-09): the sidebar logo follows the chosen app icon (transparent, the O in its colour,
  light and dark); the sign-in page shows the chosen icon. `app-icon.e2e.ts`.
- Changed (owner approved in the review page): Scan opens as a sheet over Log, Check the label stays a page; the
  "Log it after saving" checkbox and its setting are gone (migration 0045). `scan.e2e.ts`.

- Added (owner approved in round 4 of the review page, after three rejected layouts): Scan inside New food. Foods
  is unchanged (full-width New food, as on Recipes and Saved meals); the Nutrition card has a **Scan label** text
  button on the right of its title (the style of the icon's Change) that opens the Scan sheet over the form and
  fills the Nutrition card in place, name and brand kept; with values already typed it asks first ("Keep mine" /
  "Scan and replace"). The notes replace the hint; the button becomes Show photo. Saving a new food (scanned or
  not) goes to Foods with it highlighted (`?saved=`, shown at the top when not on the first page); nothing is
  logged; a scanned one counts in the scan-correction totals. `scan.e2e.ts`, `catalog.e2e.ts`.
- Added (owner approved, review stop 4): after a scan on New food, Show photo opens the photo in the Nutrition
  card with **Retake** under it, which scans again and replaces the values without asking. Scan label, Show photo
  and Retake carry Log's icons in Scan's ochre square (`ScanAction.svelte`). Kept by the owner: saving a typed
  food also returns to Foods highlighted. At 200% text the button wraps under the Nutrition title
  (`large-text.e2e.ts` caught it running past the screen).
- Test fixes: the busy-scanner test used one stand-in OCR answer for both browsers at once, so one sometimes got
  the other's; each browser has its own photo width now. Scan tests open the sheet at `/log?scan=1` instead of
  relying on `/scan` redirecting.

Checked 2026-11-09: lint, type-check, all Vitest projects, the full browser suite in the Playwright image and the
passkey journeys (1052 Vitest; 209 browser tests passed, 16 skipped by design; no screenshot changed). Not yet released.

Released as `v1.0.0-beta.6` (2026-11-09), with migration 0045 (drops `profiles.scan_log_after`; runs on update).

Found on the owner's server after updating to beta.6 (2026-11-09): obur restarted every minute with "the backup
before the upgrade failed, so nothing was changed" (pgBackRest `[050] unable to acquire lock … obur-archive-1.lock`).
The backup scheduler and the pre-upgrade backup both create the stanza at start-up; with an off-site store the
scheduler holds pgBackRest's lock for seconds while reaching it, and the pre-upgrade one gave up at once. Untested
before because the smoke test and the upgrade check had no off-site store, and beta.5 had no migration. Reproduced
here (beta.5 → beta.6 with an off-site store configured: same error). Fixed in `deploy/obur/obur-backup`: stanza
setup takes turns (`flock`, up to 15 min) and retries a busy lock; the pre-upgrade backup is local only (as if no
off-site store were configured), so an unreachable off-site store can't block an upgrade. Checked: the reproduction
gets past the lock; beta.5 → fixed image upgrades (0045 applied); smoke test passes. Not checked: a working but slow
S3 store (no S3 server here works with pgBackRest). Owner's way back in meanwhile: start once without
`OBUR_OFFSITE_TYPE`, then restore it.

Open (older than beta.6): when the off-site store is unreachable, `archive-push` fails for both repositories, so WAL
stops reaching the local one too and backups wait on it. Needs its own fix (e.g. async archiving with a queue limit,
or pushing to the local repository even when the off-site push fails).

Released as `v1.0.0-beta.7` (2026-11-09) with the backup fix.

The owner updated to beta.7 the same day: it started and is serving (the fixed pre-upgrade backup ran with R2 configured and 0045 applied).

## Owner's questions after removing a member, 2026-11-10

Agreed (owner, 2026-11-10), one commit each, `main`, next release:

- Done: Household → Invites lists only invites still waiting; used, cancelled and expired ones drop off (a used
  one's person is under People). A deleted member's used invite had read "Joined as" with no name.
  `auth.db.test.ts`, `auth.e2e.ts`.
- Done: Deleted accounts is inside the Backups card, says why it exists (a restore must delete these accounts
  again; only the code is kept, not the name), shows who deleted each one, and **Copy list** copies the entries as
  `obur restore finish` takes them. `data.e2e.ts`; `docs/restore.md` and `docs/ui.md` updated.
- Done: deleting an account (a member from Household, or your own from Your data) asks about shared foods only
  when the person shared any, naming them and the count ("Alex shared 2 foods with the household. Keep them in
  everyone's search?" Keep / Remove; it had said "Foods you shared" to the admin), with "Meals already logged
  don't change either way." Counts: `portability.members` (`sharedFoods`) and `GET /api/v1/account`.
  `portability.db.test.ts`, `data.e2e.ts`.

Checked 2026-11-10: lint, type-check, all Vitest projects (1053), the full browser suite in the Playwright image
(209 passed, 16 skipped by design, passkey journeys included). Released as `v1.0.0-beta.8` (2026-11-10), no migration.

The open archiving issue above was fixed on 2026-11-13 (see "Before version 1").

## Current phase

**Phase 2 — LoseIt replacement and early voice**: approved by the owner on 2026-10-30. Phase 1 is complete (deployed on the owner's Unraid, offline behaviour confirmed on the iPhone). The owner uses obur daily since 2026-11-08 (see above); 1.0.0 follows once a few days of use turn up nothing new.

## Design review build

The owner finished reviewing the design on 2026-11-06 and approved recording it and building it in small steps. The decisions are in `docs/ui.md`, "Design review, November 2026"; the reference demos are in `docs/ui/review-2026-11/`. Each step ends with passing checks and a commit, and deploys to the pilot.

1. **Themes and tokens:** the eight themes, the `--fill` token, the corner set, an Appearance theme choice, contrast tests for every theme.
2. **Shared controls:** field menus, rows with menus, unit inside the amount field, the warning card, the checkbox; replace pills and chips.
3. **Navigation and More:** compact More with nested pages, sidebar and icon rail, centred dialogs on wide screens, the 24/12-hour setting.
4. **Today:** budget card, status colours, Water and Weight rows, meal card grid, day titles, Show older in the list.
5. **Day notes:** schema, RLS, export and import, offline rule, card.
6. **Log:** search on top, three tiles, Recent, amount sheet, entry editing, Recently deleted, Type it.
7. **Speak and Scan:** failure states, scan review.
8. **Journal and Progress:** day box, month title return, desktop layout, chart label column.
9. **Signing in and first day:** sign in, set up, join, recovery codes, signed out, budget setup, empty states.
10. **Recipes, saved meals, foods, Your data, Household, Help, reminders.**
11. **Finish label scanning and the leftovers:** a blurry-photo message, a waiting line when the scanner is busy, notes per decision on Check the label; Create it as food keeps what is already in the sheet; a browser test of the voice-off and no-microphone cards; Profile's details as rows into setup; the badge grid on a new account's Progress; New weigh-in on an empty Progress opening in place.
12. **App icon choice** on the Appearance page. The owner picks the icons from a review page first, and checks the fonts against the new themes at the same stop. An iPhone reads the icon when the app is added to the Home Screen, so changing it there means removing and adding the app again.
13. **Offline warnings and a full desktop, dark-mode and 200 % pass,** last, so it covers everything above.

Then the pre-release check (security, accessibility, long Turkish names, restore rehearsal), the owner's real-iPhone pass, and the LoseIt cut-over when the owner chooses.

Owner, 2026-11-07: scan gaps and the app icon choice are in before release, nothing is deferred to after it: "I don't want a half-baked released product." Pounds are skipped for now (owner, 2026-11-07: nobody in the household uses them). Weights are stored in kg, so a kg/lb choice can be added later without touching data; the public README should say the app is kg only until then. If it is added: about 26 files, weight achievements every 5 lb, and the comparison pictures reworded.

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

- Owner's iPhone report, fixed 2026-11-07 (awaits the owner's check on the iPhone; a browser can't open a real keyboard, so the test stands in for what the phone reports): fields under 16 px made iOS zoom (food form values, TimeField, RangeSelect; `ui/field-size.test.ts` now guards every field); empty values looked like warnings, now normal fields with a quiet Unknown; a sheet growing with the keyboard up went off the top, `ui/Sheet.svelte` now fits the visible area and `ui/Menu.svelte` measures from it too (`tests/e2e/sheet-keyboard.e2e.ts`); the serving size's unit lined up with its field, hint under both; Add a food shows Recent before typing. Owner confirmed fixes 1 and 2 on the iPhone, and asked for a search that stays put everywhere and for sheets to keep opening small (see `docs/ui.md`, "A search stays in view"). Done: `pinned` and `resizes` on `ui/Sheet.svelte`, `.pinned-search` on Log, Foods and Help, recent foods loaded with the editor, `catalog.foodsById` in three queries rather than three for each food. Time on the iPhone not measured. Owner confirmed on the iPhone (2026-11-07) that all of it works. Opening a sheet no longer rings the close button: the sheet takes focus itself unless its content took it. A long food name no longer squeezes the close button (it could shrink to 20 px). Owner confirmed on the iPhone and said to move on.
- Design review build, step 11 (started 2026-11-07). Done: Create it as food keeps what is in the sheet (`food/NewFoodSheet.svelte` on top of `log/EntrySheet.svelte`; a closing sheet whose opener is gone hands focus to the sheet below). Notes per decision on Check the label done (`LabelProposal.notes`, `food/ScanNotes.svelte`; checked on the real labels' OCR output). Busy scanner's waiting line done (OCR service reports `ahead`; `RateLimiter.refund`; the scan page retries; the real service's busy reply is untested beyond a syntax check). Blurry photo done (sharpness from the OCR service, threshold 0.16 from 132 measured images, `docs/feasibility.md`; provisional, artificial blur). The scan gaps are closed. Browser tests for voice off (a second test server with no speech or OCR service, `FEATURES_OFF` in `playwright.config.ts`) and for a refused or missing microphone (both browsers) done. Profile's details as rows into setup done (setup's first step saves through the recalculating details route, which now also takes body fat, waist, pregnancy and breastfeeding; `profile/DetailsCard.svelte` removed). New weigh-in on an empty Progress opens in place (`today/WeighIn.svelte`, shared with Today's Weight card). The badge grid on a new account's Progress done: the owner chose (2026-11-07) to add the demo's four as real achievements (firsts `weigh_in`, `day_logged`, `complete_day` and a 3-day streak; migration 0038 widens the level check). Step 11 is finished. Step 12 under way: review round 9 published on the Design Review artifact (2026-11-07): the owner's bowl icon recoloured for each theme (only the background and the O change), keep or drop each, the default, Appearance's icon card, and the fonts in all eight themes; answers in its database collection `review9`. Owner's answers (2026-11-07): all nine icons kept, Pazar the default, the Appearance card as shown, fonts unchanged. Built: `shared/app-icons.ts`, icons from `scripts/brand-icons.sh` in `static/app-icons/`, the `obur_icon` cookie, `/manifest.webmanifest` as a route, the App icon card on Appearance. Owner's iPhone check (2026-11-07): an icon chosen in the Home Screen app didn't carry over to Safari (separate cookies), so the choice now lives with the account (`profiles.app_icon`, migrations 0039 and 0040, `PUT /api/v1/profile/app-icon`, in the export). Second iPhone check (2026-11-07): Safari still added the default icon because the page's head was written only on its first load; and the owner asked for every setting to follow the account and be in the backup. Done: `shared/preferences.ts` (mode, theme, icon, time format, scan's log-after, weight view, dismissed notes) on `profiles` (migrations 0041, 0042), `PATCH /api/v1/profile/preferences`, read by the root layout on every page change, which also renders the icon and manifest links; first load takes over a browser's existing look; in the export. Step 12 is finished. Step 13 started (2026-11-07): offline warnings done (refused-entry card and sheet with calories only, another food and discard, all with Undo; the offline and back-online cards; `restore` on the queue; Log takes `?q=`). Full pass so far: every page swept in phone and desktop, light and dark: no overflow. At 320 px everything works except "Carbohydrate" cut off in the food form. Owner chose (2026-11-07) that "200 % text" means following the iPhone's text size (Larger Text), up to 200 %. Groundwork done: `static/text-scale.js` reads the iPhone's body text size before the page draws and sets the root size (capped at 200 %; elsewhere the browser's own font size); all text sizes are rem (exact conversions, screenshots unchanged); spacing is fixed at 4 px a step. Large text done (2026-11-07): `data-text="large"` from 135 % and the `large:` variant fix every page at 200 % on a 390 px phone (sweep of all 28 pages: no overflow, screenshots checked); tab bar, segmented controls and weekday labels grow less; `tests/e2e/large-text.e2e.ts`. Step 13 is finished, and with it the design review build. Owner confirmed Larger Text on the iPhone (2026-11-07).
- Pre-release check (started 2026-11-07). Security: every table forces RLS (existing test); the request gate, admin checks and recent-passkey checks reviewed route by route; found and fixed: deleting someone's account from Household checked the admin role but not a recent passkey on the server (the page asked, a direct request didn't), now `requireRecent` with a browser test. `npm audit --omit=dev`: two low findings in `deepmerge` through `@sveltejs/vite-plugin-svelte`, build-time only, no fix available. Accessibility: axe (WCAG 2.2 A/AA) on all 25 signed-in pages in light and dark found 5 problems, all fixed: meal "Add food" rows now named "Add food to <meal>", the Journal day box's Open link in the text colour (the orange was 4.37:1 on its fill), Progress's inactive Readings/Smoothed name without the extra fade; `tests/e2e/accessibility.e2e.ts` keeps every page at zero. A keyboard sweep of 11 main pages found every focusable element visible with a focus ring. Long Turkish names: the Today screenshot tests now carry a long Turkish name and brand (desktop page, light and dark, and a phone picture of the meal), wrapping or ending in "…" after two lines as designed; the page sweeps used long names and a long display name on every page in every mode. Next: Restore: the restore check on the owner's server passed from the local repository and from R2 (2026-11-07, `docs/restore.md`); a full live-stack restore is still rehearsed only on the desktop. Owner's decisions on the evidence gaps (2026-11-07): voice released on the current results; labels get a check now instead of new photos; a full live-stack restore is rehearsed on the server by the owner. Label check done (2026-11-07): amber notes for values the OCR was unsure of (confidence under 0.9) and for when the energy check couldn't run, and the energy check from kJ alone; on every saved OCR run each wrong value now has a warning or a note (24 of 31 newly or already, the other 7 on a running-text label that has its own note; `docs/feasibility.md`, "Unflagged misreads"). Live-stack restore rehearsed on the owner's server (2026-11-07, run by the owner, recorded in `docs/restore.md`): latest restore with a marker after the last backup, app closed until finish, passkey sign-in again, marker back, fresh backups to both repositories. The moved-aside folder `/mnt/cache/appdata/obur/data/postgres.before-restore-2026-11-07` can be deleted by the owner. Pre-release check done. The owner skips a separate iPhone pass (issues will be reported as found).
- Distribution (owner's decision, 2026-11-07, `docs/design.md`, "Distribution"): one `obur` container (app, worker, PostgreSQL, backups) plus optional `obur-speech` and `obur-labels`, published from GitHub Actions on version tags, with install guides for a VPS, Unraid and TrueNAS. Steps: 1 decisions recorded (done); 2 the single `obur` image; 3 add-ons renamed and optional; 4 the owner's server moved to it with data kept; 5 guides; 6 release workflow. Remote models (OpenAI, OpenRouter, personal keys) are a point update after release. Steps 2–3 done (2026-11-07): the `obur` image (root `Dockerfile`, `deploy/obur/`: `obur-init` supervises PostgreSQL, the backup scheduler, web and worker as separate users; `env.sh` generates role passwords and Web Push keys into `/data/secrets` on first start; the database listens on 127.0.0.1 only and the administrator signs in only as the postgres system user over the socket; upgrades back up first; a new installation prints a setup link in the log and is backed up at once; `obur setup-link|recovery-link|backup now|info|restore-check|restore start|finish|cancel` via `docker exec`), the add-ons renamed (`labels/`, `LABELS_URL`), and `deploy/compose.yaml` and `.env.example` rewritten for the published images. Verified locally: fresh start (healthy, first backup, archiving), the app user refused as administrator over TCP and socket, clean stop in 0.5 s, restart without changes, restore check, restore start/finish (503 while pending, worker stopped) and restore cancel. Step 4 prepared (2026-11-07): `obur-ctl` rewritten for `obur`, `obur-speech`, `obur-labels` (deploy backs up from whichever layout runs, stops every old container before the new one starts, rollback keeps the database; tests updated), `deploy/unraid/README.md` "Moving to the single obur container" with the owner's root steps and a way back. Rehearsed locally: the previous commit's layout with an account and backups switched to the new container on the same folders (same database, existing Web Push keys kept, old containers removed, restore check passed on the continued backups); and a new server holding only those backups waited for a restore, then `restore start`/`finish` brought the account back. Found: backup labels use local time, so `TZ` must stay the same across a move (documented). The container now waits for a restore instead of exiting when backups exist without a database, and makes `/data` passable for its users. Steps 5–6 drafted: `docs/install/` (overview, Docker/VPS, Unraid with the form or Compose Manager, TrueNAS, remote access, first start, updating, troubleshooting), `docs/restore.md` rewritten for `obur restore …`, `.github/workflows/release.yml` (on `v*` tags or by hand: lint, check, all Vitest projects with PostgreSQL, then the three images, a smoke test of `obur` (`deploy/obur/smoke-test.sh`, passes locally) and push to ghcr.io with the version and `latest`). Not yet run on GitHub. **The pilot deploy route needs the owner's root steps first (README above); the old `obur-ctl` refuses the new source.** Owner, 2026-11-07: no more Unraid pilot; the owner removed obur from Unraid (data, R2 copy, passkeys and the deploy key) and will install afresh from GitHub. The repository is public (2026-11-07; history checked first: no secrets, hostnames or private files). `deploy/pilot.sh` and `deploy/unraid/` (obur-ctl) removed. Test releases (`v1.0.0-beta.N`) publish under their own version only, never `latest`. Release is v1.0.0; before it, the owner wants remote models (OpenAI and OpenRouter, personal keys) designed and built. Actions turned on by the owner (2026-11-07). Remote models designed (2026-11-07, `docs/design.md`, "Remote models for Speak and Scan"; the owner delegated the design). Screens published for the owner as round 10 of the Design Review page (2026-11-07; seven stops: the Speak and Scan settings page, adding a key, the consent sheet, Speak and Check the label with a key, provider failures, a server without the add-ons (pick: the tiles stay and explain), the admin's switch); reference copy `docs/ui/review-2026-11/remote-models.html`, verdicts saved in the page's `review10` collection. The owner kept all seven screens after stops 5 and 6 were redrawn (`docs/ui.md`). Build step 1 done (2026-11-07): module `remote-models` (tables `model_keys`, `model_choices`, `model_usage`, `household_settings`; migrations 0043–0044 with forced RLS: keys, choices and counts are their owner's alone, the household switch is read by all and changed only by an admin), AES-256-GCM keys bound to their owner (`OBUR_SECRETS_KEY`, made by the container), 9 real-Postgres tests. Step 2 done (2026-11-08): `server/providers.ts` (OpenAI and OpenRouter only; key check, transcription, label reading with a strict table schema; OpenRouter limited to zero-retention, no-training endpoints; refusals mapped to key refused / no credit / busy / unavailable; `AI_PROVIDER_TEST_URL` for the browser tests' stand-in) and `label-parser/table.ts` (a copied table laid out as lines and read by the same parser, so column choice, bounds, decimal commas, impossible values, notes and warnings are shared); 10 + 4 unit tests. Step 3 done (2026-11-08): Speak and Scan follow the person's choice (`model-source.ts`: their key when chosen and allowed, else the add-on, else off), with `?via=server` for one recording or photo after a provider's refusal; a provider's busy answer is not counted against the limit; uses counted; remote label readings carry a `read_by` note. Routes: `GET /api/v1/remote-models`, `POST|DELETE /api/v1/remote-models/keys` (checked with the provider before saving), `PUT /api/v1/remote-models/choice` (a provider needs `allowed`), `PUT /api/v1/household/personal-keys` (admins). Step 4 done (2026-11-08): More → Speak and Scan (`more/speak-and-scan`, `ui/own-key/AddKeySheet`, `ConsentSheet`; without an add-on, "On this server" tells a member their admin can add it and tells an admin which add-on, pointing at "Adding Speak and Scan later" in the install guides), Speak and Scan with a key ("With your … key", the read-by note, one-card refusals from `ui/remote-problem.ts` with Replace the key / Record again / Try again with the kept recording or photo, typing as the way on, and the server for one request only when it has the add-on), `NotSetUpSheet` and the Scan notice on a server without add-ons, the Household switch. Browser tests (`own-key.e2e.ts`, both browsers; Speak in Chromium) against the stand-in provider (`speech-stub.ts` plays OpenAI and OpenRouter); a fourth test server without add-ons but with keys; the new page in the accessibility check. Full suite: 200 passed, 15 skipped. Step 5 done (2026-11-08): the Speak and Scan choices (with when a company was allowed) are in exports and imports like reminder settings (`account.modelChoices`, optional); keys and counts never leave the server; account deletion removes keys, choices and counts (portability tests extended). Remote models are built. A goal weight with a budget set by hand done (2026-11-08): More → Goal shows the goal weight row for it (no pace or worked-out budget), saved as a new version; refused for minors, pregnancy and breastfeeding (`goalWeightAllowed`), which the page explains; DB and browser tests. The Help page already existed (2026-10-31); added an answer on using your own AI key. README says kilograms only. First test release (2026-11-08): `v1.0.0-beta.1` failed its checks on GitHub because `.gitignore`'s `models/` hid `src/lib/ui/models/` (moved to `ui/own-key/`, rule narrowed); `v1.0.0-beta.2` passed (checks 2¼ min, images ~3½ min in parallel, smoke test passed) and published `ghcr.io/aloglu/obur`, `obur-speech` and `obur-labels` at `1.0.0-beta.2`, public and pullable anonymously (no `latest` for test releases). Next: the owner installs fresh from GitHub with `OBUR_VERSION=1.0.0-beta.2` (or that tag on Unraid/TrueNAS), imports the LoseIt export, and tries a real OpenAI or OpenRouter key; then fixes from that, and 1.0.0; after it, a goal weight with a set budget and a Help page (owner: both before 1.0.0).
- Owner checked the menus on the iPhone (2026-11-06): they work. Reported missing animations and the page scrolling behind a sheet; both addressed the same day (`docs/ui.md`, "Motion"), the scroll fix awaits a check on the iPhone. Segmented controls are now a tray with a sliding highlight.
- Design review build, step 10 done (2026-11-07). Done: Foods, Recipes and Saved meals lists (`items/ListCard`, `items/ListRow`, `catalog.ownFoods`, `GET /api/v1/foods?mine=1`), counts on More, the recipe and saved meal editors (`items/EditorHead` with the … menu and confirmation under the title, `ActionMenu` shared with the meal card, ingredient rows opening in place, "Update to current food values" shown only when `anyValuesChanged`). Food editor done (`food/FoodForm.svelte` as cards, also used by Check the label). Your data done (one "To add" list with what's already here as small print under a row, `ui/Switch.svelte`, the LoseIt preview now reports the first weigh-in so the unit can be judged; the demo's percentage bar is not built because the import is one atomic request, so the button says Importing…). Household, Reminders (`ui/TimeField.svelte`, `Switch` with `bare`) and the Help answer for notes done, so step 10 is finished; **step 11 (label scanning gaps and leftovers) is next.** Help's quick-add answer now says Log calories only. Owner confirmed (2026-11-06): no key on the Journal calendar, with a Help question and example rings instead (done, `progress/DayRing.svelte`); keep "Set a number yourself" in setup, Maintain and the 1 kg pace on the Goal page, average water on Progress's Calories tab, and the note rather than a stretched scale for a far goal. Step 9 (signing in and first day) done: sign in, Set up, Join, Recover, recovery codes, the signed-out card (`client/offline/waiting.ts`), budget setup in three steps with `ui/UnitField.svelte`, the welcome card ("Just log" saves a `none` target, so it stays gone on every device), Profile's optional budget card, the Goal page (`/more/goal`, with pace and goal weight added to `PATCH /api/v1/targets/settings`), and empty Journal and Progress. Profile's details are still the inline form rather than the demo's rows into setup, and Progress keeps its Achievements row rather than the demo's badge grid on a new account; New weigh-in on an empty Progress goes to Today rather than opening in place. Also still to add to the plan: the pounds option and the app icon choice. Step 8 (Journal and Progress) done: `journal/DayBox.svelte`, the travelling highlight and sliding months in `progress/CalendarMonth.svelte`, the month title as the way back to today, one column on desktop. Progress has tabs on every size and one card, the headline as the readout (`onlook` from the charts, with a screen-reader live line kept), our own axis marks in a right-hand column inside LayerChart's frame, a clip-based line draw-on (dash-based can't coexist with the dashed gaps), rising bars. The Journal key is gone as in the final demo, and Help explains the ring colours. Kept against the demo: the water row, the stripes on over-budget bars, and the rule that the goal never stretches the weight scale (a note gives the distance instead). Step 7 (Speak and Scan) done: compact item rows in `log/EntrySheet.svelte` that open to edit, Not sure (from the search's typo-tolerant match, `FoodSearchResult.loose`), food not found with three ways out, failure cards with Try again and Type it instead, Speak off as a dismissible grey card with the tile gone, the Scan page with a frame, failure cards with Fill in by hand, and Check the label with the photo one tap away. Not built: the notes per decision on Check the label (the server sends no decisions), a blurry-photo state (nothing detects it), and a waiting line with a message for a busy scan. Create it as food leaves the sheet, so anything else in it is lost. A match that ignores some of the words also asks Not sure (owner left it to me, 2026-11-06). Step 6 (Log) done: search on top, three tiles, Recent always visible and fitted above the tab bar, Type it (`log/EntrySheet.svelte` reads the sentence as it changes; the meal follows the text), Log calories only kept for search misses and for no connection, the amount sheet with `log/FoodSheetHead.svelte` and rolling preview, editing as the same sheet (No changes, Move to a meal, Save changes), Recently deleted (`/more/deleted`, `diary.trash`). The item cards in Type it and Speak are still the older layout; the demo's compact rows come with step 7. Step 5 (day notes) done: `day_notes` table with forced RLS (migrations 0036 and 0037), `diary.dayNote` and `saveDayNote`, `POST /api/v1/diary/days/:date/note`, pure `shared/markdown.ts` rendered as elements by `today/NoteBody.svelte`, `today/DayNoteCard.svelte`, offline through the same per-account queue, export and import. A note the server refuses leaves the queue (no review sheet for notes). Not done: a Help answer for notes, in step 10. Step 4 (Today) done: budget card with status colours and Activity chip (`shared/goals.ts` budgetStatus), `ui/Roll.svelte` rolling numbers, compact nutrients, Water and Weight on a shared four-row grid with `today/WeightSpark.svelte`, inline fields (`client/inline-field.svelte.ts`), one meal card with Add food rows and Save as a meal in the … menu, day titles (`shared/format.ts` dayHeading), ←/→ keys, Show older as the end of the list, activity shortcuts. The desktop Log panel is gone from Today, so all logging goes through `/log`; the sheets it held were removed from the page. Step 3 (navigation and More) done: one nav with More on phone and desktop, icon rail from 760 px and labels from 1100 px, `/settings` redirects to `/more`, compact More with `/more/appearance` and `/more/units`, the Time setting (device, 24 or 12-hour; a cookie, used by the readings sheet), sheets as centred dialogs from 760 px, `ui/MenuRow.svelte`. Not built yet from this part of the review: the pounds option (Weight shows kg as plain text; pounds touch every weight in the app and need their own step), app icon choice, the Goal page (Goal stays in Profile until step 9), counts on the Foods, Recipes and Saved meals rows, Recently deleted (step 6). Keys ←/→ for days come with Today in step 4. Needs a real iPhone check: `ui/Menu.svelte` uses the Popover API (iOS 17 or later). Step 2 (shared controls) done: the corner set, `ui/Menu.svelte` (top-layer popover; needs iOS 17 or later), `ui/Select.svelte` rebuilt on it, `ui/Notice.svelte` as the one warning card, one app-drawn checkbox in `layout.css`, no fully rounded controls left. Also done: `ui/DayMealFields.svelte` and `ui/AmountField.svelte` in every sheet. Rows with menus come with their pages in step 3, so step 3 is next. Step 1 done: `ui/themes.css` holds the seven extra themes (generated once from the reviewed palettes; bar colours nudged only as far as the 3:1 test needs, kilo inks chosen per theme), `shared/themes.ts` lists them, `--fill` colours filled buttons, the palette is a cookie rendered by the server (`data-palette`), and More/Settings has a temporary picker until the Appearance page in step 3. `themes.test.ts` checks every theme in both modes; the review's own check had missed Sade's accent on soft (4.49), now fixed.

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
2–3. Dropped by the owner (2026-10-31): the 10-second logging check and the desktop "+" check are not needed.

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
6. Cut-over (owner, 2026-10-31): only when obur is ready for production release, which the owner judges still some
   way off; do not ask for a date. The day to stop logging in LoseIt. On that day, a final LoseIt export imported into obur adds only the
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
Typed-entry gap list: nothing open. Phase 2 work is complete (phone checks dropped 2026-10-31); cut-over waits for production release.

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
use the stand-in service (answers keyed by photo width so the two browsers don't race). 

Step 4 done: held-out evaluation (parser 7884d6f, 12 photos, truth read by hand first, scored once):
61% right, 14 wrong, 27 missing, basis 8/12 (docs/feasibility.md, "Label scanning, held-out evaluation"). Not
shippable; the owner has not yet copied the OCR server files, so Scan is still off on the server (keep it so until
the wrong values are fixed). Truth: `~/obur-private/labels-prepared-heldout/ground_truth.tsv`; OCR output:
`~/obur-private/results/ocr/heldout-B-1280-service.jsonl`. Next: an improvement round (explicit energy units;
value lines belonging to no row; two-line names; basis from the title; the Scan screen must not assume a basis),
treating these 12 as development data; then a fresh held-out set from the owner.

Improvement round done (2026-10-30, docs/feasibility.md): new photos 61% → 77% right, wrong 14 → 3 (all OCR
misreads; all on labels that show a warning), basis 12/12; Phase 0 set 84%, 1 wrong (OCR "7,8" → "8"). 15 parser
unit tests; energy check counts "less than" at its bound; Scan says when the basis is unknown. The owner has no 10
new products for a fresh held-out set: offered (a) counting how many proposed values are changed before saving (counts
only, needs the owner's OK), (b) a friend's kitchen, (c) new purchases over time. The owner copied compose.yaml and obur-ctl
(2026-10-30); deployed with the OCR service (healthy), so Scan is on for testing. Final accuracy check (owner,
2026-10-31): no outside people; both (a) and (c). (c) the owner photographs labels of newly bought products into
`~/obur-private/labels-heldout-2/` (do not look until the owner says about 10 are there; likely after launch), then
score once. (a) count how many proposed values are changed before saving (counts only): built 2026-10-31 (migrations 0030–0031, `shared/scan-edits.ts`, Household "Label scans" totals for admins; 4 unit, 4 real-Postgres and 2 browser checks incl. an untouched save recording zero edits). Next: batch 2 features (Profile details, editable macro targets, saved meal
editor), then the budget circle alternatives Artifact.

## Phase 4 (owner approved the order 2026-10-31)

Order: history (charts and averages on Progress) first, then bulk actions and drag-and-drop, reminders,
achievements; imported-activity credit last (likely low value). History needs a visual direction: three layouts
(A summary first, B tabs per topic, C chart first with difference bars) published as a private Artifact
(2026-10-31; link in the session) with a pick, notes per option and four questions saved in its `notes` collection.
Owner's answers read (2026-10-31): B on phone with the range as a dropdown beside the tabs; desktop all cards side by side like A; trend plus points; bars against the budget line; averages over complete days only. Recorded in `docs/ui.md` and `docs/design.md`. Steps: 1 docs (done); 2 pure rules in `shared/history.ts` (done: ranges by calendar month, trend, bars, averages; 11 unit tests); 3 range data and loader (done: `diary.dailyHistory` with per-macro missing counts, `diary.firstDay`, `body.waterByDay`, `body.firstWeightDay`, `server/progress-history.ts`, `?range=` on /progress; 3 real-Postgres tests incl. isolation); 4 screen (done: LayerChart 2.8.0 for frame, scales and y axis, own marks in `ui/progress/WeightMarks` and
`CalorieMarks`; `HistorySection` with phone tabs and desktop cards, panels built only when shown so charts measure
their width; `RangeSelect`; the old raw weight list removed; the history browser journey on both projects; desktop
calendar screenshot regenerated for the two-column page). LayerChart adds two low npm audit entries, both through the
existing dev-only SvelteKit `deepmerge` chain (22 → 24 before/after). The first deploy failed at `npm ci`: Node 24.11's bundled npm 11.6 misreads the lockfile written by npm 11.19 (optional peer entries via `runed`); the Dockerfile's build stage now installs npm 11.19.0 first (verified with a local image build). Next after recording: then build (LayerChart, `progress` module queries over diary snapshots and target
versions). Independent work meanwhile: the label-scan edit counting (approved, above).

Weight views (owner, 2026-10-31): the first trend (plain smoothing) read 2 kg heavy on the owner's history, so the
Weight card now has Readings (raw weigh-ins, default) and Trend (damped Holt, tuned in docs/feasibility.md); no
softening of ups and downs. Later idea from the owner: a help / FAQ section (in Settings or its own page) on using the
app and how things are calculated, including the trend.

Weight card height (owner, 2026-10-31): fixed across Readings/Trend; on desktop equal to the calendar's. Test flake
found and fixed: a fresh browser's first load set the time-zone cookie and refreshed the page's data; a full
navigation during that refresh made SvelteKit reload the old page and cancel it (affects only whole-page navigations
in the first moment after app start, so real use is barely touched). `signedInAs` now sets the zone cookie; the full
browser suite then passed three runs in a row. Trend settings also checked on simulated histories (owner agreed, 2026-10-31; docs/feasibility.md): they hold up, no change.

Bulk diary actions (Phase 4, next): demos published for the owner as a private Artifact (2026-10-31; link in the
session): A meal "…" menu (select, move/copy/delete meal), B long-press to select (Select in the edit sheet as the
alternative), C a day-level Select with Select all per meal, E drag on the phone (a grip on each entry lifts it at once, the rest of the row scrolls; added at the owner's request), F hold an entry, then let go to select or move to drag (no grip; owner's request); shared Move to / Copy to sheet (day and meal) and Delete
with Undo; desktop drag between meal cards. Picks, notes and three questions (copy yesterday's meal, stay or go after
moving to another day, drag copy/move) are saved in its `notes` collection. Owner's answers (2026-10-31): **F** on the phone ("instant pick"; the selected row's background needs room around its contents); no "copy yesterday's meal" shortcut; stay on the day after moving or copying elsewhere; desktop drag always moves (copy through the menu). Desktop note: consistent with F, **no grip on hover** (rows are narrow), maybe a hover effect on the row, to be demoed before building. Round 2 published on the same Artifact (top of the page): drag starts at once or after a hold like the phone; hover tint, lift or dashed outline; Ctrl/⌘-click selects; choice saved as `desktop-choice` in `notes`. Round 2 choice: hold first (as on the phone), tint on hover. Built 2026-10-31: `diary.bulk` (place/copy/delete/restore, 4 real-Postgres tests incl. isolation and atomicity), `POST /api/v1/diary/entries/bulk`, `client/hold-drag.ts`, MealCard … menu (`MealMenu`), `SelectionBar`, `BulkSheet`, one-time tip; browser journey `bulk.e2e.ts` on both projects (hold-select, move + undo, hold-drag, copy meal to yesterday, delete meal + undo, Ctrl-click). Needs the owner's iPhone check of the hold and drag (Safari's own press-and-hold behaviour).

Reminders (Phase 4, 2026-10-31; owner: the three suggested kinds, only when missing, specific wording, native time
pickers, build directly): `shared/reminders.ts` (due rule, 5 unit tests), `modules/reminders` (migrations 0032–0033,
`app_reminder_candidates()`, 8 real-Postgres tests incl. isolation, dedupe, gone devices, disabled accounts, worker
without identity), worker `send-reminders` every 5 minutes with web-push 3.6.7, `npm run push:keys`, service worker
push and click handlers, Settings → Reminders page, export/import of settings, sign-out unsubscribes; browser test on
both projects. Error classes no longer use parameter properties (Node type stripping in the worker), with a lint rule.
First server deploy: the worker crash-looped (`drizzle-orm` was a dev dependency, pruned from the image, and the worker now imports modules); moved to dependencies, verified by loading the worker inside a local image build. Keys set in the server's `.env` by the owner (2026-10-31); the server's hand-copied `compose.yaml` still lacks the `VAPID_*` lines, so the owner copies it (deploy/unraid/README.md), then redeploy. **Owner action needed:** generate keys with `npm run push:keys` on the desktop and put the three lines in the server's
`.env`, then redeploy; then turn notifications on from the installed app on the iPhone and check a reminder arrives.

UI round (2026-10-31, owner's iPhone): top of phone pages clear of iOS's status-bar blur (+12 px), portion row fits
on phones, Readings/Trend switch moved into the headline row (deployed c21b69e). Owner still finds the switch off:
seven placements published as a private Artifact (link in the session; picks and notes in its `notes` collection).
Committed but not deployed yet: shared form `Select` (owner: one dropdown convention). Round two picked T2 (the label is the switch); built and deployed with the dropdown change.

Remaining work (owner, 2026-10-31): design first, as separate mock-ups on one Artifact page: achievements, a Help /
FAQ page, a Progress timeline (built only if the owner likes it). Then Units and formats, Help, a pre-release pass
(security, accessibility, long Turkish names, restore), and the cut-over import. Mock-ups published (one private Artifact, three tabs; link in the session; answers in its `notes` collection, docs `ach`, `help`, `tl`): achievements (moments A toast / B card glow / C banner; collections 1 strip / 2 road to goal / 3 badge page; which kinds), Help (search, topics, real answers; optional "?" links), timeline (A day cards / B running line / not now). Kept in mind, not scheduled: Phase 5
(entry-point profiles, Unraid template, catalog exchange), full offline editing, counting imported activity.

Design settled (owner, 2026-10-31, five rounds): achievements (every 2 kg to 120 with comparisons, toast then
full-screen celebration, flat circles with tint deepening every 10 kg, only the next weight and streak mark shown),
a Journal tab (calendar plus that month's highlights), and a Help page with no inline links. Recorded in docs/ui.md
("Achievements, Journal and Help") and docs/achievement-comparisons.md. Owner approved the build plan (Journal,
then achievements, then Help) and three defaults: start weight is the earliest weigh-in on record (imported history
included); past milestones are awarded quietly with their real dates; the badge page opens from an "Achievements"
row on Progress and from an achievement in the Journal.

Step 1, Journal (2026-10-31): `/journal`, a fifth tab between Log and Progress; the calendar moved from Progress
(old month links redirect); `shared/journal.ts` builds the month's weeks and highlights (new lowest weight, budget
change, first day logged). Today's screenshot baselines regenerated for the five-tab bar and reviewed.
Step 2, achievements (2026-10-31): rules in `shared/achievements.ts`; the `progress` module keeps the
`achievements` table (migrations 0034–0035, forced RLS) in step with the records on every page change (the app
layout's load) and on the badge page, Progress and Journal. Toast and full-screen celebration, badge page
`/achievements`, Progress row, achievements in the Journal, first voice log noted when a heard entry is saved.
Validation: 592 Vitest tests (rules, real-Postgres sync, privacy, tint contrast) and the e2e suite; one full e2e run
had two phone-webkit failures (`achievements` and `goals` "day totals" tests) that did not recur in three further
full runs or 45 targeted repeats; cause unknown, so watch for it.
Known limits: weight achievements need a calculated target with a goal weight below the start (a manual budget has
no goal weight, so they stay off and the page says so); pounds not handled until Units and formats exists.
Step 3, Help (2026-10-31): `/help` from More, 14 answers in six topics, accent- and Turkish-insensitive search;
the icon credit now covers the achievement pictures. **Next step:** Units and formats (pounds would also settle the
"Pounds lost" step), then the pre-release pass (security, accessibility and 200 % text, long Turkish names, restore
check) and the cut-over import when the owner chooses.

Owner's notes (2026-10-31, evening, after trying the deployed build). **Do these first, next session.**

1. Achievements on Progress: replace the "Achievements" row with a card of its own showing the most recent
   achievements, grouped by category.
2. Tapping an achievement on the badge page opens its full-screen celebration.
3. Remove "Profile and goals" from the Settings/More list (Profile has its own entry).
4. Reorder the Settings/More rows into a more sensible order (propose one).
5. Help: remove the topic chips under the search.
6. Back buttons on settings sub-pages go to Today instead of back. Owner's options: a back button styled like
   Today's previous-day button that really goes back, or a redesign of Settings. If a redesign, show demos in an
   Artifact first. Decide with the owner.
7. Open sheets/modals must lock scrolling of the page behind, on desktop and phone (e.g. "Change icon" on the Edit
   food page). Probably one shared fix in `Sheet.svelte`.

Owner asked where the goal weight is set: it appears only with a calculated budget (budget setup in onboarding,
and Profile → Details → Edit). A budget the person sets themselves has no goal weight field, so weight
achievements stay off for it. Open question: offer a goal weight with a manual budget too (it would also feed
achievements and the goal line on the weight chart)?

Owner to check on the iPhone when convenient: the achievement toast and celebration (next 2 kg mark), the
five-tab bar, the Journal.

## App icon (2026-10-31)

The owner's artwork in `assets/brand/` (MIT, owner's choice); home-screen icons, Android maskable icon, light/dark
logo on sign-in and the desktop sidebar, tab icon (docs/ui.md, "App icon"). Desktop Today screenshots regenerated
and reviewed. iPhones keep the old home-screen icon until the app is added to the home screen again.

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



- Test phone: iPhone 13, iOS 27.0.1. Second authenticators for recovery tests: two YubiKeys.
- Pilot hostname chosen (a subdomain of the owner's domain); recorded only in the owner's `.env`, RP ID is the parent domain.
- Home server OS, Docker availability and exact CPU/storage (design assumes a 2-core/4-thread i3 with 16 GB RAM).

## Repository

- Private GitHub repository `aloglu/obur` (created 2026-10-29), remote `origin`, branch `main`. Push after each commit so the off-machine copy stays current. The rules about private data and real hostnames still apply as if the repository were public.
- No hosted CI (owner decision, 2026-10-29: the account's Actions allowance is nearly used up). GitHub Actions is disabled in the repository settings and there are no workflow files; do not add any without asking. Checks run locally before every deploy: `npm run check`, `npm run lint`, `npx vitest run`, `npm run test:e2e`.

## Next features under discussion (2026-10-30)

- Barcodes (Phase 3): explained to the owner (barcode read on the phone with a bundled open-source reader, since iOS
  Safari has no BarcodeDetector; household products only, no outside lookups; unknown barcode leads into the label
  scan and is attached on save). **Scratched (owner, 2026-10-31, second decision):** only worth it if obur is ever published on the app stores, where user scans could build a product database. Earlier note: **Not building (owner, 2026-10-31):** without an outside product database a barcode
  only finds foods the household already saved, which search with recent foods already finds quickly; the reader,
  camera work and iPhone testing cost more than that saves. Revisit only if real use shows packaged products are slow
  to find. Workflow agreed if revived: live viewfinder in Scan; one match opens its amount sheet, several give a list;
  unknown leads into the label scan and the barcode is attached on save; typed digits as a fallback.
- Food icons: the owner chose OpenMoji (2026-10-30: "looks better than the rest"). Step 1 done: 134 OpenMoji 15.1.0
  food and drink icons in `static/icons/food/` (minified, 0.36 MB, licence file; CC BY-SA 4.0 for the icons only) and
  `shared/food-icons.ts` (English and Turkish words per icon; `suggestIcon` takes the match nearest the end of the
  name, Turkish suffixes and k/p/t softening, English plurals; 92% of the owner's 251 logged food names get a
  suggestion). Step 2 done: `foods.icon` (migrations 0028–0029: format check, update
  grant), FoodInput/FoodDetail/search and recent results, diary snapshots (`icon`, display only), archive (optional
  field). Step 3 done: `FoodIcon` (light tile in both themes, `--icon-tile`), in meal
  cards, Log results, Foods list, saved meal and recipe item lists; `IconPicker` in the food form; OpenMoji credit at
  the foot of More. e2e: suggestion, picking in Turkish, chosen icon carried to the meal card. Recipe editor picker done
  (2026-10-31; `icon` in the recipe save; DB, portability and recipe e2e tests). Food icons done and deployed
  (2026-10-30, 53330c0). Earlier note: an icon per food, suggested from the name, shown in rows. The owner rejected Fluent
  Emoji, Twemoji and Noto as ugly and likes OpenMoji's style. Comparison Artifact of OpenMoji-like sets (OpenMoji 35/35
  foods; Emoji One 31; Firefox OS 23; IconPark 22; with icons Sticker/Pastel 21; Streamline Emojis 20; Streamline
  Ultimate 11; licences noted) published for the owner's pick; the link is in the session. Icons are bundled into the
  app (no runtime fetching); the set's licence needs a credit line (OpenMoji: CC BY-SA 4.0 for the icons only).
