<script lang="ts">
	// A … button with a short list of actions. Arrow keys move between them; Escape or a click elsewhere closes it and
	// returns focus to the button.
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { tick } from 'svelte';

	interface Item {
		label: string;
		ariaLabel?: string;
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
			if (!menu?.contains(e.target as Node) && !button.contains(e.target as Node)) close(false);
		};
		document.addEventListener('pointerdown', outside);
		return () => document.removeEventListener('pointerdown', outside);
	});
</script>

<div class="relative">
	<button
		bind:this={button}
		type="button"
		aria-label={label}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={open ? `${uid}-menu` : undefined}
		onclick={() => (open ? close() : show())}
		class="group grid size-11 place-items-center"
	>
		<span
			class="grid size-9 place-items-center rounded-full bg-surface2 text-muted group-hover:text-text"
			><Ellipsis size={18} aria-hidden="true" /></span
		>
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
			{#each items as item (item.label)}
				<button
					type="button"
					role="menuitem"
					aria-label={item.ariaLabel}
					class={[
						'flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[15px] font-[550] hover:bg-surface2',
						item.danger && 'text-bad'
					]}
					onclick={() => choose(item.action)}>{item.label}</button
				>
			{/each}
		</div>
	{/if}
</div>
