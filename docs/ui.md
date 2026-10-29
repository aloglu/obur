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
- **Budget card:** a ring showing eaten ÷ budget with "kcal left" or "kcal over" in the middle. Eaten, Budget and the equation (base + activity − deficit) sit beside it, never wrapped below. The ring is 128 px on phone and 150 px on desktop.
- **Ring colours:** accent while under budget. When over, the ring and number turn **red** (`bad`). This was the owner's explicit choice.
- **Nutrients card:** protein, carbohydrate and fat bars against their targets. Fibre, sugars, saturated fat and salt sit in a 2×2 grid. Unknown values show a "+" and "N entries unknown", never zero.
- **Water and weight:** side-by-side cards with +250 / +500 ml buttons and a decimal-comma weight input.
- **Meal cards:** Breakfast, Lunch, Dinner and Snacks, each with its kcal total and a **+** button. Each entry row shows a two-line clamped name, quantity, badges ("Waiting to sync", "Macros unknown") and kcal. Tapping an entry opens Edit.
- **Desktop layout:** two columns, with Today on the left and the Log panel as a sticky 380 px panel on the right.

**Log**
- **Idle state:** the search field, then two large centred tiles, **Speak** (olive icon tile) and **Scan a label** (ochre icon tile). There are no descriptions under the tiles. Until a feature is built (voice in Phase 2, scanning in Phase 3), its tile is shown disabled with a "Coming soon" label (owner decision, 2026-10-25); once built, a tile switched off in configuration is hidden. Below them is a "Quick add calories" ghost button.
- **Suggestions:** they appear only when the search field is focused and empty. A Cancel button then returns to the tiles. Typing replaces suggestions with results.
- **Search matching:** Turkish-insensitive, so "sutas" finds "Sütaş Ayran".
- **No results:** the empty state points to scanning or quick add.
- **The meal's +:** goes to Log, not a modal, with the meal preset. An "Adding to Lunch · Today" pill shows the preset and can be cleared. On desktop the panel is already visible, so + only sets the preset. A modal would duplicate search, voice and scan.
- **Picking a food** opens a sheet (bottom sheet on phone, 440 px right-side sheet on desktop) with these steps:
  1. The basis line, then the amount (decimal comma) and unit chips.
  2. Day chips: Today / Yesterday, or the viewed day plus Today.
  3. Meal chips.
  4. A live kcal and P/C/F preview, then Save.
  5. After Save it returns to Today, briefly highlights the new row and shows a toast.
- **Speak:**
  1. A pulsing mic with "Listening… say what you ate" and a bilingual example, plus Done.
  2. "I heard" as editable text.
  3. One card per parsed food, with an editable amount, unit, kcal, meal and day, and a remove button.
  4. "Log all (N)" saves them; "Try again" restarts.
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
- Below the calendar: weight chart, averages and achievements. Not designed yet.

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

### Icons

The demo's line icons are hand-drawn: 24 px grid, 2–2.4 px stroke, round caps. In the app, use Lucide (ISC licence) in the same style.

## 4. Deliberately left open

- **Progress below the calendar:** weight chart, averages, per-kilo achievements, and the "joy" moment when an achievement lands.
- **Unfinished screens:** Profile and goals, Units and formats, Your data, Household and admin, and onboarding (including BMI). Provisional versions of Profile, onboarding, Your data and Household exist (Phase 1 steps 7 and 10) and need the owner's review.
- **Barcode:** with no outside product lookups, a barcode only finds products someone in the household already scanned. The proposal is to add it later as a shortcut inside Scan, not as its own tile.
- **Voice quick adds:** voice could also handle "500 calories, dinner". If it does, the Quick add button could move to the no-results state only.
- **Voice error states:** nothing heard, low confidence, a food not found (offer to create it or quick add), voice turned off in `.env` (hide the tile).
- **Scan error states:** no table found, several tables, kJ/kcal mismatch, a per-serving label without a serving size, scan turned off in `.env` (hide the tile).
- **Marking a day complete:** the control on Today (and its undo) is not designed yet. The calendar depends on it.
- **Offline and pending:** only the "Waiting to sync" badge is designed. A global offline indicator and sync-failure states are not.
- **Other logging flows:** recipes and saved meals. A provisional food create/edit screen (`/foods/new`, `/foods/[id]`) was built in Phase 1 step 4 following the scan confirmation layout above: basis chips, one row per value with empty rows marked unknown, a "<" toggle per value, live plausibility warnings, portions, Shared/Only me, an EU-Turkey/US label switch (US maps carbohydrate to total carbohydrate and salt to sodium), "Make my own variant" and Archive. It needs the owner's review before it is considered designed.
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
