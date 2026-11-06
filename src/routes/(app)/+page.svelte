<script lang="ts">
	// docs/ui.md "Today". Phone: one column. From 760 px: Budget and the meals on the left, the rest on the right.
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { closeInlineOnOutsideTap } from '#lib/client/inline-field.svelte.ts';
	import { dayHref, logHref } from '#lib/client/links.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { addDays, carbohydrateDay } from '#lib/shared/diary-rules.ts';
	import type { ActivityEntry } from '#lib/shared/body-types.ts';
	import { MEALS, type DiaryEntry, type Meal } from '#lib/shared/diary-types.ts';
	import { dayTitle, entryName, kcal, mealName } from '#lib/shared/format.ts';
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import X from '@lucide/svelte/icons/x';
	import Swap from '#lib/ui/Swap.svelte';
	import { discard, offline } from '#lib/client/offline/sync.svelte.ts';
	import type { QueuedOp } from '#lib/client/offline/store.ts';
	import ActivitySheet from '#lib/ui/log/ActivitySheet.svelte';
	import PendingSheet from '#lib/ui/log/PendingSheet.svelte';
	import EditEntrySheet from '#lib/ui/log/EditEntrySheet.svelte';
	import SaveMealSheet from '#lib/ui/log/SaveMealSheet.svelte';
	import BudgetCard from '#lib/ui/today/BudgetCard.svelte';
	import BulkSheet from '#lib/ui/today/BulkSheet.svelte';
	import DayNoteCard from '#lib/ui/today/DayNoteCard.svelte';
	import SelectionBar from '#lib/ui/today/SelectionBar.svelte';
	import DayHeader from '#lib/ui/today/DayHeader.svelte';
	import MealCard from '#lib/ui/today/MealCard.svelte';
	import NutrientsCard from '#lib/ui/today/NutrientsCard.svelte';
	import WaterCard from '#lib/ui/today/WaterCard.svelte';
	import WeightCard from '#lib/ui/today/WeightCard.svelte';

	let { data } = $props();

	let addingActivity = $state(false);
	let pendingOpen = $state<QueuedOp | null>(null);
	let savingMeal = $state<Meal | null>(null);
	const pendingFor = (meal: Meal) =>
		offline.items.filter(
			(i) =>
				i.preview.kind === 'diary' && i.preview.localDate === data.date && i.preview.meal === meal
		);
	let editing = $state<DiaryEntry | null>(null);
	let highlight = $state<string | undefined>(page.url.searchParams.get('highlight') ?? undefined);

	const eaten = $derived(data.totals.energy_kcal?.value ?? 0);
	const byMeal = $derived(
		Object.fromEntries(
			MEALS.map((meal) => [meal, data.entries.filter((e) => e.meal === meal)])
		) as Record<Meal, DiaryEntry[]>
	);

	$effect(() => {
		if (!highlight) return;
		const t = setTimeout(() => (highlight = undefined), 2500);
		return () => clearTimeout(t);
	});
	$effect(() => closeInlineOnOutsideTap());

	const move = (days: number) => goto(dayHref(addDays(data.date, days)));

	async function saved(entry: DiaryEntry, movedTo?: Meal) {
		editing = null;
		await invalidateAll();
		highlight = entry.id;
		showToast({ message: movedTo ? m.toast_moved({ meal: mealName(movedTo) }) : m.toast_saved() });
	}

	async function deleted(entry: DiaryEntry) {
		editing = null;
		await invalidateAll();
		const name =
			entry.kind === 'quick' ? (entry.description ?? m.entry_quick()) : (entry.food?.name ?? '');
		showToast({
			message: m.toast_deleted(),
			detail: m.toast_deleted_detail({ name, meal: mealName(entry.meal) }),
			undo: async () => {
				await api('POST', `/api/v1/diary/entries/${entry.id}?action=restore`, {});
				await invalidateAll();
				highlight = entry.id;
			}
		});
	}

	async function activityAdded(entry: ActivityEntry) {
		addingActivity = false;
		await invalidateAll();
		showToast({
			message:
				entry.kind === 'day_total'
					? m.toast_activity_total({ kcal: kcal(entry.kcal) })
					: m.toast_activity({ kcal: kcal(entry.kcal) }),
			undo: async () => {
				await api('POST', `/api/v1/body/activity/${entry.id}?action=delete`, {});
				await invalidateAll();
			}
		});
	}

	// Bulk actions (docs/ui.md, "Bulk actions"): hold an entry to select it or drag it; the meal … menu; the bar's
	// Move to… / Copy to… / Delete. Each is one request for all the entries, with one Undo.
	let selecting = $state(false);
	const selected = new SvelteSet<string>();
	const lifted = new SvelteSet<string>();
	let bulkSheet = $state<{ mode: 'move' | 'copy'; ids: string[] } | null>(null);
	let bulkBusy = $state(false);
	const entryById = $derived(new Map(data.entries.map((e) => [e.id, e])));
	const entriesOf = (ids: Iterable<string>) =>
		[...ids].flatMap((id) => (entryById.get(id) ? [entryById.get(id)!] : []));
	const dayName = (date: string) => dayTitle(date, data.today);

	function endSelect() {
		selecting = false;
		selected.clear();
	}
	function toggle(entry: DiaryEntry) {
		// A hold released without moving ends here too: nothing is being dragged any more.
		lifted.clear();
		selecting = true;
		if (selected.has(entry.id)) selected.delete(entry.id);
		else selected.add(entry.id);
	}
	function lift(entry: DiaryEntry) {
		const ids = selected.has(entry.id) ? [...selected] : [entry.id];
		lifted.clear();
		ids.forEach((id) => lifted.add(id));
		return { label: entryName(entry), count: ids.length };
	}
	async function bulk<T>(body: unknown): Promise<T> {
		return (await api<{ entries: T }>('POST', '/api/v1/diary/entries/bulk', body)).entries;
	}
	async function run(action: () => Promise<void>) {
		bulkBusy = true;
		try {
			await action();
		} catch {
			// Changed meanwhile, deleted elsewhere, or no connection: show the day as it is now.
			showToast({ message: m.toast_conflict() });
			await invalidateAll();
		} finally {
			bulkBusy = false;
		}
	}
	const countMessage = (
		count: number,
		one: () => string,
		many: (a: { count: string }) => string
	) => (count === 1 ? one() : many({ count: String(count) }));

	/** Moves entries to a day and meal; Undo puts each back where it was. */
	const place = (entries: DiaryEntry[], date: string, meal: Meal) =>
		run(async () => {
			const before = new Map(entries.map((e) => [e.id, { date: e.localDate, meal: e.meal }]));
			const placed = await bulk<DiaryEntry[]>({
				action: 'place',
				entries: entries.map((e) => ({ id: e.id, revision: e.revision, date, meal }))
			});
			bulkSheet = null;
			endSelect();
			await invalidateAll();
			showToast({
				message: countMessage(placed.length, m.toast_moved_one, m.toast_moved_many),
				detail: m.toast_to({ meal: mealName(meal), day: dayName(date) }),
				undo: async () => {
					await bulk({
						action: 'place',
						entries: placed.map((e) => ({ id: e.id, revision: e.revision, ...before.get(e.id)! }))
					});
					await invalidateAll();
				}
			});
		});

	/** Copies entries (their own snapshots) to a day and meal; Undo deletes the copies. */
	const copy = (entries: DiaryEntry[], date: string, meal: Meal) =>
		run(async () => {
			const copies = await bulk<DiaryEntry[]>({
				action: 'copy',
				entries: entries.map((e) => ({ id: e.id, copyId: crypto.randomUUID() })),
				date,
				meal,
				zone: deviceZone()
			});
			bulkSheet = null;
			endSelect();
			await invalidateAll();
			showToast({
				message: countMessage(copies.length, m.toast_copied_one, m.toast_copied_many),
				detail: m.toast_to({ meal: mealName(meal), day: dayName(date) }),
				undo: async () => {
					await bulk({ action: 'delete', ids: copies.map((e) => e.id) });
					await invalidateAll();
				}
			});
		});

	/** Deletes entries at once (to the trash); Undo restores them. No "are you sure", as for one entry. */
	const remove = (entries: DiaryEntry[]) =>
		run(async () => {
			const ids = entries.map((e) => e.id);
			await bulk({ action: 'delete', ids });
			endSelect();
			await invalidateAll();
			showToast({
				message: countMessage(ids.length, m.toast_deleted, m.toast_deleted_many),
				detail: m.toast_from_day({ day: dayName(data.date) }),
				undo: async () => {
					await bulk({ action: 'restore', ids });
					await invalidateAll();
				}
			});
		});

	/** A drag ended: on another meal, move what was lifted there (only entries not already in it). */
	function dropped(meal: string | null) {
		const entries = entriesOf(lifted);
		lifted.clear();
		if (!meal || !(MEALS as readonly string[]).includes(meal)) return;
		const moving = entries.filter((e) => e.meal !== meal);
		if (moving.length) place(moving, data.date, meal as Meal);
	}

	function mealAction(meal: Meal, action: 'select' | 'move' | 'copy' | 'delete') {
		const ids = byMeal[meal].map((e) => e.id);
		if (action === 'select') {
			selecting = true;
			ids.forEach((id) => selected.add(id));
		} else if (action === 'delete') remove(byMeal[meal]);
		else bulkSheet = { mode: action, ids };
	}

	// Escape ends selecting; leaving the day does too.
	$effect(() => {
		if (!selecting) return;
		const key = (e: KeyboardEvent) => e.key === 'Escape' && !bulkSheet && endSelect();
		addEventListener('keydown', key);
		return () => removeEventListener('keydown', key);
	});
	let selectionDay = untrack(() => data.date);
	$effect(() => {
		if (data.date === selectionDay) return;
		selectionDay = data.date;
		endSelect();
	});

	// A one-time tip about holding entries, remembered on this device (storage may be unavailable: then it shows).
	const HINT_KEY = 'obur:hold-hint-seen';
	let hintSeen = $state(true);
	onMount(() => {
		try {
			hintSeen = localStorage.getItem(HINT_KEY) === 'yes';
		} catch {
			hintSeen = false;
		}
	});
	function closeHint() {
		hintSeen = true;
		try {
			localStorage.setItem(HINT_KEY, 'yes');
		} catch {
			// Not remembered; it shows again next time.
		}
	}

	async function toggleComplete() {
		await api('PUT', `/api/v1/diary/days/${data.date}`, { complete: !data.complete });
		await invalidateAll();
	}

	async function conflict() {
		editing = null;
		showToast({ message: m.toast_conflict() });
		await invalidateAll();
	}
