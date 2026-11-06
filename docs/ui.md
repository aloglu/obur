# obur — UI direction

The owner chose this direction from three demos. It is the source of truth for the look and behaviour of the interface. Where it disagrees with `docs/design.md`, this file wins on visual and interaction matters, and the conflict is listed under "Changes to other docs" so design.md can be updated.

The current reference is `docs/ui/review-2026-11/` (see "Design review" below). The original demo is `docs/ui/pazar-demo.dc.html`. It was built in a design-canvas format: the markup with `{{holes}}`, `<sc-if>` and `<sc-for>`, and the `Component` script at the bottom, show the structure, styles and behaviour exactly. It does not run outside that canvas, so read it, don't serve it. Do not copy its inline-style approach; build proper Svelte components with Tailwind using the tokens below.

## Design review, November 2026

The owner reviewed every screen, on phone and on desktop, over five rounds and two theme rounds (2026-11-01 to 2026-11-06). **Where this section disagrees with anything below, this section wins.** Older text is replaced as each screen is built (`docs/progress.md`, "Design review build").

The final demos are in `docs/ui/review-2026-11/`: `diary.html` (the daily app and More), `account.html` (signing in, first day, Profile, Security, Household, Your data, Help) and `open-ends.html` (empty states, Speak and Scan failures, offline, install). They run in a browser and show exact sizes, states and wording. They are a reference, not code to copy: they open in Sade, carry review-only controls, and fake the data. Build proper components with the tokens.

### Across the app

- **Corners.** One set: cards 22, buttons and fields 14, small controls 10. Only things round by nature stay round: icon buttons, switches, avatars, dots and rings. No fully rounded toggles or chips anywhere (owner, three times), and the tab bar and its active item use the same corners.
- **Choices.**
  - In sheets, **Day** and **Meal** are two fields side by side. Each opens a menu with a tick on the current choice, as wide as its field.
  - **Settings choices** are rows showing the value; tapping opens a menu (Goal pace, Units, Profile, the LoseIt weight unit).
  - **Every other open menu is only as wide as its longest option** and lines up with the right edge of its row. It never stretches across the row.
  - **The unit sits inside the amount field:** "piece ⌄" opens a menu when there are several units; a single unit (g, ml) is plain text, not a button.
  - **Forms with two or three options filled in once** (Female / Male, Shared / Only me, Appearance mode) keep a segmented control with the usual corners. **Type it** has a toggle listing all four meals.
- **One warning style.** A plain surface card: an icon tile coloured by severity (grey information, amber needs you, red failure, green done), a bold one-line title, a short line under it, actions below when there are any. Used for offline and back online, a refused entry, entries waiting while signed out, no microphone, Speak switched off, and the recovery-codes warning. The card itself is never tinted. Household's backup status keeps its own larger line.
- **Fewer descriptions.** No explanatory text under titles and fields unless the owner kept it. Help carries explanations; no inline "?" links. Help's topics scroll sideways by finger (with a soft fade at the edge), and by dragging with a mouse.
- **Checkbox.** One app-drawn style, for example "I've saved these codes", the pregnancy questions and delete confirmations.
- **Inline fields** (Other amount, New weigh-in and so on): a tap on any non-interactive area closes them without saving, and so does opening another one. Only one is open at a time.
- **Examples and placeholders are in English,** in the English interface, although Turkish input works (including messages such as `speak_example`).
- **Macro colours** do not follow the accent. Protein, carbs and fat change together, per theme, never protein alone.
- **Keyboard.** An open sheet sits on top of the on-screen keyboard (`visualViewport` inset).
- **Wide screens.** The desktop layout starts at 760 px: icon rail on mid widths, labelled sidebar from 1100 px. Sheets become centred dialogs. Today has two columns, other pages use reading widths. Keys: ←/→ for days, Enter and Esc in dialogs. Chart text keeps a fixed size rather than scaling (13.5 px on desktop).

