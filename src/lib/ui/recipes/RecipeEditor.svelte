<script lang="ts">
	// The recipe editor (docs/ui.md, "Recipes"): name, who can use it, servings, the optional cooked weight, the
	// ingredients (shared with the saved meal editor) and the values per serving, and its icon as in the food form. One Save sends the whole recipe;
	// kept ingredients re-scale their own snapshot, and only Update to current food values reads the catalog.
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { householdMeasures } from '#lib/client/measures.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { suggestIcon } from '#lib/shared/food-icons.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import { recipeNutrients, type Recipe } from '#lib/shared/recipe.ts';
	import type { MeasureOption } from '#lib/shared/unit-options.ts';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Button from '../Button.svelte';
	import FoodIcon from '../FoodIcon.svelte';
	import Notice from '../Notice.svelte';
	import TextField from '../TextField.svelte';
	import EditorHead from '../items/EditorHead.svelte';
	import ItemsCard from '../items/ItemsCard.svelte';
	import { changed, keptDraft, nutrientsOf, payloadOf, type Draft } from '../items/drafts.ts';
	import IconPicker from '../food/IconPicker.svelte';
	import MacroPreview from '../log/MacroPreview.svelte';

	interface Props {
		/** The recipe to edit, or null to create one. */
		recipe: Recipe | null;
		/** An ingredient's food has changed since it was added. */
		stale?: boolean;
	}
	let { recipe, stale = false }: Props = $props();
	const start = untrack(() => recipe);
	// A new recipe's ID is chosen once, so a retried Save never creates it twice.
	const id = start?.id ?? crypto.randomUUID();

	let name = $state(start?.name ?? '');
	// The chosen icon; null shows the one the name suggests.
	let icon = $state<string | null>(start?.icon ?? null);
	let choosingIcon = $state(false);
	let servingsText = $state(start ? formatDecimal(start.servings, 2) : '');
	let yieldText = $state(start?.cookedYieldG ? formatDecimal(start.cookedYieldG, 2) : '');
	let items = $state<Draft[]>((start?.ingredients ?? []).map((i) => keptDraft(i)));
	let measures = $state<MeasureOption[]>([]);
	let busy = $state(false);
	let problem = $state('');
	let showErrors = $state(false);

	onMount(async () => (measures = await householdMeasures()));

	const servings = $derived(parseDecimal(servingsText));
	const cookedYieldG = $derived(yieldText.trim() === '' ? null : parseDecimal(yieldText));
	const numbersBad = $derived(
		servings === undefined ||
			servings <= 0 ||
			servings > 1000 ||
			cookedYieldG === undefined ||
			(cookedYieldG !== null && (cookedYieldG <= 0 || cookedYieldG > 100_000))
	);
	const computed = $derived(items.map((d) => nutrientsOf(d, measures)));
	const perServing = $derived(
		servings && servings > 0 && computed.every(Boolean)
			? recipeNutrients(
					computed.map((n) => n!),
					servings
				)
			: undefined
	);
	const energyUnknown = $derived(
		perServing !== undefined &&
			items.length > 0 &&
			!perServing.some((n) => n.code === 'energy_kcal')
	);
	const invalid = $derived(
		!name.trim() || items.length === 0 || numbersBad || computed.some((n) => !n)
	);
	const dirty = $derived(
		!start ||
			name !== start.name ||
			icon !== start.icon ||
			servings !== start.servings ||
			cookedYieldG !== start.cookedYieldG ||
			items.length !== start.ingredients.length ||
			items.some((d, i) => d.keptId !== start.ingredients[i].id || changed(d))
	);

	async function run(action: () => Promise<void>) {
		busy = true;
		problem = '';
		try {
			await action();
		} catch (e) {
			problem =
				e instanceof ApiError && (e.status === 409 || e.status === 404)
					? m.meal_editor_changed()
					: e instanceof ApiError && e.status === 422
						? m.amount_conversion_unknown()
						: m.error_generic();
		} finally {
			busy = false;
		}
	}

	const save = (event: SubmitEvent) => {
		event.preventDefault();
		showErrors = true;
		if (invalid) return;
		return run(async () => {
			const saved = await api<Recipe>('PUT', `/api/v1/recipes/${id}`, {
				version: start?.version ?? null,
				name,
				icon,
				servings,
				cookedYieldG,
				ingredients: items.map((d) => payloadOf(d, measures, 'ingredientId'))
			});
			await goto(resolve('/(app)/recipes'), { invalidateAll: true });
			showToast({ message: m.recipe_saved({ name: saved.name }) });
		});
	};

	const refresh = () =>
		run(async () => {
			const result = await api<{ refreshed: number; kept: number }>(
				'POST',
				`/api/v1/recipes/${id}/refresh`,
				{ version: start!.version }
			);
			await goto(resolve('/(app)/recipes/[id]', { id }), { invalidateAll: true });
			showToast({
				message: m.saved_refreshed({
					refreshed: String(result.refreshed),
					kept: String(result.kept)
				})
			});
		});

	const archiveCall = (archived: boolean) =>
		api('POST', `/api/v1/foods/${id}?action=${archived ? 'archive' : 'restore'}`, {});

	// As on a food's page: archiving goes back to Recipes with Undo (back to the recipe); restoring stays here.
	const setArchived = (archived: boolean) =>
		run(async () => {
			await archiveCall(archived);
			if (!archived) {
				await invalidateAll();
				showToast({ message: m.recipe_restored_toast() });
				return;
			}
			await goto(resolve('/(app)/recipes'), { invalidateAll: true });
			showToast({
				message: m.recipe_archived_toast(),
				detail: m.food_archived_detail(),
				undo: async () => {
					await archiveCall(false);
					await goto(resolve('/(app)/recipes/[id]', { id }));
				}
			});
		});

	// Delete (archived recipes only) goes back to Archived recipes with Undo, which brings it back and reopens it.
	const remove = () =>
		run(async () => {
			const bulk = (action: 'delete' | 'undelete') =>
				api('POST', '/api/v1/foods/bulk', { action, ids: [id] });
			await bulk('delete');
			await goto(resolve('/(app)/recipes/archived'), { invalidateAll: true });
			showToast({
				message: m.items_deleted_one({ name: start!.name }),
				detail: m.items_deleted_detail(),
				undo: async () => {
					await bulk('undelete');
					await goto(resolve('/(app)/recipes/[id]', { id }));
				}
			});
		});
