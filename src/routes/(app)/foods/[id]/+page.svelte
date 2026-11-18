<script lang="ts">
	import { fullFoodName } from '#lib/shared/curated-names.ts';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { goto, invalidate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { ACCOUNT_DATA } from '#lib/shared/account-data.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Card from '#lib/ui/Card.svelte';
	import FoodForm from '#lib/ui/food/FoodForm.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let { data } = $props();
	const food = $derived(data.food);
	const editing = $derived(food.mine && food.origin !== 'recipe');

	let busy = $state(false);
	let problem = $state('');

	async function run(action: () => Promise<void>) {
		busy = true;
		problem = '';
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
			showToast({ message: m.food_saved() });
		});

	const variant = () =>
		run(async () => {
			const { id } = await api<{ id: string }>(
				'POST',
				`/api/v1/foods/${food.id}?action=variant`,
				{}
			);
			await goto(resolve('/(app)/foods/[id]', { id }));
		});

	const archiveCall = (id: string, archived: boolean) =>
		api('POST', `/api/v1/foods/${id}?action=${archived ? 'archive' : 'restore'}`, {});

	// Archiving goes back to Foods, which no longer lists it, with Undo (back to the food); restoring
	// stays here.
	const setArchived = (archived: boolean) =>
		run(async () => {
			const id = food.id;
			await archiveCall(id, archived);
			if (!archived) {
				await invalidateAll();
				showToast({ message: m.food_restored_toast() });
				return;
			}
			await goto(resolve('/(app)/foods'), { invalidateAll: true });
			showToast({
				message: m.food_archived_toast(),
				detail: m.food_archived_detail(),
				// Undo puts the person back where they were, on the food.
				undo: async () => {
					await archiveCall(id, false);
					await goto(resolve('/(app)/foods/[id]', { id }));
				}
			});
		});

	// Delete (archived foods only) goes back to Archived foods with Undo, which brings the food back and reopens it.
	const remove = () =>
		run(async () => {
			const id = food.id;
			const bulk = (action: 'delete' | 'undelete') =>
				api<{ ids: string[]; usedIn: string[] }>('POST', '/api/v1/foods/bulk', {
					action,
					ids: [id]
				});
			const { usedIn } = await bulk('delete');
			await goto(resolve('/(app)/foods/archived'), { invalidateAll: true });
			void invalidate(ACCOUNT_DATA);
			showToast({
				message: m.items_deleted_one({ name: fullFoodName(food) }),
				detail:
					usedIn.length === 1
						? m.items_deleted_detail_recipe({ recipe: usedIn[0] })
						: usedIn.length > 1
							? m.items_deleted_detail_recipes()
							: m.items_deleted_detail(),
				undo: async () => {
					await bulk('undelete');
					await goto(resolve('/(app)/foods/[id]', { id }));
				}
			});
		});

	const nutrientName: Record<string, () => string> = {
		energy_kcal: m.nutrient_energy_kcal,
		energy_kj: m.nutrient_energy_kj,
		fat: m.nutrient_fat,
		saturated_fat: m.nutrient_saturated_fat,
		carbohydrate_excl_fibre: m.nutrient_carbohydrate,
		carbohydrate_total: m.nutrient_carbohydrate_total,
		carbohydrate_unspecified: m.nutrient_carbohydrate_unspecified,
		cholesterol: m.nutrient_cholesterol,
		sugars: m.nutrient_sugars,
		fibre: m.nutrient_fibre,
		protein: m.nutrient_protein,
		salt: m.nutrient_salt,
		sodium: m.nutrient_sodium,
		starch: m.nutrient_starch,
		polyols: m.nutrient_polyols,
		monounsaturated_fat: m.nutrient_monounsaturated_fat,
		polyunsaturated_fat: m.nutrient_polyunsaturated_fat,
		trans_fat: m.nutrient_trans_fat,
		calcium: m.nutrient_calcium,
		potassium: m.nutrient_potassium,
		iron: m.nutrient_iron
	};