### Themes

**Pazar stays the default** (owner, 2026-11-06, after two rounds of alternatives). Themes are chosen in More → Appearance; light, dark or system is a separate choice. Every theme is complete, in light and dark, including macro colours; each must pass the contrast test. All values are in `docs/ui/review-2026-11/diary.html`, in the last style block and the base tokens.

| Theme | Light | Dark |
|---|---|---|
| **Pazar** (default) | As in Tokens below | As in Tokens below |
| **Sade** | Neutral greys `#F6F5F4`, one blue accent `#2563EB` | `#111113` with `#6EA2FF` |
| **Zerde** | Butter page `#FBEFCB`, saffron buttons `#F5B301` with dark text, pomegranate links `#8B1E4A` | Warm dark `#1C130A`, saffron accent |
| **Patlıcan** | Rosy oat page `#F5E8E2`, aubergine `#5B1F52` | Plum `#1A0E19`, buttons `#8A3D7D`, links `#E6A4D4` |
| **Zeytin** | Oat page `#EFEAD2`, olive `#55600F` | `#15160A`, accent `#CBD66A` |
| **Disko** (80s) | Pink page `#FFD9EF`, cyan fields, hot pink buttons `#FF4FB0` with dark text, links `#B8007F` | Indigo `#120829`, neon buttons `#FF2E9A`, thin neon glow on cards |
| **Kaset** (90s) | Turquoise page `#6FE3D6`, purple `#5B1FBF`, yellow fields, hard outline and block shadow on cards | `#12103A`, yellow `#FFE14D`, turquoise outlines, pink block shadows |
| **Sinyal** (modern, bright) | Acid page `#C6FF00`, white outlined cards, black buttons with acid text, blue links `#2020E8` | `#0A0B08`, acid accent, outlined cards |

- A separate `--fill` token sets the background of filled buttons when it differs from the link colour `--accent` (Zerde, Disko, Sinyal, dark Patlıcan). Shadow tokens carry Kaset's and Sinyal's outlines.
- Rejected as default: Sade (too cold for a food app), Warm ink, Marigold, Rosewood, Persimmon. Rejected outright: Kayısı, Defter, Lokum. The default search is closed for now.
- Open: the app icon is Pazar's orange on every theme, and the fonts are unchanged. Neither has been reviewed against the new themes.

### Motion

The owner expects the motion in the demos, not only their layout (2026-11-06). Curves: `--travel` for things moving across, `--ui` for things opening. All of it stops with reduced motion, and none of it blocks input.

- **Built:** sheets slide up and down (dialogs fade and scale from 760 px) with the scrim fading, menus fade and scale from their own corner, the tab bar's and segmented controls' highlight slides (380 ms), a new page rises 8 px (220 ms), budget and nutrient bars travel to their value (600 ms).
- **Build with each screen; do not skip:** numbers roll digit by digit when they change (`roll` in the demos), fields and inline forms open with the `.collapse` height and fade, charts draw on, entries and rows animate in and out, toasts pop their check. Look for it in the demo's CSS and script for each screen.

**An open sheet holds the page behind it still** (`client/scroll-lock.ts`), and returns it to the same place when it closes. Closing gives the page back at once: the sheet unmounts immediately and a lifeless copy plays the slide-out, so nothing waits for the animation.

### Signing in and first day

