# obur — UI direction

The owner chose this direction from three demos. It is the source of truth for the look and behaviour of the interface. Where it disagrees with `docs/design.md`, this file wins on visual and interaction matters, and the conflict is listed under "Changes to other docs" so design.md can be updated.

The reference demo is `docs/ui/pazar-demo.dc.html`. It was built in a design-canvas format: the markup with `{{holes}}`, `<sc-if>` and `<sc-for>`, and the `Component` script at the bottom, show the structure, styles and behaviour exactly. It does not run outside that canvas, so read it, don't serve it. Do not copy its inline-style approach; build proper Svelte components with Tailwind using the tokens below.

## 1. Direction: Pazar

Pazar (Turkish: "market", also "Sunday") is warm and friendly but practical first. It uses off-white and warm-brown neutrals, one terracotta-orange accent, rounded cards, a characterful display face for headings and numbers, and a plain, highly legible body face.

The owner chose it over the other two directions (Defter, a dense ledger with hairlines and a monospace face; Lokum, a playful pastel design with colour-coded meals) for these reasons:
- It reads at a glance on a phone.
- It has personality without being tacky.
- Its information density sits between the two alternatives.

## 2. Screens and behaviour (as decided in review)

**Navigation**
- **Phone:** a floating pill tab bar inset 12 px from the screen edges, with Today, Log, Progress and More. The active tab gets a soft accent background and accent text.
- **Desktop (≥ 760 px):** a 232 px side nav with Today, Log and Progress at the top, and Profile and Settings pinned at the bottom. The side nav is sticky at full viewport height, so the bottom links are always visible. There is no More on desktop.
- **More (phone only):** Appearance first, then rows for Profile and goals, Units and formats, Your data and Household (admin).
- **Theme:** chosen in Settings (desktop) or More (phone) as System / Light / Dark, with System as the default. There is no theme toggle in the header.

**Header**
- Shows previous day, then the title (Today / Yesterday / "Thu 15 Oct") with the long date under it, then next day.
- The next-day arrow is disabled on today. You can go back as far as the data goes.
- On desktop the header spans only the left column, so the next-day arrow lines up with the cards' right edge. On phone the title is centred.

