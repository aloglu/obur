<script lang="ts">
	// A list card whose rows can be selected (docs/ui.md, "Archived and deleted"): the list's name and count at the left,
	// and Select at the right, which becomes Select all, then Clear, while selecting.
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		title: string;
		/** The whole list's size, shown after the title. */
		count?: number;
		selecting: boolean;
		/** Everything is selected: the button clears instead. */
		allSelected: boolean;
		onselect: () => void;
		onselectall: () => void;
		onclear: () => void;
		children: Snippet;
		/** Below the rows (Show more). */
		footer?: Snippet;
	}
	let {
		title,
		count,
		selecting,
		allSelected,
		onselect,
		onselectall,
		onclear,
		children,
		footer
	}: Props = $props();
</script>

<section class="flex flex-col rounded-card bg-surface px-[18px] pb-2 shadow-card">
	<div class="flex min-h-11 items-center justify-between gap-3 pt-1">
		<h2 class="text-[0.78125rem] font-[650] text-muted">
			<span class="tabular-nums">{count === undefined ? title : `${title} · ${count}`}</span>
		</h2>
		<button
			type="button"
			class="-mr-1 min-h-11 px-1 text-[0.875rem] font-[650] text-accent"
			onclick={selecting ? (allSelected ? onclear : onselectall) : onselect}
			>{selecting ? (allSelected ? m.list_clear() : m.list_select_all()) : m.list_select()}</button
		>
	</div>
	<ul class="-mx-2.5 flex flex-col">{@render children()}</ul>
	{@render footer?.()}
</section>
