<script lang="ts">
	// docs/ui.md "Meal cards": one meal in the shared card, on one grid (icon, name, number) for its header, its entries
	// and a trailing Add food row; the meal total sits in the number column. Bulk actions ("Bulk actions"): the … menu,
	// holding a row to select it or drag it to another meal, and, while selecting, a round check on each row that a tap
	// toggles. Ctrl/⌘-click also selects.
	import { slide } from 'svelte/transition';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import { holdDrag } from '#lib/client/hold-drag.ts';
	import { m } from '#lib/paraglide/messages.js';
	import type { DiaryEntry, Meal } from '#lib/shared/diary-types.ts';
	import type { QueuedOp } from '#lib/client/offline/store.ts';
	import FoodIcon from '../FoodIcon.svelte';
	import Roll from '../Roll.svelte';
	import MealMenu from './MealMenu.svelte';
	import { entryName, entryQuantity, kcal, mealName } from '#lib/shared/format.ts';

	interface Props {
		meal: Meal;
		entries: DiaryEntry[];
		highlight?: string[];
		onadd: () => void;
		/** Offered once the meal has entries on the server. */
		onsave?: () => void;
		onopen: (entry: DiaryEntry) => void;
		/** Entries kept on this device and not yet on the server. */
		pending?: QueuedOp[];
		onpending?: (op: QueuedOp) => void;
		/** Bulk actions; without them the card behaves as before. */
		bulk?: {
			selecting: boolean;
			selected: ReadonlySet<string>;
			/** Entries lifted by a drag, shown faded where they are. */
			lifted: ReadonlySet<string>;
			ontoggle: (entry: DiaryEntry) => void;
			onlift: (entry: DiaryEntry) => { label: string; count: number };
			ondrop: (meal: string | null) => void;
			onmeal: (action: 'select' | 'move' | 'copy' | 'delete') => void;
		};
	}
	let {
		meal,
		entries,
		highlight,
		onadd,
		onsave,
		onopen,
		pending = [],
		onpending,
		bulk
	}: Props = $props();
	const selecting = $derived(bulk?.selecting ?? false);

	const total = $derived(
		entries.reduce((sum, e) => sum + (e.nutrients.energy_kcal?.value ?? 0), 0)
	);
	const row = 'grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3';
	const leaveMs = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
</script>

<section
	class="-mx-2.5 rounded-[16px] px-2.5 pt-3 pb-2 not-first:rounded-t-none not-first:border-t not-first:border-line first:pt-0.5"
	aria-labelledby="meal-{meal}"
	data-meal-drop={bulk ? meal : undefined}