**Today**
- **Budget card** (owner's pick 2026-10-30, "number and bar", from an Artifact comparing it with the ring, an equation-tiles card and a half gauge): "kcal left" or "kcal over" as the headline (Bricolage 44 px phone, 48 px desktop) with a compact **+ Activity** pill beside it; one full-width 12 px bar of eaten ÷ budget; Eaten at its left end and Budget at its right. The budget's breakdown is not on the card face (the owner found the "base + activity − goal" line spoils the design): tapping **Budget** opens rows for Base burn (or Your own target), Activity, Goal and the total, plus the activity-not-added and minimum notes. Without a budget the headline is "kcal eaten" with a Set up link. The owner may revisit a ring if the activity button and breakdown can be placed well; the calendar keeps its rings.
- **Budget colours:** accent while under budget. When over, the bar and number turn **red** (`bad`). This was the owner's explicit choice.
- **Nutrients card:** protein, carbohydrate and fat bars against their targets. Fibre, sugars, saturated fat and salt sit in a 2×2 grid. Unknown values show a "+" and "N entries unknown", never zero.
- **Water and weight:** side-by-side cards with +250 / +500 ml buttons stretched across the first row and a full-width **Other amount** button below them that turns, in place, into a field with a tappable **ml / l** suffix (per entry, starting at ml; a typed "3,5 l" also works; up to 10 l) and a round check button (owner review 2026-10-30), and a decimal-comma weight input. Each card has an **Edit** link (shown once something is recorded) that opens a sheet: Water lists the viewed day's additions, Weigh-ins lists all readings newest first, 20 at a time with **Show older**. Each row has Edit (inline value, decimal comma) and Delete; a deleted row stays in place, struck through, with its own Undo, because a toast would sit behind the sheet. A weight change that moves a calculated budget says so at the top of the sheet (added 2026-10-30, provisional).
- **Meal cards:** Breakfast, Lunch, Dinner and Snacks, each with its kcal total and a **+** button. Each entry row shows a two-line clamped name, quantity, badges ("Waiting to sync", "Macros unknown") and kcal. Tapping an entry opens Edit.
- **Desktop layout:** two columns, with Today on the left and the Log panel as a sticky 380 px panel on the right, starting level with the Budget card (the day header sits above, in Today's column only).

**Log**
- **Idle state:** the search field, then two large centred tiles, **Speak** (olive icon tile) and **Scan a label** (ochre icon tile). There are no descriptions under the tiles. Until a feature is built (voice in Phase 2, scanning in Phase 3), its tile is shown disabled with a "Coming soon" label (owner decision, 2026-10-25); once built, a tile switched off in configuration is hidden. Below them is a "Quick add calories" ghost button.
- **Suggestions:** they appear only when the search field is focused and empty. A Cancel button then returns to the tiles. Typing replaces suggestions with results.
- **Search matching:** Turkish-insensitive, so "sutas" finds "Sütaş Ayran".
- **No results:** the empty state points to scanning or quick add.
- **The meal's +:** goes to Log, not a modal, with the meal preset. An "Adding to Lunch · Today" pill shows the preset and can be cleared. On desktop the panel is already visible, so + sets the preset there; the pill pulses briefly, the panel's outline flashes for under a second, and the pill is announced to screen readers (owner report 2026-10-30: the change was easy to miss; no motion with reduced motion). Focus stays put, so the panel keeps the same tiles as the phone's Log screen. A modal would duplicate search, voice and scan.
- **Picking a food** opens a sheet (bottom sheet on phone, 440 px right-side sheet on desktop) with these steps:
  1. The basis line, then the amount (decimal comma) and unit chips.
  2. Day chips: Today / Yesterday, or the viewed day plus Today.
  3. Meal chips.
  4. A live preview, then Save: kcal as the headline, then Protein, Carbs and Fat, each with a dot in its Nutrients-card colour (owner request 2026-10-30; the earlier one-line "P · C · F" was hard to read). Unknown is "?"; estimates show "≈" and bounds "<"; carbohydrate falls back to an imported value of unstated definition, with a note. The same preview is used on Check and log cards and when editing an entry.
  5. After Save it returns to Today, briefly highlights the new row and shows a toast.
- **Speak:**
  1. A pulsing mic with "Listening… say what you ate" and a bilingual example, plus Done.
  2. "I heard" as editable text.
  3. One card per parsed food, with an editable amount, unit, kcal, meal and day, and a remove button.
  4. "Log all (N)" saves them; "Try again" restarts.
- **Typed entry (provisional, built 2026-10-30, owner to review):** typing a sentence with more than a food's name in the Log search ("kahvaltıda iki dilim ekmek ve iki bardak su", "bugün 80,5 kiloydum") adds a **Log as typed** row above the results, with the number of items and the day. It opens **Check and log**, the same layout planned for Speak: "You typed" as an editable two-line text with **Read again**, then one card per item (food: a chooser among the candidates, amount, unit chips and live kcal, with prompts when the amount or unit is missing; calories only, water, weight and activity: their value), shared Day and Meal chips, and **Log all (N)**, enabled only when every card is complete. Each card has a remove button. After saving, one toast with one Undo for everything. Needs a connection.
- **Scan a label:**
  1. A camera frame filling the sheet width, with the hint "Fill the frame with the nutrition table", and "Take photo" (or "Choose a photo" on desktop).
  2. A "Reading the nutrition table…" state that says it runs on your own server.
  3. The product name field, typed by the user since the name is never read from the label.
  4. Basis chips: per 100 g / per 100 ml / per serving.
  5. An editable row for each value. Missing values are empty, highlighted in the warning colour and labelled "unknown".
  6. Notes, for example "Fibre isn't on this label…" and "Energy matches the label's kJ value; %RI column ignored".
  7. "Save food and choose amount" leads to the normal amount sheet. "Retake photo" goes back to the camera.
- **Quick add calories:** kcal, an optional description, day and meal. The note says the other nutrients stay unknown. It is the fallback for food known only by its calories (a bakery simit, a meal at a friend's).
- **Barcode:** deliberately not in the UI yet (see open items).

**Edit entry**
- A sheet with the amount and unit (or kcal for quick adds), then Save changes.
- "Move to…" expands an inline list of meals with the current one disabled.
- Delete removes the entry immediately and the toast offers **Undo**. There is no "are you sure" dialog.

**Toast**
- Appears bottom-left of the main area on desktop and above the tab bar on phone.
- It has a check icon that pops in, a bold message and a muted detail ("Logged to Lunch · 240 kcal"), plus Undo where relevant.
- It lives for 5 s and uses `role="status"`.

**Progress**
- **Month calendar** at the top:
  - Weeks start on Monday, and each day has a small ring with its date inside (40 px on phone, 54 px on desktop).
  - The ring fills by eaten ÷ budget: **green** (`good`) when the day is marked complete and at or under budget, a full **red** (`bad`) ring when over. A logged day that is not marked complete fills in a neutral colour (`muted`), so incomplete logging is never shown as success (owner decision, 2026-10-25).
  - Today has an accent outline. Days with no logs show only the track, and future days have no ring and are disabled.
  - Tapping a day opens that day's Today view. Arrows move between months.
  - Each cell's accessible name reads like "Thursday, 15 October: 1,840 of 2,000 kcal, 160 under".
  - Below the grid: a key and a month summary ("17 days under, 4 over, 3 not logged"). Today isn't counted. "Under" counts complete days only; incomplete days need their own wording in the summary and key.
- **History below the calendar** (owner chose layout B with changes, 2026-10-31; demos in the session's Artifact):
  - Phone: a tab bar **Weight / Calories / Nutrients** with a compact range dropdown (1W, 1M, 3M, 1Y, All; all time by
    default) beside it, one tone like the tabs' tray (no raised pill, no focus ring on tap; owner 2026-10-31) in its own tray; one topic at a time, each with a headline number, a chart and a few stat rows.
  - Desktop: no tabs; two columns, the calendar beside Weight, then Calories beside Nutrients, with the range
    dropdown beside the page title.
  - Weight: a **Readings / Trend** switch in the card (Readings by default; the choice is remembered on the
    device). Readings: the weigh-ins as points joined by a line; headline "Latest weigh-in" with the change since the
    first weigh-in in the range; rows to goal, average change per week, weigh-ins, lowest reading. Trend: the smoothed
    weight as the line with the weigh-ins faint behind it; headline "Smoothed weight" with the pace per week and the
    line "Evens out day-to-day swings from water and food."; rows to goal, change in the range, weigh-ins. Both: goal
    as a dashed line when it is within the chart (otherwise a note of the distance), dashed across gaps over a week. The
    card keeps one height in both views (each view's headline, rows and readout share a cell; owner, 2026-10-31), and
    on desktop the calendar and the Weight card are the same height, spare room above the calendar's key and the
    weight rows.
  - Calories: bars against a budget step line; over budget striped red, under green, days not marked complete as
    outlines, unlogged days as a dash when bars are wide enough; weekly averages from 3 months up.
  - Nutrients: average protein, carbohydrate and fat against the targets, with a coverage note when some days are
    unknown.
  - Tapping or dragging on a chart shows that day's (or week's) values in a readout line below it; each chart has a
    text summary for screen readers.
  - Achievements: a later item; they will sit at the top of the Weight tab.

**Profile, Settings and the More rows:** placeholders only.

## 3. Tokens

### Colour

| Role | Light | Dark | Used for |
|---|---|---|---|
| bg | `#F6F3EE` | `#161310` | page background |
| surface | `#FFFFFF` | `#211D19` | cards, sheets, tab bar |
| surface2 | `#F1EBE3` | `#2C2722` | inputs, chips, tiles, inner boxes |
| line | `#E5DDD2` | `#3A332C` | borders, dividers |
| text | `#1E1A16` | `#F4EEE7` | primary text |
| muted | `#665D53` | `#B6AB9F` | secondary text, inactive tabs |
| accent | `#C2410C` | `#FF8F55` | brand, primary buttons, active nav, ring while under budget |
| onAccent | `#FFFFFF` | `#2A1304` | text on accent |
| soft | `#FDF0E7` | `#3D2619` | accent-tinted backgrounds (active tab, + buttons, preset pill, just-logged row) |
| good (success) | `#2E7D3B` | `#6CCB7A` | complete days at or under budget in the calendar |
| bad (over budget) | `#C62F3A` | `#FF6B6B` | over-budget ring and number; over days in the calendar |
| warn (warning) | `#8A4B00` | `#F2B65A` | "Waiting to sync", unknown scan values |
| warnSoft | `#FCEFD9` | `#3A2C14` | warning backgrounds |
| track | `#EFE6DB` | `#342D26` | empty part of rings and bars |
| protein | `#C2410C` | `#FF8F55` | protein bar |
| carb | `#9E6510` | `#E7B45C` | carbohydrate bar |
| fat | `#5E7F3F` | `#9CC77A` | fat bar |
| voice / voiceBg | `#4F6E33` / `#E7EEDD` | `#B3D392` / `#2A3322` | Speak tile icon |
| scan / scanBg | `#8A5A00` / `#F8E9CC` | `#EDBE66` / `#3B2F18` | Scan tile icon |
| toastBg / toastText | `#2A241F` / `#FFFFFF` | `#F4EEE7` / `#1E1A16` | toast (inverted) |
| scrim | `rgba(30,26,22,.42)` | `rgba(0,0,0,.6)` | behind sheets |

**Contrast:**
- All text pairs pass WCAG AA (4.5:1). Lowest pairs in light: accent on soft 4.6, voice and scan icons on their tiles 4.9. Lowest in dark: bad on surface 6.0.
- Ring and bar colours reach at least 3.5:1 against track.
- Values are always printed as numbers too, so colour is never the only carrier.
- Red and green are hard to tell apart for red-green colour-blind users. The calendar's shape helps: an over ring is always full, an under ring always has a gap.

The old `over` purple from the brief's "calm over-budget" rule is dropped.

### Type

- **Fonts:** Bricolage Grotesque (display: headings, the budget number, the logo) and Inter (everything else). Both are SIL OFL and include the Turkish letters. Self-host them in production; the demo loads them from Google Fonts.
- **Numbers:** use `font-variant-numeric: tabular-nums` for all figures.

| Style | Font | Size / weight |
|---|---|---|
| Budget number | Bricolage | 36 desktop / 30 phone, 800, −0.03em |
| Logo | Bricolage | 30, 800 |
| Page title (h1) | Bricolage | 24, 750 |
| Panel title | Bricolage | 22, 750 |
| Sheet title | Bricolage | 21, 750 |
| Card / meal title | Bricolage | 19, 700 |
| Primary button | Inter | 17, 750 |
| Input, side nav | Inter | 16, 600 |
| Body, rows, chips | Inter | 15, 550–650 |
| Secondary | Inter | 14 |
| Meta, labels | Inter | 13, labels 650 |
| Caption, list heads | Inter | 12–12.5 (list heads uppercase, +0.06em) |
| Tab label | Inter | 11.5, 700 |

### Spacing, sizes and radius

- **Spacing scale (px):** 2, 4, 6, 8, 10, 12, 14, 16, 18, 24, 28.
  - Card padding is 18. Gaps between cards are 12. The two desktop columns are 24 apart.
  - Page gutters: 14 on phone, 28 on desktop. Content max width is 1064 px.
- **Sizes:**
  - Touch targets at least 44 px. Inputs 48 px, primary buttons 52 px, tab items 52 px, entry rows 56 px.
  - Header 60 px. Side nav 232 px. Desktop log panel 380 px, desktop sheet 440 px.
  - Phone/desktop switch at 760 px.
- **Radius:**
  - 999: pills, chips, tab bar and tabs, + buttons.
  - 26: sheets.
  - 22: cards and panels.
  - 18: tiles and toast.
  - 16: primary buttons and tile icons.
  - 14: inputs, rows, ghost buttons, nav items.
  - 12: small buttons, notes, inner boxes.
  - 10: menu items.

### Elevation

- **Cards:**
  - Light: `0 1px 2px rgba(60,40,20,.06), 0 8px 24px rgba(60,40,20,.08)`.
  - Dark: `0 1px 2px rgba(0,0,0,.5)`. Dark mode relies on surface steps rather than shadows.
- **Tab bar:**
  - Light: `0 8px 30px rgba(60,40,20,.16)`.
  - Dark: `0 8px 30px rgba(0,0,0,.5)` plus a 1 px `line` border.
- **Sheet:** `0 -8px 40px rgba(0,0,0,.2)`.
- **Toast:** `0 10px 30px rgba(0,0,0,.25)`.

### Motion

- **Toast and check:** 260 ms `cubic-bezier(.2,.9,.3,1.25)` (a slight overshoot) for movement and scale. 180 ms ease for opacity.
- **Toast lifetime:** 5 s.
- **Voice mic pulse:** 700 ms.
- **Reduced motion:** with `prefers-reduced-motion`, no movement or pulse; changes are instant.

### App icon (the owner's artwork, 2026-10-31)

- Source: `assets/brand/` (1024 px PNGs, used as the source because the SVGs have small outline flaws; MIT like
  the rest of the repository, owner's choice). `./scripts/brand-icons.sh` (ImageMagick 7) makes the served files.
- Home screen (iOS `icon-180.png`, manifest `icon-192.png` / `icon-512.png`): the version with its dark background.
  Android's maskable icon (`icon-maskable-512.png`) is the same at 88 % so the O stays inside the crop circle.
- Logo and browser tab icon (`static/brand/`, empty margin trimmed): the brown bowl in light, the cream bowl in dark
  (`AppLogo`; the tab icon follows the browser's scheme). The logo sits left of the wordmark on the sign-in screens
  (36 px) and the desktop sidebar (32 px).

### Food icons (owner's choice 2026-10-30: OpenMoji)

- OpenMoji 15.1.0 food and drink icons (CC BY-SA 4.0; credit at the foot of More), bundled in `static/icons/food/`.
- A food shows its chosen icon, else the one its name suggests (`shared/food-icons.ts`: English and Turkish words,
  the match nearest the end of the name wins), else a plate. Quick adds use their description.
- Shown as a 40 px tile with a 28 px icon, left of the name, in meal cards, Log search and recent foods, the Foods list,
  and the saved meal and recipe editors. The tile follows the theme (`--icon-tile`); in dark the icons use a variant
  with OpenMoji's black outlines redrawn light (`static/icons/food/dark/`, from `node scripts/food-icons-dark.ts`;
  owner found the bright tiles out of place in dark mode, 2026-10-30). Decorative: the name always sits beside it.
- The food form's and recipe editor's **Icon** row shows the current icon and whether it is suggested or chosen; **Change icon** opens a
  picker (search in English or Turkish, a grid of tiles, "Use the suggestion from the name" when one is chosen).

### Icons

The demo's line icons are hand-drawn: 24 px grid, 2–2.4 px stroke, round caps. In the app, use Lucide (ISC licence) in the same style.

### Rules from the owner's screen review (2026-10-30)

- **Never stack two choices.** Two chips or buttons offered as a choice sit side by side at equal width (the shared
  `Chips` component does this for two options); shorten the labels rather than shrink the text. The exception is a
  different kind of action under a row of choices, using the full width (Water's **Other amount** below +250 / +500).
- **Row buttons in a list share one width,** whatever the length of the name beside them; long names truncate.
- **No sentences broken across lines for numbers.** Show figures as a headline plus labelled rows (Profile's Current
  budget) instead of one long line.
- **Card contents align with the card title.** Rows keep their padded highlight by sitting in a list pulled out by
  the same padding.
- **Small round actions in a card header** (meal card + and bookmark): a 36 px circle inside a 44 px tap target, alike
  in shape, told apart by colour (accent for adding, muted for secondary actions).
- **Live result previews keep their layout still:** the number that changes sits in a fixed-width column, so the
  values beside it don't move as it gains or loses digits.

## 4. Deliberately left open

- **Progress below the calendar:** history decided (§2, Progress); per-kilo achievements and the "joy" moment when an achievement lands remain open.
- **Unfinished screens:** Profile and goals, Units and formats, Your data, Household and admin, and onboarding (including BMI). Provisional versions of Profile, onboarding, Your data and Household exist (Phase 1 steps 7 and 10) and need the owner's review.
- **Barcode:** with no outside product lookups, a barcode only finds products someone in the household already scanned. The proposal is to add it later as a shortcut inside Scan, not as its own tile. Not building (owner, 2026-10-31) unless real use shows packaged products are slow to find.
- **Voice quick adds:** voice could also handle "500 calories, dinner". If it does, the Quick add button could move to the no-results state only.
- **Voice error states:** nothing heard, low confidence, a food not found (offer to create it or quick add), voice turned off in `.env` (hide the tile).
- **Scan (provisional, built 2026-10-30, owner to review):** the Log panel's Scan tile opens `/scan`: a card with a one-line explanation, three tips (fill the photo with the table, good light without glare, hold curved packs flat) and **Take photo** (camera) / **Choose photo** side by side; "Reading the label…" while it works. The result shows the photo (Hide/Show), a note to check every value and that unreadable values are empty, then **New food** with the food form filled in (name and brand to type). Below the form, **Log it after saving** (on by default, remembered on the device; owner request 2026-10-30): on, Save opens Log's amount sheet for the new food; off, Save stays on Scan, ready for the next label, with a toast. After a result the tips step aside and the camera button reads **Retake**. Errors: no table read (the form stays empty to fill in), busy, too many scans, an unreadable photo, unavailable, offline. Several tables on one pack and barcodes are not handled yet.
- **Marking a day complete:** a full-width **Day complete** switch below the meal cards, styled like a card, with its hint below (owner review 2026-10-30). Turning it off is the undo. The calendar depends on it.
- **Offline and pending:** only the "Waiting to sync" badge is designed. A global offline indicator and sync-failure states are not.
- **Saved meals (provisional, built 2026-10-30, owner to review):** a muted bookmark button beside a meal card's total (only when it has entries) opens **Save as a meal**: a name (defaults to the meal's name) and a checklist of the meal's entries, all ticked. In Log, saved meals appear above Recent when the search field is focused (the five most recently changed) and above food results when their name matches (Turkish-insensitive). Picking one opens a sheet titled with its name: the item checklist, the same Day and Meal chips as the amount sheet, and **Log N items · X kcal**, which creates ordinary entries with one Undo in the toast. The sheet is for logging only; an **Edit meal** link below opens the editor (owner review 2026-10-30: managing and logging are separate). More/Settings has a **Saved meals** page listing them all, each opening its editor, with **New meal**. The editor: a Name card; a Foods card with the running total, each item a row (name, quantity, kcal) that expands to Amount, unit chips, the macro preview and **Remove from meal**; **Add food** opens a sheet to search and pick an amount; **Cancel** and **Save** side by side. For an existing meal, a **More** card offers **Update to current food values** (disabled until changes are saved or cancelled) and **Delete saved meal** with an inline confirmation. Saved meals need a connection (not part of the offline queue).
- **Recipes (provisional, built 2026-10-30, owner to review):** More/Settings has **Recipes**, a list with energy per serving and **New recipe**. The editor shares the saved meal editor's ingredient list (rows that expand to amount, unit chips, preview and Remove; **Add food**, which refuses recipes): above it a card with Name, Shared/Only me (with a note that others see only totals), **Servings it makes** and **Cooked weight (g, optional)** side by side with a hint; below it **Per serving** with the macro preview, the serving's weight and a note when energy is unknown; **Cancel** and **Save**; for an existing recipe **More** with Update to current food values and Archive (confirmed inline). A recipe's food page links its owner to the editor and tells others it is a recipe with values per serving.
- **Other logging flows:** A provisional food create/edit screen (`/foods/new`, `/foods/[id]`) was built in Phase 1 step 4 following the scan confirmation layout above: basis chips, one row per value with empty rows marked unknown, a "<" (less than) checkbox per value, explained in the hint above the rows, an optional **More nutrients** disclosure for the source-backed extra codes (fat types, cholesterol, starch, polyols, calcium, potassium, iron; open when the food has any), live plausibility warnings, portions, Shared/Only me, an EU-Turkey/US label switch (US maps carbohydrate to total carbohydrate and salt to sodium), "Make my own variant" and Archive. It needs the owner's review before it is considered designed.
- **Calendar details:** which month it opens on when you come from a past day (the demo always opens the current month); a just-under day that looks almost full.
- **Day titles:** for older days, whether "Thu 15 Oct" in the title duplicates the long date underneath.
- **Tablet:** only the 760 px switch was checked.
- **Testing:** full dark-mode contrast and 200 % zoom testing on the real build.
- **Demo data:** the demo uses fixed dates (today = Sunday 25 October 2026) and made-up past days. It is not test data.

## 5. Implementation notes (Phase 1, step 5)

Routine choices made while building the screens; none changes the direction above. Listed so the owner can review them.

- **Sign out** sits at the bottom of Settings (desktop) and More (phone), under "Signed in as …". The demo did not place it.
- **Default meal** for a new entry when no meal was preset: breakfast 04:00–10:30, lunch 11:00–15:00, dinner 17:00–21:30, otherwise snacks (device time zone).
- **After midnight** (before 04:00) the amount sheet keeps Today selected and shows "It's after midnight. Did you mean yesterday?" above the day chips, as the design asks (offer, never silently change).
- **Budget card** shows calories eaten and "Budget: Not set yet" until goals arrive (Phase 1, step 7); the ring structure is already in place.
- **Nutrient bars** are drawn relative to each other until targets exist (step 7). "Partial · N unknown" marks totals where some entries lack the value; "Unknown" when none has it.
- **Desktop Log panel** starts fresh after each save (query and preset cleared).
- **Theme** choice is per device (cookie) so the server renders the right theme without a flash; System is the default.
- **Day titles** are formatted by hand ("Tue 20 Oct", "Tuesday 20 October 2026") because browser engines format dates differently.
- **Portion text**: "1 bar" for one basis serving, "2 × 1 bar", "3 × slice (26 g)", "2 × Su bardağı (200 ml)".

## 6. Changes to other docs

- `docs/design.md`: replace "calm over-budget" with red for over budget (the ring on Today and the calendar), by the owner's choice.
- `docs/design.md`: voice and label scanning are part of the core logging UI (Speak and Scan tiles on Log). They still need hiding when switched off in `.env`.
- `docs/design.md`: suggestions show only when the search field is focused. There are no standing Favourites/Recent lists.
- **Your data** (step 10, provisional): three cards. Export ("Download export"), Import (choose a file, then a preview table of New / Already here / Kept as is per kind with plain-language warnings, then "Import"), and Delete account (a keep/remove choice for shared foods, the backup-retention note, and a confirmation sheet with an "I understand" checkbox).
- **Household** (step 10, provisional): a People card with "Delete account" for others (confirmation sheet with the same shared-foods choice), and a Deleted accounts card listing opaque IDs and dates with the instruction to keep a copy off the server.
- **Imported carbs** (Phase 2, provisional): LoseIt does not state its carbohydrate definition. The Nutrients card shows Carbs from the excluding-fibre values when any entry has one; on a day with only imported values it shows those with "Definition not stated (imported)"; on a mixed day it shows the stated total with "+ N g with the definition not stated (imported)". The two are never added together.
