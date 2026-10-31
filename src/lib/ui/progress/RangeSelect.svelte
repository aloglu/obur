<script lang="ts">
	// The history's range as a compact dropdown (owner, 2026-10-31): 1W, 1M, 3M, 1Y or All, with full names for
	// screen readers.
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
<select
	{id}
	{value}
	onchange={(e) => onchange(e.currentTarget.value)}
	class="min-h-11 shrink-0 cursor-pointer rounded-[12px] border border-line bg-surface px-3 text-[14px] font-[650]"
>
	{#each HISTORY_RANGES as r (r)}<option value={r}>{names[r]()}</option>{/each}
</select>
