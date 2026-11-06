<script lang="ts">
	// Bottom sheet on phones, a centred dialog from 760 px (docs/ui.md). A native <dialog> provides the focus
	// trap, Escape to close and an inert background.
	import type { Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/paraglide/messages.js';

	let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } =
		$props();
	let dialog: HTMLDialogElement;

	$effect(() => {
		dialog.showModal();
		return () => dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	{onclose}
	onclick={(e) => e.target === dialog && onclose()}
	class="sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-sheet bg-surface p-0 text-text shadow-sheet backdrop:bg-scrim desk:m-auto desk:max-h-[86dvh] desk:w-[480px] desk:rounded-sheet"
>
	<div class="flex flex-col gap-4 p-[18px] pb-[max(18px,env(safe-area-inset-bottom))]">
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-[21px] font-[750]">{title}</h2>
			<button
				type="button"
				onclick={onclose}
				class="grid size-11 place-items-center rounded-full bg-surface2 text-muted"
				aria-label={m.sheet_close()}><X size={20} aria-hidden="true" /></button
			>
		</div>
		{@render children()}
	</div>
</dialog>

<style>
	.sheet[open] {
		animation: slide-up 260ms cubic-bezier(0.2, 0.9, 0.3, 1);
	}
	@media (min-width: 760px) {
		.sheet[open] {
			animation-name: fade-in;
		}
	}
	@keyframes slide-up {
		from {
			transform: translateY(24px);
			opacity: 0.6;
		}
	}
	@keyframes fade-in {
		from {
			transform: scale(0.97);
			opacity: 0;
		}
	}
</style>
