<script lang="ts">
	// docs/ui.md "Day titles". ← and → also move between days, unless the keys are being used in a field or a sheet.
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { dayHeading } from '#lib/shared/format.ts';

	let { date, today, onmove }: { date: string; today: string; onmove: (days: number) => void } =
		$props();
	const heading = $derived(dayHeading(date, today));

	$effect(() => {
		const keys = (event: KeyboardEvent) => {
			const target = event.target as Element;
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
			if (target.closest('input, textarea, select, dialog, [popover], [contenteditable]')) return;
			if (event.key === 'ArrowLeft') onmove(-1);
			else if (event.key === 'ArrowRight' && date < today) onmove(1);
		};
		window.addEventListener('keydown', keys);
		return () => window.removeEventListener('keydown', keys);
	});
</script>

<header class="grid min-h-[60px] grid-cols-[44px_minmax(0,1fr)_44px] items-center text-center">
	<button
		type="button"
		onclick={() => onmove(-1)}
		aria-label={m.day_previous()}
		class="grid size-11 place-items-center rounded-full text-text"
	>
		<ChevronLeft size={24} aria-hidden="true" />
	</button>
	{#key heading.title}
		<div class="title-in min-w-0">
			<h1 class="text-[1.5rem] leading-tight font-[750]">{heading.title}</h1>
			<p class="mt-0.5 text-[0.8125rem] text-muted">{heading.detail}</p>
		</div>
	{/key}
	<button
		type="button"
		onclick={() => onmove(1)}
		disabled={date >= today}
		aria-label={m.day_next()}
		class="grid size-11 place-items-center rounded-full text-text disabled:text-line"
	>
		<ChevronRight size={24} aria-hidden="true" />
	</button>
</header>

<style>
	.title-in {
		animation: title-in 200ms var(--ui);
	}
	@keyframes title-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.title-in {
			animation: none;
		}
	}
</style>
