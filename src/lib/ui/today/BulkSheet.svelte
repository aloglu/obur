<script lang="ts">
	// Move to… / Copy to… for several entries (docs/ui.md, "Bulk actions"): the day (Today, Yesterday or another day,
	// never a future one) and the meal, then one button. A move that would leave everything where it is says so.
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { addDays } from '#lib/shared/diary-rules.ts';
	import { MEALS, type Meal } from '#lib/shared/diary-types.ts';
	import { mealShortName, mealNameTo } from '#lib/shared/format.ts';
	import Button from '../Button.svelte';
	import Select from '../Select.svelte';
	import Sheet from '../Sheet.svelte';

	interface Props {
		mode: 'move' | 'copy';
		/** Where each entry is now. */
		places: { date: string; meal: Meal }[];
		today: string;
		/** The day being viewed, offered first when it is neither today nor yesterday. */
		viewed: string;
		busy: boolean;
		onconfirm: (date: string, meal: Meal) => void;
		onclose: () => void;
	}
	let { mode, places, today, viewed, busy, onconfirm, onclose }: Props = $props();

	type DayChoice = 'today' | 'yesterday' | 'other';
	const yesterday = $derived(addDays(today, -1));
	const startDay = (): DayChoice =>
		viewed === today ? 'today' : viewed === yesterday ? 'yesterday' : 'other';
	let day = $state<DayChoice>(startDay());
	// The sheet starts from the day being viewed; it doesn't follow later changes while open.
	let other = $state(untrack(() => viewed));
	let meal = $state<Meal | null>(null);
	const date = $derived(day === 'today' ? today : day === 'yesterday' ? yesterday : other);
	const dateOk = $derived(/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today);
	const already = $derived(
		mode === 'move' && meal !== null && places.every((p) => p.date === date && p.meal === meal)
	);
	const count = $derived(places.length);
	const title = $derived(
		mode === 'move'
			? count === 1
				? m.bulk_move_one()
				: m.bulk_move_many({ count: String(count) })
			: count === 1
				? m.bulk_copy_one()
				: m.bulk_copy_many({ count: String(count) })
	);
</script>

<Sheet {title} {onclose}>
	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-2 gap-2">
			<Select
				label={m.bulk_day()}
				bind:value={day}
				wide
				options={[
					{ value: 'today', label: m.bulk_today() },
					{ value: 'yesterday', label: m.bulk_yesterday() },
					{ value: 'other', label: m.bulk_other_day() }
				]}
			/>
			<Select
				label={m.bulk_meal()}
				value={meal ?? ('' as Meal)}
				onchange={(v) => (meal = v)}
				wide
				options={MEALS.map((value) => ({ value, label: mealShortName(value) }))}
			/>
		</div>
		{#if day === 'other'}
			<label class="flex flex-col gap-1.5">
				<span class="text-[0.8125rem] font-[650] text-muted">{m.bulk_date()}</span>
				<input
					type="date"
					bind:value={other}
					max={today}
					class="min-h-12 rounded-input border border-line bg-bg px-3 text-[1rem]"
				/>
			</label>
		{/if}
		{#if mode === 'copy'}<p class="text-[0.8125rem] text-muted">{m.bulk_copy_note()}</p>{/if}
		{#if already}<p class="text-[0.8125rem] text-muted">{m.bulk_already_there()}</p>{/if}
		<Button
			wide
			disabled={!meal || !dateOk || already || busy}
			onclick={() => meal && onconfirm(date, meal)}
			>{meal
				? mode === 'move'
					? m.bulk_confirm_move({ meal: mealNameTo(meal) })
					: m.bulk_confirm_copy({ meal: mealNameTo(meal) })
				: title}</Button
		>
	</div>
</Sheet>
