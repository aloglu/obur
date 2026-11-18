<script lang="ts">
	// A … button with a short list of actions. Arrow keys move between them; Escape closes it and returns focus to the
	// button. A tap elsewhere only closes it, as with every menu (docs/ui.md, "Choices"): what was tapped does nothing.
	// The button is the bare dots, the last dot's ink on the right edge of the numbers above (owner, 2026-11-18): the
	// 44 px target reaches 16 px past that edge, which is the Ellipsis icon's room right of its last dot.
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import type { Component } from 'svelte';
	import { tick } from 'svelte';
	import { swallowRestOfPress } from '#lib/client/swallow-press.ts';

	interface Item {
		label: string;
		ariaLabel?: string;
		/** A Lucide icon before the label. */
		icon?: Component<{ size?: number; 'aria-hidden'?: 'true' }>;
		/** Red, after a line that sets it apart from the rest. */
		danger?: boolean;
		action: () => void;
	}
	interface Props {
		label: string;
		items: Item[];
		/** Opens above the button, for a button low on the page. */
		up?: boolean;
	}
	let { label, items, up = false }: Props = $props();
	let open = $state(false);
	let button: HTMLButtonElement;
	let menu = $state<HTMLDivElement>();
	const uid = $props.id();

	async function show() {
		open = true;
		await tick();
		menu?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
	}
	function close(refocus = true) {
		open = false;
		if (refocus) button.focus();
	}
	function choose(action: () => void) {
		close(false);
		action();
	}
	function keys(event: KeyboardEvent) {
		const rows = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
		const at = rows.indexOf(document.activeElement as HTMLButtonElement);
		const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[event.key];
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		} else if (next !== undefined) {
			event.preventDefault();
			rows[(next + rows.length) % rows.length]?.focus();
		}
	}
	$effect(() => {
		if (!open) return;
		const outside = (e: PointerEvent) => {
			if (menu?.contains(e.target as Node) || button.contains(e.target as Node)) return;
			swallowRestOfPress();
			close(false);
		};
		window.addEventListener('pointerdown', outside, { capture: true });
		return () => window.removeEventListener('pointerdown', outside, { capture: true });
	});
</script>

<div class="relative -mr-4">
	<button
		bind:this={button}
		type="button"
		aria-label={label}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={open ? `${uid}-menu` : undefined}
		onclick={() => (open ? close() : show())}
		class="grid size-11 place-items-center text-muted hover:text-text"
	>
		<Ellipsis size={18} aria-hidden="true" />
	</button>
	{#if open}
		<div
			bind:this={menu}
			id="{uid}-menu"
			role="menu"
			tabindex="-1"
			aria-label={label}
			onkeydown={keys}
			class={[
				'absolute right-0 z-20 flex min-w-[13rem] flex-col rounded-[14px] border border-line bg-surface p-1.5 shadow-sheet',
				up ? 'bottom-full mb-1' : 'top-full mt-1'
			]}
		>
			{#each items as item, i (item.label)}
				{#if item.danger && i > 0}<div role="separator" class="mx-1.5 my-1 h-px bg-line"></div>{/if}
				<button
					type="button"
					role="menuitem"
					aria-label={item.ariaLabel}
					class={[
						'flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[0.9375rem] font-[550] hover:bg-surface2',
						item.danger && 'text-bad'
					]}
					onclick={() => choose(item.action)}
				>
					{#if item.icon}<span class={['shrink-0', !item.danger && 'text-muted']}
							><item.icon size={20} aria-hidden="true" /></span
						>{/if}{item.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
