<script lang="ts">
	// docs/ui.md "Log": search; Speak and Scan tiles (Coming soon until each feature works); suggestions only while
	// the empty field is focused; typing shows results; the meal preset pill.
	import { resolve } from '$app/paths';
	import Mic from '@lucide/svelte/icons/mic';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import type { Meal } from '#lib/shared/diary-types.ts';
	import type { FoodSearchResult } from '#lib/shared/food-types.ts';
	import { dayTitle, kcal, mealName } from '#lib/shared/format.ts';

	interface Props {
		date: string;
		today: string;
		preset: Meal | null;
		onpick: (foodId: string) => void;
		onquick: () => void;
		onclearpreset: () => void;
	}
	let { date, today, preset, onpick, onquick, onclearpreset }: Props = $props();

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

	// Refreshed on every focus: logging, undo or edits elsewhere change what is recent.
	async function loadRecent() {
		try {
			recent = (await api<{ results: FoodSearchResult[] }>('GET', '/api/v1/diary/recent')).results;
		} catch {
			// Keep what was shown; offline, the saved copy normally answers.
		}
	}

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
	{#if preset}
		<div
			class="flex items-center gap-2 self-start rounded-full bg-soft py-1 pr-1 pl-3.5 text-[14px] font-semibold text-accent"
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
			{#each [{ label: m.log_speak(), icon: Mic, tile: 'bg-voice-bg text-voice' }, { label: m.log_scan(), icon: ScanLine, tile: 'bg-scan-bg text-scan' }] as t (t.label)}
				<button
					type="button"
					disabled
					aria-describedby="coming-soon"
					class="flex min-h-32 flex-col items-center justify-center gap-2 rounded-tile bg-surface2 p-3 opacity-70"
				>
					<span class="grid size-14 place-items-center rounded-button {t.tile}"
						><t.icon size={28} aria-hidden="true" /></span
					>
					<span class="text-[15px] font-semibold">{t.label}</span>
					<span class="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-semibold text-muted"
						>{m.log_coming_soon()}</span
					>
				</button>
			{/each}
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