</script>

<svelte:head><title>{m.nav_today()} · {m.app_name()}</title></svelte:head>

<main class="today mx-auto max-w-[1064px] px-3.5 py-3 desk:px-7 desk:py-5">
	<DayHeader date={data.date} today={data.today} onmove={move} />
	<div class="today-a">
		<div class="o-budget">
			<BudgetCard
				{eaten}
				budget={data.budget}
				manual={data.target?.mode === 'manual'}
				floor={data.target?.floorKcal ?? 0}
				onaddactivity={() => (addingActivity = true)}
			/>
		</div>
		<div class="o-meals flex flex-col gap-3">
			{#if !hintSeen && data.entries.length > 0}
				<p
					class="flex items-center gap-2 rounded-input bg-soft py-1 pr-1 pl-3.5 text-[14px] text-text"
					role="note"
				>
					<span class="flex-1">{m.hold_hint()}</span>
					<button
						type="button"
						onclick={closeHint}
						aria-label={m.hold_hint_close()}
						class="grid size-11 shrink-0 place-items-center text-muted"
						><X size={18} aria-hidden="true" /></button
					>
				</p>
			{/if}
			<div class="rounded-card bg-surface px-[18px] pt-1.5 pb-2 shadow-card">
				<!-- Keyed by day: rows animate out when deleted, not when the whole day changes. -->
				{#key data.date}
					{#each MEALS as meal (meal)}
						<MealCard
							{meal}
							entries={byMeal[meal]}
							{highlight}
							onadd={() => goto(logHref(meal, data.date))}
							onsave={() => (savingMeal = meal)}
							onopen={(e) => (editing = e)}
							pending={pendingFor(meal)}
							onpending={(op) => (pendingOpen = op)}
							bulk={{
								selecting,
								selected,
								lifted,
								ontoggle: toggle,
								onlift: lift,
								ondrop: dropped,
								onmeal: (action) => mealAction(meal, action)
							}}
						/>
					{/each}
				{/key}
			</div>
		</div>
	</div>
	<div class="today-b">
		<div class="o-nutrients">
			<NutrientsCard
				totals={data.totals}
				carbs={carbohydrateDay(data.entries)}
				entryCount={data.entries.length}
				targets={data.macros}
			/>
		</div>
		<div class="o-pair grid grid-cols-2 grid-rows-[repeat(4,auto)] gap-x-3">
			<WaterCard
				date={data.date}
				today={data.today}
				entries={data.water.entries}
				totalMl={data.water.totalMl}
				onchange={invalidateAll}
			/>
			<WeightCard
				date={data.date}
				today={data.today}
				recent={data.recentWeights}
				onchange={invalidateAll}
			/>
		</div>
		<div class="o-note">
			{#key data.date}<DayNoteCard date={data.date} saved={data.note.text} />{/key}
		</div>
		<div class="o-done flex flex-col gap-2.5">
			<div class="rounded-card bg-surface px-[18px] py-1 shadow-card">
				<button
					type="button"
					role="switch"
					aria-checked={data.complete}
					onclick={toggleComplete}
					aria-label={m.day_complete_switch()}
					class="flex min-h-14 w-full items-center justify-between gap-3 text-left font-[650]"
				>
					<Swap a={m.day_mark_complete()} b={m.day_complete_switch()} showB={data.complete} />
					<span
						aria-hidden="true"
						class={[
							'relative h-7 w-12 shrink-0 rounded-full transition-colors',
							data.complete ? 'bg-good' : 'bg-track'
						]}
						><span
							class={[
								'absolute top-0.5 size-6 rounded-full bg-surface shadow-card transition-[left] duration-300 ease-(--ui) motion-reduce:transition-none',
								data.complete ? 'left-[22px]' : 'left-0.5'
							]}
						></span></span
					>
				</button>
			</div>
			<p class="px-1 text-[13px] text-muted">{m.day_complete_hint()}</p>
		</div>
	</div>
</main>

{#if selecting}
	<SelectionBar
		count={selected.size}
		busy={bulkBusy}
		oncancel={endSelect}
		onmove={() => (bulkSheet = { mode: 'move', ids: [...selected] })}
		oncopy={() => (bulkSheet = { mode: 'copy', ids: [...selected] })}
		ondelete={() => remove(entriesOf(selected))}
	/>
{/if}
{#if bulkSheet}
	{@const sheet = bulkSheet}
	<BulkSheet
		mode={sheet.mode}
		places={entriesOf(sheet.ids).map((e) => ({ date: e.localDate, meal: e.meal }))}
		today={data.today}
		viewed={data.date}
		busy={bulkBusy}
		onconfirm={(date, meal) =>
			(sheet.mode === 'move' ? place : copy)(entriesOf(sheet.ids), date, meal)}
		onclose={() => (bulkSheet = null)}
	/>
{/if}
{#if editing}
	<EditEntrySheet
		entry={editing}
		today={data.today}
		onsaved={saved}
		ondeleted={deleted}
		onconflict={conflict}
		onclose={() => (editing = null)}
	/>
{/if}
{#if savingMeal}
	<SaveMealSheet
		meal={savingMeal}
		entries={byMeal[savingMeal]}
		onsaved={(saved) => {
			savingMeal = null;
			showToast({ message: m.saved_toast({ name: saved.name }), detail: m.saved_toast_detail() });
		}}
		onclose={() => (savingMeal = null)}
	/>
{/if}
{#if addingActivity}
	<ActivitySheet
		date={data.date}
		counted={data.budget?.activityKcal ?? 0}
		watchTotal={data.activity.entries.findLast((e) => e.kind === 'day_total')?.kcal ?? null}
		onsaved={activityAdded}
		onclose={() => (addingActivity = false)}
	/>
{/if}
{#if pendingOpen}
	<PendingSheet
		op={pendingOpen}
		ondiscard={async () => {
			await discard(pendingOpen!.seq!);
			pendingOpen = null;
		}}
		onclose={() => (pendingOpen = null)}
	/>
{/if}

<style>
	/* Phone: everything in one column, in this order. From 760 px: two columns of their own. */
	.today {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.today-a,
	.today-b {
		display: contents;
	}
	.o-budget {
		order: 1;
	}
	.o-nutrients {
		order: 2;
	}
	.o-pair {
		order: 3;
	}
	.o-meals {
		order: 4;
	}
	.o-note {
		order: 5;
	}
	.o-done {
		order: 6;
	}
	@media (min-width: 760px) {
		.today {
			display: grid;
			grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
			align-items: start;
		}
		.today > :global(header) {
			grid-column: 1 / -1;
		}
		.today-a,
		.today-b {
			display: flex;
			flex-direction: column;
			gap: 12px;
			min-width: 0;
		}
	}
</style>
