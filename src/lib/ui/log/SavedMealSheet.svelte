<script lang="ts">
	// Logs a saved meal (docs/ui.md, "Saved meals"): pick items, day and meal, then one tap creates ordinary entries.
	// Below, Manage renames, updates items to current food values (an explicit action) or deletes the saved meal.
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { addDays, isLateNight } from '#lib/shared/diary-rules.ts';
	import { MEALS, type DiaryEntry, type Meal, type SavedMeal } from '#lib/shared/diary-types.ts';
	import { dayTitle, kcal, mealName } from '#lib/shared/format.ts';
	import Button from '../Button.svelte';
	import Chips from '../Chips.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import TextField from '../TextField.svelte';
	import ItemChecklist from './ItemChecklist.svelte';

	interface Props {
		savedMealId: string;
		date: string;
		today: string;
		meal: Meal;
		onlogged: (entries: DiaryEntry[]) => void;
		/** Renamed, updated or deleted, so lists can refresh. */
		onchanged?: () => void;
		ondeleted: (name: string) => void;
		onclose: () => void;
	}
	let {
		savedMealId,
		date,
		today,
		meal: presetMeal,
		onlogged,
		onchanged,
		ondeleted,
		onclose
	}: Props = $props();

	let saved = $state<SavedMeal | null>(null);
	let chosen = $state<string[]>([]);
	let day = $state(untrack(() => date));
	let meal = $state<Meal>(untrack(() => presetMeal));
	let busy = $state(false);
	let problem = $state('');
	let note = $state('');
	let renaming = $state(false);
	let newName = $state('');
	let confirmDelete = $state(false);
	// Entry IDs per item, kept across retries so a lost reply never logs twice (not displayed, so not reactive).
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const entryIds = new Map<string, string>();

	const dayOptions = $derived(date === today ? [today, addDays(today, -1)] : [date, today]);
	const lateNight = $derived(day === today && isLateNight(new Date(), deviceZone()));
	const picked = $derived(saved ? saved.items.filter((i) => chosen.includes(i.id)) : []);
	const pickedKcal = $derived(
		kcal(picked.reduce((sum, i) => sum + (i.nutrients.energy_kcal?.value ?? 0), 0)) +
			(picked.some((i) => !i.nutrients.energy_kcal) ? '+' : '')
	);

	onMount(async () => {
		try {
			saved = await api<SavedMeal>('GET', `/api/v1/saved-meals/${savedMealId}`);
			chosen = saved.items.map((i) => i.id);
		} catch {
			problem = m.saved_offline();
		}
	});

	async function run(action: () => Promise<void>) {
		busy = true;
		problem = '';
		note = '';
		try {
			await action();
		} catch (e) {
			problem =
				e instanceof ApiError && (e.status === 409 || e.status === 404)
					? m.saved_changed()
					: m.error_generic();
		} finally {
			busy = false;
		}
	}

	const log = (event: SubmitEvent) => {
		event.preventDefault();
		if (!saved || picked.length === 0) return;
		return run(async () => {
			const items = picked.map((i) => {
				if (!entryIds.has(i.id)) entryIds.set(i.id, crypto.randomUUID());
				return { itemId: i.id, entryId: entryIds.get(i.id)! };
			});
			const { entries } = await api<{ entries: DiaryEntry[] }>(
				'POST',
				`/api/v1/saved-meals/${savedMealId}/log`,
				{ date: day, meal, zone: deviceZone(), items }
			);
			onlogged(entries);
		});
	};

	const rename = (event: SubmitEvent) => {
		event.preventDefault();
		if (!saved || !newName.trim()) return;
		return run(async () => {
			saved = await api<SavedMeal>('PATCH', `/api/v1/saved-meals/${savedMealId}`, {
				revision: saved!.revision,
				name: newName
			});
			renaming = false;
			onchanged?.();
		});
	};

	const refresh = () =>
		run(async () => {
			const result = await api<{ meal: SavedMeal; refreshed: number; kept: number }>(
				'POST',
				`/api/v1/saved-meals/${savedMealId}/refresh`,
				{ revision: saved!.revision }
			);
			saved = result.meal;
			note = m.saved_refreshed({ refreshed: String(result.refreshed), kept: String(result.kept) });
			onchanged?.();
		});

	const remove = () =>
		run(async () => {
			// A JSON body: SvelteKit refuses a bodyless cross-origin-looking DELETE behind the proxy as a form post.
			await api('DELETE', `/api/v1/saved-meals/${savedMealId}`, {});
			ondeleted(saved!.name);
		});
