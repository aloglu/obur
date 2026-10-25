<script lang="ts">
	// docs/ui.md "Water and weight": +250 / +500 ml buttons; each addition can be undone from the toast.
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';

	let {
		date,
		totalMl,
		onchange
	}: { date: string; totalMl: number; onchange: () => Promise<void> } = $props();
	let busy = $state(false);

	async function add(ml: number) {
		busy = true;
		try {
			const r = await api<{ id: string }>('POST', '/api/v1/body/water', {
				id: crypto.randomUUID(),
				date,
				zone: deviceZone(),
				value: ml
			});
			await onchange();
			showToast({
				message: m.toast_water({ ml: String(ml) }),
				undo: async () => {
					await api('POST', `/api/v1/body/water/${r.id}?action=delete`, {});
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
	aria-labelledby="water-title"
>
	<h2 id="water-title" class="text-[19px] font-bold">{m.water_title()}</h2>
	<p class="font-display text-[28px] leading-none font-extrabold tabular-nums">
		{m.water_total({ ml: formatDecimal(totalMl, ',', 0) })}
	</p>
	<div class="flex flex-wrap gap-2">
		{#each [250, 500] as ml (ml)}
			<button
				type="button"
				disabled={busy}
				onclick={() => add(ml)}
				aria-label={m.water_add_label({ ml: String(ml) })}
				class="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-soft px-3 text-[15px] font-bold text-accent disabled:opacity-50"
			>
				<Plus size={18} aria-hidden="true" />{ml} ml
			</button>
		{/each}
	</div>
</section>
