<script lang="ts">
	// The saved meal editor (owner review 2026-10-30): a meal is a group of foods managed on its own; changing it
	// never logs it. Name, items (tap to change the amount or unit, or remove), Add food, then one Save sends the
	// whole meal. Kept items re-scale their own snapshot; only "Update to current food values" reads the catalog.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { householdMeasures } from '#lib/client/measures.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { SavedMeal } from '#lib/shared/diary-types.ts';
	import type { MeasureOption } from '#lib/shared/unit-options.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import TextField from '../TextField.svelte';
	import ItemsCard from '../items/ItemsCard.svelte';
	import { changed, keptDraft, nutrientsOf, payloadOf, type Draft } from '../items/drafts.ts';

	interface Props {
		/** The meal to edit, or null to create one. */
		meal: SavedMeal | null;
	}
	let { meal }: Props = $props();
	const start = untrack(() => meal);
	// A new meal's ID is chosen once, so a retried Save never creates it twice.
	const id = start?.id ?? crypto.randomUUID();

	let name = $state(start?.name ?? '');
	let items = $state<Draft[]>(
		(start?.items ?? []).map((i) => keptDraft({ ...i, quickName: m.entry_quick() }))
	);
	let measures = $state<MeasureOption[]>([]);
	let busy = $state(false);
	let problem = $state('');
	let showErrors = $state(false);
	let confirmDelete = $state(false);

	onMount(async () => (measures = await householdMeasures()));

	const invalid = $derived(
		!name.trim() || items.length === 0 || items.some((d) => !nutrientsOf(d, measures))
	);
	const dirty = $derived(
		!start ||
			name !== start.name ||
			items.length !== start.items.length ||
			items.some((d, i) => d.keptId !== start.items[i].id || changed(d))
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
			const saved = await api<SavedMeal>('PUT', `/api/v1/saved-meals/${id}`, {
				revision: start?.revision ?? null,
				name,
				items: items.map((d) => payloadOf(d, measures, 'itemId'))
			});
			await goto(resolve('/(app)/saved-meals'), { invalidateAll: true });
			showToast({ message: m.meal_editor_saved({ name: saved.name }) });
		});
	};

	const refresh = () =>
		run(async () => {
			const result = await api<{ meal: SavedMeal; refreshed: number; kept: number }>(
				'POST',
				`/api/v1/saved-meals/${id}/refresh`,
				{ revision: start!.revision }
			);
			await goto(resolve('/(app)/saved-meals/[id]', { id }), { invalidateAll: true });
			showToast({
				message: m.saved_refreshed({
					refreshed: String(result.refreshed),
					kept: String(result.kept)
				})
			});
		});

	const removeMeal = () =>
		run(async () => {
			// A JSON body: SvelteKit refuses a bodyless cross-origin-looking DELETE behind the proxy as a form post.
			await api('DELETE', `/api/v1/saved-meals/${id}`, {});
			await goto(resolve('/(app)/saved-meals'), { invalidateAll: true });
			showToast({ message: m.saved_deleted({ name: start!.name }) });
		});
</script>

<form class="flex flex-col gap-3" onsubmit={save} novalidate>
	<section class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
		<TextField
			label={m.meal_editor_name()}
			bind:value={name}
			maxlength={120}
			aria-invalid={showErrors && !name.trim()}
		/>
	</section>

	<ItemsCard
		title={m.meal_editor_items()}
		bind:items
		{measures}
		emptyText={m.meal_editor_empty()}
		{showErrors}
	/>

	{#if problem}<Notice>{problem}</Notice>{/if}
	<div class="grid grid-cols-2 gap-2">
		<a
			href={resolve('/(app)/saved-meals')}
			class="inline-flex min-h-[52px] items-center justify-center rounded-button border border-line bg-surface text-[17px] font-[750]"
			>{m.common_cancel()}</a
		>
		<Button type="submit" disabled={busy || !dirty}
			>{busy ? m.common_working() : m.meal_editor_save()}</Button
		>
	</div>

	{#if start}
		<section
			class="mt-2 flex flex-col gap-2 rounded-card bg-surface p-[18px] shadow-card"
			aria-labelledby="meal-more"
		>
			<h2 id="meal-more" class="text-[19px] font-bold">{m.meal_editor_more()}</h2>
			<Button variant="ghost" disabled={busy || dirty} onclick={refresh}>{m.saved_refresh()}</Button
			>
			<p class="text-[13px] text-muted">
				{dirty ? m.meal_editor_save_first() : m.saved_refresh_hint()}
			</p>
			{#if confirmDelete}
				<p class="text-[14px]">{m.saved_delete_hint()}</p>
				<div class="grid grid-cols-2 gap-2">
					<Button variant="ghost" onclick={() => (confirmDelete = false)}
						>{m.common_cancel()}</Button
					>
					<Button variant="danger" disabled={busy} onclick={removeMeal}
						>{m.saved_delete_confirm()}</Button
					>
				</div>
			{:else}
				<Button variant="danger" onclick={() => (confirmDelete = true)}>{m.saved_delete()}</Button>
			{/if}
		</section>
	{/if}
</form>
