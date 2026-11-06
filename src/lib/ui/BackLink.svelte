<script lang="ts">
	// The way back from a nested page, the same everywhere.
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	let { href, label }: { href: string; label: string } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- every caller passes resolve(...) -->
<a {href} class="flex items-center gap-1 self-start font-bold text-accent">
	<ChevronLeft size={20} aria-hidden="true" />{label}
</a>
