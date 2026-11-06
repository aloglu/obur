<script lang="ts">
	// docs/ui.md "Quick add calories": kcal, optional description, day and meal. Other nutrients stay unknown.
	import DayMealFields from '../DayMealFields.svelte';
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { submit } from '#lib/client/offline/sync.svelte.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { addDays } from '#lib/shared/diary-rules.ts';
	import { MEALS, type DiaryEntry, type Meal } from '#lib/shared/diary-types.ts';
	import { dayTitle, mealName } from '#lib/shared/format.ts';
	import { parseDecimal } from '#lib/shared/numbers.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import TextField from '../TextField.svelte';

	interface Props {
		date: string;
		today: string;
		meal: Meal;
		/** The saved entry, or null when it was kept on this device to send later. */
		onsaved: (entry: DiaryEntry | null) => void;
		onclose: () => void;
	}
	let { date, today, meal: presetMeal, onsaved, onclose }: Props = $props();

	let kcalText = $state('');
	let description = $state('');
	let day = $state(untrack(() => date));
	let meal = $state<Meal>(untrack(() => presetMeal));
	let busy = $state(false);
	let problem = $state('');
	const value = $derived(parseDecimal(kcalText));
	const dayOptions = $derived(date === today ? [today, addDays(today, -1)] : [date, today]);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (value === undefined) return;
		busy = true;
		problem = '';
		try {
			const result = await submit<DiaryEntry>(
				'/api/v1/diary/entries',
				{
					kind: 'quick',
					id: crypto.randomUUID(),
					date: day,
					meal,
					zone: deviceZone(),
					kcal: value,
					description: description || null
				},
				{
					kind: 'diary',
					localDate: day,
					meal,
					name: description || m.entry_quick(),
					quantity: m.entry_quick(),
					kcal: value
				}
			);
			onsaved(result.status === 'sent' ? result.data : null);
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<Sheet title={m.quick_title()} {onclose}>
	<form class="flex flex-col gap-4" onsubmit={save}>
		<TextField
			label={m.quick_kcal()}
			bind:value={kcalText}
			inputmode="decimal"
			autocomplete="off"
			aria-invalid={kcalText.trim() !== '' && value === undefined}
		/>
		<TextField
			label={m.quick_description()}
			placeholder={m.quick_description_placeholder()}
			bind:value={description}
			maxlength={200}
		/>
		<p class="text-[13px] text-muted">{m.quick_note()}</p>
		<DayMealFields
			bind:day
			days={dayOptions.map((d) => ({ value: d, label: dayTitle(d, today) }))}
			bind:meal
			meals={MEALS.map((x) => ({ value: x, label: mealName(x) }))}
		/>
		{#if problem}<Notice>{problem}</Notice>{/if}
		<Button type="submit" wide disabled={busy || value === undefined}
			>{busy ? m.common_working() : m.amount_save()}</Button
		>
	</form>
</Sheet>
