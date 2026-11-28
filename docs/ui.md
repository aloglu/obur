# obur — UI direction

The owner chose this direction from three demos. It is the source of truth for the look and behaviour of the interface. Where it disagrees with `docs/design.md`, this file wins on visual and interaction matters, and the conflict is listed under "Changes to other docs" so design.md can be updated.

The current reference is `docs/ui/review-2026-11/` (see "Design review" below). The original demo is `docs/ui/pazar-demo.dc.html`. It was built in a design-canvas format: the markup with `{{holes}}`, `<sc-if>` and `<sc-for>`, and the `Component` script at the bottom, show the structure, styles and behaviour exactly. It does not run outside that canvas, so read it, don't serve it. Do not copy its inline-style approach; build proper Svelte components with Tailwind using the tokens below.

## Design review, November 2026

The owner reviewed every screen, on phone and on desktop, over five rounds and two theme rounds (2026-11-01 to 2026-11-06). **Where this section disagrees with anything below, this section wins.** Older text is replaced as each screen is built (`docs/progress.md`, "Design review build").

The final demos are in `docs/ui/review-2026-11/`: `diary.html` (the daily app and More), `account.html` (signing in, first day, Profile, Security, Members, Your data, Help) and `open-ends.html` (empty states, Speak and Scan failures, offline, install). They run in a browser and show exact sizes, states and wording. They are a reference, not code to copy: they open in Sade, carry review-only controls, and fake the data. Build proper components with the tokens.

### Across the app

- **Corners.** One set: cards 22, buttons and fields 14, small controls 10. Only things round by nature stay round: icon buttons, switches, avatars, dots and rings. No fully rounded toggles or chips anywhere (owner, three times), and the tab bar and its active item use the same corners.
- **Choices.**
  - In sheets, **Day** and **Meal** are two fields side by side. Each opens a menu with a tick on the current choice, as wide as its field.
  - **Settings choices** are rows showing the value; tapping opens a menu (Goal pace, Units, Profile, the LoseIt weight unit).
  - **Every other open menu is only as wide as its longest option** and lines up with the right edge of its row. It never stretches across the row. It is at most 288 px wide, and every option stays on one line: a longer one is cut with "…". In the unit menu the size ("125 g") sits apart on the right, always whole, so only the portion's name is cut (owner picked option B of the unit menu demo, 2026-11-16, over cutting the whole line and over also shortening names).
  - **Two buttons side by side:** the way back or the lesser choice on the left, the main button on the right, everywhere (owner, 2026-11-18). **Small add links** inside a card are accent text with a + in front (Add portion, Add a key).
  - **A tap outside an open menu only closes it.** What was tapped does nothing, so closing a menu never presses a row or link by accident (owner report, 2026-11-16). This includes the press itself: a chart under it doesn't move to a point (owner report, 2026-11-21).
  - **Every dropdown is the shared Menu**, never the browser's own list, which a page can't stop a tap from going through (the Progress range changed, owner 2026-11-21). Date and time fields keep the phone's own pickers.
  - **Menus have a visible edge** (a hairline in the text colour at 16 % and a stronger shadow), so they stand apart from the white cards under them in every theme and mode (owner picked it in the menu edge demo, 2026-11-16, over the earlier faint edge and a deeper shadow alone). The tap-outside rule applies to every dropdown and every … menu (owner, 2026-11-16 and 2026-11-18; `client/swallow-press.ts`).
  - **The unit sits inside the amount field:** "piece ⌄" opens a menu when there are several units; a single unit (g, ml) is plain text, not a button.
  - **Forms with two or three options filled in once** (Female / Male, Appearance mode) keep a segmented control with the usual corners. **Type it** has a toggle listing all four meals.
- **One warning style.** A plain surface card: an icon tile coloured by severity (grey information, amber needs you, red failure, green done), a bold one-line title, a short line under it, actions below when there are any. Used for no connection, no microphone, Speak switched off, and the recovery-codes warning. The card itself is never tinted. Members' backup status keeps its own larger line.
- **Fewer descriptions.** No explanatory text under titles and fields unless the owner kept it. Help carries explanations; no inline "?" links.
- **Checkbox.** One app-drawn style, for example "I've saved these codes", the pregnancy questions and delete confirmations.
- **Inline fields** (Other amount, New weigh-in and so on): a tap on any non-interactive area closes them without saving, and so does opening another one or tapping the check with the field empty (owner, 2026-11-09). Only one is open at a time.
- **Name fields capitalise each word on phone keyboards** (owner, 2026-11-09, as LoseIt does): food, brand, recipe and saved-meal names use `autocapitalize="words"`. It is only the keyboard's Shift: the person can turn it off for a word, and nothing is changed after typing.
- **Examples and placeholders are in English,** in the English interface, although Turkish input works (including messages such as `speak_example`).
- **Macro colours** do not follow the accent. Protein, carbs and fat change together, per theme, never protein alone.
- **Keyboard.** An open sheet stays inside the area the on-screen keyboard leaves free, however tall its content grows (`ui/Sheet.svelte`, from `visualViewport`).
- **Swipe to close.** On phones a finger on a sheet pulls it down, with the scrim fading; letting go past a quarter of its height, or with a fast flick, closes it, otherwise it springs back (owner, 2026-11-23). Only from the top of its content: a scrolled sheet scrolls back first. A drag that starts sideways, after a hold (the phone's text cursor), in a text area, a slider, a menu, something that scrolls on its own or a sheet open over it is left alone; a finger that stops before letting go, a second finger, or the phone taking the touch springs it back. Escape, the close button and a tap on the scrim still close it; a file picker dismissed without a choice does not (`ui/Sheet.svelte`).
- **A search stays in view.** Wherever a search sits above a list, the search stays while the list scrolls (owner, 2026-11-07): the title and search in Add a food and Choose an icon (`pinned` on `ui/Sheet.svelte`); the search on Log, Foods and Help (`.pinned-search`); in Type it and Speak, the search inside an item while that item is on screen.
- **Text follows the phone's text size** (owner, 2026-11-07: the "200 %" check means the iPhone's Larger Text setting): `static/text-scale.js` reads the iPhone's body text size before the page draws and sets the root size (17 px is 100 %, capped at 200 %; elsewhere the browser's own font size). All text is in rem; spacing stays 4 px a step, so only text grows. From 135 % the page is marked `data-text="large"` and the `large:` variant stacks what sits side by side: settings rows put their value under the label, Water and Weight go one per line, nutrient bars go under their numbers, the food form's names go above their controls, the macro preview lists one macro per line, Members' Delete account goes under the name, Appearance shows two columns. The tab bar labels, segmented controls and the calendar's weekdays grow less (capped at 14, 20 and 15 px) so they keep fitting. Checked on every page with text at 200 % on a 390 px phone (`tests/e2e/large-text.e2e.ts` keeps the main pages from running past the screen); at the standard size nothing changes (the screenshot tests are unchanged).
- **Fields never zoom the page.** iPhones zoom in on a field whose text is under 16 px, so every input, select and textarea is at least 16 px; a test checks it (`ui/field-size.test.ts`). A control that shows smaller text keeps a 16 px input unseen over it. 
- **No zooming (owner, 2026-11-14).** No pinch and no double-tap zoom anywhere: `user-scalable=no` in the viewport, `touch-action: manipulation` on the page, and Safari's pinch gesture stopped in `static/text-scale.js` (Safari ignores the viewport setting). Bigger text comes from the phone's text size (above). Pinch was kept until then; the owner chose an app-like feel over it.
- **Empty values look like fields.** An empty value in the food form is a normal field with a quiet "Unknown" placeholder (owner, 2026-11-07: the amber fill read as a warning or plain text, not something to tap).
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
- The app icon and fonts were reviewed against the themes on 2026-11-07: see "App icon" below.

### Motion