</script>

<Sheet title={saved?.name ?? m.saved_title()} {onclose}>
	{#if problem}<Notice>{problem}</Notice>{/if}
	{#if saved}
		<form class="flex flex-col gap-4" onsubmit={log}>
			<ItemChecklist label={m.saved_items()} items={saved.items} bind:chosen />
			{#if lateNight}<Notice tone="info">{m.amount_late_night()}</Notice>{/if}
			<Chips
				label={m.amount_day()}
				bind:value={day}
				options={dayOptions.map((d) => ({ value: d, label: dayTitle(d, today) }))}
			/>
			<Chips
				label={m.amount_meal()}
				bind:value={meal}
				options={MEALS.map((x) => ({ value: x, label: mealName(x) }))}
			/>
			<Button type="submit" wide disabled={busy || picked.length === 0}
				>{busy
					? m.common_working()
					: picked.length === 1
						? m.saved_log_one({ kcal: pickedKcal })
						: m.saved_log_many({ count: String(picked.length), kcal: pickedKcal })}</Button
			>
		</form>

		<section class="flex flex-col gap-2 border-t border-line pt-4" aria-labelledby="saved-manage">
			<h3 id="saved-manage" class="text-[13px] font-[650] text-muted">{m.saved_manage()}</h3>
			{#if note}<Notice tone="info">{note}</Notice>{/if}
			{#if renaming}
				<form class="flex flex-col gap-2" onsubmit={rename}>
					<TextField
						label={m.saved_name()}
						bind:value={newName}
						maxlength={120}
						autocomplete="off"
					/>
					<div class="flex gap-2">
						<Button type="submit" disabled={busy || !newName.trim()}>{m.saved_rename_save()}</Button
						>
						<button
							type="button"
							onclick={() => (renaming = false)}
							class="min-h-11 px-3 text-[15px] font-semibold text-muted">{m.common_cancel()}</button
						>
					</div>
				</form>
			{:else}
				<button
					type="button"
					disabled={busy}
					onclick={() => {
						renaming = true;
						newName = saved!.name;
					}}
					class="min-h-11 rounded-input border border-line text-[15px] font-semibold"
					>{m.saved_rename()}</button
				>
			{/if}
			<button
				type="button"
				disabled={busy}
				onclick={refresh}
				aria-describedby="saved-refresh-hint"
				class="min-h-11 rounded-input border border-line text-[15px] font-semibold"
				>{m.saved_refresh()}</button
			>
			<p id="saved-refresh-hint" class="text-[13px] text-muted">{m.saved_refresh_hint()}</p>
			{#if confirmDelete}
				<p class="text-[13px] text-muted">{m.saved_delete_hint()}</p>
				<div class="flex gap-2">
					<button
						type="button"
						disabled={busy}
						onclick={remove}
						class="min-h-11 flex-1 rounded-input border-2 border-bad bg-surface text-[15px] font-bold text-bad"
						>{m.saved_delete_confirm()}</button
					>
					<button
						type="button"
						onclick={() => (confirmDelete = false)}
						class="min-h-11 px-3 text-[15px] font-semibold text-muted">{m.common_cancel()}</button
					>
				</div>
			{:else}
				<button
					type="button"
					disabled={busy}
					onclick={() => (confirmDelete = true)}
					class="min-h-11 rounded-input text-[15px] font-semibold text-bad"
					>{m.saved_delete()}</button
				>
			{/if}
		</section>
	{/if}
</Sheet>
