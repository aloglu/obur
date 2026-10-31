<script lang="ts">
	// The history's range as a compact dropdown (owner, 2026-10-31): styled like the topic tabs beside it (a tray
	// with the chosen value as a raised pill) but in its own tray, so it reads as a separate control. A native select
	// underneath keeps the phone's own picker and screen reader support.
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
<div class="shrink-0 rounded-[14px] bg-surface2 p-1">
	<div class="relative">
		<select
			{id}
			{value}
			onchange={(e) => onchange(e.currentTarget.value)}
			class="min-h-11 cursor-pointer appearance-none rounded-[10px] bg-surface py-0 pr-8 pl-3 text-[14px] font-[650] text-text shadow-card"
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
