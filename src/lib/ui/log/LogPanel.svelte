<script lang="ts">
	// docs/ui.md "Log": search; Speak and Scan tiles (Coming soon until each feature works); suggestions only while
	// the empty field is focused; typing shows results; the meal preset pill.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import TextCursorInput from '@lucide/svelte/icons/text-cursor-input';
	import Mic from '@lucide/svelte/icons/mic';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import type { Meal, SavedMealSummary } from '#lib/shared/diary-types.ts';
	import type { ParsedEntry } from '#lib/shared/entry-types.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import type { FoodSearchResult } from '#lib/shared/food-types.ts';
	import { dayTitle, kcal, mealName } from '#lib/shared/format.ts';
	import { foldForSearch } from '#lib/shared/search-text.ts';

	interface Props {
		date: string;
		today: string;
		preset: Meal | null;
		onpick: (foodId: string) => void;
		onquick: () => void;
		onclearpreset: () => void;
		/** Opens Speak; the tile is enabled only when given (a speech service is configured). */
		onspeak?: () => void;
		/** Label scanning is configured: the Scan tile links to it. */
		scan?: boolean;
		/** Opens the confirmation for a typed sentence; offered only when given. */
		onentry?: (entry: ParsedEntry) => void;
		/** Opens a saved meal; saved meals are listed only when given. */
		onpickmeal?: (savedMealId: string) => void;
		/** Desktop: bumped each time a meal's + chooses the meal, to replay the pill's pulse. */
		presetRequest?: number;
	}
	let {
		date,
		today,
		preset,
		onpick,
		onquick,
		onclearpreset,
		onpickmeal,
		onentry,
		scan = false,
		onspeak,
		presetRequest = 0
	}: Props = $props();

	let query = $state('');
	let focused = $state(false);
	let recent = $state<FoodSearchResult[] | undefined>();
	let results = $state<FoodSearchResult[]>([]);
	let searchedFor = $state('');
	let searchFailed = $state(false);
	let input: HTMLInputElement;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const typing = $derived(query.trim().length > 0);

	// A sentence with more than a food's name ("3 dilim ekmek", "iki bardak su") is offered as an entry to confirm.
	let typed = $state<ParsedEntry | null>(null);
	let parseTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const q = query.trim();
		clearTimeout(parseTimer);
		typed = null;
		if (!onentry || q.split(/\s+/).length < 2) return;
		parseTimer = setTimeout(async () => {
			try {
				const entry = await api<ParsedEntry>('POST', '/api/v1/entry/parse', {
					text: q,
					date,
					zone: deviceZone()
				});
				const worth =
					entry.items.length > 1 ||
					entry.items.some((i) => i.kind !== 'food' || i.amount !== null || i.vague);
				if (q === query.trim() && worth) typed = entry;
			} catch {
				// Offline or unreachable: the ordinary search says so.
			}
		}, 250);
	});
	const typedSummary = (e: ParsedEntry) =>
		e.items.length === 1
			? m.log_as_typed_one({ day: dayTitle(e.date, today) })
			: m.log_as_typed_many({ count: String(e.items.length), day: dayTitle(e.date, today) });
	const showSuggestions = $derived(focused && !typing);

	// Refreshed on every focus: logging, undo or edits elsewhere change what is recent.
	async function loadRecent() {
		if (onpickmeal) void loadSavedMeals();
		try {
			recent = (await api<{ results: FoodSearchResult[] }>('GET', '/api/v1/diary/recent')).results;
		} catch {
			// Keep what was shown; offline, the saved copy normally answers.
		}
	}

	let savedMeals = $state<SavedMealSummary[]>([]);
	async function loadSavedMeals() {
		try {
			savedMeals = (await api<{ meals: SavedMealSummary[] }>('GET', '/api/v1/saved-meals')).meals;
		} catch {
			// Offline: saved meals need a connection to log anyway.
		}
	}
	// Also on mount: a search typed before the page finished loading never saw the focus event.
	onMount(() => {
		if (onpickmeal) void loadSavedMeals();
	});
	// Few enough to match here, with the same Turkish-aware folding as food search.
	const matchingMeals = $derived.by(() => {
		const q = foldForSearch(query.trim());
		return q ? savedMeals.filter((s) => foldForSearch(s.name).includes(q)) : [];
	});
	const mealSummary = (s: SavedMealSummary) => {
		const total = kcal(s.kcal) + (s.partial ? '+' : '');
		return s.itemCount === 1
			? m.saved_one_item({ kcal: total })
			: m.saved_many_items({ count: String(s.itemCount), kcal: total });
	};

	$effect(() => {
		const q = query.trim();
		clearTimeout(timer);
		if (!q) return;
		timer = setTimeout(async () => {
			try {
				const data = await api<{ results: FoodSearchResult[] }>(
					'GET',
					`/api/v1/foods?q=${encodeURIComponent(q)}`
				);
				if (q === query.trim()) {
					results = data.results;
					searchedFor = q;
					searchFailed = false;
				}
			} catch {
				// Offline or unreachable: say so instead of showing nothing.
				if (q === query.trim()) searchFailed = true;
			}
		}, 180);
	});

	function cancel() {
		query = '';
		focused = false;
		input.blur();
	}

	const per = (r: FoodSearchResult) =>
		r.basis === 'serving' ? (r.servingLabel ?? '') : r.basis === '100g' ? '100 g' : '100 ml';