- **Sign in:** icon and "obur" centred on the screen, one button low, no subtitle and no invite line. On desktop the group is centred, with 72 px between name and button.
- **Set up and Join:** no description under the title, no hints under fields, no closing line.
- **Recovery codes:** an amber warning card ("Keep these somewhere safe", shown only now), then "I've saved these codes" as its own row with the app's checkbox; Continue waits for it.
- **Signed out with entries waiting:** the regular sign-in layout, with the warning card right above the button. It must never cover the name.
- **The budget is a free choice.** First day is the real Today, only empty. After "Just log" nothing on Today mentions a missing budget; the only pointer is the toast when the welcome card is dismissed (More → Profile). Profile's empty card reads "Daily budget · Optional…". Repeatedly mentioning a missing budget makes people feel they are doing something wrong (owner).
- **Budget setup:** Body fat and Waist are always visible under the other fields, with no divider, expander or "Optional" in the label (the fields say it), and even spacing. No explanation under "Sex used by the formula".
- **Empty Journal day:** the date and Open, then only "Nothing logged", centred in its line; no kcal or dashes. A day with a weigh-in but no food keeps its columns, so the weight shows.

### Today

- **All cards share one surface** (no two-tone fills for hierarchy).
- **From 760 px:** two columns, Budget and meals on the left, the rest on the right. The Log panel is gone from Today: Add food opens the Log page on every screen size, so there is one way to log.
- **Budget card:** an Activity chip beside "kcal left" shows what is counted today and opens its sheet. The sheet takes any typed amount, with 100, 150 and 250 as shortcuts, and says in words what is already counted. The bar uses **status colours**: green with room, amber in the last 200 kcal or 10 %, red over; never the protein colour. Without a budget, the card is just "kcal eaten", with no bar and no link to set one up.
- **Water and Weight:** four aligned rows each. Weight has a sparkline of the last 7 weigh-ins and **New weigh-in**, which opens in place like Other amount. Slim side padding on phones. The older "Same as last time" button did not survive the redesign.
- **Edit sheets for water and weigh-ins:** rows with Edit and Delete. **Show older** is the last thing in the list, right after the oldest row shown, and scrolls with it; it adds 20 in place and goes away when nothing older is left.
- **Meal cards:** all four meals share one card, divided by lines. Each is one grid (icon, name, number) for its header, entries and a trailing **Add food** row; the meal total sits in the kcal column and an empty meal has no "nothing logged" text. The bookmark moves into the … menu as **Save as a meal**.
- **Day titles:** Today, Yesterday, the weekday for days this week, then the date with the weekday under it. The year shows only for other years.
- **Day notes:** a card that opens in place, above Mark the day complete (right column from 760 px). Closed, it shows the note's first line. A note saves itself half a second after typing stops, and when the app goes to the background. Tapping the text edits it; **Edit** does the same for keyboards. Markdown: `#` headings, `**bold**`, `*italic*`, `` `code` ``, `[links](https://…)`, `-` and `1.` lists, `- [ ]` to-dos that tick from the note, and `>` quotes. A note never renders as HTML. Up to 10,000 characters. See `docs/design.md`.
- **Editing an entry:** the amount sheet in edit mode (Save changes, or "No changes"; Move to…; Delete beside it; Undo toast).
- **More → Recently deleted:** 30 days, with Restore.
- **Hold-to-drag and select** stay as decided below, restyled.

### Logging

- **Log screen:** the search bar at the top on phone and desktop; three equal tiles (Speak, Scan a label, Type it); **Recent is always visible** and fills the room down to the tab bar (at least three foods). No meal or day dropdown in the header; a preset pill appears only after a meal's Add food. This replaces "suggestions only when focused" below.
- **Amount sheet:** one sheet with a rolling preview, using the fields above.
- **Type it** replaces Quick add and the search's "Log as typed" row: natural-language typing parsed into foods or calories-only items. The meal toggle follows the text ("for dinner"); removing the meal word returns to the tapped or preset meal. Only the placeholder gives an example ("two eggs and toast for breakfast"). Reading a sentence needs the server, so **Log calories only** stays: from a search that finds nothing, and from Type it when the server can't be reached. It is what can wait offline.
- **Speak:** "I heard" rows.
  - **Not sure:** one short line ("Not sure. Which one?"), full rows under the food name with portion and kcal, a tick on the chosen one; "Something else" has a tint so it reads as a different kind of action.
  - **Food not found:** three stacked full-width rows: "Create it as food", "Log calories only", "Search your foods". No food name in the button, so a long name can't break it.
  - **No microphone:** amber warning, no assumption about the device.
  - **Voice off:** the normal Log layout with one dismissible **grey** information card.
