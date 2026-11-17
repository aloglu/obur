<script lang="ts">
	// A new food made without leaving what is open (Create it as food in Type it and Speak): the food form in a sheet on
	// top, starting from the name that was said. Saving hands the new food back; nothing else in the sheet below changes.
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
	import type { FoodSearchResult } from '#lib/shared/food-types.ts';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import FoodForm from './FoodForm.svelte';

	interface Props {
		name: string;
		oncreated: (id: string) => void;
		onclose: () => void;
	}
	let { name, oncreated, onclose }: Props = $props();
	let busy = $state(false);
	let problem = $state('');

	// A food the person already has that is the same: Use this one hands it back instead.
	let match = $state<FoodSearchResult | null>(null);

	async function save(food: FoodInput, anyway = false) {
		busy = true;
		problem = '';
		try {
			const saved = await api<{ id?: string; match?: FoodSearchResult }>('POST', '/api/v1/foods', {
				food,
				anyway
			});
			if (saved.match) match = saved.match;
			else oncreated(saved.id!);
		} catch (e) {
			problem =
				e instanceof ApiError && e.code === 'energy_required'
					? m.food_energy_required()
					: m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<Sheet title={m.food_new_title()} {onclose}>
	{#if problem}<Notice>{problem}</Notice>{/if}
	<FoodForm
		{busy}
		onsave={save}
		startName={name}
		{match}
		onedit={() => (match = null)}
		onuse={() => match && oncreated(match.id)}
	/>
</Sheet>
