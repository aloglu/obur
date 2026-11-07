<script lang="ts">
	// The one warning style (docs/ui.md): a plain card with an icon tile coloured by severity, an optional bold title and
	// a short line. Never tinted: only the icon carries the severity.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Info from '@lucide/svelte/icons/info';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Component, Snippet } from 'svelte';

	interface Props {
		tone?: 'warn' | 'bad' | 'info' | 'good';
		title?: string;
		/** A more specific picture than the tone's own (a mic for Speak, a cloud for offline). */
		icon?: Component<{ size?: number | string; 'aria-hidden'?: 'true' | boolean }>;
		children?: Snippet;
		actions?: Snippet;
	}
	let { tone = 'warn', title, icon, children, actions }: Props = $props();
	const Icon = $derived(
		icon ?? { warn: TriangleAlert, bad: CircleAlert, info: Info, good: CircleCheck }[tone]
	);
</script>

<div
	role={tone === 'info' || tone === 'good' ? 'status' : 'alert'}
	class="flex flex-col gap-3 rounded-input border border-line bg-surface p-3.5"
>
	<div class="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3">
		<span class={['grid size-10 place-items-center rounded-small', `tile-${tone}`]}>
			<Icon size={20} aria-hidden="true" />
		</span>
		<div class="flex min-h-10 flex-col justify-center gap-0.5">
			{#if title}<b class="text-[1rem] leading-snug font-bold">{title}</b>{/if}
			{#if children}
				<div
					class={['text-[0.875rem] leading-snug', title ? 'text-muted' : 'font-medium text-text']}
				>
					{@render children()}
				</div>
			{/if}
		</div>
	</div>
	{#if actions}{@render actions()}{/if}
</div>

<style>
	.tile-info {
		background: var(--surface2);
		color: var(--muted);
	}
	.tile-warn {
		background: var(--warn-soft);
		color: var(--warn);
	}
	.tile-bad {
		background: color-mix(in srgb, var(--bad) 13%, var(--surface));
		color: var(--bad);
	}
	.tile-good {
		background: color-mix(in srgb, var(--good) 13%, var(--surface));
		color: var(--good);
	}
</style>
