<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { dayTitle, longDate } from '#lib/shared/format.ts';

	let { date, today, onmove }: { date: string; today: string; onmove: (days: number) => void } =
		$props();
</script>

<header class="flex min-h-[60px] items-center gap-2">
	<button
		type="button"
		onclick={() => onmove(-1)}
		aria-label={m.day_previous()}
		class="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-text shadow-card"
	>
		<ChevronLeft size={22} aria-hidden="true" />
	</button>
	<div class="min-w-0 flex-1 text-center desk:text-left">
		<h1 class="text-[24px] leading-tight font-[750]">{dayTitle(date, today)}</h1>
		<p class="text-[13px] text-muted">{longDate(date)}</p>
	</div>
	<button
		type="button"
		onclick={() => onmove(1)}
		disabled={date >= today}
		aria-label={m.day_next()}
		class="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-text shadow-card disabled:opacity-35"
	>
		<ChevronRight size={22} aria-hidden="true" />
	</button>
</header>
