<script lang="ts" generics="D extends string, M extends string">
	// Day and Meal in a sheet: two fields side by side, each opening a menu as wide as itself (docs/ui.md, "Choices").
	import { m as t } from '#lib/paraglide/messages.js';
	import Select from './Select.svelte';

	interface Option<V> {
		value: V;
		label: string;
	}
	interface Props {
		day: D;
		days: Option<D>[];
		meal: M;
		meals: Option<M>[];
	}
	let { day = $bindable(), days, meal = $bindable(), meals }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-2">
	<Select bind:value={day} options={days} label={t.amount_day()} wide />
	<Select bind:value={meal} options={meals} label={t.amount_meal()} wide />
</div>
