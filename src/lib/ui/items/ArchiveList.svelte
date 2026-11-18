<script lang="ts" module>
	export interface ArchiveItem {
		id: string;
		name: string;
		brand: string | null;
		icon: string | null;
		detail: string;
		kcal: string | null;
	}
	export interface ArchivePage {
		items: ArchiveItem[];
		/** How many match the search (all of them without one). */
		total: number;
		more: boolean;
	}
</script>

<script lang="ts">
	// Archived foods and Archived recipes (docs/ui.md, "Archived and deleted"): their own search, a page at a time, and
	// Select for Restore or Delete in one step. Select all, without a search, takes the whole archive, not only the rows
	// on screen. Each step has one toast with Undo.
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { bulkFoods } from '#lib/client/food-bulk.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { ACCOUNT_DATA } from '#lib/shared/account-data.ts';
	import Button from '../Button.svelte';
	import TextField from '../TextField.svelte';
	import ItemSelectionBar from './ItemSelectionBar.svelte';
	import SelectCard from './SelectCard.svelte';
	import SelectRow from './SelectRow.svelte';

	interface Props {
		kind: 'food' | 'recipe';
		first: ArchivePage;
		fetchPage: (offset: number, query: string) => Promise<ArchivePage>;
	}
	let { kind, first, fetchPage }: Props = $props();

	let items = $state(untrack(() => first.items));
	let total = $state(untrack(() => first.total));
	let more = $state(untrack(() => first.more));
	let query = $state('');
	let loading = $state(false);
	let busy = $state(false);

	let selecting = $state(false);
	const selected = new SvelteSet<string>();
	// Select all without a search: the whole archive, including rows not loaded yet.
	let everything = $state(false);
	const count = $derived(everything ? total : selected.size);
	const allSelected = $derived(
		everything || (items.length > 0 && !more && items.every((i) => selected.has(i.id)))
	);

	async function reload() {
		const q = query.trim();
		const page = await fetchPage(0, q);
		if (q !== query.trim()) return;
		items = page.items;
		total = page.total;
		more = page.more;
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	let started = false;
	$effect(() => {
		void query;
		if (!started) {
			started = true;
			return;
		}
		clearTimeout(timer);
		timer = setTimeout(() => {
			stopSelecting();
			void reload();
		}, 200);
		return () => clearTimeout(timer);
	});

	async function showMore() {
		loading = true;
		try {
			const page = await fetchPage(items.length, query.trim());
			items.push(...page.items.filter((p) => !items.some((i) => i.id === p.id)));
			more = page.more;
			total = page.total;
			if (everything) for (const i of page.items) selected.add(i.id);
		} finally {
			loading = false;
		}
	}

	function stopSelecting() {
		selecting = false;
		everything = false;
		selected.clear();
	}
	function toggle(id: string) {
		if (!selecting) selecting = true;
		everything = false;
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}
	function selectAll() {
		for (const i of items) selected.add(i.id);
		everything = more && !query.trim();
	}

	// Select all names no IDs, however big the archive; a long list of IDs (Undo after it) goes in parts.
	const bulk = (
		action: 'restore' | 'delete',
		target: { all: 'food' | 'recipe' } | { ids: string[] }
	) =>
		'all' in target
			? api<{ ids: string[]; usedIn: string[] }>('POST', '/api/v1/foods/bulk', {
					action,
					...target
				})
			: bulkFoods(action, target.ids);

	async function act(action: 'restore' | 'delete') {
		busy = true;
		const target = everything ? { all: kind } : { ids: [...selected] };
		const one = !everything && selected.size === 1 ? items.find((i) => selected.has(i.id)) : null;
		try {
			const { ids, usedIn } = await bulk(action, target);
			stopSelecting();
			await reload();
			void invalidate(ACCOUNT_DATA);
			const n = String(ids.length);
			const message =
				action === 'delete'
					? one
						? m.items_deleted_one({ name: one.name })
						: kind === 'food'
							? m.items_deleted_foods({ count: n })
							: m.items_deleted_recipes({ count: n })
					: one
						? m.items_restored_one({ name: one.name })
						: kind === 'food'
							? m.items_restored_foods({ count: n })
							: m.items_restored_recipes({ count: n });
			const detail =
				action === 'restore'
					? kind === 'food'
						? m.items_back_foods()
						: m.items_back_recipes()
					: usedIn.length === 1
						? m.items_deleted_detail_recipe({ recipe: usedIn[0] })
						: usedIn.length > 1
							? m.items_deleted_detail_recipes()
							: m.items_deleted_detail();
			showToast({
				message,
				detail,
				undo: async () => {
					await bulkFoods(action === 'delete' ? 'undelete' : 'archive', ids);
					await reload();
					void invalidate(ACCOUNT_DATA);
				}
			});
		} catch {
			await reload().catch(() => {});
			showToast({ message: m.error_generic() });
		} finally {
			busy = false;
		}
	}

	const href = (id: string) =>
		kind === 'food' ? resolve('/(app)/foods/[id]', { id }) : resolve('/(app)/recipes/[id]', { id });
</script>

<div class="pinned-search">
	<TextField
		label={kind === 'food' ? m.archived_foods_search() : m.archived_recipes_search()}
		placeholder={kind === 'food'
			? m.foods_search_placeholder()
			: m.archived_recipes_search_placeholder()}
		bind:value={query}
		type="search"
		autocomplete="off"
	/>
</div>
{#if items.length === 0}
	<p class="text-[0.9375rem] text-muted">
		{query.trim()
			? m.archived_none_match()
			: kind === 'food'
				? m.archived_foods_empty()
				: m.archived_recipes_empty()}
	</p>
{:else}
	<SelectCard
		title={m.archived_list_head()}
		count={total}
		{selecting}
		{allSelected}
		onselect={() => (selecting = true)}
		onselectall={selectAll}
		onclear={() => {
			everything = false;
			selected.clear();
		}}
	>
		{#each items as item (item.id)}
			<SelectRow
				href={href(item.id)}
				icon={item.icon}
				name={item.name}
				brand={item.brand}
				detail={item.detail}
				kcal={item.kcal}
				{selecting}
				selected={everything || selected.has(item.id)}
				ontoggle={() => toggle(item.id)}
			/>
		{/each}
		{#snippet footer()}
			{#if more}
				<Button variant="ghost" disabled={loading} onclick={showMore}>{m.foods_show_more()}</Button>
			{/if}
		{/snippet}
	</SelectCard>
{/if}
<p class="px-1 text-[0.8125rem] text-muted">
	{kind === 'food' ? m.archived_foods_hint() : m.archived_recipes_hint()}
</p>
{#if selecting}
	<ItemSelectionBar
		{count}
		{busy}
		oncancel={stopSelecting}
		actions={[
			{ label: m.items_restore(), run: () => act('restore') },
			{ label: m.items_delete(), danger: true, run: () => act('delete') }
		]}
	/>
{/if}
