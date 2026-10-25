<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
	import FoodForm from '#lib/ui/food/FoodForm.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let busy = $state(false);
	let problem = $state('');

	async function save(food: FoodInput) {
		busy = true;
		problem = '';
		try {
			const { id } = await api<{ id: string }>('POST', '/api/v1/foods', { food });
			await goto(resolve('/foods/[id]', { id }));
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

<svelte:head><title>{m.food_new_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-[520px] flex-col gap-3 px-3.5 py-6">
	<a href={resolve('/foods')} class="text-[14px] font-semibold text-accent">← {m.foods_title()}</a>
	<h1 class="text-[24px] font-[750]">{m.food_new_title()}</h1>
	{#if problem}<Notice>{problem}</Notice>{/if}
	<div class="rounded-card bg-surface p-[18px] shadow-card"><FoodForm {busy} onsave={save} /></div>
</main>
