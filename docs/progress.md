# Progress

Resumable status for obur. Update before each commit. Design: `docs/design.md`; working rules: `CLAUDE.md`.

## Second 1.0 audit (owner's go, 2026-11-21)

The owner's outside audit of rc.6: `~/Documents/Obur-1.0-Audit-Codex.md` (not in the repository), items A01-A50.
Owner's choices: A02 keep the setup link in the log, plus a warning not to share logs before setup and a log line
once it is used; A36+A37 update PyAV and ship a licence notice for its FFmpeg (treated as GPL: it includes x264);
A49 keep about 5 weeks of backups (`OBUR_BACKUP_KEEP_WEEKS`) and correct the design; A28 no zoom stays.
Judged wrong: A24 (`isLateNight` is used by the amount and saved-meal sheets). Skipped by my judgement: A11 (the
queue sits beside the unencrypted database in /data), A35 (seconds, only on a failed publish), A40 (later), A45
(as R-audit). Documentation only: A09, A33, A42, A48, A50. A43 changes Today's look: screenshot review first.
Order: data-loss and privacy fixes, then small fixes, then documents; one commit each.

- A03 done: every upgrade of an existing database takes a backup first, also with no local repository (it is set
  up again; the backup is then full); a repository that can't be used stops the upgrade. Smoke test: backups
  removed, one step pending → full backup, then ready.
- A04 done: `obur restore start` writes and syncs where the database goes before it moves it; `cancel` and a
  retried `start` handle a note whose move never happened (the database is still in place, never removed). Smoke
  test covers cancel in that state.
- A16 done: LoseIt's "move to the trash" counts a row missing only within its own kind's dates in the export (a
  kind the export doesn't hold marks nothing). Database test fails without the fix.
- A15 + A17 done: a preview returns `confirm` (hash of file, options and planned summary); import needs it and is
  refused with `plan_changed` and the new preview when the plan inside its transaction differs. The page shows the
  new numbers, and the finished line uses the counts the import reports. Found by the browser test: an older
  preview answering last replaced a newer one (unit changed quickly); now only the newest counts, and Import
  waits for it. Settings (reminders, model choices) are a counted kind. Database tests (stale and missing
  confirmation, two imports at once, settings only) and data/Turkish browser tests pass.
- A01 + A22 done: when the account's data refreshes with someone else signed in, the tab forgets prepared pages
  and reloads, and keeps the earlier account's header until then (anything still on it is refused, never saved
  for the new person). A day note keeps the time it was typed across retries, and takes a newer saved note from
  the page's data when no words wait. Browser tests (Chromium: they hold back the service worker's requests) fail
  without each fix.

## Release-readiness audit (owner's go, 2026-11-20)

The owner's audit of rc.5: `~/Documents/Obur-1.0-Release-Readiness-Review.md` (not in the repository), items R01-R15.
Owner's choices: R12 A (an older version refuses a newer database and points to the backup taken before the
update), R06 A (unpack imports in parts, one import at a time, in the web app), R13 A (keep the preparation; fix
stale data after a session ends elsewhere or the connection is lost; make the page code list automatic).
Skipped by my judgement, told the owner: development-only npm advisories; a permanent image scanner (one scan by
hand after R04); R15 only removes unused queue code and test files from the image.
Order, one commit each: R02, R01, R04, R03 (+R11 release record), R08, R05, R07, R09, R10, R12, R14, R15, README
and licence, R06, R13. Real-phone checks stay with the owner.

- R02 done: `model-source.ts` `requestSource`: "Read this one on obur's server instead" uses the add-on or fails
  ("unavailable"), never the person's provider (unit test).
