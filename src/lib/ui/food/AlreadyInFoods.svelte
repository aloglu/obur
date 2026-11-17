<script lang="ts">
	// "Already in your foods" (docs/ui.md): above Save, when the food being saved is the same as one the person has
	// (or a built-in one). Use this one opens that food and saves nothing; Save mine anyway submits the form as it is.
	import { m } from '#lib/paraglide/messages.js';
	import { foodName, servingLabelName } from '#lib/shared/curated-names.ts';
	import type { FoodSearchResult } from '#lib/shared/food-types.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import Button from '../Button.svelte';
	import FoodIcon from '../FoodIcon.svelte';

	interface Props {
		match: FoodSearchResult;
		busy?: boolean;
		onuse: () => void;
	}
	let { match, busy = false, onuse }: Props = $props();

	const per = $derived(
		match.basis === 'serving'
			? m.foods_per_serving({ serving: servingLabelName(match.servingLabel ?? '') })
			: match.basis === '100g'
				? m.food_basis_100g()
				: m.food_basis_100ml()
	);
	const name = $derived(foodName(match.name, match.curated));
</script>

<section
	class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-labelledby="already-title"
	data-testid="already-in-foods"
>
	<h2 id="already-title" class="text-[1.0625rem] font-bold">{m.food_already_title()}</h2>
	<div class="flex min-w-0 items-center gap-3">
		<FoodIcon icon={match.icon} name={match.name} brand={match.brand} />
		<p class="min-w-0 text-[0.9375rem] break-words">
			<span class="font-semibold">{match.brand ? `${name}, ${match.brand}` : name}</span>
			<span class="block text-[0.8125rem] text-muted"
				>{[
					match.kcal === null
						? null
						: m.food_already_kcal({ kcal: formatDecimal(match.kcal, 0), per }),
					match.curated ? m.food_already_builtin() : null
				]
					.filter(Boolean)
					.join(' · ')}</span
			>
		</p>
	</div>
	<div class="grid grid-cols-2 gap-2">
		<Button disabled={busy} onclick={onuse}>{m.food_already_use()}</Button>
		<Button type="submit" variant="ghost" disabled={busy} data-anyway="1"
			>{m.food_already_anyway()}</Button
		>
	</div>
</section>