The owner expects the motion in the demos, not only their layout (2026-11-06). Curves: `--travel` for things moving across, `--ui` for things opening. All of it stops with reduced motion, and none of it blocks input.

- **Built:** sheets slide up and down (dialogs fade and scale from 760 px) with the scrim fading, menus fade and scale from their own corner, the tab bar's and segmented controls' highlight slides (380 ms), pages change as described under "Page changes" below, budget and nutrient bars travel to their value (600 ms).
- **Build with each screen; do not skip:** numbers roll digit by digit when they change (`roll` in the demos); a number that gains or loses a digit opens or closes that place's width as it rolls, so nothing snaps sideways at the end, fields and inline forms open with the `.collapse` height and fade, charts draw on, entries and rows animate in and out, toasts pop their check. Look for it in the demo's CSS and script for each screen.

**Page changes** (owner's picks from a demo, 2026-11-13: "Push" into sections, "Slide by tab order" between tabs, nothing on desktop; they replaced "a new page rises 8 px", which left an empty frame between pages and made the title blink, and then a 220 ms dissolve for tabs and every desktop change, which the owner disliked). On phones, going into a page down the tree the "<" buttons follow (`shared/page-tree.ts`: More → Settings → Appearance, More → Foods → a food, Progress → Achievements, Log → Scan) slides it in from the right over the page you were on, which drifts a quarter to the left and dims (380 ms on `--ui`); going back up slides the top page away to the right and the one under it returns (340 ms). Changing to another tab, from the tab or from any page under it, moves both screens sideways together as the tabs are laid out: a tab to the right comes in from the right, one to the left from the left (360 ms). Anything else on a phone (two pages side by side under one tab, pages outside the tree) and every change on desktop happens at once. The tab bar stays still. Drawn with the browser's view transitions (a picture of the old screen and the live new one); without them, with reduced motion, within one page (another day on Today) and for the browser's own back and forward, pages change at once.

**A field that gets focus must already be in place.** iOS scrolls a focused field above the keyboard smoothly by itself, but only to where it is at that moment. So an empty note, which opens straight into typing, reaches its height at once and fades in. Don't scroll the page from script to help: it fights iOS's own scroll and overshoots (owner's report, 2026-11-06).

**A sheet that fills in after opening still opens small** (owner, 2026-11-07): Add a food slides up with the same motion as every sheet, then, once it has arrived, grows to fit its list (340 ms on `--ui`, the same as rows opening by height), and it follows the list's height as a search narrows it. It never opens at full height to make room for what is coming.

**An open sheet holds the page behind it still** (`client/scroll-lock.ts`), and returns it to the same place when it closes. Closing gives the page back at once: the sheet unmounts immediately and a lifeless copy plays the slide-out, so nothing waits for the animation.

### Signing in and first day

- **Sign in:** icon and "obur" centred on the screen, one button low, no subtitle and no invite line. On desktop the group is centred, with 72 px between name and button. After the passkey, the button stays busy while Today loads in one full page load; a signed-in visitor to the sign-in page goes straight to Today (2026-11-09: refreshing the sign-in page with the account's look reloaded it for a changed app icon and asked for the passkey twice).
- **Set up and Join:** no description under the title, no hints under fields, no closing line.
- **Recovery codes:** an amber warning card ("Keep these somewhere safe", shown only now), then "I've saved these codes" as its own row with the app's checkbox; Continue waits for it.
- **The budget is a free choice.** First day is the real Today, only empty. After "Just log" nothing on Today mentions a missing budget; the only pointer is the toast when the welcome card is dismissed (More → Profile). Profile's empty card reads "Daily budget · Optional…". Repeatedly mentioning a missing budget makes people feel they are doing something wrong (owner).
- **Budget setup:** Body fat and Waist are always visible under the other fields, with no divider, expander or "Optional" in the label (the fields say it), and even spacing. No explanation under "Sex used by the formula". Three steps (About you, Your estimate, Your goal). Each field's unit is a button at its end (owner's pick from an interactive demo, 2026-11-22; a Metric/Imperial row was dropped because a UK mix, feet and inches with kilograms, then needed Settings): "cm" or "in" with a small orange up-down mark on Height, Weight and Waist. A tap switches that unit, saves it for the account and converts what was typed (80 kg becomes 176.4 lb, 180 cm becomes 5 ft 10.9 in); height and waist share one setting. The unit text is in the text colour, the mark orange (orange text on the field is under AA). In feet and inches, Height is one field with two numbers (ft and in). A new account (no settings, no records) starts with the units of where the device is, by its time zone (the sign-in, setup and join pages send it): United States lb, ft and in, fl oz; United Kingdom and Ireland kg, ft and in, ml; elsewhere metric (audit D01: the phone's language named a variant, not a place). Every field is 48 px tall; the birth date field drops iOS's own date look, which drew it shorter and narrower than the others. A quiet "Set a number yourself" under step 1 keeps a fixed budget reachable for anyone, not only those the formula doesn't apply to (the demo offered it only from the restriction card).
- **Empty Journal day:** the date and Open, then only "Nothing logged", centred in its line; no kcal or dashes. A day with a weigh-in but no food keeps its columns, so the weight shows.

### Today

- **All cards share one surface** (no two-tone fills for hierarchy).
- **Card order (owner, 2026-11-23, Gemini audit 2 H17):** on phones Budget, Nutrients, Water and Weight, then Meals, Notes and Complete; the page's own order (keyboard, screen readers) is Budget, Meals, then the rest, as the desktop columns are. The owner kept it: matching the two would move Meals up on phones or break the desktop columns.
- **From 760 px:** two columns, Budget and meals on the left, the rest on the right. The Log panel is gone from Today: Add food opens the Log page on every screen size, so there is one way to log.
- **Goal reached:** while the offer to switch to maintain stands (docs/design.md, "Targets, profile and activity"), a card sits above Budget in the Welcome card's style: "You've reached your goal weight", one muted line, and two equal buttons, **Switch to maintain** and **Keep deficit**. Either answer slides it away with a toast that says where the setting lives. The goal's celebration shows a bordered **Switch to maintain** under Done; Done keeps the focus.
- **Budget card:** an Activity chip beside "kcal left" shows what is counted today and opens its sheet. The sheet takes any typed amount, with 100, 150 and 250 as shortcuts, and says in words what is already counted. The bar uses **status colours**: green with room, amber in the last 200 kcal or 10 %, red over; never the protein colour. Without a budget, the card is just "kcal eaten", with no bar and no link to set one up.
- **Water and Weight:** four aligned rows each. Weight has a sparkline of the last 7 weigh-ins and **New weigh-in**, which opens in place like Other amount. Slim side padding on phones. The older "Same as last time" button did not survive the redesign.
- **Edit sheets for water and weigh-ins:** rows with Edit and Delete. **Show older** is the last thing in the list, right after the oldest row shown, and scrolls with it; it adds 20 in place and goes away when nothing older is left.
- **Meal cards:** all four meals share one card, divided by lines. Each is one grid (icon, name, number) for its header, entries and a trailing **Add food** row; the meal total sits in the kcal column and an empty meal has no "nothing logged" text. The bookmark moves into the … menu as **Save as a meal**.
- **Day titles:** Today, Yesterday, the weekday for days this week, then the date with the weekday under it. The year shows only for other years.
- **Day notes:** a card that opens in place, above Mark the day complete (right column from 760 px). Closed, it shows the note's first line. A note saves itself half a second after typing stops, and when the app goes to the background. Tapping the text edits it; **Edit** does the same for keyboards. Markdown, our own small subset rather than a full flavour: `#` headings, `**bold**` or `__bold__`, `*italic*` or `_italic_` (underscores only at a word's edge, so `snake_case` stays), no nesting inside a line, `` `code` ``, `[links](https://…)`, `-` and `1.` lists, `- [ ]` to-dos that tick from the note, and `>` quotes. A note never renders as HTML. Up to 10,000 characters. See `docs/design.md`.
- **Editing an entry:** the amount sheet in edit mode (Save changes, or "No changes"; Move to…; Delete beside it; Undo toast).
- **More → Recently deleted:** 30 days, with Restore; grouped into Entries, Foods, Recipes and Saved meals (see "Archived and deleted").
- **Hold-to-drag and select** stay as decided below, restyled.

### Logging

- **Log screen:** the search bar at the top on phone and desktop; three equal tiles (Speak, Scan a label, Type it); **Recent is always visible** and fills the room down to the tab bar (at least three foods). No meal or day dropdown in the header; a preset pill appears only after a meal's Add food. This replaces "suggestions only when focused" below.
- **Amount sheet:** one sheet with a rolling preview, using the fields above.
- **Type it** replaces Quick add and the search's "Log as typed" row: natural-language typing parsed into foods or calories-only items. The meal toggle follows the text ("for dinner"); removing the meal word returns to the tapped or preset meal. Only the placeholder gives an example ("two eggs and toast for breakfast"). Reading a sentence needs the server, so **Log calories only** stays: from a search that finds nothing, and from Type it when the server can't be reached. It is what can wait offline.
- **Speak:** "I heard" rows.
  - **Not sure:** one short line ("Not sure. Which one?"), full rows under the food name with portion and kcal, a tick on the chosen one; "Something else" has a tint so it reads as a different kind of action. It asks only when the top match came from typo tolerance or ignored some of the words said, not when the words or an alias matched, so logging stays fast and a food can't drop out unnoticed (a comma between plain names doesn't split items: "yumurta, karpuz").
  - **Food not found:** three stacked full-width rows: "Create it as food", "Log calories only", "Search your foods". No food name in the button, so a long name can't break it. **Create it as food** opens the food form in a sheet on top, starting from the name that was said; saving makes it that item's food with the amount that was said, and everything else in the sheet stays as it was (2026-11-07, my call; the demo stopped at the button).
  - **No microphone:** amber warning, no assumption about the device.
  - **Voice off:** the normal Log layout with one dismissible **grey** information card.
- **Scan:** the food form filled in from the photo ("Check the label"), photo one tap away, notes per decision, "Save and choose amount". The camera frame follows the theme. Failure states: no table, blurry, busy, limit, offline. As built: a busy scanner puts the photo in a waiting line (2026-11-07, my call; the demo had no busy state): the frame says "Waiting for the scanner" and how many labels it is reading, the phone asks again every 3 seconds by itself, Fill in by hand stays available, and after two minutes it gives up with the busy card. A blurry photo (edge sharpness under 0.16, measured in `docs/feasibility.md`) says "The photo is blurry" when nothing was read, and opens Check the label with a note that values may be misread when something was; the notes per decision are built (2026-11-07): the parser reports what it decided (`shared/label-notes.ts`) and `food/ScanNotes.svelte` shows them in the Nutrition card in place of the hint on copying a label, as in the demo: a grey line with a tick for a decision (the column read and the ones skipped, a basis from the title, kcal matching the label's kJ, mg given in g, sodium left out for salt) and an amber line with a question mark for something to check (running text, impossible values left out, values not read, which stay unknown). Added before release (2026-11-07, my call within the owner's "add a check now"): an amber line for values the OCR was unsure of ("Protein was hard to read in the photo…", naming the decimal-comma misread), and one when the values couldn't be checked against the energy.

### Journal and Progress

- **Journal:** tapping a day selects it and shows a fixed-size day box with Open; it does not jump to the day. **Day box row (owner's pick, 2026-11-21):** three equal columns under small muted labels, Eaten (with "+" when partial) on the left, the budget's result in the centre ("Under budget" green, "Over budget" red, "Left" muted on a day not marked complete, "Budget" with "–" without one) and Weight on the right; each column keeps its place whatever its value (`journal.e2e.ts` checks the edges). "· Not complete" sits beside the date. A day with nothing at all says only "Nothing logged" at the same height. With large text the columns stack, label left and value right. It opens on the month of the day you came from, with that day picked. The month sentence, the summary bar and the key are gone, as in the final demo (owner confirmed 2026-11-06; a Help question explains the rings with examples). Quieter highlights. Desktop: one column up to 760 px, taller calendar with bigger rings, highlights under it.
- **Returning to today:** no Today pill. Away from today the month title turns accent-coloured with a small return icon, and tapping it goes back. On today it is plain and does nothing. Arrows and title never shift.
- **Rings:** the green ring always keeps its gap when under budget.
- **Progress charts:** the Y labels sit in their own column right of the plot, level with their lines; the plot and its lines stop before that column. The first and last dates line up with the edges of the numbers below. "Goal" uses the same column. No explanation under Smoothed; only the weekly change. Tabs with a sliding thumb on every screen size and one card, up to 920 px wide on desktop. The headline is the readout: while you tap, drag or arrow along a chart it shows that weigh-in, day or week, and goes back on release. No separate readout line, no legend on the weight chart, no Budget entry in the calories legend.
- **Achievements:** confetti falls in from above the screen, lands at the bottom, piles up and stays (owner, 2026-11-13; `client/confetti.ts`, drawn on one canvas behind the text, about one piece per 4 px of width). A tap on the celebration's background throws it up like a snow globe. No confetti with reduced motion. The page behind is held still (`client/scroll-lock.ts`), so its scroll bar doesn't show through. Tilting or shaking the phone to move the confetti was built and dropped the same day (owner: too much work and friction; iPhones ask a permission question before giving motion readings).

### More and settings

- **More** is compact: Foods, Recipes, Saved meals and Recently deleted with their counts; then **Settings**, Members and Server (admins) and Help; then Sign out in its row beside the name.
- **More → Settings** (owner, 2026-11-08: More had become mostly settings): Profile, Goal, Language (only when the server offers more than one; a menu with each language in its own words, English and Türkçe; choosing one reloads the app in it), Units, Appearance, Reminders and Speak and Scan, with their current values; then Your data and Security. Each settings page's back button returns to Settings.
- **Archived and deleted** (owner, 2026-11-18, from the review page; `ui/items/ArchiveList.svelte`, `SelectCard`, `SelectRow`, `ItemSelectionBar`):
  - Foods and Recipes show only what is in use. Under New food / New recipe, a card row "Archived foods · 214" (or recipes) opens the archive; it shows only when something is archived. Recipes now has New recipe above its list, like Foods.
  - The archive page: its own search, the list card "Archived · N" with **Select** at the right (then **Select all** / **Clear**), rows with a round check while selecting (as on Today; Ctrl/⌘-click also selects on desktop), and the bar over the tab bar with the count, Cancel, **Restore** and **Delete**. Escape ends selecting. A hint under the list says what archiving does.
  - An archived food's page says it is archived and that Delete keeps it 30 days in Recently deleted; its actions are **Restore** (accent) and **Delete food** (red), and its back button leads to Archived foods. A recipe's page ends, above Save, with **Archive recipe** (red, no question: back to Recipes with a toast and Undo), as a food's page does; an archived recipe's has **Restore** (accent, stays on the page) and **Delete recipe** (red) there instead, and no … menu (owner, 2026-11-18: Foods and Recipes must archive the same way). The archive searches have placeholders like Foods' search. A saved meal ends, above Cancel and Save, with **Delete saved meal** (red, no question: back to Saved meals with a toast and Undo), in the same kind of card (owner, 2026-11-18, buttons review round 2, replacing a trash icon by the title).
  - Every step has one toast with Undo: "Deleted 3 foods · In Recently deleted for 30 days.", "Restored “Oats” · Back in Foods, search and Speak."
  - Recently deleted: one card per kind with its count and Select (Restore only), Restore on each row, "N days left" on foods, recipes and saved meals, five rows and "Show all N".
- **Back button** (owner, 2026-11-13; `ui/PageHead.svelte`): every nested page has an accent "<" to the left of its title, on the title's line, a 44 px target, named after where it leads for screen readers. No text link above the title. It goes one level up: Settings pages to Settings; Settings, Foods, Recipes, Saved meals, Recently deleted, Household and Help to More; a food, recipe or saved meal to its list (an archived one to its archive, the archive to Foods or Recipes); Achievements to Progress; Scan to Log. The title stays at the height it has on pages without a "<". Every page's title sits at one height, Today's included (measured on the letters, 32 px below the status bar's room on a phone and 20 px on desktop; `app-shell.e2e.ts` checks it): a control beside a title, such as Progress's range, is pulled in rather than allowed to push the title down.
- **Appearance:** mode, then themes as cards, then app icons, with no descriptions except a short line: "A new icon shows after you add obur to the Home Screen again."
- **Goal:** Pace is a row ("Steady · 0,25 kg a week") opening a menu. Goal weight opens in place and moved here from Profile's details; Maintain and the 1 kg pace ("Fastest") stay as options because setup offers them. Without a calculated budget the page points to setup. **Units:** menu rows for **Weight** (Kilograms or Pounds), **Height and waist** (Centimetres, or Feet and inches), **Water** (Millilitres, or US fluid ounces) (owner, 2026-11-22) and **Time** (24-hour or 12-hour, defaulting to the device). Settings' Units row says "Metric" or "Imperial" when every unit agrees, otherwise each one ("lb · cm · ml · 12-hour"). Profile shows height in the person's unit ("5 ft 10 in"). With pounds, Pace reads "Brisk · 1 lb a week".
- **Reminders:** just the time; tapping opens the native picker. The Home Screen hint shows only on Reminders, in three one-line steps with room between them. Quiet hours stay on the page as their own card (the demo left them out; they are a real setting, owner 2026-10-31).
- **Recipes and saved meals:**
  - Recipes: Archive sits at the end of the page, as on a food (2026-11-18, replacing the "…" menu). Saved meals: Delete saved meal at the end of the page. Every editor ends the same way: a card with the page's actions (Archive, Restore, Delete), then **Cancel** and **Save** side by side; an existing food's page has Cancel beside **Save food** too, both leading back to Foods (or Archived foods), Save with a "Food saved." toast (owner, 2026-11-24: Save had stayed on the page, unlike the recipe and saved meal editors). New food, Check the label and the New food sheet keep Save alone (owner, 2026-11-18, buttons review round 2).
  - "Update to current food values" is a full-width secondary button with an icon, shown only when an ingredient has changed.
  - Cooked weight is empty with the placeholder "Optional", never prefilled, and its label has no tag.
  - Beside "Per serving": "300 g a serving", or "No cooked weight", on one line.
  - Ingredient icons and Add food share one column.
  - **Already in your foods** (owner, 2026-11-17; `docs/design.md`): when a new food (New food, Scan, Create it as food)
  matches one the person has, or a built-in one, Save asks the server, which saves nothing and answers with the
  match; a plain card titled "Already in your foods" then takes Save's place: the food's icon and name (with brand),
  "97 kcal per 100 g" and "Built-in food" for USDA ones, and two equal buttons side by side, **Use this one**
  (New food opens it, Scan goes on to its amount, Create it as food hands it back) and **Save mine anyway**, which
  saves the form as it is. The LoseIt import preview says "3 foods are already in your foods, so those are used"
  under a **Keep separate copies** switch (`ui/food/AlreadyInFoods.svelte`, `shared/food-match.ts`).
  - **Food form:** one card each for name and icon, Nutrition and Portions, then the archive row; a built-in food, which can't be edited, shows Make my own variant instead (Archive food goes back to Foods with a toast, "Food archived", and Undo, which restores it and returns to the food; an archived food's page says so in a muted line under the title, and Restore stays on the page with a toast; owner report, 2026-11-16), Save (on only after a change, except for a scanned label), and a line saying the diary keeps what was logged. Kept against the demo: the kJ row, because a label may give only kJ and the kcal check needs it (empty kJ shows a dash rather than Unknown), and the Label type choice, because US and EU carbohydrate are different values.
  - **Lists:** Foods, Recipes and Saved meals are one card each with a small head ("Your recipes", "kcal a serving"), rows with an icon, a detail line and the number at the right, and their counts on More's rows. New food, New recipe and New meal sit at the top, under the title (and Foods' search), with or without items (owner, 2026-11-18, buttons review). On Foods, the search stays and New food sits above the list, because an import can bring hundreds of foods (2026-11-07, my call against the demo, which had a short list and no search). Archived foods and recipes stay in their lists, faded and last, so they can be restored.