</script>

{#snippet mealList(items: SavedMealSummary[])}
	<section aria-labelledby="saved-heading">
		<h2
			id="saved-heading"
			class="px-2 text-[12px] font-bold tracking-[0.06em] text-muted uppercase"
		>
			{m.saved_title()}
		</h2>
		<ul class="flex flex-col">
			{#each items as s (s.id)}
				<li>
					<button
						type="button"
						onclick={() => onpickmeal?.(s.id)}
						class="flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left hover:bg-surface2"
					>
						<Bookmark size={18} class="shrink-0 text-accent" aria-hidden="true" />
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 text-[15px] font-semibold break-words">{s.name}</span>
							<span class="block text-[13px] text-muted">{mealSummary(s)}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/snippet}

{#snippet foodList(items: FoodSearchResult[])}
	<ul class="flex flex-col">
		{#each items as r (r.id)}
			<li>
				<button
					type="button"
					onclick={() => onpick(r.id)}
					class="flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left hover:bg-surface2"
				>
					<span class="min-w-0 flex-1">
						<span class="line-clamp-2 text-[15px] font-semibold break-words"
							>{r.brand ? `${r.brand} ` : ''}{r.name}</span
						>
						<span class="block text-[13px] text-muted"
							>{r.kcal === null ? m.foods_kcal_unknown() : `${kcal(r.kcal)} kcal · ${per(r)}`}</span
						>
					</span>
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

<div class="flex flex-col gap-3">
	<!-- Announced when a meal's + sets it, since focus stays on that button. -->
	<div aria-live="polite" class="flex flex-col empty:hidden">
		{#if preset}
			<!-- Keyed by the request too, so choosing a meal again replays the short pulse. -->
			{#key `${preset}:${presetRequest}`}
				<div
					class="preset flex items-center gap-2 self-start rounded-full bg-soft py-1 pr-1 pl-3.5 text-[14px] font-semibold text-accent"
				>
					{m.log_adding_to({ meal: mealName(preset), day: dayTitle(date, today) })}
					<button
						type="button"
						onclick={onclearpreset}
						aria-label={m.log_clear_preset()}
						class="grid size-9 place-items-center rounded-full"
						><X size={16} aria-hidden="true" /></button
					>
				</div>
			{/key}
		{/if}
	</div>

	<div class="flex items-center gap-2">
		<label
			class="flex min-h-12 flex-1 items-center gap-2 rounded-input border border-line bg-surface2 px-3 focus-within:outline-3 focus-within:outline-accent"
		>
			<Search size={20} class="shrink-0 text-muted" aria-hidden="true" />
			<span class="sr-only">{m.log_search_label()}</span>
			<input
				bind:this={input}
				bind:value={query}
				type="search"
				autocomplete="off"
				placeholder={m.log_search_placeholder()}
				onfocus={() => {
					focused = true;
					loadRecent();
				}}
				class="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:font-normal placeholder:text-muted"
			/>
		</label>
		{#if focused || typing}
			<button
				type="button"
				onclick={cancel}
				class="min-h-12 px-2 text-[15px] font-semibold text-accent">{m.log_cancel()}</button
			>
		{/if}
	</div>

	{#if typing}
		{#if typed}
			<button
				type="button"
				onclick={() => typed && onentry?.(typed)}
				class="flex min-h-14 w-full items-center gap-3 rounded-input bg-soft px-3 py-2 text-left"
			>
				<TextCursorInput size={20} class="shrink-0 text-accent" aria-hidden="true" />
				<span class="min-w-0 flex-1">
					<span class="block text-[15px] font-bold text-accent">{m.log_as_typed()}</span>
					<span class="block text-[13px] text-muted">{typedSummary(typed)}</span>
				</span>
			</button>
		{/if}
		{#if matchingMeals.length}{@render mealList(matchingMeals)}{/if}
		<section aria-label={m.log_results()}>
			{#if searchFailed}
				<div class="flex flex-col items-start gap-2 py-2">
					<p class="text-[15px] text-muted">{m.log_search_offline()}</p>
					<button type="button" onclick={onquick} class="font-semibold text-accent underline"
						>{m.log_quick_add()}</button
					>
				</div>
			{:else if searchedFor && results.length === 0}
				<div class="flex flex-col items-start gap-2 py-2">
					<p class="text-[15px] text-muted">{m.log_no_results({ query: searchedFor })}</p>
					<a href={resolve('/(app)/foods/new')} class="font-semibold text-accent underline"
						>{m.log_create_food()}</a
					>
					<button type="button" onclick={onquick} class="font-semibold text-accent underline"
						>{m.log_quick_add()}</button
					>
				</div>
			{:else}
				{@render foodList(results)}
			{/if}
		</section>
	{:else if showSuggestions}
		<!-- The five most recently changed; search finds the rest. -->
		{#if savedMeals.length}{@render mealList(savedMeals.slice(0, 5))}{/if}
		<section aria-labelledby="recent-heading">
			<h2
				id="recent-heading"
				class="px-2 text-[12px] font-bold tracking-[0.06em] text-muted uppercase"
			>
				{m.log_recent()}
			</h2>
			{#if recent && recent.length === 0}
				<p class="px-2 py-2 text-[14px] text-muted">{m.log_no_recent()}</p>
			{:else if recent}
				{@render foodList(recent)}
			{/if}
		</section>
	{:else}
		<div class="grid grid-cols-2 gap-3">
			<button
				type="button"
				disabled={!onspeak}
				aria-describedby={onspeak ? undefined : 'coming-soon'}
				onclick={() => onspeak?.()}
				class={[
					'flex min-h-32 flex-col items-center justify-center gap-2 rounded-tile bg-surface2 p-3',
					!onspeak && 'opacity-70'
				]}
			>
				<span class="grid size-14 place-items-center rounded-button bg-voice-bg text-voice"
					><Mic size={28} aria-hidden="true" /></span
				>
				<span class="text-[15px] font-semibold">{m.log_speak()}</span>
				{#if !onspeak}<span
						class="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-semibold text-muted"
						>{m.log_coming_soon()}</span
					>{/if}
			</button>
			{#if scan}
				<a
					href={resolve('/(app)/scan')}
					class="flex min-h-32 flex-col items-center justify-center gap-2 rounded-tile bg-surface2 p-3"
				>
					<span class="grid size-14 place-items-center rounded-button bg-scan-bg text-scan"
						><ScanLine size={28} aria-hidden="true" /></span
					>
					<span class="text-[15px] font-semibold">{m.log_scan()}</span>
				</a>
			{:else}
				<button
					type="button"
					disabled
					aria-describedby="coming-soon"
					class="flex min-h-32 flex-col items-center justify-center gap-2 rounded-tile bg-surface2 p-3 opacity-70"
				>
					<span class="grid size-14 place-items-center rounded-button bg-scan-bg text-scan"
						><ScanLine size={28} aria-hidden="true" /></span
					>
					<span class="text-[15px] font-semibold">{m.log_scan()}</span>
					<span class="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-semibold text-muted"
						>{m.log_coming_soon()}</span
					>
				</button>
			{/if}
		</div>
		<span id="coming-soon" class="sr-only">{m.log_coming_soon()}</span>
		<button
			type="button"
			onclick={onquick}
			class="min-h-12 rounded-input border border-line bg-surface text-[15px] font-semibold"
			>{m.log_quick_add()}</button
		>
	{/if}
</div>

<style>
	@media (prefers-reduced-motion: no-preference) {
		.preset {
			animation: preset-pulse 600ms ease-out;
		}
	}
	@keyframes preset-pulse {
		0% {
			transform: scale(0.92);
			box-shadow: 0 0 0 0 var(--color-accent);
		}
		60% {
			transform: scale(1.03);
		}
		100% {
			transform: scale(1);
			box-shadow: 0 0 0 10px transparent;
		}
	}
</style>