- **Scan:** the food form filled in from the photo ("Check the label"), photo one tap away, notes per decision, "Save and choose amount". The camera frame follows the theme. Failure states: no table, blurry, busy, limit, offline.

### Journal and Progress

- **Journal:** tapping a day selects it and shows a fixed-size day box with Open; it does not jump to the day. It opens on the month of the day you came from, with that day picked. Summary bar and 2×2 key stay, the month sentence goes. Quieter highlights. Desktop: one column up to 760 px, taller calendar with bigger rings, highlights under it.
- **Returning to today:** no Today pill. Away from today the month title turns accent-coloured with a small return icon, and tapping it goes back. On today it is plain and does nothing. Arrows and title never shift.
- **Rings:** the green ring always keeps its gap when under budget.
- **Progress charts:** the Y labels sit in their own column right of the plot, level with their lines; the plot and its lines stop before that column. The first and last dates line up with the edges of the numbers below. "Goal" uses the same column. No explanation under Smoothed; only the weekly change.
- **Achievements:** confetti falls to the bottom of the viewport.

### More and settings

- **More** is compact: rows with current values; Appearance, Goal, Units and Reminders on nested pages. Sign out sits in its row beside the name.
- **Appearance:** mode, then themes as cards, then app icons, with no descriptions except a short line: "A new icon shows after you add obur to the Home Screen again."
- **Goal:** Pace is a row ("Steady · 0,25 kg a week") opening a menu. **Units:** Weight and a new **Time** (24-hour or 12-hour, defaulting to the device).
- **Reminders:** just the time; tapping opens the native picker. The Home Screen hint shows only on Reminders, in three one-line steps with room between them.
- **Recipes and saved meals:**
  - Archive moves into a "…" menu by the title; its confirmation opens under the title.
  - "Update to current food values" is a full-width secondary button with an icon, shown only when an ingredient has changed.
  - Cooked weight is empty with the placeholder "Optional", never prefilled, and its label has no tag.
  - Beside "Per serving": "300 g a serving", or "No cooked weight", on one line.
  - Ingredient icons and Add food share one column.

### Account and household

- **Passkeys:** labels sit beside the name; rows open a detail sheet with Rename and Remove.
- **Household:** "Backups are working" is one larger line with a bigger mark.
- **Your data, LoseIt import:** the chosen file replaces the picker (name, source, dates, size in one row); one "To add" list with numbers on the right, deleted entries as the last grey row; weight unit and sharing as two settings rows; even spacing throughout.
- **Offline refused entry:** calories only, other food or discard, with Undo; waiting entries are tied to one account.

## 1. Direction: Pazar

Pazar (Turkish: "market", also "Sunday") is warm and friendly but practical first. It uses off-white and warm-brown neutrals, one terracotta-orange accent, rounded cards, a characterful display face for headings and numbers, and a plain, highly legible body face. It remains the default theme (see "Themes" above).

The owner chose it over the other two directions (Defter, a dense ledger with hairlines and a monospace face; Lokum, a playful pastel design with colour-coded meals) for these reasons:
- It reads at a glance on a phone.
- It has personality without being tacky.
- Its information density sits between the two alternatives.

## 2. Screens and behaviour (as decided in review)

