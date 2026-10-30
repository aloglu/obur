<script lang="ts">
	// docs/ui.md "Edit entry": amount and unit (or kcal for quick adds), Save changes; "Move to…" lists meals with the
	// current one disabled; Delete is immediate and the toast offers Undo.
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { householdMeasures } from '#lib/client/measures.ts';
	import { snapshotNutrients } from '#lib/shared/diary-rules.ts';
	import { MEALS, type DiaryEntry, type Meal } from '#lib/shared/diary-types.ts';
	import { kcal, mealName } from '#lib/shared/format.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import { optionKeyFor, unitOptions, type MeasureOption } from '#lib/shared/unit-options.ts';
	import Button from '../Button.svelte';
	import Chips from '../Chips.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import TextField from '../TextField.svelte';

	interface Props {
		entry: DiaryEntry;
		onsaved: (entry: DiaryEntry, movedTo?: Meal) => void;
		ondeleted: (entry: DiaryEntry) => void;
		onconflict: () => void;
		onclose: () => void;
	}
	let { entry, onsaved, ondeleted, onconflict, onclose }: Props = $props();
	const start = untrack(() => entry);

	let measures = $state<MeasureOption[]>([]);
	let optionKey = $state(start.unit ? optionKeyFor(start.unit) : '');
	let amountText = $state(start.amount !== null ? formatDecimal(start.amount, ',', 2) : '');
	let kcalText = $state(formatDecimal(start.nutrients.energy_kcal?.value ?? 0, ',', 0));
	let description = $state(start.description ?? '');
	let moving = $state(false);
	let busy = $state(false);
	let problem = $state('');

	onMount(async () => (measures = await householdMeasures()));

	const snapshot = start.food;
	const options = $derived(
		snapshot ? unitOptions(snapshot, measures, start.unit?.kind === 'basis_serving') : []
	);
	const option = $derived(options.find((o) => o.key === optionKey));
	const amount = $derived(parseDecimal(amountText));
	const kcalValue = $derived(parseDecimal(kcalText));
	const name =
		start.kind === 'quick'
			? (start.description ?? m.entry_quick())
			: `${snapshot?.brand ? `${snapshot.brand} ` : ''}${snapshot?.name ?? ''}`;

	const storedUnit = $derived.by(() => {
		const i = option?.input;
		if (!i) return undefined;
		if (i.kind === 'measure') {
			const mm = measures.find((x) => x.code === i.code);
			return mm && { kind: 'measure' as const, code: mm.code, name: mm.name, ml: mm.ml };
		}
		if (i.kind === 'serving') {
			const s = snapshot?.servings.find((x) => x.id === i.servingId);
			return (
				s && {
					kind: 'serving' as const,
					servingId: s.id,
					name: s.name,
					amount: s.amount,
					unit: s.unit
				}
			);
		}
		return i;
	});
	const previewKcal = $derived.by(() => {
		if (!snapshot || !storedUnit || amount === undefined) return undefined;
		return snapshotNutrients(snapshot, amount, storedUnit)?.energy_kcal?.value;
	});

	async function patch(body: Record<string, unknown>, movedTo?: Meal) {
		busy = true;
		problem = '';
		try {
			onsaved(
				await api<DiaryEntry>('PATCH', `/api/v1/diary/entries/${start.id}`, {
					revision: start.revision,
					...body
				}),
				movedTo
			);
		} catch (e) {
			if (e instanceof ApiError && (e.code === 'conflict' || e.code === 'not_found')) onconflict();
			else problem = m.error_generic();
		} finally {
			busy = false;
		}
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (start.kind === 'quick') {
			if (kcalValue !== undefined) patch({ kcal: kcalValue, description: description || null });
		} else if (option && amount !== undefined) {
			patch({ amount, unit: option.input });
		}
	}

	async function remove() {
		busy = true;
		try {
			ondeleted(
				await api<DiaryEntry>('POST', `/api/v1/diary/entries/${start.id}?action=delete`, {})
			);
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<Sheet title={m.edit_title()} {onclose}>
	<p class="line-clamp-2 text-[15px] font-semibold break-words">{name}</p>
	<form class="flex flex-col gap-4" onsubmit={save}>
		{#if start.kind === 'quick'}
			<TextField label={m.quick_kcal()} bind:value={kcalText} inputmode="decimal" />
			<TextField label={m.quick_description()} bind:value={description} maxlength={200} />
		{:else}
			<div class="flex flex-col gap-1.5">
				<label for="edit-amount" class="text-[13px] font-[650] text-muted"
					>{m.amount_amount()}</label
				>
				<input
					id="edit-amount"
					bind:value={amountText}
					inputmode="decimal"
					autocomplete="off"
					class="min-h-12 rounded-input border border-line bg-surface2 px-3.5 text-[20px] font-bold tabular-nums"
				/>
			</div>
			<Chips
				label={m.amount_unit()}
				bind:value={optionKey}
				options={options.map((o) => ({ value: o.key, label: o.label }))}
			/>
			<p class="text-[15px] font-semibold tabular-nums" aria-live="polite">
				{previewKcal === undefined ? '—' : m.amount_preview({ kcal: kcal(previewKcal) })}
			</p>
		{/if}
		{#if problem}<Notice>{problem}</Notice>{/if}
		<Button type="submit" wide disabled={busy}>{m.edit_save()}</Button>
	</form>

	<Button variant="ghost" aria-expanded={moving} onclick={() => (moving = !moving)}
		>{m.edit_move()}</Button
	>
	{#if moving}
		<ul class="flex flex-col gap-1.5">
			{#each MEALS as meal (meal)}
				<li>
					<button
						type="button"
						disabled={busy || meal === start.meal}
						onclick={() => patch({ meal }, meal)}
						class="min-h-12 w-full rounded-menu bg-surface2 px-3.5 text-left text-[15px] font-semibold disabled:opacity-50"
					>
						{meal === start.meal ? m.edit_current_meal({ meal: mealName(meal) }) : mealName(meal)}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<Button variant="danger" disabled={busy} onclick={remove}>{m.edit_delete()}</Button>
</Sheet>
