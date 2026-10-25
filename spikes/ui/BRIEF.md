# obur — brief for UI demo directions

Paste this into a Claude app conversation. The outcome (chosen direction, its final HTML and its tokens) comes back to the repository and is recorded in `docs/ui.md`; this brief and that conversation are discussion aids, not a source of truth.

## The product

obur (Turkish: "gluttonous") is a self-hosted calorie, weight and water tracker for a household, replacing LoseIt. It is an installable mobile web app (PWA), English interface, with food names in English, Turkish or both. People log several times a day, mostly one-handed on a phone; the desktop is used less often but should feel designed, not stretched.

## What to build

Three **distinct visual directions**, each as a clickable HTML demo of the same flows. Each direction is one coherent design system (colours, type, spacing, components, motion), not three unrelated screens.

Flows to show in every direction:

1. **Today**: the day's budget, eaten and remaining calories; meals (Breakfast, Lunch, Dinner, Snacks) with their entries; macros (protein, carbohydrate, fat) with a compact view of fibre, sugars, saturated fat and salt; water and weight quick entry. Navigation: Today, Log, Progress, Profile.
2. **Log a food**: search with recent/favourite foods first; pick a food; choose amount and unit; choose day and meal; save. Show the "logged" moment.
3. **Correct an entry**: edit the amount, **Move to** another meal (menu, not drag), delete with **Undo**.
4. **Calories-only quick add**: "300 kcal snack" with an optional description, other nutrients unknown.

Show each flow on a **phone (about 390 px wide)** and on **desktop (side navigation, two columns)**, in **light and dark**.

## Content to use (fictional numbers, real-style names)

- Budget: base burn 2,450 kcal + activity 250 kcal − deficit 700 kcal = 2,000 kcal. Eaten so far 1,240 kcal.
- Long names that must wrap or truncate gracefully:
  - Fellas HighPro+ Çikolatalı Kaplamalı Hindistan Cevizli Protein Bar (1 bar, 50 g)
  - Superfresh Pratik Sebze Sote Mix (225 g)
  - La Vache Qui Rit Light Üçgen Peynir (50 g)
  - Untad Premium Light Ekmek (3 slices; this food is per slice, with no gram conversion)
  - Migros Hindi Füme Eti (90 g)
  - SEK Kakaolu Protein Süt (330 ml)
  - Coca-Cola Zero (1 can, 330 ml)
  - Tavuk göğsü, çiğ (200 g)
- Decimal commas in input: "82,4 kg", "1,5 su bardağı".
- Search example: typing `sutas` finds "Sütaş Ayran".

## Rules that affect the design

- **Practical first, fun second.** Joy lives in short moments: a satisfying tick when something is logged, friendly copy, a confident palette. Animations are short, never block input, and respect reduced motion. Nothing decorative sits between the person and logging food.
- **Compact information, large tap targets.** Numbers and lists are dense and scannable; anything tappable is at least 44×44 px. WCAG AA contrast in both themes; text must survive 200% zoom; respect phone safe areas.
- **Unknown is not zero.** When some entries lack a nutrient (for example fibre), totals show that they are partial, for example "fibre 12 g+ (2 entries unknown)". A calories-only entry shows its macros as unknown, not 0.
- **Pending is not saved.** An entry created offline shows as pending until the server confirms it.
- **Remaining can go negative.** Show over-budget calmly, without alarm colours that feel punishing.
- Manual save is the confirmation; no extra "are you sure" for routine logging. Delete uses Undo, not a confirmation dialog.
- Voice and label scanning are not shown yet; they appear only once they work.
- Modern conventions over novelty. Menus exist for every action (no drag-only interactions).
- The real app makes no third-party requests, so fonts must be openly licensed and self-hostable (a demo may load them from a CDN). Turkish letters (ç ğ ı İ ö ş ü) must render well in the chosen fonts.

## What to bring back

For the chosen direction:
1. Its name and a few sentences on why it was chosen.
2. The final HTML file(s) of the demo.
3. Its tokens: colours for light and dark (with roles such as background, surface, text, muted, accent, success, warning, over-budget), type scale and font choice, spacing scale, corner radius, elevation and motion durations.
4. Anything deliberately left open.
