<script lang="ts">
	// docs/ui.md "Meal cards": total, + button, entry rows with a two-line clamped name, quantity, badges and kcal.
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/paraglide/messages.js';
	import type { DiaryEntry, Meal } from '#lib/shared/diary-types.ts';
	import type { QueuedOp } from '#lib/client/offline/store.ts';
	import { kcal, mealName, quantityText } from '#lib/shared/format.ts';

	interface Props {
		meal: Meal;
		entries: DiaryEntry[];
		highlight?: string;
		onadd: () => void;
		onopen: (entry: DiaryEntry) => void;
		/** Entries kept on this device and not yet on the server. */
		pending?: QueuedOp[];
		onpending?: (op: QueuedOp) => void;
	}
	let { meal, entries, highlight, onadd, onopen, pending = [], onpending }: Props = $props();

	const total = $derived(
		entries.reduce((sum, e) => sum + (e.nutrients.energy_kcal?.value ?? 0), 0)
	);
	const name = (e: DiaryEntry) =>
		e.kind === 'quick'
			? (e.description ?? m.entry_quick())
			: `${e.food?.brand ? `${e.food.brand} ` : ''}${e.food?.name ?? ''}`;
	const quantity = (e: DiaryEntry) =>
		e.kind === 'quick'
			? m.entry_quick()
			: quantityText(e.amount!, e.unit!, e.food?.servingLabel ?? null);
</script>

<section class="rounded-card bg-surface p-[18px] shadow-card" aria-labelledby="meal-{meal}">
	<div class="flex items-center justify-between gap-3">
		<h2 id="meal-{meal}" class="text-[19px] font-bold">{mealName(meal)}</h2>
		<div class="flex items-center gap-3">
			<span class="text-[15px] font-semibold text-muted tabular-nums">{kcal(total)} kcal</span>
			<button
				type="button"
				onclick={onadd}
				aria-label={m.meal_add({ meal: mealName(meal) })}
				class="grid size-11 place-items-center rounded-full bg-soft text-accent"
			>
				<Plus size={22} aria-hidden="true" />
			</button>
		</div>
	</div>
	{#if entries.length === 0 && pending.length === 0}
		<p class="mt-1 text-[14px] text-muted">{m.meal_empty()}</p>
	{:else}
		<ul class="mt-2 flex flex-col">
			{#each entries as e (e.id)}
				<li>
					<button
						type="button"
						onclick={() => onopen(e)}
						class={[
							'flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left transition-colors duration-700',
							e.id === highlight ? 'bg-soft' : 'hover:bg-surface2'
						]}
					>
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 text-[15px] font-semibold break-words">{name(e)}</span>
							<span class="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
								{quantity(e)}
								{#if e.kind === 'quick'}<span
										class="rounded-full bg-surface2 px-2 py-0.5 text-[12px] font-semibold"
										>{m.entry_macros_unknown()}</span
									>{/if}
								{#if e.pending}<span
										class="rounded-full bg-warn-soft px-2 py-0.5 text-[12px] font-semibold text-warn"
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
							<span class="min-w-0 flex-1">
								<span class="line-clamp-2 text-[15px] font-semibold break-words"
									>{op.preview.name}</span
								>
								<span class="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
									{op.preview.quantity}
									<span
										class="rounded-full bg-warn-soft px-2 py-0.5 text-[12px] font-semibold text-warn"
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
