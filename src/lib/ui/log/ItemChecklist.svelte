<script lang="ts">
	// Items to include, each with its name, quantity and kcal; used when saving a meal and when logging one.
	import type { EntryNutrients, FoodSnapshot, SnapshotUnit } from '#lib/shared/diary-types.ts';
	import { entryName, entryQuantity, kcal } from '#lib/shared/format.ts';

	interface Item {
		id: string;
		kind: 'food' | 'quick';
		food: FoodSnapshot | null;
		amount: number | null;
		unit: SnapshotUnit | null;
		description: string | null;
		nutrients: EntryNutrients;
	}
	let {
		label,
		items,
		chosen = $bindable()
	}: { label: string; items: Item[]; chosen: string[] } = $props();
</script>

<fieldset class="flex flex-col">
	<legend class="mb-1 text-[0.8125rem] font-[650] text-muted">{label}</legend>
	{#each items as item (item.id)}
		<label
			class="flex min-h-14 cursor-pointer items-center gap-3 rounded-input px-1 py-2 hover:bg-surface2"
		>
			<input type="checkbox" value={item.id} bind:group={chosen} />
			<span class="min-w-0 flex-1">
				<span class="line-clamp-2 text-[0.9375rem] font-semibold break-words"
					>{entryName(item)}</span
				>
				<span class="text-[0.8125rem] text-muted">{entryQuantity(item)}</span>
			</span>
			<span class="shrink-0 text-[0.9375rem] font-semibold tabular-nums"
				>{item.nutrients.energy_kcal ? kcal(item.nutrients.energy_kcal.value) : '?'}</span
			>
		</label>
	{/each}
</fieldset>
