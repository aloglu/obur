<script lang="ts">
	// docs/ui.md "Logging": search on top; Speak, Scan and Type it tiles; Recent always there, filling the room it has;
	// typing shows results; the meal preset pill. Calories alone stay one tap from search, also offline.
	import { page } from '$app/state';
	import { savePreferences } from '#lib/client/prefs.ts';
	import { onMount, tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import Mic from '@lucide/svelte/icons/mic';
	import MicOff from '@lucide/svelte/icons/mic-off';
	import Notice from '../Notice.svelte';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import FoodIcon from '../FoodIcon.svelte';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import type { Meal, SavedMealSummary } from '#lib/shared/diary-types.ts';
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
		/** Opens Speak; without it (no speech service) the tile goes and a grey card says so. */
		onspeak?: () => void;
		/** Label scanning is configured: the Scan tile links to it. */
		scan?: boolean;
		/** Opens Type it. */
		ontype: () => void;
		/** Opens a saved meal; saved meals are listed only when given. */
		onpickmeal?: (savedMealId: string) => void;
	}
	let {
		date,
		today,
		preset,
		onpick,
		onquick,
		onclearpreset,
		onpickmeal,
		ontype,
		scan = false,
		onspeak
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

	const showSuggestions = $derived(focused && !typing);

	// Told once that Speak is off; dismissed, it stays quiet on every device (kept with the account).
	let voiceOffSeen = $state(untrack(() => page.data.preferences?.voiceOffSeen ?? false));
	function dismissVoiceOff() {
		voiceOffSeen = true;
		// Not saved (offline): it shows again next time.
		savePreferences({ voiceOffSeen: true }).catch(() => {});
	}

	// Refreshed on every focus: logging, undo or edits elsewhere change what is recent.
	async function loadRecent() {
		if (onpickmeal) void loadSavedMeals();
		try {
			recent = (await api<{ results: FoodSearchResult[] }>('GET', '/api/v1/diary/recent')).results;
		} catch {
			// Keep what was shown; offline, the saved copy normally answers.
		}
		void fitRecent();
	}

	// Recent fills the room down to the tab bar (or the window's end), and always shows at least three foods.
	const MIN_RECENT = 3;
	let recentCard = $state<HTMLElement>();
	async function fitRecent() {
		await tick();
		const card = recentCard;
		if (!card) return;
		const rows = [...card.querySelectorAll<HTMLElement>('li')];
		for (const row of rows) row.hidden = false;
		const bar = document.querySelector('[data-tabbar]')?.getBoundingClientRect();
		const limit = (bar && bar.height ? bar.top : window.innerHeight) - 12 + window.scrollY;
		const bottom = () => card.getBoundingClientRect().bottom + window.scrollY;
		for (let i = rows.length; i > MIN_RECENT && bottom() > limit; i--) rows[i - 1].hidden = true;
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
		void loadRecent();
		const refit = () => void fitRecent();
		addEventListener('resize', refit);
		return () => removeEventListener('resize', refit);
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

	const tile =
		'flex min-h-28 flex-col items-center justify-center gap-2.5 rounded-tile bg-surface px-1.5 text-center text-[14.5px] leading-tight font-bold shadow-card transition-transform active:scale-[0.97]';
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
	<ul class="-mx-2.5 flex flex-col">
		{#each items as r (r.id)}
			<li>
				<button
					type="button"
					onclick={() => onpick(r.id)}
					class="grid min-h-14 w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-input px-2.5 py-1.5 text-left hover:bg-surface2"
				>
					<FoodIcon icon={r.icon} name={r.name} brand={r.brand} />
					<span class="min-w-0">
						<span class="line-clamp-2 text-[15px] leading-[1.3] font-semibold break-words"
							>{r.brand ? `${r.brand} ` : ''}{r.name}</span
						>
						<span class="block text-[13px] text-muted"
							>{r.kcal === null ? m.foods_kcal_unknown() : per(r)}</span
						>
					</span>
					{#if r.kcal !== null}
						<span class="min-w-11 text-right text-[15px] font-[650] tabular-nums"
							>{kcal(r.kcal)}</span
						>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

<div class="flex flex-col gap-3">
	<div class="pinned-search flex items-center gap-2">
		<label
			class="flex min-h-12 flex-1 items-center gap-2 rounded-input bg-surface px-3.5 text-muted shadow-card focus-within:outline-2 focus-within:outline-accent"
		>
			<Search size={20} class="shrink-0" aria-hidden="true" />
			<span class="sr-only">{m.log_search_label()}</span>
			<input
				bind:this={input}
				bind:value={query}
				type="search"
				autocomplete="off"
				placeholder={m.log_search_placeholder()}
				onfocus={() => {
					focused = true;
					void loadRecent();
				}}
				class="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-text outline-none placeholder:font-normal placeholder:text-muted"
			/>
		</label>
		{#if focused || typing}
			<button
				type="button"
				onclick={cancel}
				class="min-h-12 px-1 text-[14px] font-[650] text-accent">{m.log_cancel()}</button
			>
		{/if}
	</div>

	<!-- Announced when it appears after a meal's Add food. -->
	<div aria-live="polite" class="flex flex-col empty:hidden">
		{#if preset}
			<div
				class="preset flex h-10 items-center gap-1.5 self-start rounded-small bg-soft pr-1 pl-3.5 text-[14px] font-semibold text-accent"
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
		{/if}
	</div>

	{#if typing}
		{#if matchingMeals.length}
			<div class="rounded-card bg-surface px-[18px] py-2 shadow-card">
				{@render mealList(matchingMeals)}
			</div>
		{/if}
		<section
			class="rounded-card bg-surface px-[18px] py-2 shadow-card"
			aria-label={m.log_results()}
		>
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
	{:else}
		{#if !showSuggestions}
			<div
				class={[
					'grid gap-2.5',
					onspeak && scan ? 'grid-cols-3' : onspeak || scan ? 'grid-cols-2' : 'grid-cols-1'
				]}
			>
				{#if onspeak}
					<button type="button" onclick={onspeak} class={tile}>
						<span class="grid size-12 place-items-center rounded-input bg-voice-bg text-voice"
							><Mic size={24} aria-hidden="true" /></span
						>
						{m.log_speak()}
					</button>
				{/if}
				{#if scan}
					<a href={resolve('/(app)/scan')} class={tile}>
						<span class="grid size-12 place-items-center rounded-input bg-scan-bg text-scan"
							><ScanLine size={24} aria-hidden="true" /></span
						>
						{m.log_scan()}
					</a>
				{/if}
				<button type="button" onclick={ontype} class={tile}>
					<span class="grid size-12 place-items-center rounded-input bg-soft text-accent"
						><PencilLine size={24} aria-hidden="true" /></span
					>
					{m.log_type_it()}
				</button>
			</div>
			{#if !onspeak && !voiceOffSeen}
				<div class="relative">
					<Notice tone="info" title={m.speak_off_title()} icon={MicOff}>{m.speak_off_line()}</Notice
					>
					<button
						type="button"
						onclick={dismissVoiceOff}
						aria-label={m.speak_off_dismiss()}
						class="absolute top-1.5 right-1.5 grid size-11 place-items-center text-muted"
						><X size={18} aria-hidden="true" /></button
					>
				</div>
			{/if}
		{:else if savedMeals.length}
			<!-- The five most recently changed; search finds the rest. -->
			<div class="rounded-card bg-surface px-[18px] py-2 shadow-card">
				{@render mealList(savedMeals.slice(0, 5))}
			</div>
		{/if}
		<section
			bind:this={recentCard}
			class="rounded-card bg-surface px-[18px] py-2 shadow-card"
			aria-labelledby="recent-heading"
		>
			<h2 id="recent-heading" class="pt-2 text-[13px] font-[650] text-muted">
				{m.log_recent()}
			</h2>
			{#if recent && recent.length === 0}
				<p class="py-2 text-[14px] text-muted">{m.log_no_recent()}</p>
			{:else if recent}
				{@render foodList(recent)}
			{/if}
		</section>
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
