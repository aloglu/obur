<script lang="ts">
	// docs/ui.md "Archived and deleted": everything deleted waits here for 30 days, grouped into entries, foods, recipes
	// and saved meals. Restore puts an entry back in its meal and day, a food or recipe back in its archive, and a saved
	// meal back in Saved meals. Select restores several at once; a long group shows its first five.
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { bulkFoods } from '#lib/client/food-bulk.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { dayTitle, entryName, kcal, mealName } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Button from '#lib/ui/Button.svelte';
	import ItemSelectionBar from '#lib/ui/items/ItemSelectionBar.svelte';
	import SelectCard from '#lib/ui/items/SelectCard.svelte';
	import SelectRow from '#lib/ui/items/SelectRow.svelte';

	let { data } = $props();

	type Kind = 'entry' | 'food' | 'recipe' | 'meal';
	interface Row {
		id: string;
		name: string;
		brand: string | null;
		icon: string | null | undefined;
		iconFrom?: { name: string; brand: string | null };
		detail: string;
		kcal: string | null;
	}

	const DAY = 86_400_000;
	const left = (deletedAt: string) => {
		const days = 30 - Math.floor((Date.now() - Date.parse(deletedAt)) / DAY);
		return days <= 1 ? m.deleted_day_left() : m.deleted_days_left({ days: String(days) });
	};
	const energy = (v: number | null | undefined) => (v === null || v === undefined ? null : kcal(v));

	const groups: { kind: Kind; title: string; rows: Row[] }[] = $derived(
		(
			[
				{
					kind: 'entry',
					title: m.deleted_group_entries(),
					rows: data.entries.map((e) => ({
						id: e.id,
						name: entryName(e),
						brand: null,
						icon: e.food?.icon,
						iconFrom: {
							name: e.kind === 'quick' ? (e.description ?? '') : (e.food?.name ?? ''),
							brand: e.food?.brand ?? null
						},
						detail: `${dayTitle(e.localDate, data.today)} · ${mealName(e.meal)}`,
						kcal: energy(e.nutrients.energy_kcal?.value ?? 0)
					}))
				},
				{
					kind: 'food',
					title: m.deleted_group_foods(),
					rows: data.foods.map((f) => ({
						id: f.id,
						name: f.name,
						brand: f.brand,
						icon: f.icon,
						detail: left(f.deletedAt),
						kcal: f.kcal === null ? null : formatDecimal(f.kcal, 0)
					}))
				},
				{
					kind: 'recipe',
					title: m.deleted_group_recipes(),
					rows: data.recipes.map((f) => ({
						id: f.id,
						name: f.name,
						brand: null,
						icon: f.icon,
						detail: left(f.deletedAt),
						kcal: f.kcal === null ? null : kcal(f.kcal)
					}))
				},
				{
					kind: 'meal',
					title: m.deleted_group_meals(),
					rows: data.meals.map((s) => ({
						id: s.id,
						name: s.name,
						brand: null,
						icon: s.firstFood?.icon,
						iconFrom: { name: s.firstFood?.name ?? s.name, brand: s.firstFood?.brand ?? null },
						detail: `${s.itemCount === 1 ? m.saved_row_one() : m.saved_row_many({ count: String(s.itemCount) })} · ${left(s.deletedAt)}`,
						kcal: kcal(s.kcal)
					}))
				}
			] as { kind: Kind; title: string; rows: Row[] }[]
		).filter((g) => g.rows.length > 0)
	);

	let busy = $state(false);
	let selecting = $state<Kind | null>(null);
	const selected = new SvelteSet<string>();
	const showAll = new SvelteSet<Kind>();
	const CAP = 5;

	function stopSelecting() {
		selecting = null;
		selected.clear();
	}
	function toggle(kind: Kind, id: string) {
		if (selecting !== kind) {
			selecting = kind;
			selected.clear();
		}
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}

	/** Entries go 100 at a time (the diary's bulk limit). */
	async function entriesBulk(action: 'restore' | 'delete', ids: string[]) {
		for (let i = 0; i < ids.length; i += 100)
			await api('POST', '/api/v1/diary/entries/bulk', { action, ids: ids.slice(i, i + 100) });
	}
	const restoreCall: Record<Kind, (ids: string[]) => Promise<unknown>> = {
		entry: (ids) =>
			ids.length === 1
				? api('POST', `/api/v1/diary/entries/${ids[0]}?action=restore`, {})
				: entriesBulk('restore', ids),
		food: (ids) => bulkFoods('undelete', ids),
		recipe: (ids) => bulkFoods('undelete', ids),
		meal: (ids) => api('POST', '/api/v1/saved-meals/restore', { ids })
	};
	const deleteCall: Record<Kind, (ids: string[]) => Promise<unknown>> = {
		entry: (ids) => entriesBulk('delete', ids),
		food: (ids) => bulkFoods('delete', ids),
		recipe: (ids) => bulkFoods('delete', ids),
		meal: async (ids) => {
			for (const id of ids) await api('DELETE', `/api/v1/saved-meals/${id}`, {});
		}
	};

	async function restore(kind: Kind, ids: string[]) {
		busy = true;
		const group = groups.find((g) => g.kind === kind)!;
		const one = ids.length === 1 ? group.rows.find((r) => r.id === ids[0]) : undefined;
		const entry = kind === 'entry' && one ? data.entries.find((e) => e.id === one.id) : undefined;
		try {
			await restoreCall[kind](ids);
			stopSelecting();
			await invalidateAll();
			const n = String(ids.length);
			showToast({
				message: one
					? kind === 'entry'
						? m.deleted_restored({ name: one.name })
						: m.items_restored_one({ name: one.name })
					: {
							entry: () => m.items_restored_entries({ count: n }),
							food: () => m.items_restored_foods({ count: n }),
							recipe: () => m.items_restored_recipes({ count: n }),
							meal: () => m.items_restored_meals({ count: n })
						}[kind](),
				detail: entry
					? m.toast_to({ meal: mealName(entry.meal), day: dayTitle(entry.localDate, data.today) })
					: {
							entry: () => m.items_back_days(),
							food: () => m.items_back_archived_foods(),
							recipe: () => m.items_back_archived_recipes(),
							meal: () => m.items_back_saved()
						}[kind](),
				undo: async () => {
					await deleteCall[kind](ids);
					await invalidateAll();
				}
			});
		} catch {
			await invalidateAll();
			showToast({ message: m.error_generic() });
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.deleted_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 pb-40 desk:px-7">
	<PageHead href={resolve('/(app)/more')} label={m.nav_more()} title={m.deleted_title()} />
	{#if groups.length === 0}
		<div class="rounded-card bg-surface px-[18px] py-1.5 shadow-card">
			<p class="py-3.5 text-[0.9375rem] text-muted">{m.deleted_empty()}</p>
		</div>
	{/if}
	{#each groups as g (g.kind)}
		{@const on = selecting === g.kind}
		{@const rows = on || showAll.has(g.kind) ? g.rows : g.rows.slice(0, CAP)}
		<SelectCard
			title={g.title}
			count={g.rows.length}
			selecting={on}
			allSelected={on && g.rows.every((r) => selected.has(r.id))}
			onselect={() => {
				selecting = g.kind;
				selected.clear();
			}}
			onselectall={() => g.rows.forEach((r) => selected.add(r.id))}
			onclear={() => selected.clear()}
		>
			{#each rows as r (r.id)}
				<SelectRow
					icon={r.icon}
					name={r.name}
					brand={r.brand}
					iconFrom={r.iconFrom}
					detail={r.detail}
					kcal={r.kcal}
					selecting={on}
					selected={on && selected.has(r.id)}
					ontoggle={() => toggle(g.kind, r.id)}
				>
					{#snippet end()}
						<button
							type="button"
							disabled={busy}
							onclick={() => restore(g.kind, [r.id])}
							aria-label={m.deleted_restore_label({ name: r.name })}
							class="min-h-11 shrink-0 pl-1 text-[0.875rem] font-[650] text-accent disabled:opacity-50"
							>{m.deleted_restore()}</button
						>
					{/snippet}
				</SelectRow>
			{/each}
			{#snippet footer()}
				{#if rows.length < g.rows.length}
					<Button variant="ghost" onclick={() => showAll.add(g.kind)}
						>{m.deleted_show_all({ count: String(g.rows.length) })}</Button
					>
				{/if}
			{/snippet}
		</SelectCard>
	{/each}
	<p class="px-1 text-[0.8125rem] text-muted">{m.deleted_hint()}</p>
</main>

{#if selecting}
	<ItemSelectionBar
		count={selected.size}
		{busy}
		oncancel={stopSelecting}
		actions={[{ label: m.items_restore(), run: () => restore(selecting!, [...selected]) }]}
	/>
{/if}
