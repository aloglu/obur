<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import FoodForm from '#lib/ui/food/FoodForm.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let { data } = $props();
	const food = $derived(data.food);

	let busy = $state(false);
	let problem = $state('');
	let info = $state('');

	async function run(action: () => Promise<void>) {
		busy = true;
		problem = '';
		info = '';
		try {
			await action();
		} catch (e) {
			problem =
				e instanceof ApiError && e.code === 'conflict'
					? m.food_conflict()
					: e instanceof ApiError && e.code === 'energy_required'
						? m.food_energy_required()
						: m.error_generic();
		} finally {
			busy = false;
		}
	}

	const save = (input: FoodInput) =>
		run(async () => {
			await api('PUT', `/api/v1/foods/${food.id}`, { version: food.version, food: input });
			await invalidateAll();
			info = m.food_saved();
		});

	const variant = () =>
		run(async () => {
			const { id } = await api<{ id: string }>(
				'POST',
				`/api/v1/foods/${food.id}?action=variant`,
				{}
			);
			await goto(resolve('/foods/[id]', { id }));
		});

	const setArchived = (archived: boolean) =>
		run(async () => {
			await api('POST', `/api/v1/foods/${food.id}?action=${archived ? 'archive' : 'restore'}`, {});
			await invalidateAll();
		});

	const nutrientName: Record<string, () => string> = {
		energy_kcal: m.nutrient_energy_kcal,
		energy_kj: m.nutrient_energy_kj,
		fat: m.nutrient_fat,
		saturated_fat: m.nutrient_saturated_fat,
		carbohydrate_excl_fibre: m.nutrient_carbohydrate,
		carbohydrate_total: m.nutrient_carbohydrate_total,
		sugars: m.nutrient_sugars,
		fibre: m.nutrient_fibre,
		protein: m.nutrient_protein,
		salt: m.nutrient_salt,
		sodium: m.nutrient_sodium
	};
</script>

<svelte:head><title>{food.name} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-[520px] flex-col gap-3 px-3.5 py-6">
	<a href={resolve('/foods')} class="text-[14px] font-semibold text-accent">← {m.foods_title()}</a>
	<h1 class="text-[24px] font-[750] break-words">
		{food.brand ? `${food.brand} ` : ''}{food.name}
	</h1>
	{#if problem}<Notice>{problem}</Notice>{/if}
	{#if info}<Notice tone="info">{info}</Notice>{/if}
	{#if food.archived}<Notice tone="info">{m.food_archived()}</Notice>{/if}
	{#if food.derivedFrom && food.mine}<p class="text-[14px] text-muted">
			{m.food_from_variant()}
		</p>{/if}

	{#if food.editable}
		<Card title={m.food_edit_title()}>
			{#key food.version}<FoodForm initial={food} {busy} onsave={save} />{/key}
		</Card>
	{:else}
		<Card>
			<p class="text-[14px] text-muted">{m.food_read_only()}</p>
			<dl class="flex flex-col divide-y divide-line">
				{#each food.nutrients as n (n.code)}
					<div class="flex min-h-11 items-center justify-between gap-3">
						<dt class="text-[15px]">{nutrientName[n.code]?.() ?? n.code}</dt>
						<dd class="text-[15px] font-semibold tabular-nums">
							{n.qualifier === 'less_than' ? '< ' : ''}{formatDecimal(n.value, ',', 2)}
							{#if n.qualifier === 'derived'}<span class="text-[12px] font-normal text-muted"
									>({m.food_derived()})</span
								>{/if}
							{#if n.qualifier === 'estimate'}<span class="text-[12px] font-normal text-muted"
									>({m.food_estimate()})</span
								>{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</Card>
	{/if}

	<Card>
		<p class="text-[13px] text-muted">{m.food_variant_hint()}</p>
		<Button variant="ghost" disabled={busy} onclick={variant}>{m.food_variant()}</Button>
		{#if food.editable}
			<Button variant="danger" disabled={busy} onclick={() => setArchived(!food.archived)}>
				{food.archived ? m.food_restore() : m.food_archive()}
			</Button>
		{/if}
	</Card>
</main>