### Account and members

- **First steps (owner, 2026-11-07):** a new account's Progress shows an Achievements card ("0 so far") with four dashed outlines to reach, as in the demo: First weigh-in, First day logged, First complete day and 3 days in a row. They are real achievements (firsts and a 3-day streak before 7), worked out from the records like the others, so imported history earns them quietly. Once one is earned, Progress shows the Achievements row again. Unreached first steps use a line icon in the outline; earned ones an OpenMoji picture (scale, plate, check). 3 days shares 7's amber, so the colours settled for longer streaks are unchanged.
- **Empty Progress:** New weigh-in opens in place, as on Today (`today/WeighIn.svelte`), instead of going to Today (2026-11-07).
- **Profile:** as in the demo: the budget card first, then **About you** as rows (Height, Birth date, Sex for the formula, Body fat) that open setup's first step, with "Weight comes from your weigh-ins on Today."; then **Budget settings**: the activity switch and, with a goal weight, Keep deficit / Maintain as a two-way choice. Macro targets stay in their own card below (not in the demo). Setup's first step saves the details when it moves on (`PATCH /api/v1/profile/details`), so someone who came to change one detail may stop there and a calculated budget still follows from today (2026-11-07).
- **Passkeys:** labels sit beside the name; rows open a detail sheet with Rename and Remove.
- **Members and Server (admins; split 2026-11-21, owner):** Members holds the people on the server: People and Invite someone. Server holds what concerns the whole installation, in this order: Backups (with the deleted accounts), Updates, Personal AI keys and Label scans. In More, Server sits after Members and carries "Update available". Old addresses: `/household` still leads to Members.
- **Server:** "Backups are working" is one larger line with a bigger mark. Sections have small labels above their cards. Invites lists only invites still waiting (owner, 2026-11-10). Deleting someone needs the "I understand" tick as well as a passkey. Deleted accounts sit inside the Backups card (owner, 2026-11-10: the list is only for a restore), with why the list exists, who deleted each account and **Copy list** (the entries as `obur restore finish` takes them). They list opaque IDs, not the demo's names: names are not kept after deletion. The off-site row says whether a copy is set up, not when it last ran, because the backup report only has that.
- **Your data, LoseIt import:** the chosen file replaces the picker (name, source, dates, size in one row); one "To add" list with numbers on the right, deleted entries as the last grey row; weight unit and sharing as two settings rows, plus a water unit row (ml or fl oz, with the file's most water in a day) when the file has water (audit D02); even spacing throughout.
- **No connection (2026-11-20, provisional until the owner sees it):** one screen in the shared warning style, grey: the cloud icon tile, "obur needs a connection", "Check your connection, then try again.", and **Try again**. A failed save keeps its sheet or form open with the shared failure line ("Couldn't save. Check your connection and try again."); a day note says "Not saved · it goes with your next change" under the field and "Not saved" on the closed card.
- **Entries left on a phone by the old offline support:** rc.5 to rc.7 sent them and showed a refused one on Today; 1.0 removes that step (2026-11-21 audit, C01). Meal cards show no waiting rows.

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
- **From 760 px:** a sticky side nav with the same five items: icons only (72 px) until 1100 px, labelled (232 px) from there. `/settings` redirects to `/more/settings`.
- **More:** see "More and settings" in the design review above.
- **Theme:** chosen in More → Settings → Appearance as System / Light / Dark, with System as the default. There is no theme toggle in the header.

**Header**
- Shows previous day, then the title (Today / Yesterday / "Thu 15 Oct") with the long date under it, then next day.
- The next-day arrow is disabled on today. You can go back as far as the data goes.
- On desktop the header spans only the left column, so the next-day arrow lines up with the cards' right edge. On phone the title is centred.

**Today** (superseded by the design review above where they differ)
- **Budget card** (owner's pick 2026-10-30, "number and bar", from an Artifact comparing it with the ring, an equation-tiles card and a half gauge): "kcal left" or "kcal over" as the headline (Bricolage 44 px phone, 48 px desktop) with a compact **Activity** pill beside it (a flame in the accent colour, the label and the day's activity kcal; owner, 2026-11-09: the plain pill didn't read as a button); one full-width 12 px bar of eaten ÷ budget; Eaten at its left end and Budget at its right. The budget's breakdown is not on the card face (the owner found the "base + activity − goal" line spoils the design): tapping **Budget** opens rows for Base burn (or Your own target), Activity, Goal and the total, plus the activity-not-added and minimum notes. Without a budget the headline is "kcal eaten" with a Set up link. The owner may revisit a ring if the activity button and breakdown can be placed well; the calendar keeps its rings. The room under the Eaten/Budget line equals the room above the headline: the Budget button's 44 px height is taken back from the row (owner, 2026-11-13). **Unknown calories (owner, 2026-11-21, audit A43):** an item without a calorie value is never counted as 0. When some items have none, Eaten shows the known total with "+" ("455+") and one muted line under the row says "1 item has no calories, so the total is higher." ("2 items have …"); "kcal left" stays the known figure. When no item has one, the headline and Eaten show "?" and the line says "Nothing logged has calories, so the total is unknown." The same "+" follows a partial day's calories in Journal's day box, the calendar's spoken labels, and Progress (a tapped bar and the average); a partial day still counts toward under/over budget.
- **Budget colours:** accent while under budget. When over, the bar and number turn **red** (`bad`). This was the owner's explicit choice.
- **Nutrients card:** protein, carbohydrate and fat bars against their targets. Fibre, sugars, saturated fat and salt sit in a 2×2 grid. Unknown values show a "+" and "N entries unknown", never zero.
- **Water and weight:** side-by-side cards with +250 / +500 ml buttons (+8 / +16 with US fluid ounces, where Other amount takes fluid ounces with a plain "fl oz" suffix, up to 338 fl oz) stretched across the first row and a full-width **Other amount** button below them that turns, in place, into a field with a tappable **ml / l** suffix (per entry, starting at ml; a typed "3,5 l" also works; up to 10 l) and a round check button (owner review 2026-10-30), and a decimal-comma weight input. Each card has an **Edit** link (shown once something is recorded) that opens a sheet: Water lists the viewed day's additions, Weigh-ins lists all readings newest first, 20 at a time with **Show older**. Each row has Edit (inline value, decimal comma) and Delete; a deleted row stays in place, struck through, with its own Undo, because a toast would sit behind the sheet. A weight change that moves a calculated budget says so at the top of the sheet (added 2026-10-30, provisional).
- **Meal cards:** Breakfast, Lunch, Dinner and Snacks, each with its kcal total and a **+** button. Each entry row shows a two-line clamped name, quantity, badges ("Macros unknown") and kcal. Tapping an entry opens Edit.
- **Desktop layout:** two columns, with Today on the left and the Log panel as a sticky 380 px panel on the right, starting level with the Budget card (the day header sits above, in Today's column only).

**Log**
- **Idle state:** the search field, then two large centred tiles, **Speak** (olive icon tile) and **Scan a label** (ochre icon tile). There are no descriptions under the tiles. Until a feature is built (voice in Phase 2, scanning in Phase 3), its tile is shown disabled with a "Coming soon" label (owner decision, 2026-10-25); once built, a tile switched off in configuration is hidden. Below them is a "Quick add calories" ghost button.
- **Suggestions:** they appear only when the search field is focused and empty. A Cancel button then returns to the tiles. Typing replaces suggestions with results.
- **Search matching:** Turkish-insensitive, so "sutas" finds "Sütaş Ayran".
- **No results:** the empty state points to scanning or quick add.
- **The meal's +:** goes to Log, not a modal, with the meal preset. An "Adding to Lunch · Today" pill shows the preset and can be cleared. On desktop the panel is already visible, so + sets the preset there; the pill pulses briefly, the panel's outline flashes for under a second, and the pill is announced to screen readers (owner report 2026-10-30: the change was easy to miss; no motion with reduced motion). Focus stays put, so the panel keeps the same tiles as the phone's Log screen. A modal would duplicate search, voice and scan.
- **Picking a food** opens a sheet (bottom sheet on phone, 440 px right-side sheet on desktop) with these steps:
  1. The basis line, then the amount (the language’s decimal mark; either is accepted) and unit chips.
  2. Day chips: Today / Yesterday, or the viewed day plus Today.
  3. Meal chips.
  4. A live preview, then Save: kcal as the headline, then Protein, Carbs and Fat, each with a dot in its Nutrients-card colour (owner request 2026-10-30; the earlier one-line "P · C · F" was hard to read). Unknown is "?"; estimates show "≈" and bounds "<"; carbohydrate falls back to an imported value of unstated definition, with a note. The same preview is used on Check and log cards and when editing an entry.
  5. After Save it returns to Today, briefly highlights the new row and shows a toast.
- **Speak:**
  1. A pulsing mic with "Listening… say what you ate" and an example, the seconds, plus Done. The whole layout shows from the first frame ("Starting the microphone…", Done disabled until it listens), so the sheet never grows as it opens (owner, 2026-11-23).
  2. "I heard" as editable text.
  3. One card per parsed food, with an editable amount, unit, kcal, meal and day, and a remove button.
  4. "Log all (N)" saves them; "Try again" restarts.
- **Typed entry (provisional, built 2026-10-30, owner to review):** typing a sentence with more than a food's name in the Log search ("kahvaltıda iki dilim ekmek ve iki bardak su", "bugün 80,5 kiloydum") adds a **Log as typed** row above the results, with the number of items and the day. It opens **Check and log**, the same layout planned for Speak: "You typed" as an editable two-line text with **Read again**, then one card per item (food: a chooser among the candidates, amount, unit chips and live kcal, with prompts when the amount or unit is missing; calories only, water, weight and activity: their value), shared Day and Meal chips, and **Log all (N)**, enabled only when every card is complete. Each card has a remove button. After saving, one toast with one Undo for everything. Needs a connection.
- **Scan a label:**
  1. A camera frame filling the sheet width, with the hint "Fill the frame with the nutrition table", and "Take photo" (or "Choose a photo" on desktop).
  2. A "Reading the nutrition table…" state that says it runs on your own server.
  3. The product name field, typed by the user since the name is never read from the label.
  4. Basis chips: per 100 g / per 100 ml / per serving.
  5. An editable row for each value. Missing values are empty fields with a quiet "Unknown" placeholder.
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
- **The meal … menu** (on meals with entries): Save as a meal, Select entries, Move meal to…, Copy meal to…, Delete meal,
  each with an icon, and a line above Delete meal (owner, 2026-11-18, buttons review). It does everything a hold or drag
  does, without the gestures. How its button looks is still open (it must line up with the calorie numbers).
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
- **Swipe it away** (owner, 2026-11-21; `client/swipe-away.ts`), as with a phone's own notifications, for an ordinary and an achievement toast. Sideways or down it follows the finger; let go past half its width (half its height going down), or with a quick flick, and it slides off; otherwise it goes back. A finger on it stops its timer. Touch and pen only. With reduced motion it still follows the finger, without the slide.
- **Dismiss button** for the keyboard and screen readers: hidden until the keyboard reaches it (owner's choice B, 2026-11-21: a computer screen has room to wait, so no visible ×).

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
  - Phone: a tab bar **Weight / Calories / Nutrients** and a compact range dropdown (1W, 1M, 3M, 1Y, All; all time by
    default) beside the page title, styled like a settings row's value: muted text and a small arrow, no tray, so it
    doesn't clash with the tabs below (owner, 2026-11-21; it replaced the earlier tray, 2026-10-31); one topic at a time, each with a headline number, a chart and a few stat rows.
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
| warn (warning) | `#8A4B00` | `#F2B65A` | warning icon tiles and lines |
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
- **The logo follows the chosen icon (owner, 2026-11-09):** the desktop sidebar's logo is the transparent artwork with
  only the O in the chosen icon's colour, the bowl brown in light and cream in dark (`static/app-icons/<id>/logo-light.png`
  and `logo-dark.png`, from `brand-icons.sh`). The O keeps at least 3:1 against every theme's surface, so where the
  icon's O is too faint the logo uses a deeper shade of it on light (Zerde, Patlıcan, Zeytin) or the icon's
  background colour on dark (Kaset's teal, Sinyal's lime). The sign-in page shows the chosen icon itself (the tile,
  read from this browser's cookie), which suits every background. The browser tab icon stays the brown/cream bowl.
- **Choosing an icon (owner, 2026-11-07, review round 9):** Appearance offers nine Home Screen icons: Pazar (the
  default, the icon above), Pazar light, and one for each other theme. Each is the same artwork with only the
  background and the O in the theme's colours; the bowl and food never change. They are made from the SVG by
  `./scripts/brand-icons.sh` into `static/app-icons/<id>/` (list in `shared/app-icons.ts`) and kept out of the
  service worker's cache. The choice is kept with the account (`profiles.app_icon`, null for the default),
  not the device: an iPhone's Home Screen app keeps its own cookies apart from Safari's, so a choice made in the app
  was lost when the owner removed it and added obur again from Safari (owner's report, 2026-11-07). Signed in, the
  server writes the account's icon into the page's `apple-touch-icon` and links `/manifest.webmanifest?icon=<id>`,
  a route that names that icon's files; an `obur_icon` cookie covers pages before signing in. It is in the export with the other settings (see "Settings follow the account"). A phone reads the icon when obur is added to the Home Screen, so the card's one line says
  a new icon shows after adding it again. The logo and browser tab icon stay the brown and cream artwork.
- **Fonts (owner, 2026-11-07, review round 9):** Bricolage Grotesque and Inter stay in every theme.

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
  Done or Escape closes; "See all achievements"). Tapping an earned badge on the badge page plays its celebration again (as in the review demo; built 2026-11-09 after the owner noticed it missing), without "See all achievements"; Done returns focus to the badge. Only the most notable new one gets the toast; others that arrive
  with it are kept quietly. Celebrated means seen, once. Kilo circles hold only the number (owner: "just put the
  number in circle"); the tint is 10 % of `--badge-coral` plus 8 points every further 10 kg, and the number's ink
  moves from coral to the text colour (and in dark, to the dark accent ink) as the tint deepens, tested for 3:1 at
  every step in both themes. Streaks: 7, 14, 30, 60, 100, 180 and 365 days, coloured amber, coral, rose, violet,
  blue, teal, green in turn. The badge page opens from an "Achievements" row at the foot of Progress and from an
  achievement in the Journal; it says why when weight achievements are off. Pictures: OpenMoji 15.1.0 in
  `static/icons/achievements/` (dark variants from `node scripts/food-icons-dark.ts`). Pounds (2026-11-22): with the
  weight unit set to pounds, the section is "Pounds lost", one every 5 lb, the tint deepening every 25 lb (after five
  badges, as kilos every 10 kg); the celebration, toast and Journal say "35 lb lost" (docs/achievement-comparisons.md).
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
- **Help:** a Units topic (2026-11-22, audit D09: where to change each unit, the start units, and that records stay as stored). Its own page (search that ignores accents and Turkish letters, answers grouped under topic headings with no topic chips (owner, 2026-11-09), short real answers that slide open with the shared `.collapse-row` motion), opened
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

### Food icons (owner's choice 2026-10-30: OpenMoji; to be replaced by obur's own set, see below)

- OpenMoji 15.1.0 food and drink icons (CC BY-SA 4.0; credit at the foot of More), bundled in `static/icons/food/`.
- A food shows its chosen icon, else the one its name suggests (`shared/food-icons.ts`: English and Turkish words,
  the match nearest the end of the name wins), else a plate. Quick adds use their description.
- Shown as a 40 px tile with a 28 px icon, left of the name, in meal cards, Log search and recent foods, the Foods list,
  and the saved meal and recipe editors. The tile follows the theme (`--icon-tile`); in dark the icons use a variant
  with OpenMoji's black outlines redrawn light (`static/icons/food/dark/`, from `node scripts/food-icons-dark.ts`;
  owner found the bright tiles out of place in dark mode, 2026-10-30). Decorative: the name always sits beside it.
- The food form's and recipe editor's **Icon** row shows the current icon and whether it is suggested or chosen; **Change icon** opens a
  picker (search in English or Turkish, a grid of tiles, "Use the suggestion from the name" when one is chosen).

#### Our own food icon set (owner's decision 2026-11-27; under way since 2026-11-28)

OpenMoji stays until obur's own set replaces it. Status: the decisions below are the owner's **requirements**; the
method, numbers and order are **provisional** plans from the 2026-11-27 discussion; the cost figures are **estimates**
from an 8-icon pilot, not measurements.

- **Requirement: one style, entirely obur's own.** No mixing of icon styles, however alike. No third-party icons in the
  set: neither OpenMoji nor Iconito nor any other pack. OpenMoji is replaced in one switch once the set covers
  everything it covers now; until then the app shows OpenMoji only.
- **The look:** flat, colour, no outlines, two or three tones per hue, a darker crescent on the lower right and a small
  highlight; each drawing fills its square and reads at 29 px. This is the look of the Iconito pack the owner preferred
  among three candidates (Iconito, Culinary Assets, Ingredient Atlas, compared on the Foods screen on 2026-11-27). Ours
  are drawn from scratch; nothing is traced or copied. The palette may lean towards Pazar so the set is obur's own.
  The owner liked an 8-icon pilot in this look (pear, cherries, apricot, pomegranate, eggplant, chicken şiş, chili,
  Turkish coffee); those drawings are kept in `assets/food-icons/` (source in `build.ts`, built files in `svg/`).
- **Method (provisional):**
  1. A short written style guide: 1024 grid, a fixed palette per food family, the shading rule, legibility at 29 px.
  2. Icons as source code in the repository: each drawing a few lines in a script with shared helpers (shading, stems,
     leaves, plates, cups, bowls); a build step writes the SVGs, fits each to its square and minifies it. A palette or
     shading change is one edit rebuilt across the set.
  3. Batches of about 15. Each batch is rendered and checked, then shown to the owner on a review page (Foods rows,
     close-up, light and dark, keep or redo per icon); redos go into the next batch.
  4. English and Turkish words per icon as now; matching unchanged. Tests: every word points at an existing icon, and
     a set of real Turkish names gets the expected icon.
  5. Each icon drawn to read on both the light and dark tile (no separate dark files, unlike OpenMoji).
- **The switch.** Chosen icons are stored as OpenMoji hexcodes (`foods.icon` with its format check, diary snapshots,
  exports). Provisional: keep those values and map each hexcode to the new icon when shown, so no diary snapshot or old
  archive is rewritten; new choices store the new names. The OpenMoji files and the CC BY-SA credit go at the switch;
  the new set is MIT like the app.
- **Size (provisional):** about 150 icons before the switch (the 133 foods mapped now plus about 15 fallbacks for whole
  groups: soup, pastry, dessert, sauce, snack, drink, supplement and so on), then about 340 in all with Turkish staples
  and dishes (~100) and the owner's own long tail (~50). Batch order: fruit, vegetables and legumes, bakery, dairy and
  eggs, meat and fish, dishes, sweets, drinks, fallbacks; then the rest.
- **Where the list comes from:** (1) the owner's own history: a script run on their own installation or LoseIt export
  that lists, by how often logged, the food names that fall back to the plate; it reads only the owner's data, and the
  output stays on their machine; (2) today's 133 mapped foods; (3) the Turkish national food composition database
  (TÜRKOMP) as a checklist of names, after checking its terms; (4) Ingredient Atlas's CC0 catalogue names as a
  checklist only; (5) USDA food groups and the "What We Eat in America" categories, so no group is missed.
- **Estimated cost:** per batch about 30–60 minutes of Claude's work and 100–200k tokens (mostly re-read context),
  plus 10–15 minutes of the owner's review; about 10 batches to the switch and about 23 for the whole set (roughly
  20–30 hours spread over many sessions). Dishes take more redraws than fruit and vegetables.
- **Achievement pictures too (owner, 2026-11-28):** "our own system through and through". The achievements' 59
  OpenMoji pictures (`static/icons/achievements/`, `shared/achievement-display.ts`) are redrawn in the same set: 13
  are foods the set needs anyway, 46 are other things (animals, sports gear, household objects). They switch together
  with the food icons, so the set needs about 200 icons before the switch (about 14 batches).
- **How the owner reviews a batch (2026-11-28):** a private review page per batch: each icon in the Foods
  rows at real size on a phone-sized screen, light and dark, beside icons already kept, plus a close-up; Keep or Redo
  with a note per icon, saved on the page and read back from it. The owner also opens it on their phone. Before a page
  goes out, every icon is rendered at 29 px on both tiles and in greyscale (does it rely on colour alone?). No
  guessing round: the owner found it unnecessary and asked that it never be made again (2026-11-28).

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
- **The meal … button is the bare dots** (muted, no circle or square) in a 44 px tap target, the last dot's ink ending
  on the calorie numbers' right edge (owner, 2026-11-18, buttons review round 2: a circle or square never lined up,
  whether its edge or its dots were aligned). `menu-dismiss.e2e.ts` measures it.
- **Live result previews keep their layout still:** the number that changes sits in a fixed-width column, so the
  values beside it don't move as it gains or loses digits.

### Your own AI key for Speak and Scan (owner's review, round 10, 2026-11-07)

All seven screens kept; reference: `docs/ui/review-2026-11/remote-models.html`. Design: `docs/design.md`, "Remote models for Speak and Scan".

- **More → Speak and Scan:** a card for Speak and one for Scan, each a radio list: **On this server** ("Nothing leaves your server"; without the add-on it is disabled and says "Not set up on this server. An admin can add it.", or for an admin which add-on it needs and where the install guide explains adding it) and **With my OpenAI key** / **With my OpenRouter key** (disabled with "Add a key below first" until one exists). **Your keys:** provider, "···· last four · checked today", Remove; this month's count of recordings and labels; Add a key. Only the person sees this page's choices and keys.
- **Add a key:** a sheet with an OpenAI / OpenRouter segmented control, the key field, where to find a key, **Check and save** ("Checking with OpenAI…" while it asks). A refused key is never saved; the field turns red with the reason. A line says it is stored encrypted and only the person can use it (only its last four characters are shown again).
- **Consent:** choosing a key for Speak or Scan opens "Send your recordings to OpenAI?" / "Send your label photos to OpenAI?" listing exactly what is sent, that the company's terms apply, that nothing of anyone else's is sent, and that switching back stops it: **Send to OpenAI** (primary) and **Keep it on this server**.
- **Using it:** Speak shows "With your OpenAI key" under Done. Check the label's notes start with an amber "Read by OpenAI. Check each value against your photo."
- **Failures** (redrawn after the owner found the first version confusing): one warning card saying what happened, one button that fixes it, then **Type it instead**. Key refused: **Replace the key** (opens Speak and Scan). Out of credit: **Record again** / **Take the photo again**. Not answering: **Try again**, which resends the same recording or photo. Only when the server has the add-on, a small link: "Read this one on obur's server instead". Nothing ever switches to a company by itself.
- **No add-on on the server:** while personal keys are allowed, Log keeps the Speak and Scan tiles in their usual order and colours; tapping one opens "Speak isn't set up on this server" (or Scan) with **Use my own key** and **Type it instead**.
- **Server (admins), Updates** (owner, 2026-11-13; on Members until 2026-11-21): a card above Personal AI keys with a **Check for new versions** switch (off by default; its line says GitHub is asked once a day and nothing about the members is sent), then rows: **This version**, and with the switch on **Last checked** (the time, "· nothing newer" when so, or "GitHub couldn't be reached"). A newer version is one information notice at the top of the card, "Version X is available", with a **How to update** link to the guide; More's Household row then reads "Update available".
- **Server (admins):** a **Personal AI keys** switch, on by default. Off hides the choice, the server refuses remote requests, and people with keys see why.
- **No Turkish examples** in visible text or user-facing docs (owner, 2026-11-07).

## 4. Deliberately left open

- **Where the achievements page is opened from:** proposed a row on Progress ("Achievements" with the count) and from an achievement in Journal; not yet confirmed.
- **Unfinished screens:** Profile and goals, Units and formats, Your data, Members and admin, and onboarding (including BMI). Provisional versions of Profile, onboarding, Your data and Members exist (Phase 1 steps 7 and 10) and need the owner's review.
- **Barcode:** with no outside product lookups, a barcode only finds products a member already scanned. The proposal is to add it later as a shortcut inside Scan, not as its own tile. Not building (owner, 2026-10-31) unless real use shows packaged products are slow to find.
- **Voice quick adds:** voice could also handle "500 calories, dinner". If it does, the Quick add button could move to the no-results state only.
- **Voice error states:** nothing heard, low confidence, a food not found (offer to create it or quick add), voice turned off in `.env` (hide the tile).
- **Scan (owner approved 2026-11-09, as in the review demo):** the Log panel's Scan tile opens a **sheet** like Speak and Type it (a centred dialog on desktop; `ui/scan/ScanSheet.svelte`): the dashed frame with the camera live inside it from the moment the sheet opens, as Speak listens at once (owner, 2026-11-23, knowing an installed iPhone app may ask for the camera again each session: **Take photo**, or a tap on the camera itself, takes what the frame shows, cut the same way, and the photo stays in the frame while it is read; the camera stays on while the app is away, so the way back asks nothing again (the phone pauses it; a computer's webcam light stays on in a background tab while Scan is open), and if the phone ends it, for example for Choose photo's own camera, it comes back when the page shows; without a camera the page may use, refused or none, the frame says "Fill the frame with the nutrition table", Take photo opens the phone's own camera, and a refusal is not asked again until the app is opened again), one tip ("Fill the photo with the table, flat and in good light."), **Take photo** (camera) and **Choose photo**; "Reading the label…" in the frame while it works, and the waiting line when the scanner is busy. Errors show as cards in the sheet (no table, blurry, busy, too many scans, an unreadable photo, unavailable, offline, the person's key refused), each with Fill in by hand. What was read goes to **Check the label** (`/scan`, a page because it is the whole food form): the photo (Show/Hide), a note to check every value, the notes per decision, the form with name and brand to type, **Save and choose amount**, which opens Log's amount sheet for the new food, and **Retake**, which opens the sheet again in place. The "Log it after saving" checkbox and its account setting were removed (2026-11-09: where you start decides; dropped by migration 0045, still read from older archives). `/scan` opened without a reading (a reload) goes to Log with the sheet open. **Scan inside New food** (owner approved 2026-11-09, review round 4, after rejecting a separate Scan button on Foods, a card at the top of the form, a "+ New" beside the search and a title-row button as off-language): Foods keeps the full-width New food button. The food form's Nutrition card has **Scan label** on the right of its title, styled like the icon's **Change**, shown when scanning is set up for the person; the hint reads "Copy the label, or scan it." It opens the same Scan sheet over the form; what is read fills the Nutrition card in place (basis, label type, values), keeping name, brand, icon, portions and who can find it. With values already typed it first asks "Replace the values you typed with what the label says?" (**Keep mine** / **Scan and replace**). After a scan the notes replace the hint and the button becomes **Show photo** / **Hide photo**, which opens the photo in the card under the title; **Retake** sits under the photo, inside its frame (never over the label's values), and scans again, replacing the values without asking (owner approved 2026-11-09, review stop 4, after rejecting a row of buttons under the card title). These buttons follow Log's tiles: the icon in Scan's ochre square (Log's scan-line for Scan label and Retake, a picture for the photo), the words in ordinary text (`ui/scan/ScanAction.svelte`). Fill in by hand closes the sheet and leaves the form as it was. Save food (from New food, scanned or not) goes to Foods with the food highlighted for a moment; nothing is logged. Several tables on one pack and barcodes are not handled yet.
- **Marking a day complete:** a full-width **Day complete** switch below the meal cards, styled like a card, with its hint below (owner review 2026-10-30). Turning it off is the undo. The calendar depends on it.
- **Saved meals (provisional, built 2026-10-30, owner to review):** a muted bookmark button beside a meal card's total (only when it has entries) opens **Save as a meal**: a name (defaults to the meal's name) and a checklist of the meal's entries, all ticked. In Log, saved meals appear above Recent when the search field is focused (the five most recently changed) and above food results when their name matches (Turkish-insensitive). Picking one opens a sheet titled with its name: the item checklist, the same Day and Meal chips as the amount sheet, and **Log N items · X kcal**, which creates ordinary entries with one Undo in the toast. The sheet is for logging only; an **Edit meal** link below opens the editor (owner review 2026-10-30: managing and logging are separate). More/Settings has a **Saved meals** page listing them all, each opening its editor, with **New meal**. The editor: a Name card; a Foods card with the running total, each item a row (name, quantity, kcal) that expands to Amount, unit chips, the macro preview and **Remove from meal**; **Add food** opens a sheet to search and pick an amount; **Cancel** and **Save** side by side. For an existing meal, a **More** card offers **Update to current food values** (disabled until changes are saved or cancelled) and **Delete saved meal** with an inline confirmation. Saved meals need a connection (not part of the offline queue).
- **Recipes (provisional, built 2026-10-30, owner to review):** More/Settings has **Recipes**, a list with energy per serving and **New recipe**. The editor shares the saved meal editor's ingredient list (rows that expand to amount, unit chips, preview and Remove; **Add food**, which refuses recipes): above it a card with Name, **Servings it makes** and **Cooked weight (g, optional)** side by side with a hint; below it **Per serving** with the macro preview, the serving's weight and a note when energy is unknown; **Cancel** and **Save**; for an existing recipe, Update to current food values and, at the end, Archive recipe (see "Archived and deleted"). A recipe's food page links to the editor.
- **Other logging flows:** A provisional food create/edit screen (`/foods/new`, `/foods/[id]`) was built in Phase 1 step 4 following the scan confirmation layout above: basis chips, one row per value with empty rows marked unknown, no separate "less than" control: a value printed as "<0.5" shows as "<0.5" in its field (Scan fills it in that way, and typing a leading "<" sets it; retyping the number without it clears it; owner, 2026-11-18, as hardly anyone would use a per-row "<" button), an optional **More nutrients** disclosure for the source-backed extra codes (fat types, cholesterol, starch, polyols, calcium, potassium, iron; open when the food has any), live plausibility warnings, portions, Shared/Only me, an EU-Turkey/US label switch (US maps carbohydrate to total carbohydrate and salt to sodium), "Make my own variant" and Archive. It needs the owner's review before it is considered designed.
- **Calendar details:** which month it opens on when you come from a past day (the demo always opens the current month); a just-under day that looks almost full.
- **Day titles:** for older days, whether "Thu 15 Oct" in the title duplicates the long date underneath.
- **Tablet:** only the 760 px switch was checked.
- **Testing:** full dark-mode contrast and 200 % zoom testing on the real build.
- **Demo data:** the demo uses fixed dates (today = Sunday 25 October 2026) and made-up past days. It is not test data.

