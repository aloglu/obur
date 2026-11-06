<script lang="ts">
	// docs/ui.md "Meal cards": total, + button, entry rows with a two-line clamped name, quantity, badges and kcal.
	// Bulk actions ("Bulk actions"): the … menu, holding a row to select it or drag it to another meal (the card is
	// a drop target), and, while selecting, a round check on each row that a tap toggles. Ctrl/⌘-click also selects.
	import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import { holdDrag } from '#lib/client/hold-drag.ts';
	import { m } from '#lib/paraglide/messages.js';
	import type { DiaryEntry, Meal } from '#lib/shared/diary-types.ts';
	import type { QueuedOp } from '#lib/client/offline/store.ts';
	import FoodIcon from '../FoodIcon.svelte';
	import MealMenu from './MealMenu.svelte';
	import { entryName, entryQuantity, kcal, mealName } from '#lib/shared/format.ts';

	interface Props {
		meal: Meal;
		entries: DiaryEntry[];
		highlight?: string;
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
</script>

<section
	class="rounded-card bg-surface p-[18px] shadow-card"
	aria-labelledby="meal-{meal}"
	data-meal-drop={bulk ? meal : undefined}
>
	<div class="flex items-center justify-between gap-3">
		<h2 id="meal-{meal}" class="text-[19px] font-bold">{mealName(meal)}</h2>
		<!-- Two small round icon buttons, alike but for colour; each keeps a 44 px tap target around its 36 px circle. -->
		<div class="-mr-1 flex items-center">
			<span class="mr-1.5 text-[15px] font-semibold text-muted tabular-nums"
				>{kcal(total)} kcal</span
			>
			{#if !selecting}
				{#if onsave && entries.length > 0}
					<button
						type="button"
						onclick={onsave}
						aria-label={m.saved_save_label({ meal: mealName(meal) })}
						class="group grid size-11 place-items-center"
					>
						<span
							class="grid size-9 place-items-center rounded-full bg-surface2 text-muted group-hover:text-text"
							><BookmarkPlus size={18} aria-hidden="true" /></span
						>
					</button>
				{/if}
				<button
					type="button"
					onclick={onadd}
					aria-label={m.meal_add({ meal: mealName(meal) })}
					class="grid size-11 place-items-center"
				>
					<span class="grid size-9 place-items-center rounded-full bg-soft text-accent"
						><Plus size={20} aria-hidden="true" /></span
					>
				</button>
				{#if bulk && entries.length > 0}
					<MealMenu
						label={m.meal_actions({ meal: mealName(meal) })}
						onselect={() => bulk.onmeal('select')}
						onmove={() => bulk.onmeal('move')}
						oncopy={() => bulk.onmeal('copy')}
						ondelete={() => bulk.onmeal('delete')}
					/>
				{/if}
			{/if}
		</div>
	</div>
	{#if entries.length === 0 && pending.length === 0}
		<p class="mt-1 text-[14px] text-muted">{m.meal_empty()}</p>
	{:else}
		<ul class="-mx-2 mt-2 flex flex-col gap-0.5">
			{#each entries as e (e.id)}
				{@const on = bulk?.selected.has(e.id) ?? false}
				<li>
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
							'flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left transition-colors duration-700',
							on || e.id === highlight ? 'bg-soft' : 'hover:bg-surface2',
							bulk?.lifted.has(e.id) && 'opacity-35'
						]}
					>
						{#if selecting}
							<span
								class={[
									'grid size-6 shrink-0 place-items-center rounded-full border-2',
									on ? 'border-accent bg-fill text-on-accent' : 'border-muted bg-surface'
								]}
								aria-hidden="true"
								>{#if on}<Check size={14} strokeWidth={3} />{/if}</span
							>
						{/if}
						<FoodIcon
							icon={e.food?.icon}
							name={e.kind === 'quick' ? (e.description ?? '') : (e.food?.name ?? '')}
							brand={e.food?.brand}
						/>
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 text-[15px] font-semibold break-words">{entryName(e)}</span>
							<span class="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
								{entryQuantity(e)}
								{#if e.kind === 'quick'}<span
										class="rounded-menu bg-surface2 px-2 py-0.5 text-[12px] font-semibold"
										>{m.entry_macros_unknown()}</span
									>{/if}
								{#if e.pending}<span
										class="rounded-menu bg-warn-soft px-2 py-0.5 text-[12px] font-semibold text-warn"
										>{m.entry_pending()}</span
									>{/if}
							</span>
						</span>
						<span class="shrink-0 text-[15px] font-semibold tabular-nums"
							>{kcal(e.nutrients.energy_kcal?.value ?? 0)}</span
						>
					</button>
				</li>
			{/each}
			{#each pending as op (op.seq)}
				{#if op.preview.kind === 'diary'}
					<li>
						<button
							type="button"
							onclick={() => onpending?.(op)}
							class="flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left hover:bg-surface2"
						>
							<FoodIcon name={op.preview.name} />
							<span class="min-w-0 flex-1">
								<span class="line-clamp-2 text-[15px] font-semibold break-words"
									>{op.preview.name}</span
								>
								<span class="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
									{op.preview.quantity}
									<span
										class="rounded-menu bg-warn-soft px-2 py-0.5 text-[12px] font-semibold text-warn"
										>{op.status === 'review' ? m.offline_review() : m.entry_pending()}</span
									>
								</span>
							</span>
							<span class="shrink-0 text-[15px] font-semibold text-muted tabular-nums"
								>{op.preview.kcal === null ? '?' : kcal(op.preview.kcal)}</span
							>
						</button>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</section>
