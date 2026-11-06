<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'ghost' | 'danger';
		wide?: boolean;
		children: Snippet;
	}

	let { variant = 'primary', wide = false, type = 'button', children, ...rest }: Props = $props();
</script>

<button
	{type}
	class={[
		'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-button px-5 text-[17px] font-[750]',
		'transition-[transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-50',
		'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent',
		wide && 'w-full',
		variant === 'primary' && 'bg-fill text-on-accent',
		variant === 'ghost' && 'border border-line bg-surface text-text',
		variant === 'danger' && 'border border-line bg-surface text-bad'
	]}
	{...rest}
>
	{@render children()}
</button>
