<script lang="ts">
	// The top of a nested page, the same everywhere (docs/ui.md, "More and settings"): an accent "<" that goes one
	// level up, the title beside it, and room at the end for a menu. The "<" is named after where it leads.
	import type { Snippet } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	interface Props {
		href: string;
		/** Where the "<" leads, for screen readers ("Settings"). */
		label: string;
		title?: string;
		end?: Snippet;
	}
	let { href, label, title, end }: Props = $props();
</script>

<!-- The negative margins keep the title where it sits on pages without a "<", and the arrow on the cards' edge. -->
<div class="page-head -my-1 flex items-start gap-0.5">
	<!-- eslint-disable svelte/no-navigation-without-resolve -- every caller passes resolve(...) -->
	<a
		{href}
		aria-label={label}
		class="-ml-2.5 grid size-11 shrink-0 place-items-center rounded-full text-accent"
	>
		<ChevronLeft size={24} aria-hidden="true" />
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{#if title}
		<h1 class="min-w-0 flex-1 py-1 text-[1.5rem] font-[750] break-words">{title}</h1>
	{/if}
	{#if end}<div class="-mr-2 shrink-0">{@render end()}</div>{/if}
</div>
