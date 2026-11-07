<script lang="ts">
	// A new food made without leaving what is open (Create it as food in Type it and Speak): the food form in a sheet on
	// top, starting from the name that was said. Saving hands the new food back; nothing else in the sheet below changes.
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
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

	async function save(food: FoodInput) {
		busy = true;
		problem = '';
		try {
			const { id } = await api<{ id: string }>('POST', '/api/v1/foods', { food });
			oncreated(id);
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
	<FoodForm {busy} onsave={save} startName={name} />
</Sheet>
