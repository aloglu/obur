<script lang="ts">
	// Today, once the goal weight is reached while the budget still has its deficit (docs/ui.md, "Today"): switch to
	// maintenance, or keep the deficit. Either answer removes it; the setting stays on the Goal page.
	import { m } from '#lib/paraglide/messages.js';
	import { declineMaintain, switchToMaintain } from '#lib/client/maintain.ts';
	import Button from '../Button.svelte';

	let { goalKg }: { goalKg: number } = $props();
	let busy = $state(false);

	async function answer(act: () => Promise<unknown>) {
		busy = true;
		try {
			await act();
		} finally {
			busy = false;
		}
	}
</script>

<section
	class="mb-3 flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-label={m.maintain_offer_title()}
>
	<h2 class="text-[1.1875rem] font-bold text-balance">{m.maintain_offer_title()}</h2>
	<p class="text-[0.90625rem] text-muted">{m.maintain_offer_body()}</p>
	<div class="grid grid-cols-2 gap-2">
		<Button disabled={busy} onclick={() => answer(switchToMaintain)}
			>{m.maintain_offer_yes()}</Button
		>
		<Button variant="ghost" disabled={busy} onclick={() => answer(() => declineMaintain(goalKg))}
			>{m.maintain_offer_no()}</Button
		>
	</div>
</section>
