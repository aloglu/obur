<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
	import BackLink from '#lib/ui/BackLink.svelte';
	import FoodForm from '#lib/ui/food/FoodForm.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let busy = $state(false);
	let problem = $state('');

	async function save(food: FoodInput) {
		busy = true;
		problem = '';
		try {
			const { id } = await api<{ id: string }>('POST', '/api/v1/foods', { food });
			await goto(resolve('/(app)/foods/[id]', { id }));
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

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<BackLink href={resolve('/(app)/foods')} label={m.foods_title()} />
	<h1 class="text-[24px] font-[750]">{m.food_new_title()}</h1>
	{#if problem}<Notice>{problem}</Notice>{/if}
	<FoodForm {busy} onsave={save} startName={page.url.searchParams.get('name') ?? ''} />
</main>
