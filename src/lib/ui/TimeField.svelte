<script lang="ts">
	// Just the time (docs/ui.md, "Reminders"): the whole value opens the system's picker. The input lies invisibly over the
	// value, so phones open it directly; desktop browsers need asking.
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { clockTime } from '#lib/client/prefs.ts';

	interface Props {
		value: string;
		label: string;
		tabbable?: boolean;
		onchange: (value: string) => void;
	}
	let { value, label, tabbable = true, onchange }: Props = $props();
	// The device's own format is only known in the browser, so the page first shows the value as it is stored.
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const shown = $derived(
		mounted
			? clockTime(new Date(`2000-01-01T${value}`).toISOString(), page.data.timeFormat ?? 'device')
			: value
	);
</script>

<span
	class="relative inline-flex h-9 items-center rounded-[10px] bg-surface2 px-3 text-[14px] font-[650] whitespace-nowrap tabular-nums focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
>
	{shown}
	<input
		type="time"
		{value}
		aria-label={label}
		tabindex={tabbable ? undefined : -1}
		onclick={(e) => {
			try {
				e.currentTarget.showPicker();
			} catch {
				// Phones have already opened it.
			}
		}}
		onchange={(e) => {
			if (e.currentTarget.value) onchange(e.currentTarget.value.slice(0, 5));
		}}
		class="absolute inset-0 size-full cursor-pointer text-[16px] opacity-0"
	/>
</span>