</script>

<EditorHead
	backHref={start?.archived ? resolve('/(app)/recipes/archived') : resolve('/(app)/recipes')}
	backLabel={start?.archived ? m.archived_recipes_title() : m.recipes_title()}
	title={start ? m.recipe_edit_title() : m.recipe_new_title()}
	{busy}
/>
{#if start?.archived}<p class="text-[0.875rem] text-muted">
		{m.food_archived()}
		{m.food_delete_hint()}
	</p>{/if}

<form class="flex flex-col gap-3" onsubmit={save} novalidate>
	<section class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
		<TextField
			label={m.recipe_name()}
			bind:value={name}
			autocapitalize="words"
			maxlength={200}
			aria-invalid={showErrors && !name.trim()}
		/>
		<div class="flex items-center gap-3">
			<FoodIcon {icon} name={name || '-'} />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="text-[0.8125rem] font-[650] text-muted">{m.icon_label()}</span>
				<span class="text-[0.875rem]">{icon ? m.icon_chosen() : m.icon_suggested()}</span>
			</span>
			<button
				type="button"
				onclick={() => (choosingIcon = true)}
				class="min-h-11 rounded-input px-3 text-[0.9375rem] font-semibold text-accent"
				>{m.icon_change()}</button
			>
		</div>
		<div class="grid grid-cols-2 items-end gap-2">
			<TextField
				label={m.recipe_servings()}
				bind:value={servingsText}
				inputmode="decimal"
				autocomplete="off"
				aria-invalid={showErrors && (servings === undefined || servings <= 0 || servings > 1000)}
			/>
			<TextField
				label={m.recipe_yield()}
				placeholder={m.onb_optional()}
				bind:value={yieldText}
				inputmode="decimal"
				autocomplete="off"
				aria-invalid={showErrors && cookedYieldG === undefined}
			/>
		</div>
		<p class="text-[0.8125rem] text-muted">{m.recipe_hint()}</p>
		{#if showErrors && numbersBad}<Notice>{m.recipe_invalid()}</Notice>{/if}
	</section>

	<ItemsCard
		title={m.recipe_ingredients()}
		bind:items
		{measures}
		emptyText={m.recipe_empty()}
		{showErrors}
		removeLabel={m.recipe_remove()}
		allowRecipes={false}
	/>

	{#if items.length > 0}
		<section
			class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
			aria-labelledby="per-serving"
		>
			<div class="flex flex-wrap items-baseline justify-between gap-x-3">
				<h2 id="per-serving" class="text-[1.1875rem] font-bold">{m.recipe_per_serving()}</h2>
				<span class="text-[0.875rem] text-muted tabular-nums"
					>{servings && cookedYieldG
						? m.recipe_serving_weight({ g: formatDecimal(cookedYieldG / servings, 0) })
						: m.recipe_no_cooked_weight()}</span
				>
			</div>
			<MacroPreview nutrients={perServing} />
			{#if energyUnknown}<Notice tone="info">{m.recipe_energy_unknown()}</Notice>{/if}
		</section>
	{/if}

	{#if stale && !dirty}
		<Button variant="ghost" wide disabled={busy} onclick={refresh}>
			<RefreshCw size={18} aria-hidden="true" />{m.saved_refresh()}
		</Button>
	{/if}

	<!-- Archive, Restore and Delete sit at the end, above Save, as on a food's page. -->
	{#if start}
		<div class="flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card">
			<button
				type="button"
				disabled={busy}
				onclick={() => setArchived(!start.archived)}
				class={[
					'flex min-h-14 items-center text-left text-[0.9375rem] font-semibold',
					start.archived ? 'text-accent' : 'text-bad'
				]}>{start.archived ? m.food_restore() : m.recipe_archive()}</button
			>
			{#if start.archived}
				<button
					type="button"
					disabled={busy}
					onclick={remove}
					class="flex min-h-14 items-center text-left text-[0.9375rem] font-semibold text-bad"
					>{m.recipe_delete()}</button
				>
			{/if}
		</div>
	{/if}

	{#if problem}<Notice>{problem}</Notice>{/if}
	<div class="grid grid-cols-2 gap-2">
		<a
			href={resolve('/(app)/recipes')}
			class="inline-flex min-h-[52px] items-center justify-center rounded-button border border-line bg-surface text-[1.0625rem] font-[750]"
			>{m.common_cancel()}</a
		>
		<Button type="submit" disabled={busy || !dirty}
			>{busy ? m.common_working() : m.meal_editor_save()}</Button
		>
	</div>
</form>

{#if choosingIcon}
	<IconPicker
		suggested={suggestIcon(name)}
		chosen={icon}
		onchoose={(hex) => {
			icon = hex;
			choosingIcon = false;
		}}
		onclose={() => (choosingIcon = false)}
	/>
{/if}
