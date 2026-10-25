<script lang="ts">
	// docs/ui.md "Water and weight": decimal-comma weight input. "Same as last time" records a new, genuinely
	// measured reading; it never copies an old one into a day (docs/design.md, "Progress").
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { offline, submit } from '#lib/client/offline/sync.svelte.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { BodyReading } from '#lib/shared/body-types.ts';
	import { dayTitle } from '#lib/shared/format.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';

	interface Props {
		date: string;
		today: string;
		latest: BodyReading | null;
		onchange: () => Promise<void>;
	}
	let { date, today, latest, onchange }: Props = $props();
	let text = $state('');
	let busy = $state(false);
	const pendingKg = $derived(
		offline.items.findLast(
			(i) => i.status === 'pending' && i.preview.kind === 'weight' && i.preview.localDate === date
		)
	);
	const kg = $derived(parseDecimal(text));
	const invalid = $derived(text.trim() !== '' && (kg === undefined || kg <= 0 || kg >= 700));

	async function save(value: number) {
		busy = true;
		try {
			const result = await submit<{ id: string }>(
				'/api/v1/body/weight',
				{ id: crypto.randomUUID(), date, zone: deviceZone(), value },
				{ kind: 'weight', localDate: date, kg: value }
			);
			text = '';
			if (result.status === 'queued') {
				showToast({ message: m.offline_saved(), detail: m.offline_saved_detail() });
				return;
			}
			const r = result.data;
			await onchange();
			showToast({
				message: m.toast_weight({ kg: formatDecimal(value, ',', 2) }),
				undo: async () => {
					await api('POST', `/api/v1/body/weight/${r.id}?action=delete`, {});
					await onchange();
				}
			});
		} finally {
			busy = false;
		}
	}
</script>

<section
	class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-labelledby="weight-title"
>
	<h2 id="weight-title" class="text-[19px] font-bold">{m.weight_title()}</h2>
	<p class="text-[13px] text-muted">
		{latest
			? m.weight_last({
					kg: formatDecimal(latest.value, ',', 2),
					day: dayTitle(latest.localDate, today)
				})
			: m.weight_none()}
	</p>
	{#if pendingKg?.preview.kind === 'weight'}
		<p class="text-[13px] font-semibold text-warn">
			{m.offline_weight_pending({ kg: formatDecimal(pendingKg.preview.kg, ',', 2) })}
		</p>
	{/if}
	<form
		class="flex gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			if (kg !== undefined && !invalid) save(kg);
		}}
	>
		<label class="sr-only" for="weight-input">{m.weight_input()}</label>
		<input
			id="weight-input"
			bind:value={text}
			inputmode="decimal"
			autocomplete="off"
			placeholder="kg"
			aria-invalid={invalid}
			class="min-h-11 w-0 flex-1 rounded-input border border-line bg-surface2 px-3 text-[16px] font-semibold tabular-nums"
		/>
		<button
			type="submit"
			disabled={busy || kg === undefined || invalid}
			class="min-h-11 rounded-input bg-accent px-4 text-[15px] font-bold text-on-accent disabled:opacity-50"
			>{m.weight_save()}</button
		>
	</form>
	{#if invalid}<p class="text-[13px] text-bad">{m.weight_invalid()}</p>{/if}
	{#if latest && latest.localDate !== date}
		<button
			type="button"
			disabled={busy}
			onclick={() => save(latest.value)}
			class="min-h-11 rounded-input border border-line text-[14px] font-semibold"
		>
			{m.weight_same({ kg: formatDecimal(latest.value, ',', 2) })}
		</button>
	{/if}
</section>
