<script lang="ts">
	// Type it, and what Speak heard (docs/ui.md, "Logging"): the text, read again as it changes, one card per item with its
	// own amount, unit and kcal, the meal as a toggle that follows the text, then Log. Nothing is saved before that. Each
	// card has its own client ID, so a retry never logs twice; cards that saved leave the sheet.
	import AmountField from '../AmountField.svelte';
	import Chips from '../Chips.svelte';
	import Select from '../Select.svelte';
	import { onMount, untrack } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import Flame from '@lucide/svelte/icons/flame';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { goto } from '$app/navigation';
	import { newFoodHref } from '#lib/client/links.ts';
	import { foldForSearch } from '#lib/shared/search-text.ts';
	import type { FoodSearchResult } from '#lib/shared/food-types.ts';
	import FoodIcon from '../FoodIcon.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { householdMeasures } from '#lib/client/measures.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { addDays } from '#lib/shared/diary-rules.ts';
	import { MEALS, type Meal } from '#lib/shared/diary-types.ts';
	import type { EntryItem, LoggedEntry, ParsedEntry } from '#lib/shared/entry-types.ts';
	import type { FoodDetail } from '#lib/shared/food-types.ts';
	import { dayTitle, kcal, mealName } from '#lib/shared/format.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import { basisFactor, scaleNutrients, type Unit } from '#lib/shared/quantity.ts';
	import { unitOptions, type MeasureOption, type UnitOption } from '#lib/shared/unit-options.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import TextField from '../TextField.svelte';
	import MacroPreview from './MacroPreview.svelte';

	interface Props {
		/** What Speak heard; without it, an empty Type it. */
		entry?: ParsedEntry;
		/** The day being logged to, when the sentence names none. */
		date: string;
		today: string;
		/** The meal to use when the sentence names none. */
		meal: Meal;
		/** Calories alone work without the server. */
		oncalories?: () => void;
		/** The text came from speech: label it "I heard". */
		heard?: boolean;
		onlogged: (logged: LoggedEntry) => void;
		onclose: () => void;
	}
	let {
		entry: initial,
		date,
		today,
		meal: presetMeal,
		oncalories,
		heard = false,
		onlogged,
		onclose
	}: Props = $props();

	type Card =
		| {
				kind: 'food';
				id: string;
				text: string;
				candidates: Extract<EntryItem, { kind: 'food' }>['candidates'];
				food: FoodDetail | null;
				optionKey: string;
				said: string | null;
				amountText: string;
				/** Matched only loosely: asks which one before it can be logged. */
				unsure: boolean;
				searching: boolean;
				open: boolean;
		  }
		| { kind: 'quick'; id: string; kcalText: string; description: string; open: boolean }
		| { kind: 'water'; id: string; mlText: string; open: boolean }
		| { kind: 'weight'; id: string; kgText: string; open: boolean }
		| { kind: 'activity'; id: string; kcalText: string; note: string; open: boolean };

	const num = (n: number | null) => (n === null ? '' : formatDecimal(n, ',', 2));
	const keyOf = (u: UnitOption['input'] | null) =>
		!u
			? ''
			: u.kind === 'mass'
				? 'g'
				: u.kind === 'volume'
					? 'ml'
					: u.kind === 'serving'
						? `serving:${u.servingId}`
						: u.kind === 'basis_serving'
							? 'basis'
							: `measure:${u.code}`;

	function cardsFor(items: EntryItem[]): Card[] {
		return items.map((i): Card => {
			const id = crypto.randomUUID();
			switch (i.kind) {
				case 'food':
					return {
						kind: 'food',
						id,
						text: i.text,
						candidates: i.candidates,
						food: i.food,
						optionKey: keyOf(i.unit),
						said: i.said,
						amountText: num(i.amount),
						unsure: i.candidates[0]?.loose ?? false,
						searching: false,
						open: false
					};
				case 'quick':
					return {
						kind: 'quick',
						id,
						kcalText: num(i.kcal),
						description: i.description ?? '',
						open: false
					};
				case 'water':
					return { kind: 'water', id, mlText: num(i.ml), open: false };
				case 'weight':
					return { kind: 'weight', id, kgText: num(i.kg), open: false };
				case 'activity':
					return { kind: 'activity', id, kcalText: num(i.kcal), note: i.note ?? '', open: false };
			}
		});
	}

	let text = $state(untrack(() => initial?.heard ?? ''));
	let cards = $state<Card[]>(untrack(() => cardsFor(initial?.items ?? [])));
	let day = $state(untrack(() => initial?.date ?? date));
	// The meal follows the text; without a meal word it goes back to the one tapped, or the preset.
	let tapped = $state<Meal | null>(null);
	let meal = $state<Meal>(untrack(() => initial?.meal ?? presetMeal));
	let measures = $state<MeasureOption[]>([]);
	let busy = $state(false);
	let problem = $state('');
	let unreachable = $state(false);
	let field = $state<HTMLTextAreaElement>();

	onMount(async () => {
		if (!initial) field?.focus();
		measures = await householdMeasures();
	});

	const dayOptions = $derived(
		[...new Set([day, date, today, addDays(today, -1)])].sort().reverse()
	);

	let lastRead = $state(untrack(() => initial?.heard.trim() ?? ''));
	let readTimer: ReturnType<typeof setTimeout> | undefined;
	function textChanged() {
		clearTimeout(readTimer);
		readTimer = setTimeout(read, 350);
	}

	function retry() {
		if (!unreachable) return;
		lastRead = '';
		void read();
	}

	async function read() {
		const wanted = text.trim();
		if (wanted === lastRead) return;
		lastRead = wanted;
		problem = '';
		if (!wanted) {
			unreachable = false;
			cards = [];
			day = date;
			meal = tapped ?? presetMeal;
			return;
		}
		try {
			const parsed = await api<ParsedEntry>('POST', '/api/v1/entry/parse', {
				text: wanted,
				date,
				zone: deviceZone()
			});
			if (wanted !== text.trim()) return; // typed on meanwhile
			unreachable = false;
			cards = cardsFor(parsed.items);
			day = parsed.date;
			meal = parsed.meal ?? tapped ?? presetMeal;
		} catch {
			// Stays until the text changes or the connection is back: a retry on blur would pull the offered button away
			// from under the finger.
			unreachable = true;
		}
	}

	async function choose(card: Extract<Card, { kind: 'food' }>, foodId: string) {
		card.food = await api<FoodDetail>('GET', `/api/v1/foods/${foodId}`);
		card.unsure = false;
		card.searching = false;
		// The unit chosen for the previous food may not exist for this one.
		if (!unitOptions(card.food, measures).some((o) => o.key === card.optionKey))
			card.optionKey = '';
	}

	function toUnit(o: UnitOption): Unit {
		const i = o.input;
		if (i.kind === 'measure')
			return { kind: 'measure', ml: measures.find((x) => x.code === i.code)!.ml };
		return i;
	}

	/** The card's nutrients for its amount, or undefined while something is missing. */
	function foodNutrients(card: Extract<Card, { kind: 'food' }>) {
		const option =
			card.food && unitOptions(card.food, measures).find((o) => o.key === card.optionKey);
		const amount = parseDecimal(card.amountText);
		if (!card.food || !option || amount === undefined || amount <= 0) return undefined;
		const factor = basisFactor(card.food, amount, toUnit(option));
		return factor === undefined ? undefined : scaleNutrients(card.food.nutrients, factor);
	}

	const positive = (t: string, max: number) => {
		const v = parseDecimal(t);
		return v !== undefined && v > 0 && v <= max ? v : undefined;
	};
	const valid = (c: Card) =>
		c.kind === 'food'
			? foodNutrients(c) !== undefined
			: c.kind === 'quick'
				? positive(c.kcalText, 20_000) !== undefined
				: c.kind === 'water'
					? positive(c.mlText, 10_000) !== undefined
					: c.kind === 'weight'
						? positive(c.kgText, 699) !== undefined
						: positive(c.kcalText, 10_000) !== undefined;
	const notFound = (c: Card) => c.kind === 'food' && !c.food && !c.unsure;
	const unsure = (c: Card) => c.kind === 'food' && c.unsure;
	/** Foods nothing was found for don't hold the rest back: they just aren't logged. */
	const ready = $derived(cards.filter((c) => !notFound(c)));
	const allValid = $derived(ready.length > 0 && ready.every((c) => valid(c) && !unsure(c)));

	// Something missing opens its card by itself.
	$effect(() => {
		for (const c of cards) if (!c.open && !notFound(c) && !unsure(c) && !valid(c)) c.open = true;
	});

	function kcalOf(c: Card): string {
		if (c.kind === 'food') {
			const e = foodNutrients(c)?.find((n) => n.code === 'energy_kcal');
			return e ? kcal(e.value) : '';
		}
		if (c.kind === 'water' || c.kind === 'weight') return '';
		return c.kcalText;
	}
	function rowDetail(c: Card): string {
		if (c.kind === 'food') {
			if (!c.food) return m.entry_not_in_foods();
			if (c.unsure) return m.entry_not_sure();
			const option = unitOptions(c.food, measures).find((o) => o.key === c.optionKey);
			const quantity = option ? `${c.amountText} ${option.label}` : c.amountText;
			return `${quantity} · ${mealName(meal)}`;
		}
		if (c.kind === 'quick')
			return c.description ? `${c.description} · ${mealName(meal)}` : mealName(meal);
		if (c.kind === 'water') return `${c.mlText} ml`;
		if (c.kind === 'weight') return `${c.kgText} kg`;
		return c.note || m.entry_kind_activity();
	}
	const per = (r: FoodSearchResult) =>
		r.basis === 'serving' ? (r.servingLabel ?? '') : r.basis === '100g' ? '100 g' : '100 ml';

	function caloriesOnly(i: number) {
		const c = cards[i];
		if (c.kind !== 'food') return;
		cards[i] = { kind: 'quick', id: c.id, kcalText: '', description: c.text, open: true };
	}
	function createFood(c: Card) {
		if (c.kind !== 'food') return;
		void goto(newFoodHref(c.text));
	}

	let searchQuery = $state('');
	let searchResults = $state<FoodSearchResult[]>([]);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function openSearch(c: Card) {
		if (c.kind !== 'food') return;
		for (const other of cards) if (other.kind === 'food') other.searching = false;
		c.searching = true;
		searchQuery = '';
		searchResults = [];
	}
	function searchChanged() {
		clearTimeout(searchTimer);
		const q = searchQuery.trim();
		if (!q) return (searchResults = []);
		searchTimer = setTimeout(async () => {
			const data = await api<{ results: FoodSearchResult[] }>(
				'GET',
				`/api/v1/foods?q=${encodeURIComponent(q)}`
			).catch(() => ({ results: [] }));
			if (foldForSearch(q) === foldForSearch(searchQuery.trim())) searchResults = data.results;
		}, 180);
	}
	// With only one unit to choose from, it is chosen.
	$effect(() => {
		for (const c of cards) {
			if (c.kind !== 'food' || !c.food || c.optionKey) continue;
			const options = unitOptions(c.food, measures);
			if (options.length === 1) c.optionKey = options[0].key;
		}
	});

	const usesMeal = $derived(cards.some((c) => c.kind === 'food' || c.kind === 'quick'));

	const title = (c: Card) =>
		c.kind === 'food'
			? c.food
				? `${c.food.brand ? `${c.food.brand} ` : ''}${c.food.name}`
				: c.text
			: {
					quick: m.entry_kind_quick,
					water: m.entry_kind_water,
					weight: m.entry_kind_weight,
					activity: m.entry_kind_activity
				}[c.kind]();

	/** Saves one card; returns the path that deletes it again. */
	async function save(c: Card): Promise<{ undo: string; diaryId?: string }> {
		const zone = deviceZone();
		if (c.kind === 'food') {
			const option = unitOptions(c.food!, measures).find((o) => o.key === c.optionKey)!;
			await api('POST', '/api/v1/diary/entries', {
				kind: 'food',
				id: c.id,
				date: day,
				meal,
				zone,
				foodId: c.food!.id,
				amount: parseDecimal(c.amountText),
				unit: option.input
			});
			return { undo: `/api/v1/diary/entries/${c.id}?action=delete`, diaryId: c.id };
		}
		if (c.kind === 'quick') {
			await api('POST', '/api/v1/diary/entries', {
				kind: 'quick',
				id: c.id,
				date: day,
				meal,
				zone,
				kcal: parseDecimal(c.kcalText),
				description: c.description || null
			});
			return { undo: `/api/v1/diary/entries/${c.id}?action=delete`, diaryId: c.id };
		}
		const kind = c.kind;
		const value =
			kind === 'water'
				? parseDecimal(c.mlText)
				: kind === 'weight'
					? parseDecimal(c.kgText)
					: Math.round(parseDecimal(c.kcalText)!);
		await api('POST', `/api/v1/body/${kind}`, {
			id: c.id,
			date: day,
			zone,
			value,
			...(kind === 'activity' ? { note: c.note || null } : {})
		});
		return { undo: `/api/v1/body/${kind}/${c.id}?action=delete` };
	}

	async function logAll(event: SubmitEvent) {
		event.preventDefault();
		if (!allValid) return;
		busy = true;
		problem = '';
		const undo: string[] = [];
		let firstEntryId: string | null = null;
		const failed: Card[] = [];
		const skipped = cards.filter(notFound).map((c) => (c.kind === 'food' ? c.text : ''));
		for (const c of ready) {
			try {
				const r = await save(c);
				undo.push(r.undo);
				firstEntryId ??= r.diaryId ?? null;
			} catch {
				failed.push(c);
			}
		}
		busy = false;
		if (failed.length) {
			cards = failed;
			problem = m.entry_partial();
			return;
		}
		// The first entry logged by voice is an achievement with no record behind it; noted once, and before the page
		// refreshes so the celebration can follow. Offline it is simply not noted this time.
		if (heard && undo.length) {
			await fetch('/api/v1/achievements/firsts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ first: 'voice' })
			}).catch(() => {});
		}
		onlogged({ count: undo.length, date: day, undo, firstEntryId, skipped });
	}
	const action =
		'flex min-h-[52px] items-center justify-between gap-3 rounded-small bg-surface2 py-1.5 pr-3 pl-3.5 text-left text-[15px] font-[650]';
