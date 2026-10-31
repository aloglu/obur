# obur — brief for the Progress history demos

Paste this into a Claude app conversation, and attach `docs/ui.md` and `docs/ui/pazar-demo.dc.html` (the chosen Pazar
direction) plus phone screenshots of the current Progress screen in light and dark. The outcome (the chosen layout, its
HTML and any new tokens) comes back to the repository and is recorded in `docs/ui.md`; this brief and that
conversation are discussion aids, not a source of truth.

## The product, briefly

obur is a self-hosted calorie, weight and water tracker for a household, replacing LoseIt: an installable mobile web
app, English interface, food names in Turkish and English. The visual direction is already chosen (**Pazar**: warm
neutrals, burnt-orange accent, Bricolage Grotesque headings, Inter text, soft cards). Stay inside it: these demos
explore layout and chart form, not a new style.

## What to build

The **Progress** screen below the existing month calendar, as clickable HTML at **phone (390 px)** and **desktop
(side navigation, wider content)**, in **light and dark**. Two or three **layout alternatives** of the same content,
so the owner can pick one; within each, everything consistent.

Content, in a suggested order of importance:

1. **Weight over time**: every weigh-in as a point, plus a smoothed trend line (the trend is the honest signal; daily
   readings bounce). Goal weight as a reference line. Headline: current trend weight and change over the range
   ("−3,2 kg in 3 months"). Gaps between weigh-ins stay gaps in the points; the trend line may continue across short
   gaps but must not invent readings.
2. **Calories against budget**: eaten per day next to that day's budget (budgets change over time; each day keeps its
   own). Over and under must be readable at a glance without relying on colour alone. Days not marked complete look
   different (they may be partly logged).
3. **Averages for the range**: average calories eaten, average under/over budget, average protein / carbohydrate /
   fat, water per day, weigh-ins. Each average says what it is based on ("over 18 complete days").
4. **Nutrients over time** (lower priority): protein, carbohydrate, fat (and optionally fibre) per day or per week.
   Some days have unknown values for some nutrients (imported or partly labelled foods): show that coverage is
   partial; never draw unknown as zero.
5. **A place for achievements** (later feature, just reserve space and show one example): e.g. "5 kg lost", one per
   kilo lost. It should feel like a small reward, never block anything.

Ranges: **1 week, 1 month, 3 months, 1 year, all**. One range control drives the whole section. On a phone, a chart
should be readable at a glance and allow tapping a point/day for its exact values (no hover on phones). Tapping a day
in the calories chart could open that day, like the calendar does.

## Content to use (fictional)

- Weight: 104,8 kg on 1 August falling unevenly to 97,3 kg on 31 October; weigh-ins on about two days in three, with
  one 9-day gap in September. Goal 85 kg. One reading in October is 1,4 kg above the trend (water weight) to show why
  the trend matters.
- Budget: 2,050 kcal until 14 September, then 1,980 (a new weigh-in lowered it).
- Calories: most days 1,700–2,050; about one day in six over budget (up to +600); one 3-day holiday with no logging;
  about one day in eight not marked complete.
- Macros: protein 90–150 g, carbohydrate 150–240 g, fat 50–90 g; ten days in August with carbohydrate unknown for
  part of the day (imported history).
- Water: 1,5–3,5 l on most days, none recorded on some.
- Numbers use the comma decimal ("97,3 kg"), as in the app.

## Rules that affect the design

- **Practical first.** The answer to "am I on track?" should be visible without scrolling on a phone; detail below.
- **Honest data.** Unknown is not zero; incomplete days are not shown as successes; estimates and smoothing are
  labelled as such. Past days keep the budget they had.
- **Accessible charts.** WCAG AA contrast in both themes, not colour alone for over/under, readable at 200% text, a
  text summary for screen readers, reduced motion respected, touch targets at least 44 px.
- **Long text.** Achievement and label text must survive Turkish-length words and 200% zoom.
- Charts will be built with **LayerChart** (Svelte); avoid chart forms it can't reasonably draw.

## Questions for the owner to settle with the demos

1. Which layout: chart-first, summary-first, or tabs per topic (Weight / Calories / Nutrients)?
2. Weight: trend line plus points, or something simpler?
3. Calories: bars against a budget line, or bars showing difference from budget (above/below a zero line)?
4. Should averages count only days marked complete (proposed), or every logged day?
5. Desktop: charts side by side, or one wide column?
