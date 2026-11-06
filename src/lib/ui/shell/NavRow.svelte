<script lang="ts">
	// A row that opens another page, showing its current value when it has one.
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let { href, label, value }: { href: string; label: string; value?: string | number } = $props();
</script>

<a {href} class="flex min-h-14 items-center justify-between gap-3 py-2 text-[15px] font-semibold">
	<span class="min-w-0">{label}</span>
	<span class="flex shrink-0 items-center gap-1 text-[14px] font-medium text-muted tabular-nums">
		{#if value !== undefined}{value}{/if}
		<ChevronRight size={20} aria-hidden="true" />
	</span>
</a>