>
	<div class={[row, 'min-h-11 px-2.5']}>
		<h2 id="meal-{meal}" class="col-span-2 text-[1.1875rem] font-bold">{mealName(meal)}</h2>
		{#if total}
			<span
				class="min-w-11 text-right text-[0.9375rem] font-[750] tabular-nums"
				aria-label="{kcal(total)} kcal"><Roll value={kcal(total)} /></span
			>
		{/if}
	</div>
	{#if entries.length > 0 || pending.length > 0}
		<ul class="flex flex-col gap-0.5">
			{#each entries as e (e.id)}
				{@const on = bulk?.selected.has(e.id) ?? false}
				<li class="entry-in" out:slide={{ duration: leaveMs() }}>
					<button
						type="button"
						data-hold-row
						use:holdDrag={{
							enabled: !!bulk,
							onselect: () => bulk?.ontoggle(e),
							onlift: () => bulk?.onlift(e) ?? { label: '', count: 1 },
							ondrop: (target) => bulk?.ondrop(target)
						}}
						onclick={(event) => {
							if (bulk && (selecting || event.ctrlKey || event.metaKey)) bulk.ontoggle(e);
							else onopen(e);
						}}
						aria-pressed={selecting ? on : undefined}
						class={[
							'grid min-h-14 w-full grid-cols-[auto_40px_minmax(0,1fr)_auto] items-center rounded-input px-2.5 py-1.5 text-left transition-colors duration-700',
							on || highlight?.includes(e.id) ? 'bg-soft' : 'hover:bg-surface2',
							bulk?.lifted.has(e.id) && 'opacity-35'
						]}
					>
						<span class={['check-slot', selecting && 'on']} aria-hidden="true">
							<span
								class={[
									'grid size-6 shrink-0 place-items-center rounded-full border-2',
									on ? 'border-accent bg-fill text-on-accent' : 'border-muted bg-surface'
								]}
								>{#if on}<Check size={14} strokeWidth={3} />{/if}</span
							>
						</span>
						<FoodIcon
							icon={e.food?.icon}
							name={e.kind === 'quick' ? (e.description ?? '') : (e.food?.name ?? '')}
							brand={e.food?.brand}
						/>
						<span class="ml-3 min-w-0">
							<span class="line-clamp-2 text-[0.9375rem] leading-[1.3] font-semibold break-words"
								>{entryName(e)}</span
							>
							<span class="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted">
								{entryQuantity(e)}
								{#if e.kind === 'quick'}<span
										class="rounded-menu bg-surface2 px-2 py-0.5 text-[0.75rem] font-semibold"
										>{m.entry_macros_unknown()}</span
									>{/if}
								{#if e.pending}<span
										class="rounded-menu bg-warn-soft px-2 py-0.5 text-[0.75rem] font-semibold text-warn"
										>{m.entry_pending()}</span
									>{/if}
							</span>
						</span>
						<span class="ml-3 min-w-11 text-right text-[0.9375rem] font-[650] tabular-nums"
							>{kcal(e.nutrients.energy_kcal?.value ?? 0)}</span
						>
					</button>
				</li>
			{/each}
			{#each pending as op (op.seq)}
				{#if op.preview.kind === 'diary'}
					<li class="entry-in">
						<button
							type="button"
							onclick={() => onpending?.(op)}
							class="grid min-h-14 w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-input px-2.5 py-1.5 text-left hover:bg-surface2"
						>
							<FoodIcon name={op.preview.name} />
							<span class="min-w-0">
								<span class="line-clamp-2 text-[0.9375rem] leading-[1.3] font-semibold break-words"
									>{op.preview.name}</span
								>
								<span class="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted">
									{op.preview.quantity}
									<span
										class="rounded-menu bg-warn-soft px-2 py-0.5 text-[0.75rem] font-semibold text-warn"
										>{op.status === 'review' ? m.offline_review_row() : m.entry_pending()}</span
									>
								</span>
							</span>
							<span class="min-w-11 text-right text-[0.9375rem] font-[650] text-muted tabular-nums"
								>{op.preview.kcal === null ? '?' : kcal(op.preview.kcal)}</span
							>
						</button>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
	<div
		class={[
			'flex min-h-14 items-center gap-1 rounded-input px-2.5 transition-[background-color,opacity] has-[.add-food:hover]:bg-surface2',
			selecting && 'pointer-events-none opacity-30'
		]}
	>
		<button
			type="button"
			onclick={onadd}
			aria-label={m.meal_add({ meal: mealName(meal) })}
			class="add-food grid min-h-[52px] min-w-0 flex-1 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 text-left font-[650] text-accent"
		>
			<span class="grid size-10 place-items-center rounded-small bg-soft"
				><Plus size={20} aria-hidden="true" /></span
			>
			<span>{m.meal_add_food()}</span>
		</button>
		{#if bulk && entries.length > 0}
			<MealMenu
				label={m.meal_actions({ meal: mealName(meal) })}
				saveLabel={m.saved_save_label({ meal: mealName(meal) })}
				onsave={() => onsave?.()}
				onselect={() => bulk.onmeal('select')}
				onmove={() => bulk.onmeal('move')}
				oncopy={() => bulk.onmeal('copy')}
				ondelete={() => bulk.onmeal('delete')}
			/>
		{/if}
	</div>
</section>

<style>
	.entry-in {
		animation: entry-in 300ms var(--ui);
	}
	/* The room for the check opens as selecting starts; closed, it takes no space, not even its gap. */
	.check-slot {
		display: grid;
		width: 0;
		margin-right: 0;
		overflow: hidden;
		opacity: 0;
		transition:
			width 300ms var(--ui),
			margin-right 300ms var(--ui),
			opacity 200ms;
	}
	.check-slot.on {
		width: 24px;
		margin-right: 12px;
		opacity: 1;
	}
	@media (prefers-reduced-motion: reduce) {
		.check-slot {
			transition: none;
		}
	}
	@keyframes entry-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.entry-in {
			animation: none;
		}
	}
</style>
