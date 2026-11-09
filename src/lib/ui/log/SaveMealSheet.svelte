<script lang="ts">
	// Saves some or all of a meal's entries as a saved meal (docs/ui.md, "Saved meals"). Each item keeps the entry's
	// snapshot; the name defaults to the meal's.
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import type { DiaryEntry, Meal, SavedMeal } from '#lib/shared/diary-types.ts';
	import { mealName } from '#lib/shared/format.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import TextField from '../TextField.svelte';
	import ItemChecklist from './ItemChecklist.svelte';

	interface Props {
		meal: Meal;
		entries: DiaryEntry[];
		onsaved: (meal: SavedMeal) => void;
		onclose: () => void;
	}
	let { meal, entries, onsaved, onclose }: Props = $props();
	let name = $state(untrack(() => mealName(meal)));
	let chosen = $state(untrack(() => entries.map((e) => e.id)));
	let busy = $state(false);
	let problem = $state('');
	// One ID per attempt, so a retry after a lost reply does not save twice.
	const id = crypto.randomUUID();
	const valid = $derived(name.trim().length > 0 && name.trim().length <= 120 && chosen.length > 0);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!valid) return;
		busy = true;
		problem = '';
		try {
			onsaved(
				await api<SavedMeal>('POST', '/api/v1/saved-meals', {
					id,
					name,
					// In the meal's order, not the order they were ticked.
					entryIds: entries.filter((e) => chosen.includes(e.id)).map((e) => e.id)
				})
			);
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<Sheet title={m.saved_save_title()} {onclose}>
	<form class="flex flex-col gap-4" onsubmit={save}>
		<TextField
			label={m.saved_name()}
			bind:value={name}
			maxlength={120}
			autocomplete="off"
			autocapitalize="words"
		/>
		<ItemChecklist label={m.saved_items()} items={entries} bind:chosen />
		{#if problem}<Notice>{problem}</Notice>{/if}
		<Button type="submit" wide disabled={busy || !valid}
			>{busy ? m.common_working() : m.saved_save()}</Button
		>
	</form>
</Sheet>