</script>

<svelte:head><title>{fullFoodName({ ...food, brand: null })} · {m.app_name()}</title></svelte:head>

{#snippet foodActions()}
	<div class="flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card">
		<!-- Only built-in foods, which can't be edited; on the person's own foods it made copy after copy. -->
		{#if !food.mine}
			<button
				type="button"
				disabled={busy}
				onclick={variant}
				class="flex min-h-14 items-center justify-between gap-3 text-left text-[0.9375rem] font-semibold"
			>
				{m.food_variant()}
				<ChevronRight size={20} aria-hidden="true" class="shrink-0 text-muted" />
			</button>
		{/if}
		{#if food.mine && food.origin !== 'recipe'}
			<button
				type="button"
				disabled={busy}
				onclick={() => setArchived(!food.archived)}
				class="flex min-h-14 items-center text-left text-[0.9375rem] font-semibold {food.archived
					? 'text-accent'
					: 'text-bad'}">{food.archived ? m.food_restore() : m.food_archive_row()}</button
			>
			<!-- Only an archived food can be deleted, so one still in use is never deleted by mistake. -->
			{#if food.archived}
				<button
					type="button"
					disabled={busy}
					onclick={remove}
					class="flex min-h-14 items-center text-left text-[0.9375rem] font-semibold text-bad"
					>{m.food_delete_row()}</button
				>
			{/if}
		{/if}
	</div>
{/snippet}

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead
		href={food.archived ? resolve('/(app)/foods/archived') : resolve('/(app)/foods')}
		label={food.archived ? m.archived_foods_title() : m.foods_title()}
		title={editing ? m.food_edit_title() : fullFoodName(food)}
	/>
	{#if problem}<Notice>{problem}</Notice>{/if}
	{#if food.archived}<p class="text-[0.875rem] text-muted">
			{m.food_archived()}
			{#if food.mine && food.origin !== 'recipe'}{m.food_delete_hint()}{/if}
		</p>{/if}
	{#if food.curatedDataset}<p class="text-[0.875rem] text-muted">
			{m.food_source_usda({
				dataset: food.curatedDataset === 'sr_legacy' ? 'SR Legacy' : 'Foundation Foods'
			})}
		</p>{/if}
	{#if food.derivedFrom && food.mine}<p class="text-[0.875rem] text-muted">
			{m.food_from_variant()}
		</p>{/if}

	{#if food.origin === 'recipe' && food.mine}
		<Card>
			<a
				href={resolve('/(app)/recipes/[id]', { id: food.id })}
				class="inline-flex min-h-11 items-center self-start rounded-button bg-fill px-4 font-[750] text-on-accent"
				>{m.recipe_edit()}</a
			>
		</Card>
	{:else if editing}
		{#key food.version}<FoodForm
				initial={food}
				{busy}
				onsave={save}
				actions={foodActions}
				cancelHref={food.archived ? resolve('/(app)/foods/archived') : resolve('/(app)/foods')}
				note={m.food_saved_note()}
			/>{/key}
	{:else}
		<Card>
			<p class="text-[0.875rem] text-muted">
				{m.food_read_only()}
			</p>
			<dl class="flex flex-col divide-y divide-line">
				{#each food.nutrients as n (n.code)}
					<div class="flex min-h-11 items-center justify-between gap-3">
						<dt class="text-[0.9375rem]">{nutrientName[n.code]?.() ?? n.code}</dt>
						<dd class="text-[0.9375rem] font-semibold tabular-nums">
							{n.qualifier === 'less_than' ? '< ' : ''}{formatDecimal(n.value, 2)}
							{#if n.qualifier === 'derived'}<span class="text-[0.75rem] font-normal text-muted"
									>({m.food_derived()})</span
								>{/if}
							{#if n.qualifier === 'estimate'}<span class="text-[0.75rem] font-normal text-muted"
									>({m.food_estimate()})</span
								>{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</Card>
		{@render foodActions()}
	{/if}
</main>
