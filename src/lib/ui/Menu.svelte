<script lang="ts" generics="T extends string">
	// A short list of choices that opens over the page (docs/ui.md, "Choices"). It sits in the top layer, so sheets and
	// scrolling lists can't clip it, and the browser closes it on Escape or a tap elsewhere. `width="trigger"` matches
	// the field that opened it (Day, Meal); `width="content"` is only as wide as its longest option and lines up with
	// the opener's right edge.
	import Check from '@lucide/svelte/icons/check';
	import type { Snippet } from 'svelte';

	interface Option {
		value: T;
		label: string;
		hint?: string;
	}
	interface Props {
		value: T;
		options: Option[];
		width?: 'trigger' | 'content';
		id?: string;
		label?: string;
		class?: unknown;
		disabled?: boolean;
		onchange?: (value: T) => void;
		children: Snippet;
	}
	let {
		value = $bindable(),
		options,
		width = 'content',
		id,
		label,
		class: extra,
		disabled = false,
		onchange,
		children
	}: Props = $props();

	const uid = $props.id();
	const listId = `menu-${uid}`;
	let trigger = $state<HTMLButtonElement>();
	let list = $state<HTMLDivElement>();
	let open = $state(false);

	const GAP = 6;
	const EDGE = 8;

	function place() {
		if (!trigger || !list) return;
		const box = trigger.getBoundingClientRect();
		const view = window.visualViewport;
		const viewHeight = view?.height ?? window.innerHeight;
		const viewWidth = document.documentElement.clientWidth;
		const s = list.style;
		s.maxHeight = '';
		s.top = s.bottom = s.left = s.right = 'auto';
		if (width === 'trigger') {
			s.width = `${box.width}px`;
			s.left = `${box.left}px`;
		} else {
			s.width = 'max-content';
			s.maxWidth = `${viewWidth - 2 * EDGE}px`;
			s.right = `${Math.max(EDGE, viewWidth - box.right)}px`;
		}
		const below = viewHeight - box.bottom - GAP - EDGE;
		const above = box.top - GAP - EDGE;
		const needed = list.scrollHeight;
		if (needed <= below || below >= above) {
			s.top = `${box.bottom + GAP}px`;
			s.maxHeight = `${below}px`;
		} else {
			s.bottom = `${window.innerHeight - box.top + GAP}px`;
			s.maxHeight = `${above}px`;
		}
	}

	function ontoggle(event: Event) {
		open = (event as ToggleEvent).newState === 'open';
		if (open) {
			const current = list?.querySelector<HTMLElement>('[aria-selected="true"]');
			(current ?? list?.querySelector<HTMLElement>('[role="option"]'))?.focus();
		}
	}

	function onbeforetoggle(event: Event) {
		if ((event as ToggleEvent).newState === 'open') place();
	}

	function choose(next: T) {
		list?.hidePopover();
		trigger?.focus();
		if (next === value) return;
		value = next;
		onchange?.(next);
	}

	function onkeydown(event: KeyboardEvent) {
		const items = [...(list?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
		const at = items.indexOf(document.activeElement as HTMLElement);
		const to =
			event.key === 'ArrowDown'
				? (at + 1) % items.length
				: event.key === 'ArrowUp'
					? (at - 1 + items.length) % items.length
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? items.length - 1
							: -1;
		if (to < 0) return;
		event.preventDefault();
		items[to].focus();
	}

	// The menu is placed once; if the page moves under it, close rather than leave it floating.
	$effect(() => {
		if (!open) return;
		const close = (event: Event) => {
			if (!list?.contains(event.target as Node)) list?.hidePopover();
		};
		window.addEventListener('scroll', close, { capture: true, passive: true });
		window.addEventListener('resize', close);
		return () => {
			window.removeEventListener('scroll', close, { capture: true });
			window.removeEventListener('resize', close);
		};
	});
</script>

<button
	bind:this={trigger}
	type="button"
	{id}
	{disabled}
	popovertarget={listId}
	aria-label={label}
	aria-haspopup="listbox"
	aria-expanded={open}
	class={extra as string}
>
	{@render children()}
</button>

<div
	bind:this={list}
	id={listId}
	popover="auto"
	role="listbox"
	tabindex="-1"
	aria-label={label}
	{onbeforetoggle}
	{ontoggle}
	{onkeydown}
	class="menu-panel"
>
	{#each options as option (option.value)}
		<button
			type="button"
			role="option"
			aria-selected={option.value === value}
			onclick={() => choose(option.value)}
			class="menu-option"
		>
			<span class="min-w-0">
				<span class="block">{option.label}</span>
				{#if option.hint}<small class="block text-[12.5px] font-medium text-muted"
						>{option.hint}</small
					>{/if}
			</span>
			<Check
				size={18}
				strokeWidth={2.4}
				aria-hidden="true"
				class={['shrink-0', option.value !== value && 'invisible']}
			/>
		</button>
	{/each}
</div>

<style>
	.menu-panel {
		position: fixed;
		margin: 0;
		inset: auto;
		border: 0;
		padding: 6px;
		overflow-y: auto;
		color: var(--text);
		background: var(--surface);
		border-radius: var(--radius-input);
		box-shadow:
			0 12px 36px rgba(0, 0, 0, 0.2),
			0 0 0 1px var(--line);
	}
	.menu-panel:popover-open {
		display: flex;
		flex-direction: column;
		animation: menu-in 140ms ease-out;
	}
	.menu-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		min-height: 44px;
		padding: 6px 12px;
		border-radius: var(--radius-menu);
		font-size: 15px;
		font-weight: 600;
		text-align: left;
		white-space: nowrap;
	}
	.menu-option:hover,
	.menu-option:focus-visible {
		background: var(--surface2);
		outline: none;
	}
	.menu-option[aria-selected='true'] {
		color: var(--accent);
	}
	@keyframes menu-in {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.menu-panel:popover-open {
			animation: none;
		}
	}
</style>
