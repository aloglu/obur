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
		dayLabel?: string;
		meal: M;
		meals: Option<M>[];
		mealLabel?: string;
		/** Hide Meal when nothing being logged belongs to one. */
		showMeal?: boolean;
		onmeal?: (meal: M) => void;
	}
	let {
		day = $bindable(),
		days,
		dayLabel,
		meal = $bindable(),
		meals,
		mealLabel,
		showMeal = true,
		onmeal
	}: Props = $props();
</script>

<div class={['grid gap-2', showMeal && 'grid-cols-2']}>
	<Select bind:value={day} options={days} label={dayLabel ?? t.amount_day()} wide />
	{#if showMeal}
		<Select
			bind:value={meal}
			options={meals}
			label={mealLabel ?? t.amount_meal()}
			wide
			onchange={onmeal}
		/>
	{/if}
</div>
