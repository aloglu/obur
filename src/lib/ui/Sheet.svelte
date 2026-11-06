<script lang="ts">
	// Bottom sheet on phones, a centred dialog from 760 px (docs/ui.md). A native <dialog> provides the focus trap and an
	// inert background; the page behind is held still while it is open. It slides in and out, with the scrim fading.
	import type { Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { lockPageScroll } from '#lib/client/scroll-lock.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } =
		$props();
	let dialog: HTMLDialogElement;
	let scrolled = 0;

	$effect(() => {
		const opener = document.activeElement as HTMLElement | null;
		const unlock = lockPageScroll();
		let usedKeys = false;
		const onkey = () => (usedKeys = true);
		window.addEventListener('keydown', onkey, { capture: true });
		dialog.showModal();
		return () => {
			// The sheet itself goes at once, so the page is usable straight away and opening it again gets a fresh one. What
			// slides off the screen is a lifeless copy.
			const copy = dialog.cloneNode(true) as HTMLDialogElement;
			dialog.close();
			unlock();
			window.removeEventListener('keydown', onkey, { capture: true });
			if (opener && document.activeElement === document.body) {
				// Focus goes back for assistive tech and keyboards; after a tap, no ring around the button.
				if (!usedKeys) {
					opener.toggleAttribute('data-quiet-focus', true);
					opener.addEventListener('blur', () => opener.removeAttribute('data-quiet-focus'), {
						once: true
					});
				}
				opener.focus({ preventScroll: true });
			}
			slideAway(copy, scrolled);
		};
	});

	function slideAway(copy: HTMLDialogElement, top: number) {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const wide = matchMedia('(min-width: 760px)').matches;
		for (const el of copy.querySelectorAll('[id]')) el.removeAttribute('id');
		copy.inert = true;
		copy.setAttribute('aria-hidden', 'true');
		Object.assign(copy.style, {
			position: 'fixed',
			inset: '0',
			zIndex: '60',
			pointerEvents: 'none',
			animation: 'none'
		});
		document.body.append(copy);
		copy.scrollTop = top;
		const scrim = 'color-mix(in srgb, var(--scrim) 100%, transparent)';
		const none = 'color-mix(in srgb, var(--scrim) 0%, transparent)';
		const spread = '0 0 0 200vmax';
		const frames = wide
			? [
					{ opacity: 1, transform: 'none', boxShadow: `${spread} ${scrim}` },
					{ opacity: 0, transform: 'translateY(3%) scale(0.98)', boxShadow: `${spread} ${none}` }
				]
			: [
					{ transform: 'none', boxShadow: `${spread} ${scrim}` },
					{ transform: 'translateY(105%)', boxShadow: `${spread} ${none}` }
				];
		copy
			.animate(frames, {
				duration: wide ? 200 : 260,
				easing: 'cubic-bezier(0.3, 0.75, 0.1, 1)',
				fill: 'forwards'
			})
			.finished.finally(() => copy.remove());
	}
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	{onclose}
	onscroll={() => (scrolled = dialog.scrollTop)}
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
	onclick={(e) => e.target === dialog && onclose()}
	class="sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-sheet bg-surface p-0 text-text shadow-sheet backdrop:bg-scrim desk:m-auto desk:max-h-[86dvh] desk:w-[480px] desk:rounded-sheet"
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
		animation: sheet-in 360ms var(--ui);
	}
	.sheet::backdrop {
		animation: scrim-in 240ms ease;
	}
	@media (min-width: 760px) {
		.sheet[open] {
			animation: dialog-in 260ms var(--ui);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet[open],
		.sheet::backdrop {
			animation: none;
		}
	}
	@keyframes sheet-in {
		from {
			transform: translateY(105%);
		}
	}
	@keyframes dialog-in {
		from {
			transform: translateY(3%) scale(0.98);
			opacity: 0;
		}
	}
	@keyframes scrim-in {
		from {
			opacity: 0;
		}
	}
</style>