</script>

<svelte:window ononline={retry} />

<Sheet title={heard ? m.entry_heard_title() : m.entry_title()} {onclose}>
	<label class="flex flex-col gap-1.5">
		<span class={heard ? 'text-[13px] font-[650] text-muted' : 'sr-only'}
			>{heard ? m.entry_heard() : m.entry_typed()}</span
		>
		<textarea
			bind:this={field}
			bind:value={text}
			oninput={textChanged}
			onblur={read}
			maxlength={300}
			rows="2"
			autocomplete="off"
			placeholder={m.entry_placeholder()}
			class="resize-none rounded-input bg-surface2 px-3.5 py-3 text-[16px] font-medium text-text placeholder:font-normal placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
		></textarea>
	</label>
	{#if unreachable}
		<Notice title={m.entry_unreachable_title()}>
			{m.entry_unreachable()}
			{#snippet actions()}
				{#if oncalories}
					<Button variant="ghost" wide onclick={oncalories}>{m.log_quick_add()}</Button>
				{/if}
			{/snippet}
		</Notice>
	{/if}

	<form class="flex flex-col gap-4" onsubmit={logAll}>
		{#if cards.length === 0 && text.trim() && lastRead && !unreachable}
			<Notice tone="info">{m.entry_nothing()}</Notice>
		{/if}
		{#if cards.length}
			<div class="flex flex-col divide-y divide-line">
				{#each cards as card, i (card.id)}
					<section aria-label={title(card)} class="py-1 first:pt-0">
						<div class="grid min-h-14 grid-cols-[minmax(0,1fr)_44px] items-center gap-1">
							<button
								type="button"
								disabled={notFound(card) || unsure(card)}
								onclick={() => (card.open = !card.open)}
								aria-expanded={card.open}
								aria-label={m.entry_edit_item({ name: title(card) })}
								class="grid min-h-14 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 text-left"
							>
								{#if notFound(card) || unsure(card)}
									<span
										class="grid size-10 place-items-center rounded-small bg-warn-soft text-[18px] font-extrabold text-warn"
										aria-hidden="true">?</span
									>
								{:else}
									<FoodIcon
										icon={card.kind === 'food' ? card.food?.icon : null}
										name={card.kind === 'food'
											? (card.food?.name ?? card.text)
											: card.kind === 'quick'
												? card.description
												: title(card)}
										brand={card.kind === 'food' ? card.food?.brand : null}
									/>
								{/if}
								<span class="min-w-0">
									<span class="block truncate text-[15px] leading-[1.3] font-semibold"
										>{card.kind === 'food' && unsure(card) ? `${card.text}?` : title(card)}</span
									>
									<span class="block truncate text-[13px] text-muted">{rowDetail(card)}</span>
								</span>
								<span class="min-w-11 text-right text-[15px] font-[650] tabular-nums"
									>{kcalOf(card)}</span
								>
							</button>
							<button
								type="button"
								onclick={() => cards.splice(i, 1)}
								aria-label={m.entry_remove({ name: title(card) })}
								class="grid size-11 place-items-center text-muted"
								><X size={18} aria-hidden="true" /></button
							>
						</div>

						{#if card.kind === 'food' && unsure(card)}
							<div class="flex flex-col gap-1.5 pb-2.5 pl-[52px]">
								{#each card.candidates.slice(0, 3) as c (c.id)}
									<button
										type="button"
										onclick={() => choose(card, c.id)}
										class="flex min-h-[52px] items-center justify-between gap-3 rounded-small bg-surface2 py-1.5 pr-3 pl-3.5 text-left"
									>
										<span class="min-w-0">
											<b class="block truncate text-[15px] font-[650]"
												>{c.brand ? `${c.brand} ` : ''}{c.name}</b
											>
											<small class="block text-[13px] text-muted"
												>{per(c)}{c.kcal === null ? '' : ` · ${kcal(c.kcal)} kcal`}</small
											>
										</span>
										<Check size={18} aria-hidden="true" class="invisible shrink-0" />
									</button>
								{/each}
								<button
									type="button"
									onclick={() => openSearch(card)}
									class="flex min-h-[52px] items-center justify-between gap-3 rounded-small bg-soft py-1.5 pr-3 pl-3.5 text-left"
								>
									<span class="min-w-0">
										<b class="block text-[15px] font-[650] text-accent"
											>{m.entry_something_else()}</b
										>
										<small class="block text-[13px] text-muted">{m.entry_search_foods()}</small>
									</span>
									<Search size={18} aria-hidden="true" class="shrink-0 text-accent" />
								</button>
							</div>
						{:else if notFound(card)}
							<div class="flex flex-col gap-1.5 pb-2.5 pl-[52px]">
								<button type="button" onclick={() => createFood(card)} class={action}>
									{m.entry_create_it()}<Plus size={18} aria-hidden="true" class="text-muted" />
								</button>
								<button type="button" onclick={() => caloriesOnly(i)} class={action}>
									{m.log_quick_add()}<Flame size={18} aria-hidden="true" class="text-muted" />
								</button>
								<button type="button" onclick={() => openSearch(card)} class={action}>
									{m.entry_search_foods()}<Search size={18} aria-hidden="true" class="text-muted" />
								</button>
							</div>
						{/if}

						{#if card.kind === 'food' && card.searching}
							<div class="flex flex-col gap-1 pb-2.5 pl-[52px]">
								<input
									bind:value={searchQuery}
									oninput={searchChanged}
									type="search"
									aria-label={m.entry_search_foods()}
									placeholder={m.log_search_placeholder()}
									class="min-h-12 rounded-input bg-surface2 px-3.5 text-[16px] font-medium outline-none focus:outline-2 focus:outline-accent"
								/>
								{#each searchResults as r (r.id)}
									<button
										type="button"
										onclick={() => choose(card, r.id)}
										class="min-h-11 truncate rounded-small px-2 text-left text-[15px] font-semibold hover:bg-surface2"
										>{r.brand ? `${r.brand} ` : ''}{r.name}</button
									>
								{/each}
							</div>
						{/if}

						<div class={['collapse-row', card.open && !notFound(card) && !unsure(card) && 'open']}>
							<div>
								<div class="flex flex-col gap-3 pb-3">
									{#if card.kind === 'food' && card.food}
										{@const options = unitOptions(card.food, measures)}
										{#if card.candidates.length > 1}
											<Select
												label={m.entry_food()}
												value={card.food.id}
												onchange={(id) => choose(card, id)}
												wide
												options={card.candidates.map((c) => ({
													value: c.id,
													label: `${c.brand ? `${c.brand} ` : ''}${c.name}${c.kcal === null ? '' : ` · ${kcal(c.kcal)} kcal`}`
												}))}
											/>
										{/if}
										<AmountField
											id="amount-{card.id}"
											label={m.entry_amount()}
											large={false}
											bind:amount={card.amountText}
											bind:unit={card.optionKey}
											units={options.map((o) => ({ value: o.key, label: o.label }))}
										/>
										{#if !card.amountText.trim()}<p class="text-[13px] text-warn">
												{m.entry_how_much()}
											</p>{/if}
										{#if !card.optionKey}<p class="text-[13px] text-warn">
												{card.said ? m.entry_unit_choose({ said: card.said }) : m.entry_unit_pick()}
											</p>{/if}
										<MacroPreview nutrients={foodNutrients(card)} />
									{:else if card.kind === 'quick'}
										<TextField
											id="kcal-{card.id}"
											label={m.entry_kcal()}
											bind:value={card.kcalText}
											inputmode="decimal"
										/>
										<TextField
											id="desc-{card.id}"
											label={m.entry_description()}
											bind:value={card.description}
											maxlength={200}
										/>
									{:else if card.kind === 'water'}
										<TextField
											id="ml-{card.id}"
											label={m.entry_ml()}
											bind:value={card.mlText}
											inputmode="decimal"
										/>
										{#if !card.mlText.trim()}<p class="text-[13px] text-warn">
												{m.entry_water_choose()}
											</p>{/if}
									{:else if card.kind === 'weight'}
										<TextField
											id="kg-{card.id}"
											label={m.entry_kg()}
											bind:value={card.kgText}
											inputmode="decimal"
										/>
									{:else if card.kind === 'activity'}
										<TextField
											id="act-{card.id}"
											label={m.entry_kcal()}
											bind:value={card.kcalText}
											inputmode="decimal"
										/>
										<TextField
											id="note-{card.id}"
											label={m.entry_note()}
											bind:value={card.note}
											maxlength={120}
										/>
									{/if}
								</div>
							</div>
						</div>
					</section>
				{/each}
			</div>
		{/if}

		{#if day !== date}
			<Select
				label={m.amount_day()}
				bind:value={day}
				wide
				options={dayOptions.map((d) => ({ value: d, label: dayTitle(d, today) }))}
			/>
		{/if}
		{#if !cards.length || usesMeal}
			<Chips
				label={m.amount_meal()}
				bind:value={meal}
				onchange={(next) => (tapped = next)}
				options={MEALS.map((x) => ({ value: x, label: mealName(x) }))}
			/>
		{/if}
		{#if problem}<Notice>{problem}</Notice>{/if}
		<Button type="submit" wide disabled={busy || !allValid}>
			{busy
				? m.common_working()
				: !cards.length
					? m.entry_title()
					: !ready.length
						? m.entry_nothing_to_log()
						: cards.some(unsure)
							? m.entry_pick_first()
							: usesMeal
								? m.entry_log_to({ count: String(ready.length), meal: mealName(meal) })
								: cards.length === 1
									? m.entry_log_one()
									: m.entry_log_many({ count: String(ready.length) })}
		</Button>
	</form>
</Sheet>