- R01 done: a new server with an empty database folder and only the off-site copy waits for a restore ("the
  off-site copy has backups"), and also while the store can't be reached (looks again each minute); the scheduler
  takes no backup while a restore is pending; `finish` moves aside a local repository made for another database.
  `deploy/obur/offsite-restore-test.sh` (fails on rc.5's image, passes now; in the release workflow). Smoke,
  off-site outage and upgrade-from-beta.19 tests passed on the new image.
- R04 done: Node 24.22.3 and PostgreSQL 18.7 (image, release workflow, development database); Node's own npm
  (11.19.1) reads the lockfile, so the separate npm install is gone. Migration 0061 rebuilds the food search GIN
  index once (18.7 notes: GIN bugs could point entries at wrong rows). The notes' warning about incremental backups
  is about PostgreSQL's own (`pg_basebackup --incremental`), not pgBackRest's, which obur uses. Checks: Vitest 1196
  passed on 18.7; image smoke, off-site outage, off-site restore and upgrade from beta.19 passed.
- R08 done: sign-out counts old entries still waiting as well as refused ones (`unsentOld`) and asks before it
  discards them. Browser test (Chromium) fails without the fix.
- R05 done: every page and API answer without its own rule gets `Cache-Control: private, no-store`
  (`hooks.server.ts`); code files keep `immutable`. Browser test; install guide says not to cache every response.
- R07 done: forwarded addresses are believed only from loopback, Docker's 172.16.0.0/12 and the machine's own
  networks, or only from `OBUR_TRUSTED_PROXIES` when it is set (validated at start; `config.trustedProxies`). Unit
  tests found `10.0.0.0/` read as "everything"; fixed. Install guide and `deploy/.env.example` explain the setting.
- R03 + R11 done: image jobs only build and test (no registry write); add-ons get `deploy/addon-test.sh` (healthy,
  "250 kcal" read from a drawn label, one second of silence transcribed; both passed locally). A Publish job runs
  only after all three: it loads the tested images, pushes the version, checks all three can be pulled, then moves
  `latest` (full releases only), then makes the GitHub release. The update notice reads GitHub's releases, not tags
  (unit and browser tests). actionlint clean. Not run on GitHub yet (needs a tag; ask the owner first).
- R09 done: restore guide and Docker guide say to keep `data/secrets/obur.env` off the server, where it goes on a
  new server, and what happens without it (AI keys entered again, reminders turned on again; both handled already).
  Install and agents guides list R01's two new waiting lines.
- R10 done: the two translation plugins come from npm at exact versions (4.6.0, 2.4.3), not a CDN; `npm run i18n`
  (`scripts/i18n.ts`, also run by `npm run build`) fails when a plugin doesn't load (checked by removing one).
  Compiled with no network in a container: 0 warnings. Release workflow actions pinned to full commit SHAs.
- R12 done: Docker's health check asks `/api/v1/health` (a query as the app's role; 503 when it can't). An obur
  older than its database logs "this obur is older than its database … it does not open" and waits, changing
  nothing (owner's choice A); updating guide says: start the newer version, or restore the backup from before the
  update. Smoke test checks both (role refused → 503; a fake newer migration → waits; removed → ready). Smoke,
  upgrade from beta.19 and off-site restore passed.
- R14 skipped after measuring: achievement sync with five years of records (1825 weigh-ins, 1825 complete days,
  9125 entries) takes 5.3 ms median, 7.2 ms max, and runs after the page shows. Not a practical cost.
- R06 done (owner's choice A): reading an import (obur or LoseIt) and compressing an export run in a worker thread
  (`archive-thread.ts`, `archive-worker.ts`), one at a time on the whole server; the database work stays on the main
  thread in one transaction. Measured, 30,000 entries: reading took 753 ms of the main thread; with the thread the
  longest main-thread pause during the whole preview was 48 ms. A zip that understates its sizes can't unpack more
  than it declares (fflate stops at the declared size; probed), so the declared-size limit already bounds memory.
  Not done, judged impractical: counting bytes while reading JSON and media bodies (the adapter already stops any
  request over 21 MB, and only signed-in members can send them).
- R15 done: the old queue's unused `add` and `has` are gone, three comments no longer describe offline saves, and
  the image leaves out test files and drizzle-kit's snapshots (1087.8 MB to 1081.6 MB; migrations need only the SQL
  and journal). Smoke, off-site outage, off-site restore and upgrade from beta.19 passed on it.
- R13 done (owner's choice A): the page code list is made by the build from src/routes/(app) (`shared/app-pages.ts`,
  `__APP_PAGES__`; the hand list had missed seven pages; onboarding left out). The service worker uses no prepared
  page when the device is offline or after a failed request, and drops them all after any answer without a session
  (`x-obur-no-session`; signed-out page data is answered by the session hook itself, since a thrown redirect never
  reached the header). Two browser tests (Chromium), both fail without the fix. The 45-second refresh stays (idle
  load judged impractical).
- Final checks on `896a385` (2026-11-21): lint, type check, build; Vitest 1199 passed; full browser suite (phone
  WebKit and desktop Chromium, Playwright image) 295 passed, 22 skipped by design; image built, smoke, off-site
  outage, off-site restore, upgrade from beta.19 and both add-on tests passed. Not run: the release workflow on
  GitHub (its new Publish job needs a tag; ask the owner), real-phone checks (owner).
- Release 1.0.0-rc.6 tagged on the owner's go (2026-11-21); agents guide checked (new waiting and older-version
  lines, `OBUR_TRUSTED_PROXIES`). Release run 44823369550 passed every job; Publish pushed the three images (all
  pullable), skipped `latest` (a test release) and made the GitHub pre-release. GitHub warns that three actions still
  target Node 20 (run on Node 24 for now). **Next step:** the owner's hand checks (`~/Documents` checklist, rc.6).
- Owner's rc.6 notes, built on the owner's go (2026-11-21), unreleased: (1) the icon line says "Suggested" (was
  "Suggested from the name", which wrapped); (2) Progress's range uses the shared Menu, not a native select, so a tap
  elsewhere only closes it; `swallow-press.ts` now also stops the press itself and its moves and release, which the
  charts follow (browser test holds a press on the chart: fails before, passes after); the closed header is
  pixel-identical before and after (phone and desktop); (3) toasts (also the achievement toast) swipe away sideways
  or down (`client/swipe-away.ts`), the timer stops under a finger, and a Dismiss button shows only to the keyboard
  (owner's choice B). Checks: type check, lint, Vitest 1198 passed, full browser suite 301 passed, 22 skipped.
  Owner follow-up: the range's tray clashed with the tabs; it now looks like a settings row's value (muted text and
  arrow, no tray), with the title still at 32 px (phone) and 20 px (desktop).
  **Next step:** the owner tries the swipe on a real phone, then the rest of the rc.6 checklist.

## Offline support removed, search rule replaced (owner, 2026-11-20; before rc.5)

Owner's go, with two conditions: real technical debt goes away, and no speed loss a person can feel (a slowdown
of about a second stops it). Plan, one commit each:
1. Design written: `docs/design.md` "Connection required" and "Search rule", `docs/ui.md` (connection screen,
   one-release card for refused old entries), CLAUDE.md. **Done; waiting for the owner to read it.**
2. Measure first. **Done** with `tests/e2e/speed.e2e.ts` (only with `OBUR_SPEED=1`; run with `--workers=1`):
   a second built server behind a delay proxy (150 ms round trip, about 10 Mbit/s), every request included;
   Chromium also at a 4x slower processor. Medians of 5 rounds, before the change (2026-11-20, `72f4c0d`):

   | Measure | Phone WebKit | Chromium 4x CPU |
   | --- | --- | --- |
   | Start: Today shown | 392 ms | 317 ms |
   | Tab 3.5 s after start (Journal) | 225 ms | 118 ms |
   | Tabs Today / Log / Progress / More / Journal | 161 / 117 / 135 / 136 / 149 ms | 108 / 69 / 63 / 57 / 73 ms |
   | Search "banana": first result | 786 ms | 815 ms |
   | Food save: confirmation | 1026 ms | 935 ms |
3. Remove offline support: queue, food copy, saved pages, offline warm-up, offline e2e; keep the service worker
   for push, code files and pages prepared ahead; connection screen; first start sends old queued entries, then
   deletes the queue. Measure again; stop if slower.
4. New search rule in shared TypeScript (word starts, per-word typo limits), server only, with tests; measure.

Step 3 in parts. 3a done: offline search and the food copy removed (`local-food-search.ts`,
`GET /api/v1/foods/offline`, `catalog.offlineFoods`/`offlineFoodsStamp`, the worker's copy, the start's request);
Log search says "Search needs a connection." when the server can't answer in 10 s. 3b done: the service worker keeps no saved pages (about 330 lines, was 638): code files cache-first as before,
pages prepared ahead in memory, writes, reminders, and "obur needs a connection" (`shared/no-connection-page.ts`,
built in the worker from the catalog in every language, picked by the language cookie) for a page that can't load
in 10 s or within a minute of a failure; failed page data makes SvelteKit load the page in full, which shows it.
Old caches (`obur-data-*`, `obur-account`) are deleted on activation. The start no longer downloads 7 pages and
their data (the code preloading stays). Browser tests not yet run (offline.e2e.ts still expects saved pages).
3c done: saves go to the server once (`client/api.ts`: `save`, 10 s, `NoConnection`, `recordIds` keeps one ID
while the entry is unchanged, so Save tapped again after a lost answer counts once); a failed save keeps its sheet
open with "Couldn't save. Check your connection and try again."; a day note says "Not saved" and goes with the
next change. The queue, its review rows, the back-online notices and the sign-in warning are gone; an older
version's queue is sent once at the start (`client/old-queue.svelte.ts`, one release), refused entries use the
existing Today card and sheet, sign-out clears it. The worker now tries the server for 3 s, not 10, in the minute
after a failure (the browser tests caught a first version that showed the connection page for the whole minute).
`tests/e2e/connection.e2e.ts` replaces `offline.e2e.ts` (34 passed, 1 Chromium-only skipped on WebKit).
Checks after 3c: lint, type check, Vitest 1180 passed; full browser suite 286 passed, 18 skipped; the removed
sign-in warning's test deleted. Phone WebKit accessibility check: dark Today sometimes reads the budget number and
meal names as black (contrast 1.25); it fails the same way on `47752e2`, before this work (several of 24 runs), so
it is older and intermittent; told the owner, not fixed.
Speed after (old, new, old in a row on the same machine, medians): phone WebKit start 390 / 401 / 395 ms, tabs
119-177 / 118-173 / 119-177 ms, search 790 / 790 / 788 ms, save 1030 / 1024 / 1033 ms; Chromium 4x CPU start
329 / 325 / 319 ms, tabs 56-101 / 56-124 / 58-133 ms, save 947 / 951 / 948 ms. No difference beyond the noise
between runs of the same version: the owner's speed condition holds.
Step 4 done: the search rule (`shared/search-match.ts`, unit tests): word starts, per-word typo limits (0 up to 4
letters, 1 for 5-8, 2 from 9; optimal string alignment against the start of each word). Log search: real matches
from PostgreSQL (word-start `LIKE`, trigram index), typo matches compared in TypeScript only when the real ones
don't fill the list. Foods and its archive: word starts; one page of the closest by typo when nothing matches.
Saved meals in Log and the recipe archive use the same rule in the browser. Server time with 5,000 foods: real
match about 2 ms (trigram rule 8-9 ms), typo search 9-10 ms (trigram rule 8-9 ms, found none). Speed test after:
search 791 ms phone WebKit, 824 ms Chromium (unchanged; most of it is the typing pause and the trip).
Checks: lint, type check, Vitest 1194 passed, browser suite 288 passed, 18 skipped, 1 failed (the older dark Today
contrast check, below).
Found, owner to decide (2026-11-20): Type it keeps "1/3 of a container" as the text "0.33", so it shows and logs
148.5 kcal (149) instead of 150 for a third of 300 g at 150 kcal per 100 g. The old search hid it in a test (an
unrelated typo match carried the "150"). Fixed (owner's go): a card keeps the amount it understood until the
field is changed (`EntrySheet.svelte`, `exact`); the server already compared a retried amount at the 4 stored
decimals (`storedAmount`), now tested with a third too. Browser test checks the card and the saved 150 kcal.
Dark Today contrast fixed (owner's go): with Reduce Motion, `layout.css` set every transition to 0.01 ms, which
made a transition of every property on every element (the default transition-property is "all"); WebKit then
sometimes kept the old inherited text colour when light and dark switched (a probe: wrong in most of 20 live
switches; after the fix, 0 of 20 switches and 0 of 20 loads). Now transitions take 0 s with Reduce Motion
(animations keep 0.01 ms; nothing waits for a transition's end). Real iPhones with Reduce Motion on could show it
when the phone switches to dark at sunset. Test: `app-shell.e2e.ts` "with Reduce Motion, switching to dark…"
(fails without the fix). Accessibility check 8 of 8 repeats passed.
Found, owner to be told: `app-shell.e2e.ts` "every page title sits at the same height" fails about 1 in 10 runs on
phone WebKit (the page reloads during the test: "navigation interrupted by another navigation to /"); it also
fails on `47752e2` (2 of 10), so it is older. Fixed in the test (owner's go): it opened the next page about
0.15 s after Today appeared, while Today still loaded code; WebKit failed that import and SvelteKit loaded Today
again over the next page. A probe found no second load after a normal sign-in (15 of 15). The test now waits for
the page to finish loading: 20 of 20 passed.
Browser suite: 289 passed, 19 skipped, 1 failed (that title test).
Image `obur:test` built from `0ff86de`: smoke, off-site outage and upgrade from beta.19 passed. Agents' install
guide checked; it now explains the `obur: error:` log line. Hand checks for the owner: `~/Documents` checklist.
Release 1.0.0-rc.5 (owner's go, 2026-11-20). The first tag run failed at its first step: package.json still said
rc.4 (nothing was built or published); the tag was moved to the version commit. The second run failed in the
browser tests (nothing published): `turkish.e2e.ts` "no main screen scrolls sideways" hit the same early-leave
reload as the title test (also fails with the retry). It and the diary back-link loop now wait for each page to
finish loading (Turkish test 20 of 20); the tag was moved again.
Published 2026-11-20 (run 44796699205, 21 min): checks, browser tests (290 passed, none flaky), the three images,
smoke, off-site outage and upgrade tests.
Next: the owner updates (`OBUR_VERSION=1.0.0-rc.5`) and goes through the checklist in `~/Documents`.
Earlier: step 3 started after the owner read and agreed to the design (2026-11-20). Owner accepted that entries left in an old queue
by someone who never signs in on that device again are lost when the later release removes the step.

## Owner's audit of rc.4 (2026-11-20): verified, fixing for rc.5

Report outside the repo, checked against `517f4db`; every finding real. Owner's go, one commit each:
1. A retried diary save is acknowledged before the food's current values are checked.
2. Export reads everything from one snapshot (repeatable read).
3. Offline, a food's details come from the same on-device copy as search.
4. Food edits keep the IDs of unchanged portions.
5. Recipe and saved-meal refreshes claim their version before writing.
6. Offline search keeps the stored search text (aliases).
7. Sign-out: the service worker forgets the account at once; queue deletion waits for other tabs to close it.
8. Reminders show Off only once the server confirms; sign-out sends the device's subscription with the logout.
9. `obur restore start/finish/cancel` serialised with one lock; a running restore is never removed.
10. Unused `shortMonth`/`longDate` removed. Then measure startup preparation and a near-limit import before
    deciding on them (owner's go: measure first). Then local checks and image tests; ask before tagging rc.5.

- Step 1 done: `diary.retriedFood` (service.ts) answers a create whose ID is already saved with the same request,
  checked in `POST /api/v1/diary/entries` before the fingerprint; a portion or measure is compared by its ID, not
  its saved size. DB test and an offline e2e test (fails on the old route).
- Step 2 done: `exportArchive` collects in one read-only repeatable-read transaction (`SNAPSHOT`,
  db/identity.ts) and compresses after it. DB test pauses the export on a lock while an edit commits (fails before).
- Step 3 done: offline, the service worker answers a food's details from the food copy first (`offlineAnswer`),
  a saved answer only for foods not in it. New offline e2e test (fails before); offline and prepared suites passed.
- Step 4 done: `writeChildren` (catalog/service.ts) keeps a portion's ID while its name stays (resized in place),
  deletes removed ones, inserts new ones. Rename keeps the fingerprint. DB tests (catalog; diary retry by portion).
- Step 5 done: recipe and saved-meal `refresh` claim the version with a conditional update before reading the
  contents. DB tests run two refreshes against a held row lock (both fail before: both succeeded).
- Step 6 done: the offline copy carries each food's stored `searchKey` (aliases); `searchable` uses it and keeps
  it out of the details. Unit and DB tests.
- Step 7 done: sign-in, sign-out and account deletion label their answer with the account after them
  (`locals.session`); the service worker counts account changes (`accountEpoch`) and ignores, and never saves, an
  older request's answer for another account; the page tells it `obur:signed-out` (memory cleared too). Queue
  connections close on `versionchange`; `deleteQueue` reports false if still blocked after 5 s (toast
  `device_clear_blocked`). Two offline e2e tests (both fail before). The "stays on the page" test searched
  `mercimek`, which now finds Lentils by alias offline (step 6): changed to a word that matches nothing.
- Step 8 done: `stopReminders` returns whether the server was told; Reminders shows Off only then (else toast
  `reminders_off_failed`). Sign-out sends the device's `pushEndpoint` with the logout, which removes it before
  ending the session (a failure fails the sign-out). Reminders e2e test (fails before). The Off switch itself needs a
  real push service: not browser-tested; check on the iPhone.
- Step 9 done: `restore_lock` (flock on `/run/obur/restore.lock`) in restore start/finish/cancel; smoke test
  holds the lock and checks start and cancel are refused (and now retries the sign-in page check for a few seconds:
  the ready line comes just before the server listens). Smoke test passed.
- Step 10 done: `shortMonth` and `longDate` removed with their tests.
- Measured (temporary tests, not committed), desktop, dev database:
  - Import reading (`readArchive`, synchronous): 160,000 diary rows (5.1 MiB zip, 184 MiB unpacked, near the limit)
    4.8 s, preview 5.8 s; 30,000 rows (about five years of heavy logging, 35 MiB unpacked) 0.9 s, preview 1.1 s. The
    web process answers nothing else meanwhile, and an import reads the file again. Owner to decide (worker thread
    or leave).
  - Start-up preparation, account with 1,000 days of weights and completed days: 16 answers in the background after
    the page settled, 0.6 to 0.8 s of server time in all, 40 to 85 ms each (Progress, More and Profile the slowest).
    Recommendation: leave it.
- `docs/design.md` updated for steps 1 to 9.
- Checks on `c66a1c0`: lint, check, Vitest 1194 passed; full e2e 302 passed, 19 skipped by design; image smoke,
  off-site and upgrade (beta.19) tests passed. Owner's decision (2026-11-20): imports and start-up preparation stay as they are. Full audit by us done
  2026-11-20 (report in the owner's Documents, outside the repo): 4 problems, none high. Next: the owner decides
  which to fix; then ask before tagging rc.5. Owner: fix all four (2026-11-20).
  - Fix 7.1 done: `reminders_off_failed` in Turkish uses "Hatırlatmalar" (glossary).
  - Fix 1.1 done: migration 0060 puts `pg_temp` last in the search path of 10 privileged functions; isolation DB
    test checks every SECURITY DEFINER function, and that runtime roles cannot create temporary tables.
  - Fix 4.1 done: a queue closed by a sign-out in another tab is opened again by the next new entry (`liveQueue`,
    sync.svelte.ts; only a new entry, so an idle tab never recreates it). Offline e2e test (fails before).
  - Fix 5.1 done: `handleError` (hooks.server.ts) logs unknown errors as method, path and `describeError` (kind and
    database code only; server/log.ts, unit test); the three layout log lines use it too. Checked with a temporary
    route throwing a failed query with a secret value: the log line had no value.
  - Checks on `21352d3`: lint, check, Vitest 1196 passed; full e2e 304 passed, 19 skipped by design; image smoke,
    off-site and upgrade (beta.19, includes migration 0060) tests passed. Release 1.0.0-rc.5 (owner's go, 2026-11-20). The first tag run failed at its first step: package.json still said
rc.4 (nothing was built or published); the tag was moved to the version commit. The second run failed in the
browser tests (nothing published): `turkish.e2e.ts` "no main screen scrolls sideways" hit the same early-leave
reload as the title test (also fails with the retry). It and the diary back-link loop now wait for each page to
finish loading (Turkish test 20 of 20); the tag was moved again.
Published 2026-11-20 (run 44796699205, 21 min): checks, browser tests (290 passed, none flaky), the three images,
smoke, off-site outage and upgrade tests.
Next: the owner updates (`OBUR_VERSION=1.0.0-rc.5`) and goes through the checklist in `~/Documents`.

## Release candidate 4 (2026-11-19), as `v1.0.0-rc.4`

rc.3 plus the fixes from the owner's rc.3 audit (below): day-note imports, purged records never imported again,
failed restores retryable and cancellable, the account check on every browser write, saved pages per account,
icons kept on first use, entries keeping the food values seen, and offline food search from a copy on the device.
No migration. Checks before the tag (owner's go): lint, check, Vitest 1188, full e2e (289 passed; the two expected
offline-search changes updated and passing, the WebKit dark axe flake passing alone), smoke, off-site and upgrade
tests. `docs/install/for-ai-agents.md`: no new settings, commands or start-up log lines.
- Published 2026-11-19 (run 44594368168, 23 min): checks, browser tests, the three images and the smoke, off-site
  and upgrade tests. Next: the owner updates (`OBUR_VERSION=1.0.0-rc.4`), checks offline search and the account
  guard on the iPhone, and works through the checklist; `v1.0.0` when nothing turns up.

## Owner's audit of rc.3 (2026-11-19): verified, fixed

Report outside the repo, checked against `0c2f8de`; every finding real (restore worse than reported: a failed restore
always refuses the suggested retry). Owner also found that offline food search does nothing. Owner's go, one commit
each, in this order:
1. Day notes: emptied notes exported; an import never overwrites a note typed later (also one saved meanwhile).
2. Imports skip records purged here (owner: a purged record never comes back), and the stale mapping can't double.
3. Restore: a failed `restore start` can be retried or cancelled, even with no database moved aside.
4. Export, Speak, Scan and achievements send the tab's account.
5. Saved pages per account in the service worker (no other account's copy, even before the page clears them).
6. Food and achievement icons not downloaded at install (cached when first shown).
7. Offline entries keep the calories confirmed: the queue carries what was shown; a changed food asks for review.
8. Offline food search from a copy of the person's foods on the device, used only when the server can't be reached
   (owner agreed without a separate speed test: measured search 0.1 ms for 5,000 foods; the copy refreshes in the
   service worker, only when changed, never during a page load or a write).
Then the calendar helper, local checks and image tests; ask before tagging.

- Step 1 done: `service.ts` exports emptied notes, skips one for a day with no note, and the upsert's `setWhere`
  keeps a later note. Two new DB tests (the race test fails without the guard).
- Step 2 done: `plan` marks a record whose copy here (earlier import's, or the same ID) is in `purged_records` as
  `purged`: skipped, counted, `purged_skipped` notice; a purged food links nothing, so its entries keep snapshots.
  Identity mappings stay insert-only (no UPDATE grant, and no stale mapping is left to repoint). New DB test (fails
  on the old code: 3 new instead of 1).
- Step 3 done: the restore mark gets `restoredAt` only when the restore completes; `obur restore start` retries a
  failed attempt (clears what it left, keeps the database aside) and refuses only a completed one; where the old
  database went is noted in `/data/status/restore-aside` (survives a restart); `obur restore cancel` puts it back, or
  with none clears the attempt so obur waits for a restore as before. `smoke-test.sh` now fails a restore twice,
  cancels it, then does the same on a new installation with only backups and restores for real. Smoke and upgrade
  (beta.19) tests passed.
- Step 4 done: Export, Speak, Scan and both achievement calls send `x-obur-account` (and reload on
  `wrong_account`). New lint rule `obur/account-header` (eslint-rules/, with rule tests): any browser `fetch` with a
  method other than GET must spread `accountHeaders()`; it flagged exactly these five. Lint, check, rule tests.
- Step 5 done: `hooks.server.ts` tags every answer with its account; the service worker notes it from writes,
  network answers and preparations, serves a saved copy (the offline page too) only to that account, and clears the
  copies when it changes (`obur-data-v2`). New `offline.e2e.ts` test (fails without the filter on both browsers);
  offline, prepared, auth and app-shell suites: 48 passed, 5 skipped by design.
- Step 6 done: food and achievement icons are kept when first shown, not at install (about 306 files, 2.1 MiB
  instead of about 690, 3.1 MiB); not hashed, so an older version's copy is used only offline. The unused
  `monthSummary` helper removed. Offline, icons, achievements and app-icon suites: 47 passed, 4 skipped by design.
- Step 7 done: `foodFingerprint` (shared/diary-rules.ts, unit tests); Amount sheet and Speak/typed log send it as
  `expected`; `POST /api/v1/diary/entries` refuses a changed food (409 `food_changed`); the review sheet and the
  amount sheet say so. Two new offline e2e tests (both fail without the server check). Offline, diary, catalog,
  curated, recipes and pinned-search suites: 89 passed, 4 skipped by design. Turkish strings for the three new
  messages (steps 2 and 7) added in a follow-up commit; all Vitest 1181 passed.
- Step 8 done: `catalog.offlineFoods` / `offlineFoodsStamp` and `GET /api/v1/foods/offline` (ETag, 304); the service
  worker keeps the copy in `obur-data-v2`, refreshes it at app start (layout warm-up) and 2 s after a write to
  foods/recipes/import, answers `/__offline/foods?q=` from it and food details when no saved copy exists; LogPanel
  falls back to it when the server can't be reached. `shared/local-food-search.ts` with unit tests (5,000 foods),
  DB tests (contents, isolation, stamp), offline e2e test (fails without the local search on both browsers).
  Full e2e (both browsers, default workers): 289 passed, 19 skipped by design, 3 failed: the offline "stays on the
  page" test expected "Search needs a connection" (now the copy answers; updated, offline suite 39 passed) and the
  known WebKit dark-mode axe flake under load (passes 3 of 3 alone). Vitest 1188, lint, check passed.
- Image tests on the final code (2026-11-19): smoke, off-site and upgrade from beta.19 passed. Next: ask the owner
  before tagging rc.4.
  Owner's phone check wanted for offline search and the account guard (real iPhone, installed app).

## Release candidate 3 (2026-11-19), as `v1.0.0-rc.3`

rc.2's code (never published: its release stopped at the browser tests) plus the Journal's fixed order for
same-day achievements, and the release workflow running the browser tests in the Playwright image with one worker.
No migration. Checks before the tag (owner's go): lint, check, Vitest 1169, Journal e2e on both browsers; the full
e2e on 2 CPUs with one worker (283 passed, the one failure being the Journal order, since fixed); image tests as
for rc.2 (no server or image change since). `docs/install/for-ai-agents.md`: no new settings, commands or log lines.
- Published 2026-11-19 (run 44554870866, 22 min): checks, browser tests (284 passed, none flaky, 14.6 min on one
  worker), the three images and the smoke, off-site and upgrade tests. Next: the owner updates
  (`OBUR_VERSION=1.0.0-rc.3`) and uses it for a few days; `v1.0.0` when nothing turns up.

## Release candidate 2 (2026-11-19), as `v1.0.0-rc.2`

rc.1 plus the fixes from the owner's outside audit (below): writes refused for another account, restore start-up
during replay, one import at a time, discarded drafts, Day Notes showing the kept note, archives missing a listed
file refused, the export-size notice, Progress → All, reminder counts, export grouping, 54 unused messages removed,
and the release workflow now gating on the browser tests and the upgrade test. No migration. Checks before the tag
(owner's go): type-check, lint, Vitest 1168; full e2e 282 passed (2 phone WebKit flakes passing on rerun) and image,
smoke, off-site and upgrade tests on the audit fixes; the export notice after it (data e2e, DB tests). The release
workflow runs the full e2e and upgrade test itself for the first time. `docs/install/for-ai-agents.md`: no new
settings, commands or start-up log lines.
- Tagged and pushed 2026-11-19; **the release workflow failed at the new Browser tests gate, so nothing was
  published** (run 44478894621, 16.6 min on 2 workers). Four tests failed on the slow runner; all pass locally.
  (1) Accessibility in dark mode, phone WebKit: axe read text as black on both tries. Not reproduced on 2 CPUs in the
  official Playwright image, so it comes from installing the browsers on Ubuntu: run CI through `npm run test:e2e`
  (the same image). (2) `goals.e2e.ts` onboarding (phone WebKit): a tap on Settings focused the link and the page
  never changed. Reproduced locally with 2 CPUs and four suites at once, **on rc.1 too** (not from the audit
  fixes); passes alone. Could be a real lost tap on a slow phone; cause not found yet. (3) `archive.e2e.ts` and
  (4) offline "never swaps in another page" timed out or were interrupted on the slow runner (not investigated).
- Investigated (2026-11-19): the "lost tap" is WebKit starving, not the app. Reproduced on 2 CPUs with four
  workers: the onboarding test stuck at another tap, and the trace shows WebKit stopping drawing mid-animation, with
  nothing answering after it. One worker on 2 CPUs in the Playwright image ran the whole suite in 15.7 min: 283
  passed, and the only failure was a real bug: the Journal showed two achievements of one day in the order they
  were stored, which changes with timing (first day logged / first complete day swapped). Fixed: a fixed order
  (most notable first, the first steps in their order), unit test. The offline reload (4) did not reproduce in 16
  runs under load; the archive wait (3) passed in the one-worker run; neither changed.
- CI: the Browser tests job runs `npm run test:e2e -- --workers=1 --retries=1` (the Playwright image, as locally).
  Validation: lint, check, Vitest 1169, Journal e2e on both browsers.
- Owner's choice: tag rc.3 (above); the rc.2 tag stays as it was.

## Owner's outside audit of rc.1 (2026-11-19): verified, fixed

Report (outside the repo) checked against `1756d52`: every finding real. Owner's go for this plan, one commit each:
1. A tab's writes carry its account; the server refuses another session's (409 `wrong_account`). **Done.**
2. Restore start-up: the administrator password is set only once replay is over (in the upgrade step).
3. Imports lock the account for their transaction (obur and LoseIt), so overlapping imports can't duplicate.
4. A failed send puts an item back only if it is still in the queue (a discard during the send stays discarded).
5. Day Notes: when the server kept a newer note, the card shows it and says so; a refused note never says "Saved".
6. Export size: measure how much history fits in 20 MiB, then a plain message or higher limits; a CSV listed in
   the manifest but missing is refused.
7. Progress → All starts at the earliest food, weigh-in, water or activity.
8. Reminders: counted only when delivered; failure counts carried between reminders of one pass; a removed device
   gets nothing more.
9. Export groups nutrients and servings by food once; the startup warm-up's server cost measured (achievement check
   skipped on those background copies only if it matters); unused strings removed, with a lint check.
10. Release workflow: the full Playwright run and the upgrade test from beta.19 become gates before publishing.
Then the local checks and image tests, and ask before tagging rc.2.

- Step 1 (2026-11-19): `client/account.ts` (the layout sets the tab's account; `api`, the offline queue (each item
  its own owner), import and sign-out send `x-obur-account`); `hooks.server.ts` refuses a write whose account isn't
  the session's. A refused queued item stays in its owner's queue and the tab reloads as whoever is signed in.
  `offline.e2e.ts` new test (fails without the server check); `data.e2e.ts` used to swap to another admin mid-page,
  now a new session for the same admin. Full e2e: 281 passed, 18 skipped by design.
- Step 4 (2026-11-19): `store.ts` `update` (puts an item back only if it is still there, in one transaction) and
  `has`; the send loop skips an item discarded since the pass began and never writes back a discarded one. A send
  that had already reached the server before the discard still logs the entry (it can be deleted as usual).
  `offline.e2e.ts` new test (Chromium; fails with the old write-back). Offline and prepared suites 5 times on both
  browsers: 142 passed.
- Step 3 (2026-11-19): `applyImport` and `applyLoseIt` take a per-account advisory lock for their transaction
  (`lockImports`). Without it the race usually fails the second import on a row both add (profile, settings) and
  doubles the records when those already exist. `portability.db.test.ts`: two overlapping exports at once (fails
  without the lock). Import and body DB tests passed.
- Step 7 (2026-11-19): Progress → All starts at the earliest food entry, weigh-in, water or activity
  (`body.firstDay` replaces `firstWeightDay`); body DB test covers water and activity before any weigh-in.
- Step 8 (2026-11-19): reminders count as sent only when a device took them; failure counts carry between
  reminders due in the same pass; a device dropped for one gets none of the rest. New DB test (fails on the old loop).
- Step 2 (2026-11-19): `obur-init` sets the administrator password in `upgrade` (after any restore is finished),
  not at start-up. `upgrade-test.sh` now restores with replay paused (read-only for as long as needed) and checks
  obur keeps running with the "being restored" page, then resumes. Published rc.1 fails it as the audit said
  ("cannot execute ALTER ROLE in a read-only transaction", container stopped); the new image passes.
- Step 5 (2026-11-19): the queue records what the server kept for each sent note (`noteResults`), and the card
  shows the kept note with "A newer version from another device was kept" (new message, Turkish too); a refused note
  shows "The note couldn't be saved" and is saved again on the next edit. A direct save compares the answer too.
  `offline.e2e.ts` two-device test (fails with the old card), 5 times on both browsers.
- Step 6, part (2026-11-19): an archive missing any file its manifest lists (a CSV too) is refused. Measured
  (generated history, not committed): about 1.3 MiB zipped and 15 MiB unpacked per year at 15 entries a day with
  repeated foods, 2.8 MiB zipped per year at 20 a day with every nutrient varied. The 200 MiB unpacked limit binds
  first: about 12–13 years of heavy logging (the owner's LoseIt history: about 9 a day, so about 15+). Raising it
  costs import memory (the archive is read whole; one file must stay under V8's 512 MiB string limit): **owner's
  decision pending.**
- Step 9, part (2026-11-19): the export groups nutrients and servings by food once (`collect`). Import/export DB
  tests passed.
- Step 9, rest (2026-11-19): start-up warm-up measured with 400 days of history (10 entries, water, a weigh-in and
  a complete day each; temporary e2e test, not committed): all 14 requests together about 90 ms of server time,
  4–12 ms each. Left as it is. 54 messages with no caller removed from both catalogs; `shared/messages.test.ts`
  fails on a message whose name is nowhere in `src` (names built from a prefix, `help_${id}_q`, count).
- Step 10 (2026-11-19): `release.yml` gains a Browser tests job (Ubuntu 24.04, Playwright's browsers, PostgreSQL
  service, one retry reported as flaky, results uploaded on failure), run beside the checks; the image jobs wait for
  both, and the `obur` image also runs the upgrade test from beta.19 before publishing. actionlint clean; not yet
  run on GitHub. Pre-existing, not changed: the speech and labels images can publish even if the `obur` image's
  tests fail (separate matrix jobs).
- Validation (2026-11-19, final code): check, lint, Vitest 1167 passed; full e2e 282 passed, 19 skipped, 2 failed on
  phone WebKit (the known accessibility flake, and `typed-entry` "bare count" once under load), both passing on rerun
  (typed-entry 20 of 20); image built, smoke, off-site and upgrade tests passed.
- Step 6, rest (owner's choice, 2026-11-19: keep the limits): an export too large to import back is still given
  whole, and Your data says so ("This export is too large to import back yet"; `fitsImport` reads only the zip's
  headers; `x-obur-importable`). Raise `LIMITS` in a later version as histories approach them (exports import with
  higher limits unchanged; much larger files need a streaming reader). DB test, data e2e passed.

## Release candidate (2026-11-18), as `v1.0.0-rc.1`

beta.22 plus: the buttons review (both rounds), the "<" button removed, the Text Review, archive placeholders and
recipe archive at the page end, menus closing on an outside tap, and the fixes from two audits (Select all on any
size of archive, SvelteKit 3.3.1 so a malformed address can't crash obur, offline entries sent as soon as the
connection returns, `requests` 2.33.1 in the speech image). No migration. Checks before the tag (owner's go):
type-check, lint, 1164 unit and database tests, full e2e 279 passed (18 skipped by design), build, image, smoke test
(now with malformed addresses), off-site outage test, upgrade test from beta.19, speech image built and healthy.
`docs/install/for-ai-agents.md`: no new settings, commands or start-up log lines.
- Published 2026-11-18: release workflow passed (checks, three images, smoke and off-site tests).
- Next: the owner updates (`OBUR_VERSION=1.0.0-rc.1`) and uses it on the phone for a few days; problems become rc.2;
  `v1.0.0` (the first `latest`) when nothing turns up.

## Full audit before 1.0.0 (owner, 2026-11-18), findings reported before fixing

- Checked on the migrated database itself: every table has RLS on and forced (except `schema_migrations`, which the
  runtime roles can't read); app and worker roles are not superusers and can't bypass RLS; every policy ties rows to
  `app_current_user_id()`; updates are column-limited and never touch owner or user columns; SECURITY DEFINER
  functions have fixed search paths, check identity and are executable only by the roles that need them.
- Identity: `withUser` sets it per transaction; outside it only the sign-in functions and household measures run.
  Worker unchanged since the last audit apart from housekeeping. Routes: all need a session except sign-in; every
  change is same-origin; recent passkey checks match the design's list; uploads are bounded.
- Cross-feature: imports with purged or deleted foods and saved meals; offline entries for a deleted food (kept for
  review). Unaudited changes since 2026-11-14 (Type it unit carry-over, match ranking, unit menu) read.
- Dependencies: `npm audit` and OSV for the Python add-ons. Docs: install guides and settings file against the
  container's commands and settings.
- Findings: (1) serious: SvelteKit 3.1.0 crashes the server on one request to a malformed address (our `reroute`
  hook; GHSA-mw6w-2fmv-pvw3), confirmed on a local build; in the image that stops the whole container, database
  included, and Docker restarts it, so anyone who can reach the address can keep it restarting. Every published
  version has it. Fix: @sveltejs/kit 3.3.1 and adapter-node 6.0.1+, plus a smoke-test check. Other SvelteKit
  advisories don't apply (no remote functions or query.batch; no secret found in the browser bundle). (2) minor:
  `requests` 2.32.3 in the speech image (used only while building it) has advisories; update to 2.33.x.
- Fixed (owner's go): @sveltejs/kit 3.3.1 and adapter-node 6.0.4 (malformed addresses now get an error page and the
  server keeps running, checked on a local build; the smoke test sends three and checks obur still runs); `requests`
  2.33.1 in the speech image (both pins; image built and healthy). `npm audit` shows no SvelteKit advisories.
- Validation: check, lint, Vitest 1164, image build, smoke (with the new check), off-site and upgrade tests passed;
  full e2e 277 passed, 2 failed: the accessibility check (known phone WebKit flake, passed on rerun) and the offline
  test below.
- New finding (not fixed, reported): when the connection returns while a send attempt started offline is still
  failing, the "online" signal joins that attempt instead of starting another (`flush` in
  `client/offline/sync.svelte.ts`), so waiting entries go out at the next 30 s retry. Nothing lost. The offline test
  fails 2 in 25 runs this way on both SvelteKit 3.1.0 and 3.3.1.
- Fixed (owner's go): `flush` runs one more pass when asked during a pass (`sendWaiting` is one pass). Offline test 50
  of 50 on desktop Chromium, all offline tests 3 times on both engines. Also fixed a test race in `goals.e2e.ts`
  (the pace step saw the goal weight's "Budget settings saved" and left before the pace saved; 1 in 50 before, 50 of
  50 after).
- Validation: check, lint, Vitest 1164, full e2e 279 passed, 18 skipped, none failed. Image gates passed on 4ab715c
  (smoke, off-site, upgrade); this change is browser code only. Next: tag `v1.0.0-rc.1` when the owner says so.

## Release-candidate audit (owner, 2026-11-18), findings reported before fixing

- Read: everything since beta.21 not yet audited (migrations 0058–0059, purge, catalog bulk/trash/ownFoods, saved
  meal delete/restore, export/import and LoseIt changes, new routes, archive and Recently deleted screens, menus,
  today's button, "<" and text changes) and beta.18–19 (restore replay wait, menu tap guard).
- Gates passed: check, lint, Vitest 1162, build, image, smoke test, off-site outage test, upgrade test from beta.19;
  full e2e earlier today (277 passed, 2 phone WebKit failures that passed on rerun).
- Added: a database test that deleted foods and saved meals export and import still deleted, and can be restored
  (passed; no bug).
- Findings: (1) Select all on Archived foods fails with "Something went wrong" above 5,000 archived foods
  (`MAX_BULK_FOODS`), plausible after a large LoseIt import; (2) `private-foods.db.test.ts` sometimes fails its
  cleanup (dropping its scratch database takes over 10 s under load; all its tests pass); (3) nothing since beta.22
  has been checked on a real phone.
- Fixed (owner's go): (1) Select all has no limit; ID lists (Undo, Recently deleted) go 5,000 per request
  (`shared/food-bulk.ts`, `client/food-bulk.ts`; database test with 5,001 archived foods, unit test of the split);
  (2) database test hooks get 60 s (`vite.config.ts`); three full Vitest runs clean (1164). Also found and fixed:
  the archive e2e test's phone WebKit flake (a full page load cutting off the step's data refresh, whose fallback
  reloads the page): it now opens Recently deleted through More and waits for the refresh; 15 repeats clean.
- Validation: check, lint, Vitest 1164 (three runs), full e2e in the Playwright image 279 passed, 18 skipped, none
  failed. Image gates passed before these fixes (smoke, off-site, upgrade from beta.19); the fixes touch no deploy
  files. Next: owner's real-phone check, then tag when asked.

## Text Review applied (2026-11-18), unreleased

- Owner answered 17 of the 83 items (all "agree" or "shorten as written") and asked to apply every suggestion as
  written. Done in English and Turkish: 5 lines cut (day complete hint, Copy to… note, "one of your recipes", Goal's
  "changes apply from today", the Speak/Scan feature lines), Scan's three tips made one line, about 35 shortened,
  fixes for `icon_none` (no language mention) and `achievements_weight_off` (Settings → Goal), placeholders: Log's
  search matches Foods' ("Name or brand, e.g. greek yogurt"), "e.g. cheese, tea, apple", "e.g. slice". The Nutrition
  hint dropped "Tap <" (button removed). Food archived + delete hint now read "Archived, so it's not in search. Delete
  keeps it 30 days in Recently deleted." Note formatting stays explained in Help. Keys removed from both catalogs.
- Validation: check, lint, all Vitest (1161), full e2e in the Playwright image: 277 passed, 18 skipped, 2 phone
  WebKit failures (accessibility, archive) that passed on rerun. Today and lunch-card screenshot baselines
  regenerated and reviewed (welcome text, meal … dots).

## The "<" button removed from the food form (2026-11-18), unreleased

- Owner: hardly anyone would use a per-row "less than" button, or know when to. Agreed: no control; a value printed
  "<0.5" shows as "<0.5" in its field (Scan fills it in that way, older foods open that way), typing a leading "<"
  sets it, and retyping the number without it clears it. The stored qualifier, totals marked approximate and the
  label checks are unchanged; no migration. `shared/food-edit.ts` (`parseLabelValue`, `labelValueText`, unit tests);
  the hints drop "tap <" (English and Turkish); docs/ui.md updated.
- Validation: check, lint, all Vitest (1161 passed), desktop Chromium e2e for catalog, scan, accessibility, typed
  entry, icons and menus (36 passed). Phone WebKit not run. A phone's number keyboard has no "<": typing it is for a
  full keyboard; Scan covers the usual case.

## Archive placeholders and recipe archive at the page end (2026-11-18), unreleased

- Owner reports: the archive searches had no placeholder (now "Name or brand, e.g. greek yogurt" for foods, shared
  with Foods, and "Recipe name, e.g. lentil soup" for recipes); recipes archived through the … menu with a question
  while foods use a row at the end of the page. Recipes now match foods: Archive recipe at the end, no question,
  toast with Undo; an archived recipe has Restore (stays on the page) and Delete recipe there. No … menu on recipes.
- Owner declined header icons for New food/recipe (my advice) and dropped the … menu redesign. Still open: saved
  meals keep Delete in a … menu by the title, and Today's meal cards keep theirs (asked the owner about saved meals).
- Validation: check, lint, desktop Chromium e2e for every recipe/archive/saved-meal file (55 passed). Phone WebKit
  not run.
- Placeholders added to the Text Review artifact (version 2, a Placeholders section at the end).
- … menus now follow the dropdown rule: a tap outside only closes them (shared `client/swallow-press.ts`, used by
  `Menu` and `ActionMenu`; new test in `menu-dismiss.e2e.ts`, checked to fail without the fix). Saved meals: Delete
  is a red trash icon by the title, the page's only action (owner's call); `EditorHead` lost its menu and inline
  question.
- Button placement investigated; a seven-stop review page (Artifact, owner's private link) covers New buttons on lists,
  editor endings, saved meal delete, button pairs, add links and Today's meal … menu (trigger and contents).
- Review page rebuilt with real screenshots, one decision per screen (owner found the drawn version confusing).
- Owner's picks: New meal at the top (built); keep Cancel and Save on recipe/saved meal editors (no change); main
  button on the right in every pair (built: Already in your foods, Maintain offer, Speak's failure card); + on Add a key
  (built); meal menu with icons and a line before Delete meal (built, `ActionMenu` takes `icon`). Saved meal delete:
  owner picked a row at the end but asked how it sits with archive rows; waiting on their answer (trash icon still in
  place). Meal … button: owner rejected all options because none lined up with the calorie numbers; step 6 re-shot
  with each option's right edge on the numbers' edge, waiting for a pick.
- Validation: check, lint, desktop Chromium e2e for saved meals, catalog, bulk, menus, goals, own key, speak and
  accessibility (38 passed). `turkish.e2e.ts` screenshot comparisons fail on the host with or without this change
  (baselines come from the Docker image); not run in Docker.
- Round 2 review page (new Artifact, real screenshots): meal … button (dots only vs square with its dots on the
  numbers' edge), saved meal delete (row vs icon, beside how every editor ends), Cancel on the food page.
- Round 2 picks (owner, 2026-11-18): meal … button as dots only, aligned to the calorie numbers' right edge;
  Delete saved meal as a row at the end (trash icon goes); Cancel next to Save food on the food page (archived too).
- Round 2 built (owner's go): the meal … button is the bare dots, the last dot's ink on the calorie numbers' right
  edge, 44 px target kept (`ActionMenu`; a new test in `menu-dismiss.e2e.ts` measures it and fails without the
  fix); Delete saved meal is a red row in a card at the end, above Cancel/Save (`EditorHead` is back to the way back
  and the title); a food's page has Cancel beside Save food, back to Foods or Archived foods (`FoodForm`'s
  `cancelHref`; new test). docs/ui.md updated, including the outdated "Small round actions" line.
- Validation: check, lint; desktop Chromium e2e for bulk, accessibility, icons, catalog, archive, menus, saved meals,
  typed entry and scan (42 passed); the same files on phone WebKit in Docker: 43 passed and 1 failed on the first run
  (not identified), 44 passed on the rerun.
- Next: the owner tries it. Still owed: the Text Review picks and the "<" checkbox discussion (see memory).
- An archived recipe's Cancel now leads to Archived recipes, like its "<" (owner left it to me); `archive.e2e.ts`
  checks it. Desktop Chromium archive and recipe tests: 11 passed.

## Archived and deleted foods released (2026-11-18), as `v1.0.0-beta.22`

beta.21 plus Scan's move to `gpt-6.1-terra` (before `gpt-5-mini` shuts down on 2026-12-11) and archived and deleted
foods, recipes and saved meals (below). Checks before the tag (owner's go): type-check, lint, 1158 unit and database
tests, e2e 271 passed (18 skipped by design; 2 phone WebKit failures per full run, different each time, all passing
on rerun), build, image built, smoke test, off-site outage test, upgrade test from beta.19. The upgrade test can't
start from beta.20 or later: its sample data uses the shared-foods column removed in beta.20 (beta.21 fails at its
setup), so it still starts from beta.19, which also runs the new migrations. Migrations 0058 and 0059 run on update.
`docs/install/for-ai-agents.md`: no new settings, commands or start-up log lines.
- Release workflow, first run: checks and the speech and labels images passed; the `obur` image failed its off-site
  outage test on GitHub. Cause: the test's `docker logs | grep -q` (with pipefail, grep stopping at the match makes
  `docker logs` fail on the closed pipe; the smoke test already avoided this). The log line it looked for was there.
  Fixed on main after the tag (the script isn't in the image); the failed job was rerun on the tag as is and passed,
  so all three images are published as 1.0.0-beta.22.
- Next: the owner updates (`OBUR_VERSION=1.0.0-beta.22`) and tries the archive, deleting and Recently deleted on a
  phone.

## Archived and deleted foods: design review (2026-11-18), waiting for the owner

- Owner asked: archived foods out of the Foods list into their own place, reachable from the top; delete archived foods one at a time or several at once; same for recipes. Agreed: delete goes to Recently deleted (30 days, restorable); only archived items can be deleted; diary, saved meals and recipes keep their snapshots; a later LoseIt import must not bring a deleted food back.
- Review page with seven stops published as an Artifact (owner's private link). Proposed: a row "Archived foods" under New food (or "In use / Archived" chips), Select with Select all, Delete with Undo and no question, Recently deleted grouped by Entries/Foods/Recipes/Saved meals, saved meal delete moves to Recently deleted.
- Verdicts read (2026-11-18): stops 1–6 approved, the row picked for stop 1; stop 7 (saved meals) built as shown after the owner's go. Saved meals keep no archive; the owner kept both saved meals and recipes.
- Step 1 done: `foods.deleted_at` (only an archived food), `saved_meals.deleted_at`, the nightly purge takes both after 30 days with markers (`food`, `saved_meal`), catalog `bulk` (archive/restore/delete/undelete by IDs or all), trash lists and counts, export/import carry the dates, a LoseIt import no longer links entries to a purged food. Database tests: 251 passed; all Vitest 1157 passed.
- Step 2 done: routes `POST /api/v1/foods/bulk`, `POST /api/v1/saved-meals/restore`, `GET /api/v1/recipes`, `GET /api/v1/foods?mine&archived&q`; screens: Foods and Recipes list only items in use, with an "Archived foods/recipes · N" row under New; Archived foods/recipes pages (search, Select, Select all over the whole archive, Restore/Delete with Undo); Delete food on an archived food, Delete recipe in an archived recipe's … menu; saved meal Delete without a question, with Undo; Recently deleted grouped (Entries, Foods, Recipes, Saved meals), five each and Show all, Select to restore several; More counts all of it. Turkish strings added. New `tests/e2e/archive.e2e.ts` (3 tests) passes on desktop Chromium; saved-meals and menu-dismiss tests updated. Vitest 1158 passed (one earlier full run failed `private-foods.db.test.ts` at file level, not reproduced in two runs).
- Step 3 done: docs/design.md ("Archived and deleted foods"; "Foods are archived, never deleted" replaced) and docs/ui.md ("Archived and deleted"). The accessibility check now covers Archived foods and recipes, an archived food, and Recently deleted with a deleted food. Full e2e in the Playwright image: 271 passed, 2 failed, both phone WebKit and different on each of two runs (saved meals' Update button and the Add a food sheet; then the accessibility check catching Today's budget number mid-way to dark mode, and an interrupted offline page load). Each passed when rerun (several times), so they look flaky, not caused by this change. The archive tests needed a wait for the page to settle on WebKit (test-side race with the background refresh after a step).
- Not checked yet: a real phone.
- Released as beta.22 (above).

## Scan's remote model moved off `gpt-5-mini` (2026-11-18), for tonight's release

- OpenAI shuts down `gpt-5-mini` on 2026-12-11. Scan with a person's own key now uses `gpt-6.1-terra` (OpenAI) and `openai/gpt-6.1-terra` (OpenRouter, listed there), OpenAI's named replacement. Speak is unchanged: `gpt-transcribe` isn't deprecated.
- The owner accepted the new model without a photo comparison; they'll report problems from real use.
- `openai/whisper-large-v3` (Speak on OpenRouter) is listed on OpenRouter's models API when all output types are asked for (DeepInfra, Together, Groq). Not yet tried with a real key.
- Validation: provider unit tests, `npm run check`, `npm run lint`, own-key browser tests (desktop Chromium, 13 passed).
- Next: the owner releases tonight.

## Audit fixes released (2026-11-17), as `v1.0.0-beta.21`

beta.20 plus the two audits below and the Type it unit fix. Checks before the tag (owner's go): type-check, lint,
1150 unit and database tests, e2e 267 passed (18 skipped by design), build, image built, smoke test, off-site
outage test, upgrade test from beta.19. Migration 0057 runs on update. `docs/install/for-ai-agents.md`: no new
settings, commands or start-up log lines.
Tag pushed; the release workflow passed (checks, all three images, smoke and off-site tests on GitHub) and
published them as 1.0.0-beta.21.
- Next: the owner updates (`OBUR_VERSION=1.0.0-beta.21`) and checks members' foods and diaries, the variant row,
  and "Already in your foods" on New food, Scan and Type it.

## Audit of the private-foods change (owner, 2026-11-17), for `v1.0.0-beta.21`

beta.20 was tagged before the owner could ask for an audit (my mistake: releases only when asked). Found and fixed:
Enter or Go in a field saved past "Already in your foods" (its Save mine anyway was the form's only submit
button; now an ordinary button, and the form ignores a submit while the card shows); the card stayed after an
edit (any change now clears it and Save checks again); copies made by the old variant bug claimed to be variants
of a built-in food (migration 0057 keeps a variant's source only when it is built-in; archive imports likewise).
Left as is: an entry queued offline for someone else's food before the update is refused into the usual card;
a copy of an archived shared food arrives archived. Tests added: the migration with recipe ingredients and an own
variant; an export from before the update (shared flags, someone else's food); browser tests of the card on Scan
and Create it as food, Enter and editing, the LoseIt Keep separate copies switch, the card in the accessibility
check; `deploy/obur/upgrade-test.sh` (beta.19 data updated by the new image, then its backup restored with a
`:shared` list), passed locally. Vitest: 1149 passed; e2e 266 passed (18 skipped by design) with one flake
(`saved-meals.e2e.ts` in phone WebKit under the full parallel run; it then passed 3 of 3 alone; `goals.e2e.ts`
flaked once the same way in an earlier run). Found on the side and fixed (owner's go): in Type it and Speak, a
food chosen for a card after the sentence (Create it as food, Which one?) dropped the sentence's "ml" and asked
"Choose a unit for ml" even for a food per 100 ml (grams only seemed to work: a per-100 g food usually has one
unit, chosen by itself). Grams and millilitres now carry over when the food offers them; portion words ("2
slices") are still asked. Browser test in `typed-entry.e2e.ts`.
- Second audit (owner asked, 2026-11-17), the whole diff since beta.19 and its surroundings: fixed the
  "Already in your foods" lookup missing a short name ("Su") when over 50 longer foods contained it (candidates are
  now ranked by closeness, regression test). Checked and fine: no function or policy still names the removed
  column (the development database migrated 0053–0057 cleanly, with no food links between people left); recipes,
  saved meals, Speak and Type it only see the person's own and built-in foods; old clients' extra fields are
  ignored. Left as is: a copy is also made for a food someone only linked through an earlier archive import.
  Checks: type-check, lint, 1150 unit and database tests, e2e 267 passed (18 skipped by design), no flakes.
- Released as beta.21 (above).

## Private foods released (2026-11-17), as `v1.0.0-beta.20`

Foods private, copies for members who used someone else's food, the variant fix and "Already in your foods" (see
"Before 1.0.0" below). Checks before the tag: type-check, lint, 1148 unit and database tests, e2e 261 passed (18
skipped by design), build, image built, smoke test, off-site outage test. Migrations 0055–0056 run on update, after
the automatic backup. `docs/install/for-ai-agents.md`: no new settings, commands or start-up log lines.
Tag pushed; the release workflow passed (checks, all three images, smoke and off-site tests on GitHub) and
published them as 1.0.0-beta.20.
- Next: the owner updates (`OBUR_VERSION=1.0.0-beta.20`) and checks that members' foods and diaries look right, the
  variant row, and the card on New food and Scan.

## Before 1.0.0: features agreed (owner, 2026-11-17)

- Foods become private (owner, 2026-11-17), replacing the merging idea: sharing between members is removed, each
  member who used someone else's food gets their own copy, and new duplicates are caught at Save and in the LoseIt
  import ("Already in your foods"). Also: Make my own variant only on built-in foods (it made copy after copy of the
  person's own foods). Steps, one commit each: 1 docs (done); 2–3 database move, server and screens (done, one
  commit, since dropping the column needs all three); 4 the check.
- Done (2–3): migrations 0055 (copies for every member who logged, saved, cooked with or imported someone else's
  food, records pointed at them; ownerless non-curated foods removed; policies: own foods plus curated, only the
  owner writes; `app_delete_account(uuid)` and `app_reapply_deletion(uuid, timestamptz)`) and 0056 (drops
  `foods.visibility` and `account_deletions.removed_shared_foods`; owner cascades; a food has no owner exactly when
  it is curated). Server: no sharing in foods, recipes, the LoseIt import or account deletion; variants only of
  built-in foods; an archive's built-in food from another installation becomes the person's copy (`variant`).
  Screens: no Shared/Only me, no share switch in the import, no shared-foods question on deletion, lists without
  "Shared", the variant row only on built-in foods. `obur restore finish` still takes `:shared` entries and calls
  the older function on a backup from before the update. Tests: a real-Postgres test of the migration
  (`private-foods.db.test.ts`: seeded at 0054, upgraded), catalog/recipe/curated/diary/portability/LoseIt tests
  reworked, browser tests (catalog: nobody else finds a food; a variant of a built-in food has no variant row).
- Done (4): "Already in your foods" (`shared/food-match.ts`: folded name and brand in any word order, calories within
  10 % or 10 kcal when comparable). `POST /api/v1/foods` answers `{ match }` and saves nothing unless `anyway`; the
  food form shows the card in Save's place (New food, Scan, Create it as food). The LoseIt import uses the person's
  own matching foods (`matchedFoods` in the preview, `keepCopies` option, links remembered for the next export).
  Tests: 9 unit, a real-Postgres lookup test, a LoseIt matching test, a browser test of the card.
- Next: release as beta.20 for the owner to try (update runs migrations 0055–0056 after the automatic backup).
- Waist over time: dropped (waist is hard to measure often, so the data would lag and a card would mostly show an
  old number). Waist stays a single value in Profile → About you.
- Not wanted (owner): weekly budget banking, limits for other nutrients, home-screen shortcuts, a local language
  model for parsing, fasting timer, meal photos, social features, barcodes.

## Menu fixes released (2026-11-16), as `v1.0.0-beta.19`

beta.18 plus the owner's daily-use reports below (menus, unit menu, archive food). Checks before the tag: build,
image built, smoke test, off-site outage test; the code checks as listed below. `docs/install/for-ai-agents.md`: no
new settings, commands or start-up log lines. Tag pushed; the release workflow passed (checks, all three images,
smoke and off-site tests on GitHub) and published them as 1.0.0-beta.19.
- Next: the owner updates (`OBUR_VERSION=1.0.0-beta.19`), tests archive food and the menus on the iPhone.

## Owner's daily-use reports (2026-11-16)

- Unit menu too wide with long USDA portion names: the owner rejected wrapping and picked option B of a demo: menus
  that size to their content are at most 288 px wide, every option on one line cut with "…", and the unit menu's
  size ("125 g") apart on the right, always whole (`ui/Menu.svelte` `detail`, `unitChoices` in `unit-options.ts`).
- Menu edge: the owner picked the hairline (B) in a demo. Tap outside only closes: confirmed for every dropdown.
- Archive food: built before the owner's go (my mistake); kept for the owner to test, may change.
- A tap outside an open menu now only closes it; whatever was tapped does nothing. Menus have a visible edge (text
  colour hairline, stronger shadow) in every theme and mode.
- Archive food: goes back to Foods with a "Food archived" toast and Undo (restores, back to the food); the archived
  page shows a muted line instead of a notice at the top; Restore shows a toast.
- Checks: type-check, lint, 1133 unit and database tests, full e2e (the unit menu change broke the trigger's
  accessible name, fixed; then the failed files and `menu-dismiss.e2e.ts` passed, 83 tests), including a one-line,
  288 px unit menu check. Not yet tried on the iPhone.
- Next: the owner tries these on the iPhone with the next release.

## Audit fixes released (2026-11-15), as `v1.0.0-beta.18`

beta.17 plus the restore-finish fix below. Checks before the tag: smoke test and off-site test on a fresh image
(the code otherwise as checked for beta.17). Tag pushed; the release workflow passed (checks, all three images, smoke and off-site tests on GitHub) and published them as 1.0.0-beta.18.

## Audit fixes released (2026-11-15), as `v1.0.0-beta.17`

Checks before the tag: type-check, lint, build, 1133 unit and database tests, e2e 251 passed (18 skipped by design,
no failures), image built, smoke test, off-site outage test (with the new retry and restore steps). Migrations
0053–0054 run on update. `docs/install/for-ai-agents.md` checked: no new settings, commands or start-up log lines.
Tag pushed. The workflow published `obur-speech` and `obur-labels` 1.0.0-beta.17, but the `obur` image failed its
off-site test on GitHub: `obur restore finish` ran while the restored database was still replaying WAL (read-only),
so "delete from sessions" failed. It passed locally by timing; a real restore on a fast machine would have failed the
same way. Fixed: `obur restore finish` waits until `pg_is_in_recovery()` is false (10 minutes at most). No `obur`
1.0.0-beta.17 image exists; the release is redone as beta.18.
- Next: the owner updates their server (`OBUR_VERSION=1.0.0-beta.18`), uses beta.17 for a
  week, tries the changed flows on the iPhone (Undo and sign-out offline, pregnancy in About you on a test
  account) and rehearses a restore once on a scratch copy; then 1.0.0 (version, guide check, a fresh install from
  the published image).

## Full pre-release audit (owner, 2026-11-14): every file, findings reported before fixing

Coverage ([x] read in full; findings in the list below, fixed only after the owner's go):

- [x] A. Database: every migration (RLS policies, SECURITY DEFINER functions, grants), `db/`, `jobs/setup.ts`
- [x] B. Server modules: auth (rest), goals, body, catalog (service, recipes, curated, usda), diary (saved meals),
  progress, reminders (rest), remote-models, updates, imports-exports (plan, write, LoseIt rest, account deletion)
- [x] C. Server glue (`src/lib/server/*.ts`), every API route and page server load
- [x] D. Shared logic (`src/lib/shared/`): goals and budget math, quantities, nutrients, dates and zones, history,
  achievements, reminder times, search folding, formatting
- [x] E. Client (`src/lib/client/`), every screen and component (`src/lib/ui/`, `src/routes/`)
- [x] F. Deploy: Dockerfile, `deploy/obur/*` (init, restore, CLI), `server.js`, compose, release workflow,
  `scripts/`, the speech and labels services
- [x] G. Configuration and docs: lint rules, Vite/Svelte config, `.env.example`, install guides against the commands

Findings so far (A–B):
1. A calculated (weight-loss) budget stays in force after someone marks pregnancy or breastfeeding, unless they
   finish setup (`goals.updateDetails` returns `not_recalculated`; the onboarding page ignores it). Owner decision.
2. A weight with 3 decimals or water with 2 is refused as a conflict on retry (stored rounded, compared unrounded);
   the reply also shows the unrounded value (`body/service.ts` insert).
3. LoseIt food identities are cut to 100 characters when stored but compared in full: a LoseIt database food with a
   long name is added again by every overlapping import (diary rows are not duplicated).
4. Small: expired sessions, reminder sends and purge markers are never cleaned up; no index for trash counts;
   recipe and saved-meal saves don't check the version on the final update (two devices at once: last one wins
   silently); importing an archive into an account with a profile can warn "profile kept" when only defaults
   differ; the GitHub tag list is read 100 at a time.
Findings (C–G):
5. A failed Undo (offline or refused) closes the toast and does nothing, with no message (`shell/Toast.svelte`);
   marking a day complete fails silently the same way (Today `toggleComplete`).
6. `obur restore finish` stops if the full backup fails anywhere, so an unreachable off-site store keeps the app
   closed after a restore (`deploy/obur/obur-restore`).
7. Signing out offline clears the device's queue, then the sign-out request fails silently: still signed in.
8. "Keep the calories" for a refused entry discards the original before saving the replacement; if that save is
   refused too, both are gone.
9. A reminder subscription accepts any https address, so the worker can be pointed at any host.
10. Small: achievements are worked out twice on Journal, Progress and Achievements (layout and page); links to the
    owner's private review pages sit in this file; correction to finding 2: the app's screens round amounts to two
    decimals, so only API clients and weights typed with three decimals hit it.
Screens (E) were read for their logic and failure handling, not every line of markup.
Fixing (owner, 2026-11-14: finding 1 as recommended, then the rest):
- Done: finding 1. Details that no longer allow a calculation end a calculated budget from today (a `none`
  version; outcome `ended`, a toast in setup, which then offers the person's own number). Tests in
  `goals.db.test.ts` (pregnant and under 18; earlier days keep theirs; saving again records nothing).
- Done: finding 5. A failed Undo says "Couldn't undo" (`shell/Toast.svelte`); marking a day complete says when it
  failed. E2e `offline.e2e.ts` (fails without the fix, both browsers).
- Done: finding 2. Weights (0.01 kg), water (0.1 ml) and food amounts (0.0001) are rounded to what their columns
  keep before saving, so a retry matches and the reply shows the stored value. Tests in `body.db.test.ts` and
  `diary.db.test.ts` (both fail without the fix).
- Done: finding 3. A LoseIt identity over 100 characters is stored as its start plus a hash and found again; ones
  cut at 100 by earlier imports still match. Test in `loseit.db.test.ts` (fails without the fix).
- Done: finding 6. `obur restore finish` needs only the local full backup; when the off-site store is away it says
  so and marks the off-site copy for a full backup at its next backup (`offsite-full-needed` in the status folder).
  `offsite-test.sh` gained a step: restore start and finish with the store away, then the nightly backup gives the
  off-site copy its full backup and a restore check passes (image built, test passed).
- Done: finding 7. Sign-out asks the server first, with a 5-second limit (an iPhone can leave an offline request
  hanging); offline it says it needs a connection and clears nothing. Found while testing: the reminders step
  waited forever for a service worker that wasn't registered yet (`push.ts` now looks it up without waiting).
  E2e `offline.e2e.ts`; the offline file passed 3 times on both browsers.
- Done: finding 8. "Keep the calories" saves (or queues) the replacement first and discards the refused entry only
  then; a refusal shows an error and keeps it. The existing refused-entry e2e passes; the double refusal has no
  test of its own (hard to provoke in a browser).
- Done: finding 9. A reminder subscription must point at Chrome's, Firefox's, Safari's or Edge's push service
  (`shared/push-services.ts`, unit test with look-alikes). Subscriptions already saved keep working.
- Done (small): nightly housekeeping (migration 0053, `app_housekeeping()`, run by the worker after the purge;
  database test incl. the app role refused) and an index for the trash (migration 0054).
- Done (small): recipe and saved-meal saves check the version on their final update, so of two saves at once the
  second gets a conflict instead of silently replacing the first. Tests in `recipes.db.test.ts` and
  `saved-meals.db.test.ts` (both fail without the fix; the saved-meal one holds a row lock to force the overlap).
- Not a bug (finding 4, "profile kept"): checked with a test; fields an older archive lacks are not compared, and
  the stored and exported forms of defaults match. No change.
- Done (small): the update check follows GitHub's next-page links (up to 5 pages of 100 tags; unit test).
- Done (small): links to the owner's private review pages removed from this file (they are in the owner's app).
- Left as is (small): achievements are worked out on the page and again by the layout's refresh after it. The
  layout's run is behind the page and only writes what changed; removing it would delay celebrations. Not worth
  the change.
- Checks (all audit fixes): type-check, lint, build, 1133 unit and database tests, e2e 251 passed (18 skipped by
  design, no failures), image built, smoke test, off-site test (now with retry and restore steps). Migrations
  0053–0054 run on update.

## Pre-release audit fixes (2026-11-14)

Audit of sign-in, isolation, diary retries, offline sync, service worker, imports, reminders, uploads, search and
page loads. Fixing everything found (owner, 2026-11-14):

- Done: a retried food entry logged by serving or household measure was refused as a conflict (jsonb reorders the
  unit's keys; `sameRequest` now compares with sorted keys). Regression test in `diary.db.test.ts` (fails without
  the fix).
- Done: speech requests were logged as slow (`SLOW_BY_NATURE` named `/speak`).
- Done: More's counts are counted in the database (`trashCount`, `recipes.count`, `savedMeals.count`) instead of
  loading the trash, every recipe and every saved meal with its items after each page change and save.
- Done: the device's saved pages expire after 60 days by their Date header (`shared/saved-copies.ts`); the service
  worker looks at most every 6 hours, behind a page's answer. Main tabs are saved again each start, so they stay.
  Checks: unit test for the rule, offline and prepared e2e (27 passed, 4 skipped by design). The trimming itself has
  no browser test (it would need a 60-day-old copy).
- Done: sign-in limits count each real client behind a local proxy (`server/client-ip.ts`, design.md "Sessions,
  uploads and deployment"); no new setting, install steps unchanged. Checks: unit tests, auth e2e (7 passed).
- Done: `progress.e2e.ts` reloaded before the Smoothed choice had saved (it saves in the background); it now waits
  for the save. Failed once in a full run, then passed 37 of 37 repeated (both browsers).
- Checks (all five fixes): type-check, lint, build, 1120 unit and database tests, e2e 246 passed (18 skipped by
  design) with that one failure, which is now fixed. A first full e2e run was spoilt by running `npm run build`
  alongside it (it replaces the build the tests serve); don't do that.
- Audit, second part (owner, 2026-11-14): export/LoseIt import, backup scripts, parsers, screens.
- Done: typed and spoken text read "2,000 kcal" as 2 kcal and "10 oz steak" as 10 steaks (count). Commas between
  groups of three are now thousands; oz, lb and fl oz convert to g/ml (design.md, "Typed and voice logging").
  Tests in `parse.test.ts`; all development sentences unchanged. The held-out and audio evaluations need the
  owner's private fixtures and were not run.
- Audit done: label parser, backup scripts, LoseIt file reading and screens (by pattern) had nothing else.
- Done: exports carry which LoseIt rows were imported (`data/loseit-identities.json`), so a later LoseIt import
  after a move by export/import adds only new rows. Test in `loseit.db.test.ts` (fresh installation; fails without).
  The exact-file repeat check does not travel: the same LoseIt file again is then 0 new, not "already imported".
- Done: a failed nightly backup is retried for the failed repositories after an hour, three times a day at most
  (`OBUR_BACKUP_RETRY_SECONDS`; `OBUR_SCHEDULER_SECONDS` shortens the scheduler's 10-minute tick for tests). Also
  fixed: a backup before an upgrade between midnight and the backup hour stood in for that night's (off-site
  included); the scheduler now keeps `lastScheduledBackupAt`. Checks: image built, smoke test, off-site test with a
  new step (nightly backup with the store away, then retried once it returns).
- Done: the recipe and saved-meal editors' food search says it needs a connection instead of showing nothing (new
  message `foods_search_offline`, English and Turkish); household measures that failed to load are asked for again
  (they stayed failed until a reload, and the amount sheet then never opened offline). Checks: type-check, e2e for
  recipes, saved meals and offline (28 passed, 3 skipped by design).
- Checks (everything since beta.16): type-check, lint, build, 1123 unit and database tests, e2e 247 passed (18
  skipped by design, no failures), image built, smoke test, off-site test.
- Next: the owner decides on a release (beta.17).

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
  ((a private review page in the owner’s Claude app), version 10, db collection `review`). Source:
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
- Review done (owner, 2026-11-14, (a private review page in the owner’s Claude app), collection `review`, ids `tr-*`):
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
  and coming out. Demo artifact (a private review page in the owner’s Claude app) (Current / A Dissolve / B Push);
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
