<script lang="ts" generics="T extends string">
	// A short list of choices that opens over the page (docs/ui.md, "Choices"). It sits in the top layer, so sheets and
	// scrolling lists can't clip it, and the browser closes it on Escape. A tap elsewhere only closes it: whatever was
	// tapped does nothing, so dismissing a menu never presses something by accident. `width="trigger"` matches the
	// field that opened it (Day, Meal); `width="content"` is only as wide as its longest option, up to MAX_WIDTH, and
	// lines up with the opener's right edge. Options stay on one line: a long one is cut with "…", except its `detail`
	// (a unit's size), which is always shown whole at the right.
	import Check from '@lucide/svelte/icons/check';
	import type { Snippet } from 'svelte';
	import { swallowRestOfPress } from '#lib/client/swallow-press.ts';

	interface Option {
		value: T;
		label: string;
		hint?: string;
		detail?: string;
	}
	interface Props {
		value: T;
		options: Option[];
		width?: 'trigger' | 'content';
		id?: string;
		label?: string;
		class?: unknown;
		disabled?: boolean;
		/** Answering false (or a promise of false) says the change wasn't saved: the menu shows the value before it. */
		onchange?: (value: T) => unknown;
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

	const current = $derived(options.find((o) => o.value === value));
	const fullName = (o: Option) => (o.detail ? `${o.label} (${o.detail})` : o.label);

	const uid = $props.id();
	const listId = `menu-${uid}`;
	let trigger = $state<HTMLButtonElement>();
	let list = $state<HTMLDivElement>();
	let open = $state(false);

	const GAP = 6;
	const EDGE = 8;
	const MAX_WIDTH = 288;

	function place() {
		if (!trigger || !list) return;
		const box = trigger.getBoundingClientRect();
		const view = window.visualViewport;
		const viewTop = view?.offsetTop ?? 0;
		const viewBottom = viewTop + (view?.height ?? window.innerHeight);
		const viewWidth = document.documentElement.clientWidth;
		const s = list.style;
		s.maxHeight = '';
		s.top = s.bottom = s.left = s.right = 'auto';
		if (width === 'trigger') {
			s.width = `${box.width}px`;
			s.left = `${box.left}px`;
		} else {
			s.width = 'max-content';
			s.maxWidth = `${Math.min(MAX_WIDTH, viewWidth - 2 * EDGE)}px`;
			s.right = `${Math.max(EDGE, viewWidth - box.right)}px`;
		}
		const below = viewBottom - box.bottom - GAP - EDGE;
		const above = box.top - viewTop - GAP - EDGE;
		// The closed list can't measure itself; rows are 44 px, or 62 with a hint, inside 6 px of padding.
		const needed = 12 + options.reduce((sum, o) => sum + (o.hint ? 62 : 44), 0);
		const side = width === 'trigger' ? 'left' : 'right';
		if (needed <= below || below >= above) {
			s.setProperty('--menu-origin', `top ${side}`);
			s.top = `${box.bottom + GAP}px`;
			s.maxHeight = `${below}px`;
		} else {
			s.setProperty('--menu-origin', `bottom ${side}`);
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

	async function choose(next: T) {
		list?.hidePopover();
		trigger?.focus();
		if (next === value) return;
		const before = value;
		value = next;
		// A save that failed shows what is saved again, so the same choice can be tried again (2026-11-25 Review.md
		// audit, 2.3: it kept the unsaved one, and choosing it again did nothing).
		if ((await onchange?.(next)) === false && value === next) value = before;
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
		// A press outside the menu (and its opener, which toggles it itself) closes it and is used up.
		const pressOutside = (event: PointerEvent) => {
			const target = event.target as Node;
			if (list?.contains(target) || trigger?.contains(target)) return;
			swallowRestOfPress(event);
			list?.hidePopover();
		};
		window.addEventListener('scroll', close, { capture: true, passive: true });
		window.addEventListener('resize', close);
		window.addEventListener('pointerdown', pressOutside, { capture: true });
		return () => {
			window.removeEventListener('scroll', close, { capture: true });
			window.removeEventListener('resize', close);
			window.removeEventListener('pointerdown', pressOutside, { capture: true });
		};
	});
</script>

<button
	bind:this={trigger}
	type="button"
	{id}
	{disabled}
	popovertarget={listId}
	aria-label={label ? `${label}: ${current ? fullName(current) : ''}` : undefined}
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
			aria-label={option.detail ? fullName(option) : undefined}
			onclick={() => choose(option.value)}
			class="menu-option"
		>
			<span class="min-w-0 flex-1">
				<span class="block truncate">{option.label}</span>
				{#if option.hint}<small class="block text-[0.78125rem] font-medium text-muted"
						>{option.hint}</small
					>{/if}
			</span>
			{#if option.detail}<span class="menu-detail">{option.detail}</span>{/if}
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
		overscroll-behavior: contain;
		opacity: 0;
		transform: scale(0.97);
		transform-origin: var(--menu-origin, top right);
		transition:
			opacity 140ms ease,
			transform 140ms var(--ui),
			display 140ms allow-discrete,
			overlay 140ms allow-discrete;
		color: var(--text);
		background: var(--surface);
		border-radius: var(--radius-input);
		/* A visible edge in every theme and mode, so the menu reads as its own layer over a white card. */
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--text) 16%, transparent),
			0 2px 6px rgba(0, 0, 0, 0.08),
			0 16px 40px rgba(0, 0, 0, 0.24);
	}
	.menu-panel:popover-open {
		display: flex;
		flex-direction: column;
		opacity: 1;
		transform: none;
		@starting-style {
			opacity: 0;
			transform: scale(0.97);
		}
	}
	.menu-option {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		padding: 6px 12px;
		border-radius: var(--radius-menu);
		font-size: 0.9375rem;
		font-weight: 600;
		text-align: left;
		white-space: nowrap;
	}
	.menu-detail {
		flex-shrink: 0;
		color: var(--muted);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	.menu-option[aria-selected='true'] .menu-detail {
		color: inherit;
	}
	.menu-option:hover,
	.menu-option:focus-visible {
		background: var(--surface2);
		outline: none;
	}
	.menu-option[aria-selected='true'] {
		color: var(--accent);
	}
	@media (prefers-reduced-motion: reduce) {
		.menu-panel {
			transition: none;
		}
	}
</style>
