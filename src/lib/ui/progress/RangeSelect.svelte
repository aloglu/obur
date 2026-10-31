<script lang="ts">
	// The history's range as a compact dropdown (owner, 2026-10-31): one tone, like the topic tabs' tray beside it,
	// with no raised pill so it never looks like a chosen tab; its own tray keeps it separate. No focus ring on a tap,
	// only for the keyboard. A native select keeps the phone's own picker and screen reader support.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { m } from '#lib/paraglide/messages.js';
	import { HISTORY_RANGES, type HistoryRange } from '#lib/shared/history.ts';

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
</script>

<label for={id} class="sr-only">{m.history_range()}</label>
<div
	class="shrink-0 rounded-[14px] bg-surface2 p-1 has-focus-visible:ring-2 has-focus-visible:ring-accent"
>
	<div class="relative">
		<select
			{id}
			{value}
			onchange={(e) => onchange(e.currentTarget.value)}
			class="min-h-11 cursor-pointer appearance-none rounded-[10px] bg-transparent py-0 pr-8 pl-3 text-[14px] font-[650] text-text outline-none"
		>
			{#each HISTORY_RANGES as r (r)}<option value={r}>{names[r]()}</option>{/each}
		</select>
		<ChevronDown
			size={16}
			strokeWidth={2.4}
			aria-hidden="true"
			class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted"
		/>
	</div>
</div>
