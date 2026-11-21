<script lang="ts">
	// The history's range, styled like a settings row's value (owner, 2026-11-21): muted text and a small arrow, no
	// tray, so it doesn't compete with the Weight / Calories / Nutrients tabs below. Its list is the shared Menu, so a
	// tap elsewhere only closes it. The button keeps a 44 px target.
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

<Menu
	{value}
	{options}
	{id}
	label={m.history_range()}
	{onchange}
	class="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-small pl-2 text-[0.875rem] font-medium text-muted focus-visible:outline-2 focus-visible:outline-accent"
>
	{names[value]()}<ChevronDown size={18} aria-hidden="true" />
</Menu>