**Navigation**
- **Phone status bar:** pages start 12 px below the status bar (`env(safe-area-inset-top)`, plus room for iOS's blur fading out below it); content scrolls under it, where iOS blurs it (owner, 2026-10-31: keep the blur, but nothing should sit in it at rest).
- **Phone:** a floating tab bar inset 12 px from the screen edges, with Today, Log, Journal, Progress and More. The active tab gets a soft accent background and accent text.
- **From 760 px:** a sticky side nav with the same five items: icons only (72 px) until 1100 px, labelled (232 px) from there. `/settings` redirects to `/more`.
- **More:** see "More and settings" in the design review above.
- **Theme:** chosen in Settings (desktop) or More (phone) as System / Light / Dark, with System as the default. There is no theme toggle in the header.

**Header**
- Shows previous day, then the title (Today / Yesterday / "Thu 15 Oct") with the long date under it, then next day.
- The next-day arrow is disabled on today. You can go back as far as the data goes.
- On desktop the header spans only the left column, so the next-day arrow lines up with the cards' right edge. On phone the title is centred.

**Today** (superseded by the design review above where they differ)
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

**Bulk actions** (owner's picks 2026-10-31 from the demos: F on the phone, the same on desktop with a tint on hover)
- **Hold an entry** about half a second until it lifts. Let go: it is selected and selecting starts. Keep moving: a card
  follows the finger (or mouse), the meal under it is outlined, the page scrolls near the top and bottom edges, and
  dropping on another meal moves it there (within the viewed day). Moving before the hold completes cancels it, so a
  swipe still scrolls. Holding a selected entry drags the whole selection. A one-time tip explains it (remembered
  on the device). No grip: rows keep their full width.
- **Selecting:** a round check on every entry, a tap toggles; the meal headers' buttons step aside; a bar over the tab
  bar (bottom right on desktop) shows the count, Cancel, and **Move to…**, **Copy to…**, **Delete**. Escape or leaving
  the day ends it. Desktop: Ctrl/⌘-click also selects.
- **The meal … menu** (on meals with entries): Select entries, Move meal to…, Copy meal to…, Delete meal. It does
  everything a hold or drag does, without the gestures.
- **Move to… / Copy to…** sheet: day chips (Today, Yesterday, Another day with a date, never a future day) and meal
  chips; the button names the meal ("Move to Dinner"). Copies keep each entry's own nutrition; a move that leaves
  everything in place says so instead.
- Each action is one request, with one toast and one **Undo**; moving or copying to another day stays on this day
  and the toast says where ("To Snacks · Yesterday"). Delete has no confirmation, as for one entry. No "copy
  yesterday's meal" shortcut (owner). Needs a connection.
- Selected rows: `bg-soft` with room around the icon and text, 2 px between rows.

**Reminders** (Settings → Reminders, only when the server has push keys; built 2026-10-31)
- **This device:** Turn on notifications (asks permission on the tap), or, when on, **Sample** and **Turn off** side
  by side, each on one line (owner, 2026-10-31). Blocked: how to allow them. iPhone Safari: how to add obur to the Home Screen first.
- **Remind me:** a switch per reminder (Breakfast, Lunch, Dinner, Weigh-in, Mark the day complete); on, the system's
  own time picker appears beside it (starting at 10:00, 14:00, 20:30, 09:00 and 21:30). The hint says a reminder comes
  only when that thing is still missing.
- **Quiet hours:** From and Until, the system's time pickers.
- Every change saves itself, with the device's time zone, and says so in the usual toast (owner, 2026-10-31); leaving
  the page saves a pending change at once. A tap on a notification opens Today.

**Edit entry**
- A sheet with the amount and unit (or kcal for quick adds), then Save changes.
- "Move to…" expands an inline list of meals with the current one disabled.
- Delete removes the entry immediately and the toast offers **Undo**. There is no "are you sure" dialog.

**Toast**
- Appears bottom-left of the main area on desktop and above the tab bar on phone.
- It has a check icon that pops in, a bold message and a muted detail ("Logged to Lunch · 240 kcal"), plus Undo where relevant.
- It lives for 5 s and uses `role="status"`.

**Journal** (built 2026-10-31; see "Achievements, Journal and Help" below)
- **Month calendar** at the top (on Progress until 2026-10-31; an old `/progress?month=` link opens the Journal):
  - Weeks start on Monday, and each day has a small ring with its date inside (40 px on phone, 54 px on desktop).
  - The ring fills by eaten ÷ budget: **green** (`good`) when the day is marked complete and at or under budget, a full **red** (`bad`) ring when over. A logged day that is not marked complete fills in a neutral colour (`muted`), so incomplete logging is never shown as success (owner decision, 2026-10-25).
  - Today has an accent outline. Days with no logs show only the track, and future days have no ring and are disabled.
  - Tapping a day opens that day's Today view. Arrows move between months.
  - Each cell's accessible name reads like "Thursday, 15 October: 1,840 of 2,000 kcal, 160 under".
  - Below the grid: a key and a month summary ("17 days under, 4 over, 3 not logged"). Today isn't counted. "Under" counts complete days only; incomplete days need their own wording in the summary and key.
**Progress**
- **History** (owner chose layout B with changes, 2026-10-31; demos in the session's Artifact):
  - Phone: a tab bar **Weight / Calories / Nutrients** with a compact range dropdown (1W, 1M, 3M, 1Y, All; all time by
    default) beside it, one tone like the tabs' tray (no raised pill, no focus ring on tap; owner 2026-10-31) in its own tray; one topic at a time, each with a headline number, a chart and a few stat rows.
  - Desktop: no tabs; two columns, Weight beside Calories, then Nutrients, with the range
    dropdown beside the page title.
  - Weight: the label above the weight is the switch (owner's pick T2, 2026-10-31, after two demo rounds):
    "LATEST WEIGH-IN | SMOOTHED", the view shown dark, the other faint; a tap on the faint one switches. Each name has a
    44 px tap area that adds no height, so the weight sits right under the label. Readings by default; the choice is
    remembered on the device. Readings: the weigh-ins as points joined by a line; with the change since the
    first weigh-in in the range; rows to goal, average change per week, weigh-ins, lowest reading. Trend: the smoothed
    weight as the line with the weigh-ins faint behind it; with the pace per week and the
    line "Evens out day-to-day swings from water and food."; rows to goal, change in the range, weigh-ins. Both: goal
    as a dashed line when it is within the chart (otherwise a note of the distance), dashed across gaps over a week. The
    card keeps one height in both views (each view's headline, rows and readout share a cell; owner, 2026-10-31).
  - Calories: bars against a budget step line; over budget striped red, under green, days not marked complete as
    outlines, unlogged days as a dash when bars are wide enough; weekly averages from 3 months up.
  - Nutrients: average protein, carbohydrate and fat against the targets, with a coverage note when some days are
    unknown.
  - Tapping or dragging on a chart shows that day's (or week's) values in a readout line below it; each chart has a
    text summary for screen readers.
  - Achievements: see "Achievements, Journal and Help" below.

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

### Achievements, Journal and Help (owner, 2026-10-31; all three built the same day)

Settled over five rounds of mock-ups (a private Artifact; picks and notes in its `notes` collection).

- **Achievements.** One every 2 kg lost up to 120 kg, each with a comparison (docs/achievement-comparisons.md); goal
  reached; streaks of complete days; firsts. No percentages. When one is earned, a short toast (never blocking);
  tapping it opens a full-screen celebration with the comparison. Reduced motion: the same screen, still. Off for
  maintenance goals, minors, pregnancy and breastfeeding.
- **Badge page:** flat circles, no shine or gradients. Weight badges carry only the number and unit, with the date
  earned below; the comparison never appears on a badge. All weight badges are one colour (accent), with a tint that
  strengthens every 10 kg (owner's pick C). Streaks warm with length (amber, orange, rose, violet); each first has
  its own colour (scan blue, voice violet, recipe green); the goal teal. Only the **next** weight mark and the
  **next** streak show, as a dashed outline whose text matches earned badges exactly (same type, size and weight);
  goal and firsts appear only once earned. No extra ring on the newest badge (it crowded the date). The section
  title follows the unit: "Kilos lost" or "Pounds lost". Colours keep AA contrast in light and dark.
- **As built:** the toast sits above an ordinary toast, shows the comparison's picture, title and "That's …", and
  stays 8 s; tapping opens the celebration (count-up, the picture dropping in, the comparison and its line, confetti;
  Done or Escape closes; "See all achievements"). Only the most notable new one gets the toast; others that arrive
  with it are kept quietly. Celebrated means seen, once. Kilo circles hold only the number (owner: "just put the
  number in circle"); the tint is 10 % of `--badge-coral` plus 8 points every further 10 kg, and the number's ink
  moves from coral to the text colour (and in dark, to the dark accent ink) as the tint deepens, tested for 3:1 at
  every step in both themes. Streaks: 7, 14, 30, 60, 100, 180 and 365 days, coloured amber, coral, rose, violet,
  blue, teal, green in turn. The badge page opens from an "Achievements" row at the foot of Progress and from an
  achievement in the Journal; it says why when weight achievements are off. Pictures: OpenMoji 15.1.0 in
  `static/icons/achievements/` (dark variants from `node scripts/food-icons-dark.ts`). Pounds are not handled yet
  (no unit setting exists).
- **Journal:** a fifth tab between Log and Progress: the month calendar (moved from Progress) with its key in the
  calendar's own coloured circles, then "<Month>'s highlights": each week of the month, newest first and cut at the
  month's edges ("This week" for the current one), as one summary line (average calories a day and average under or over budget, both
  over the week's complete days only, or "No days marked complete"; the change from the last weigh-in before the week
  to the week's last) with only that week's highlights below. Built so far: a new lowest weight (the week's lowest
  weigh-in when below every earlier one, so at most once a week; never the very first weigh-in), a budget change
  (the inactive-day budget at the week's end against just before it, once a week), the first day logged. Still to
  come: achievements (as small versions of their badges), streak milestones, firsts, the import. Weeks with nothing
  recorded are left out; an empty month says so. Changing the month changes the highlights. No switch and no
  setting. Progress keeps the charts. Phone: calendar, then highlights; desktop: side by side, the calendar sticky.
  Highlights that aren't achievements sit in neutral circles with a line icon.
- **Help:** its own page (search that ignores accents and Turkish letters, topic chips, short real answers), opened
  from More. No inline "?" or "How?" links (owner tried both and chose the page only). Built as `/help`, the "Help" row in More (and
  desktop Settings) after Security: a search box, topic chips (All, Logging, Budget, Weight, Progress, Reminders,
  Privacy) and the questions as disclosures grouped by topic; a search with a single match opens it. Words live in
  the message catalog (`help_<id>_q`, `_a1…`, `_k` for extra English and Turkish search words), the list in
  `shared/help.ts`; answers were checked against the code (activity counts by default; the smoothing accuracy is the
  simulated figure from docs/feasibility.md). Update an answer in the same change as the behaviour it describes.

### Food form portions

- Each portion: **Portion name** (its own line on a phone), then **Amount** and **Unit** (labelled like the other
  fields); **Remove** is a small text button at the right of the name's label row, not an × beside the unit (owner,
  2026-10-31). On a phone a thin divider separates portions; desktop keeps each on one row.

### Dropdowns

- **Form dropdowns** (`ui/Select.svelte`): styled like the text fields beside them (border, fill, rounding, focus
  ring) with our chevron instead of the browser's arrow; the native select keeps the phone's own picker. Used for
  units in the food form and the food chooser in Check and log (owner, 2026-10-31: one convention everywhere).
- **Toolbar dropdowns** (`progress/RangeSelect.svelte`): one-tone tray with the chevron, beside tab-like controls.

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

- **Where the achievements page is opened from:** proposed a row on Progress ("Achievements" with the count) and from an achievement in Journal; not yet confirmed.
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
