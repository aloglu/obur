<script lang="ts">
	// One day's ring, in the Journal's calendar and in Help's examples: filled by eaten ÷ budget. Green only for complete days
	// at or under budget, with a gap that never closes; a full red ring when over; neutral for logged but incomplete days;
	// track only when nothing was logged. It takes the size of its parent.
	import type { CalendarDay } from '#lib/shared/calendar.ts';

	let { status, fill }: Pick<CalendarDay, 'status' | 'fill'> = $props();

	const R = 15;
	const C = 2 * Math.PI * R;
	const colour = $derived(
		status === 'under' ? 'var(--good)' : status === 'over' ? 'var(--bad)' : 'var(--muted)'
	);
	// A day within budget never closes its ring, even exactly at it: a closed ring means over.
	const shown = $derived(status === 'over' ? fill : Math.min(fill, 0.92));
</script>

<svg viewBox="0 0 36 36" class="size-full -rotate-90" aria-hidden="true">
	<circle cx="18" cy="18" r={R} fill="none" stroke="var(--track)" stroke-width="3.5" />
	{#if status !== 'unlogged' && fill > 0}
		<circle
			cx="18"
			cy="18"
			r={R}
			fill="none"
			stroke={colour}
			stroke-width="3.5"
			stroke-linecap={status === 'over' ? 'butt' : 'round'}
			stroke-dasharray={C}
			stroke-dashoffset={C * (1 - shown)}
		/>
	{/if}
</svg>
