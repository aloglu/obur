<script lang="ts">
	// docs/ui.md "More and settings": Time is per device. Weight is kilograms until pounds are built.
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { setTimeFormat, type TimeFormat } from '#lib/client/prefs.ts';
	import MenuRow from '#lib/ui/MenuRow.svelte';

	let { data } = $props();
	let time = $state<TimeFormat>(untrack(() => data.timeFormat));

	function change(next: TimeFormat) {
		setTimeFormat(next);
		void invalidateAll();
	}
</script>

<svelte:head><title>{m.more_units()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<a href={resolve('/(app)/more')} class="flex items-center gap-1 self-start font-bold text-accent">
		<ChevronLeft size={20} aria-hidden="true" />{m.nav_more()}
	</a>
	<h1 class="text-[24px] font-[750]">{m.more_units()}</h1>
	<div class="flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card">
		<div class="flex min-h-14 items-center justify-between gap-3 text-[15px] font-semibold">
			{m.units_weight()}<span class="text-[14px] font-medium text-muted">kg</span>
		</div>
		<MenuRow
			label={m.units_time()}
			bind:value={time}
			onchange={change}
			options={[
				{ value: 'device', label: m.time_device() },
				{ value: '24', label: m.time_24() },
				{ value: '12', label: m.time_12() }
			]}
		/>
	</div>
</main>
