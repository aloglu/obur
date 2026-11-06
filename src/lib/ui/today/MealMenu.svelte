<script lang="ts">
	// The meal card's … menu (docs/ui.md, "Bulk actions"): select its entries, move, copy or delete the whole meal.
	// It is also the way to do everything a hold or a drag does without either gesture. Arrow keys move between
	// items; Escape or a click elsewhere closes it and returns focus to the button.
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { tick } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		label: string;
		saveLabel: string;
		onsave: () => void;
		onselect: () => void;
		onmove: () => void;
		oncopy: () => void;
		ondelete: () => void;
	}
	let { label, saveLabel, onsave, onselect, onmove, oncopy, ondelete }: Props = $props();
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
		const items = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
		const at = items.indexOf(document.activeElement as HTMLButtonElement);
		const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[event.key];
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		} else if (next !== undefined) {
			event.preventDefault();
			items[(next + items.length) % items.length]?.focus();
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
	const item =
		'flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[15px] font-[550] hover:bg-surface2';
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
			class="absolute right-0 bottom-full z-20 mb-1 flex min-w-[13rem] flex-col rounded-[14px] border border-line bg-surface p-1.5 shadow-sheet"
		>
			<button
				type="button"
				role="menuitem"
				aria-label={saveLabel}
				class={item}
				onclick={() => choose(onsave)}>{m.saved_save_as()}</button
			>
			<button type="button" role="menuitem" class={item} onclick={() => choose(onselect)}
				>{m.meal_menu_select()}</button
			>
			<button type="button" role="menuitem" class={item} onclick={() => choose(onmove)}
				>{m.meal_menu_move()}</button
			>
			<button type="button" role="menuitem" class={item} onclick={() => choose(oncopy)}
				>{m.meal_menu_copy()}</button
			>
			<button
				type="button"
				role="menuitem"
				class={[item, 'text-bad']}
				onclick={() => choose(ondelete)}>{m.meal_menu_delete()}</button
			>
		</div>
	{/if}
</div>