## 5. Implementation notes (Phase 1, step 5)

Routine choices made while building the screens; none changes the direction above. Listed so the owner can review them.

- **Sign out** sits at the bottom of More, under "Signed in as …". The demo did not place it.
- **Default meal** for a new entry when no meal was preset: breakfast 04:00–10:30, lunch 11:00–15:00, dinner 17:00–21:30, otherwise snacks (device time zone).
- **After midnight** (before 04:00) the amount sheet keeps Today selected and shows "It's after midnight. Did you mean yesterday?" above the day chips, as the design asks (offer, never silently change).
- **Budget card** shows calories eaten and "Budget: Not set yet" until goals arrive (Phase 1, step 7); the ring structure is already in place.
- **Nutrient bars** are drawn relative to each other until targets exist (step 7). "Partial · N unknown" marks totals where some entries lack the value; "Unknown" when none has it.
- **Desktop Log panel** starts fresh after each save (query and preset cleared).
- **Settings follow the account** (owner, 2026-11-07: "all our settings synced to the user account", in the backup and the export): mode, theme, app icon, 24/12-hour time, Scan's "Log it after saving", Progress's Readings/Trend, and the dismissed "Speak is off" card and holding tip (`shared/preferences.ts`, columns on `profiles`, `PATCH /api/v1/profile/preferences`). The root layout reads them again in the background (since 2026-11-13: after a page change once they are 30 seconds old, always when the app returns to the foreground, and at once after every save; no page waits for it), so a change made on another device shows without a reload, and the page's Home Screen icon link is always current (it was written once per page load before, which is why Safari added the old icon). Safari also reads that icon only when a page loads, so choosing an icon reloads the page in place, with the "App icon changed" toast carried over, and a tab that finds the icon changed elsewhere loads again once on its next page change (online only). Cookies keep the look for pages before signing in, and the first time an account loads it takes over the look that browser already had. A device's time zone and its waiting entries stay on the device. System is the default mode.
- **Day titles** are formatted by hand ("Tue 20 Oct", "Tuesday 20 October 2026") because browser engines format dates differently.
- **Portion text**: "1 bar" for one basis serving, "2 × 1 bar", "3 × slice (26 g)", "2 × Su bardağı (200 ml)".

## 6. Changes to other docs

- `docs/design.md`: replace "calm over-budget" with red for over budget (the ring on Today and the calendar), by the owner's choice.
- `docs/design.md`: voice and label scanning are part of the core logging UI (Speak and Scan tiles on Log). They still need hiding when switched off in `.env`.
- `docs/design.md`: suggestions show only when the search field is focused. There are no standing Favourites/Recent lists.
- **Your data** (step 10, provisional): three cards. Export ("Download export"), Import (choose a file, then a preview table of New / Already here / Kept as is per kind with plain-language warnings, then "Import"), and Delete account (the backup-retention note, and a confirmation sheet with an "I understand" checkbox).
- **Members** (step 10, provisional): a People card with "Delete account" for others (confirmation sheet), and a Deleted accounts card listing opaque IDs and dates with the instruction to keep a copy off the server.
- **Imported carbs** (Phase 2, provisional): LoseIt does not state its carbohydrate definition. The Nutrients card shows Carbs from the excluding-fibre values when any entry has one; on a day with only imported values it shows those with "Definition not stated (imported)"; on a mixed day it shows the stated total with "+ N g with the definition not stated (imported)". The two are never added together.
