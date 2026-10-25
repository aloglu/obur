<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { dayTitle, kcal } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import Card from '#lib/ui/Card.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let { data } = $props();
	const t = $derived(data.target);
	// Suggest recalculating after a few kilos of change (docs/design.md).
	const change = $derived.by(() => {
		const before = t?.inputs?.weightKg;
		if (t?.mode !== 'calculated' || typeof before !== 'number' || !data.latestWeight) return 0;
		return data.latestWeight.value - before;
	});
</script>

<svelte:head><title>{m.profile_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[24px] font-[750]">{m.profile_title()}</h1>
	<Card title={m.profile_target()}>
		{#if t?.mode === 'calculated'}
			<p class="text-[15px] tabular-nums">
				{m.profile_target_calculated({
					base: kcal(t.baseBurnKcal ?? 0),
					deficit: kcal(t.deficitKcal),
					floor: kcal(t.floorKcal)
				})}
			</p>
		{:else if t?.mode === 'manual'}
			<p class="text-[15px] tabular-nums">
				{m.profile_target_manual({ kcal: kcal(t.baseBurnKcal ?? 0) })}
			</p>
		{:else}
			<p class="text-[15px]">{m.profile_target_none()}</p>
		{/if}
		{#if t}<p class="text-[13px] text-muted">
				{m.profile_since({ day: dayTitle(t.effectiveFrom, data.today) })}
			</p>{/if}
		{#if Math.abs(change) >= 3}
			<Notice tone="info"
				>{m.profile_recalc_hint({ kg: formatDecimal(Math.abs(change), ',', 1) })}</Notice
			>
		{/if}
		<a
			href={resolve('/(app)/onboarding')}
			class="inline-flex min-h-11 items-center self-start rounded-button bg-accent px-4 font-[750] text-on-accent"
		>
			{t ? m.profile_recalc() : m.profile_setup()}
		</a>
	</Card>
</main>
