<script lang="ts">
	// Bottom sheet on phones, a centred dialog from 760 px (docs/ui.md). A native <dialog> provides the focus trap and an
	// inert background; the page behind is held still while it is open. It slides in and out, with the scrim fading.
	// It stays inside the part of the screen the keyboard leaves free, however tall its content grows. `pinned` stays in
	// place under the title while the rest scrolls; `resizes` makes changes in height smooth instead of a jump.
	import { untrack, type Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { lockPageScroll } from '#lib/client/scroll-lock.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		title: string;
		/** Replaces the plain title in the header. */
		head?: Snippet;
		/** Stays under the title while the content scrolls: a search above its list. */
		pinned?: Snippet;
		/** The content changes height while open. */
		resizes?: boolean;
		/** It has finished sliding in. */
		onopened?: () => void;
		onclose: () => void;
		children: Snippet;
	}
	let { title, head, pinned, resizes = false, onopened, onclose, children }: Props = $props();
	let dialog: HTMLDialogElement;
	let content: HTMLDivElement;
	let scrolled = 0;
	let settledHeight = 0;
	let resizing: Animation | undefined;

	$effect(() => {
		const opener = document.activeElement as HTMLElement | null;
		const unlock = lockPageScroll();
		let usedKeys = false;
		const onkey = () => (usedKeys = true);
		window.addEventListener('keydown', onkey, { capture: true });
		dialog.showModal();
		const stopFitting = fitAboveKeyboard();
		const stopResizing = untrack(() => resizes) ? followContentHeight() : undefined;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) untrack(() => onopened?.());
		return () => {
			stopFitting();
			stopResizing?.();
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

	// The keyboard doesn't resize the page on iPhones: it covers the bottom, and the phone moves the whole page up to keep
	// the field in view. A sheet that then grows goes off the top, so it is placed by what is actually visible.
	function fitAboveKeyboard() {
		const view = window.visualViewport;
		if (!view) return () => {};
		const { style } = dialog;
		const fit = () => {
			// Zooming in shrinks the visible area too, but the sheet should zoom along with the page.
			const zoomed = view.scale > 1.01;
			const set = (name: string, px: number) =>
				zoomed ? style.removeProperty(name) : style.setProperty(name, `${px}px`);
			set('--view-top', view.offsetTop);
			set('--view-bottom', Math.max(0, window.innerHeight - view.height - view.offsetTop));
			set('--view-height', view.height);
			if (!resizing) settledHeight = dialog.offsetHeight;
		};
		fit();
		view.addEventListener('resize', fit);
		view.addEventListener('scroll', fit);
		return () => {
			view.removeEventListener('resize', fit);
			view.removeEventListener('scroll', fit);
		};
	}

	// A browser can't animate to an automatic height, so this lets the new height land, then plays the way there. The sheet
	// is anchored at the bottom, so it rises. Same length and curve as the rows that open by height (layout.css).
	function followContentHeight() {
		settledHeight = dialog.offsetHeight;
		const observer = new ResizeObserver(() => {
			const from = resizing ? dialog.offsetHeight : settledHeight;
			resizing?.cancel();
			resizing = undefined;
			const to = dialog.offsetHeight;
			settledHeight = to;
			if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			const hide = { overflow: 'hidden' };
			const running = dialog.animate(
				[
					{ height: `${from}px`, ...hide },
					{ height: `${to}px`, ...hide }
				],
				{ duration: 340, easing: 'cubic-bezier(0.3, 0.75, 0.1, 1)' }
			);
			running.onfinish = () => {
				if (resizing === running) resizing = undefined;
			};
			resizing = running;
		});
		observer.observe(content);
		return () => observer.disconnect();
	}

	function slideAway(copy: HTMLDialogElement, top: number) {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const wide = matchMedia('(min-width: 760px)').matches;
		for (const el of copy.querySelectorAll('[id]')) el.removeAttribute('id');
		copy.inert = true;
		copy.setAttribute('aria-hidden', 'true');
		Object.assign(copy.style, {
			position: 'fixed',
			inset: 'var(--view-top, 0px) 0 var(--view-bottom, 0px)',
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

{#snippet titleRow()}
	<div class="flex items-center justify-between gap-3">
		{#if head}{@render head()}{:else}<h2 class="text-[21px] font-[750]">{title}</h2>{/if}
		<button
			type="button"
			onclick={onclose}
			class="grid size-11 place-items-center rounded-full bg-surface2 text-muted"
			aria-label={m.sheet_close()}><X size={20} aria-hidden="true" /></button
		>
	</div>
{/snippet}

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
	onanimationend={(e) => {
		if (e.target === dialog && !e.pseudoElement) onopened?.();
	}}
	class="sheet m-0 mt-auto w-full max-w-none overflow-y-auto overscroll-contain rounded-t-sheet bg-surface p-0 text-text shadow-sheet backdrop:bg-scrim desk:m-auto desk:w-[480px] desk:rounded-sheet"
>
	<div
		bind:this={content}
		class="flex flex-col gap-4 p-[18px] pb-[max(18px,env(safe-area-inset-bottom))]"
	>
		{#if pinned}
			<div
				class="sticky top-0 z-10 -mx-[18px] -mt-[18px] -mb-2 flex flex-col gap-4 bg-surface px-[18px] pt-[18px] pb-2"
			>
				{@render titleRow()}
				{@render pinned()}
			</div>
		{:else}
			{@render titleRow()}
		{/if}
		{@render children()}
	</div>
</dialog>

<style>
	.sheet {
		--tallest: 92dvh;
		top: var(--view-top, 0px);
		bottom: var(--view-bottom, 0px);
		max-height: min(var(--tallest), var(--view-height, 100dvh) - 12px);
	}
	@media (min-width: 760px) {
		.sheet {
			--tallest: 86dvh;
		}
	}
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
