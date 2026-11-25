<script lang="ts">
	// The saved meal editor (owner review 2026-10-30): a meal is a group of foods managed on its own; changing it
	// never logs it. Name, items (tap to change the amount or unit, or remove), Add food, then one Save sends the
	// whole meal. Kept items re-scale their own snapshot; only "Update to current food values" reads the catalog.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError, NoConnection, SAVE_TIMEOUT_MS } from '#lib/client/api.ts';
	import { householdMeasures } from '#lib/client/measures.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { SavedMeal } from '#lib/shared/diary-types.ts';
	import type { MeasureOption } from '#lib/shared/unit-options.ts';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import TextField from '../TextField.svelte';
	import EditorHead from '../items/EditorHead.svelte';
	import ItemsCard from '../items/ItemsCard.svelte';
	import { changed, keptDraft, nutrientsOf, payloadOf, type Draft } from '../items/drafts.ts';

	interface Props {
		/** The meal to edit, or null to create one. */
		meal: SavedMeal | null;
		/** A food in it has changed since it was added. */
		stale?: boolean;
	}
	let { meal, stale = false }: Props = $props();
	const start = untrack(() => meal);
	// A new meal's ID is chosen once, so a retried Save never creates it twice.
	const id = start?.id ?? crypto.randomUUID();
	let maybeSaved = false;

	let name = $state(start?.name ?? '');
	let items = $state<Draft[]>(
		(start?.items ?? []).map((i) => keptDraft({ ...i, quickName: m.entry_quick() }))
	);
	let measures = $state<MeasureOption[]>([]);
	let busy = $state(false);
	let problem = $state('');
	let showErrors = $state(false);

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
				e instanceof NoConnection
					? m.save_no_connection()
					: e instanceof ApiError && (e.status === 409 || e.status === 404)
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
			// A new saved meal whose save lost its answer may be there: Save again changes it, rather than being refused
			// for a changed name or answered with the first save's items (2026-11-25 Review.md audit, 2.7).
			let revision = start?.revision ?? null;
			if (!start && maybeSaved) {
				const there = await api<SavedMeal>('GET', `/api/v1/saved-meals/${id}`).catch(
					(e: unknown) => {
						if (e instanceof ApiError && e.status === 404) return null;
						throw e;
					}
				);
				revision = there?.revision ?? null;
			}
			const saved = await api<SavedMeal>(
				'PUT',
				`/api/v1/saved-meals/${id}`,
				{ revision, name, items: items.map((d) => payloadOf(d, measures, 'itemId')) },
				SAVE_TIMEOUT_MS
			).catch((e: unknown) => {
				if (e instanceof NoConnection) maybeSaved = true;
				throw e;
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

	// No confirmation: the meal waits in Recently deleted for 30 days, and the toast has Undo, which reopens it.
	const removeMeal = () =>
		run(async () => {
			// A JSON body: SvelteKit refuses a bodyless cross-origin-looking DELETE behind the proxy as a form post.
			await api('DELETE', `/api/v1/saved-meals/${id}`, {});
			await goto(resolve('/(app)/saved-meals'), { invalidateAll: true });
			showToast({
				message: m.saved_deleted({ name: start!.name }),
				detail: m.items_deleted_detail(),
				undo: async () => {
					await api('POST', '/api/v1/saved-meals/restore', { ids: [id] });
					await goto(resolve('/(app)/saved-meals/[id]', { id }));
				}
			});
		});
</script>

<EditorHead
	backHref={resolve('/(app)/saved-meals')}
	backLabel={m.saved_title()}
	title={start ? m.saved_edit_title() : m.saved_new_title()}
/>

<form class="flex flex-col gap-3" onsubmit={save} novalidate>
	<section class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
		<TextField
			label={m.meal_editor_name()}
			bind:value={name}
			autocapitalize="words"
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
		removeLabel={m.meal_editor_remove()}
	/>

	{#if stale && !dirty}
		<Button variant="ghost" wide disabled={busy} onclick={refresh}>
			<RefreshCw size={18} aria-hidden="true" />{m.saved_refresh()}
		</Button>
	{/if}

	<!-- Delete sits at the end, above Save, as Archive does on a recipe or a food (owner, 2026-11-18). -->
	{#if start}
		<div class="flex flex-col rounded-card bg-surface px-[18px] shadow-card">
			<button
				type="button"
				disabled={busy}
				onclick={removeMeal}
				class="flex min-h-14 items-center text-left text-[0.9375rem] font-semibold text-bad"
				>{m.saved_delete()}</button
			>
		</div>
	{/if}

	{#if problem}<Notice>{problem}</Notice>{/if}
	<div class="grid grid-cols-2 gap-2">
		<a
			href={resolve('/(app)/saved-meals')}
			class="inline-flex min-h-[52px] items-center justify-center rounded-button border border-line bg-surface text-[1.0625rem] font-[750]"
			>{m.common_cancel()}</a
		>
		<Button type="submit" disabled={busy || !dirty}
			>{busy ? m.common_working() : m.meal_editor_save()}</Button
		>
	</div>
</form>
