<script lang="ts">
	// The phone Log tab (and the desktop Log item). After saving it returns to Today with the new rows highlighted.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { dayHref } from '#lib/client/links.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { defaultMeal, isIsoDate } from '#lib/shared/diary-rules.ts';
	import { MEALS, type DiaryEntry, type Meal } from '#lib/shared/diary-types.ts';
	import { kcal, mealName } from '#lib/shared/format.ts';
	import AmountSheet from '#lib/ui/log/AmountSheet.svelte';
	import LogPanel from '#lib/ui/log/LogPanel.svelte';
	import QuickAddSheet from '#lib/ui/log/QuickAddSheet.svelte';
	import SavedMealSheet from '#lib/ui/log/SavedMealSheet.svelte';
	import { showLoggedMeal } from '#lib/client/saved-meal-toast.ts';
	import { showLoggedEntry } from '#lib/client/entry-toast.ts';
	import EntrySheet from '#lib/ui/log/EntrySheet.svelte';
	import SpeakSheet from '#lib/ui/log/SpeakSheet.svelte';
	import NotSetUpSheet from '#lib/ui/log/NotSetUpSheet.svelte';
	import ScanSheet from '#lib/ui/scan/ScanSheet.svelte';
	import { BY_HAND, handOver, type ScanResult } from '#lib/client/scan-result.svelte.ts';
	import type { ParsedEntry } from '#lib/shared/entry-types.ts';

	let { data } = $props();

	const params = page.url.searchParams;
	const requestedDate = params.get('date');
	const date = $derived(
		requestedDate && isIsoDate(requestedDate) && requestedDate <= data.today
			? requestedDate
			: data.today
	);
	const requestedMeal = params.get('meal');
	let preset = $state<Meal | null>(
		MEALS.includes(requestedMeal as Meal) ? (requestedMeal as Meal) : null
	);
	// A link may open a food's amount sheet (after a label scan, say); nothing is logged until Save.
	const requestedFood = params.get('food');
	let picking = $state<string | null>(
		requestedFood && /^[0-9a-f-]{36}$/i.test(requestedFood) ? requestedFood : null
	);
	let quick = $state(false);
	let openSaved = $state<string | null>(null);
	let typing = $state(false);
	let typedEntry = $state<ParsedEntry | null>(null);
	let speaking = $state(false);
	let heard = $state(false);
	// Scan a label opens as a sheet, like Speak; "?scan=1" opens it (Check the label opened without a reading).
	let scanning = $state(untrack(() => data.scan) && params.get('scan') === '1');
	const sheetMeal = $derived(preset ?? defaultMeal(new Date(), deviceZone()));

	/** What the Scan sheet read (or Fill in by hand) goes to Check the label. */
	function read(result: ScanResult) {
		handOver(result);
		void goto(resolve('/(app)/scan'));
	}

	async function logged(entry: DiaryEntry | null) {
		// Close the sheet first: a toast cannot be seen over an open dialog.
		quick = false;
		picking = null;
		if (!entry) {
			// Offline: confirm first, then return to Today's cached page.
			showToast({ message: m.offline_saved(), detail: m.offline_saved_detail() });
			void goto(date === data.today ? resolve('/(app)') : dayHref(date));
			return;
		}
		await goto(dayHref(entry.localDate, entry.id));
		showToast({
			message: m.toast_logged(),
			detail: m.toast_logged_detail({
				meal: mealName(entry.meal),
				kcal: kcal(entry.nutrients.energy_kcal?.value ?? 0)
			}),
			undo: async () => {
				await api('POST', `/api/v1/diary/entries/${entry.id}?action=delete`, {});
				await goto(dayHref(entry.localDate), { invalidateAll: true });
			}
		});
	}
</script>

<svelte:head><title>{m.log_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 pt-4 pb-3 desk:px-7 desk:pb-5">
	<h1 class="page-head text-[1.5rem] font-[750]">{m.log_title()}</h1>
	<LogPanel
		{date}
		today={data.today}
		{preset}
		onpick={(id) => (picking = id)}
		onquick={() => (quick = true)}
		onclearpreset={() => (preset = null)}
		onpickmeal={(id) => (openSaved = id)}
		ontype={() => ((heard = false), (typedEntry = null), (typing = true))}
		onspeak={data.speech ? () => (speaking = true) : undefined}
		onscan={data.scan ? () => (scanning = true) : undefined}
		initialQuery={params.get('q') ?? ''}
	/>
</main>

{#if picking}
	<AmountSheet
		foodId={picking}
		{date}
		today={data.today}
		meal={sheetMeal}
		onsaved={logged}
		onclose={() => (picking = null)}
	/>
{/if}
{#if quick}
	<QuickAddSheet
		{date}
		today={data.today}
		meal={sheetMeal}
		onsaved={logged}
		onclose={() => (quick = false)}
	/>
{/if}

{#if scanning}
	{#if data.scanSource === null}
		<NotSetUpSheet feature="scan" ontype={() => read(BY_HAND)} onclose={() => (scanning = false)} />
	{:else}
		<ScanSheet
			source={data.scanSource}
			local={data.local.scan}
			onread={read}
			onclose={() => (scanning = false)}
		/>
	{/if}
{/if}

{#if speaking}
	{#if data.speakSource === null}
		<NotSetUpSheet
			feature="speak"
			ontype={() => ((speaking = false), (heard = false), (typedEntry = null), (typing = true))}
			onclose={() => (speaking = false)}
		/>
	{:else}
		<SpeakSheet
			{date}
			source={data.speakSource}
			local={data.local.speak}
			onheard={(e) => {
				speaking = false;
				heard = true;
				typedEntry = e;
				typing = true;
			}}
			ontype={() => ((speaking = false), (heard = false), (typedEntry = null), (typing = true))}
			onclose={() => (speaking = false)}
		/>
	{/if}
{/if}
{#if typing}
	<EntrySheet
		{heard}
		entry={typedEntry ?? undefined}
		{date}
		today={data.today}
		meal={sheetMeal}
		oncalories={() => ((typing = false), (quick = true))}
		onlogged={async (logged) => {
			typing = false;
			await goto(dayHref(logged.date, logged.entryIds));
			showLoggedEntry(logged, () => goto(dayHref(logged.date), { invalidateAll: true }));
		}}
		onclose={() => (typing = false)}
	/>
{/if}
{#if openSaved}
	<SavedMealSheet
		savedMealId={openSaved}
		{date}
		today={data.today}
		meal={sheetMeal}
		onlogged={async (entries) => {
			openSaved = null;
			await goto(
				dayHref(
					entries[0].localDate,
					entries.map((e) => e.id)
				)
			);
			showLoggedMeal(entries, () => goto(dayHref(entries[0].localDate), { invalidateAll: true }));
		}}
		onclose={() => (openSaved = null)}
	/>
{/if}
