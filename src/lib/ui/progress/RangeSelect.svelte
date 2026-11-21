<script lang="ts">
	// The history's range as a compact dropdown (owner, 2026-10-31): one tone, like the topic tabs' tray beside it,
	// with no raised pill so it never looks like a chosen tab; its own tray keeps it separate. No focus ring on a tap,
	// only for the keyboard. Its list is the shared Menu (owner, 2026-11-21), not the phone's own picker, so a tap
	// elsewhere only closes it and never moves the chart under it.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { m } from '#lib/paraglide/messages.js';
	import { HISTORY_RANGES, type HistoryRange } from '#lib/shared/history.ts';
	import Menu from '../Menu.svelte';

	interface Props {
		id: string;
		value: HistoryRange;
		onchange: (range: string) => void;
	}
	let { id, value, onchange }: Props = $props();
	const names: Record<HistoryRange, () => string> = {
		'1W': m.history_range_1W,
		'1M': m.history_range_1M,
		'3M': m.history_range_3M,
		'1Y': m.history_range_1Y,
		All: m.history_range_All
	};
	const options = $derived(HISTORY_RANGES.map((r) => ({ value: r, label: names[r]() })));
</script>

<div
	class="shrink-0 rounded-[14px] bg-surface2 p-1 has-focus-visible:ring-2 has-focus-visible:ring-accent"
>
	<Menu
		{value}
		{options}
		{id}
		label={m.history_range()}
		{onchange}
		class="relative flex min-h-11 cursor-pointer items-center rounded-[10px] pr-8 pl-3 text-[0.875rem] font-[650] text-text outline-none"
	>
		{names[value]()}
		<ChevronDown
			size={16}
			strokeWidth={2.4}
			aria-hidden="true"
			class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted"
		/>
	</Menu>
</div>
