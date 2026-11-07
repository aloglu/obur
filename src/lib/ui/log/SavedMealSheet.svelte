<script lang="ts">
	// Logs a saved meal (docs/ui.md, "Saved meals"): pick items, day and meal, then one tap creates ordinary entries.
	// Edit meal opens the editor; managing and logging are separate (owner review 2026-10-30).
	import DayMealFields from '../DayMealFields.svelte';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { addDays, isLateNight } from '#lib/shared/diary-rules.ts';
	import { MEALS, type DiaryEntry, type Meal, type SavedMeal } from '#lib/shared/diary-types.ts';
	import { dayTitle, kcal, mealName } from '#lib/shared/format.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import ItemChecklist from './ItemChecklist.svelte';

	interface Props {
		savedMealId: string;
		date: string;
		today: string;
		meal: Meal;
		onlogged: (entries: DiaryEntry[]) => void;
		onclose: () => void;
	}
	let { savedMealId, date, today, meal: presetMeal, onlogged, onclose }: Props = $props();

	let saved = $state<SavedMeal | null>(null);
	let chosen = $state<string[]>([]);
	let day = $state(untrack(() => date));
	let meal = $state<Meal>(untrack(() => presetMeal));
	let busy = $state(false);
	let problem = $state('');
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
</script>

<Sheet title={saved?.name ?? m.saved_title()} {onclose}>
	{#if problem}<Notice>{problem}</Notice>{/if}
	{#if saved}
		<form class="flex flex-col gap-4" onsubmit={log}>
			<ItemChecklist label={m.saved_items()} items={saved.items} bind:chosen />
			{#if lateNight}<Notice tone="info">{m.amount_late_night()}</Notice>{/if}
			<DayMealFields
				bind:day
				days={dayOptions.map((d) => ({ value: d, label: dayTitle(d, today) }))}
				bind:meal
				meals={MEALS.map((x) => ({ value: x, label: mealName(x) }))}
			/>
			<Button type="submit" wide disabled={busy || picked.length === 0}
				>{busy
					? m.common_working()
					: picked.length === 1
						? m.saved_log_one({ kcal: pickedKcal })
						: m.saved_log_many({ count: String(picked.length), kcal: pickedKcal })}</Button
			>
		</form>

		<!-- Managing a meal is separate from logging it (owner review 2026-10-30). -->
		<a
			href={resolve('/(app)/saved-meals/[id]', { id: savedMealId })}
			class="inline-flex min-h-11 items-center justify-center self-center px-3 text-[0.9375rem] font-semibold text-accent"
			>{m.saved_edit()}</a
		>
	{/if}
</Sheet>
