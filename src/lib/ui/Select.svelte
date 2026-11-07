<script lang="ts" generics="T extends string">
	// A form field that opens a menu of choices, styled like TextField beside it. `wide` fills the row and its menu
	// matches the field (Day, Meal); otherwise the field and its menu are as wide as their content (docs/ui.md).
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { m } from '#lib/paraglide/messages.js';
	import Menu from './Menu.svelte';

	interface Props {
		value: T;
		options: { value: T; label: string; hint?: string }[];
		wide?: boolean;
		/** A visible label above, as TextField has; without it, give `aria-label`. */
		label?: string;
		'aria-label'?: string;
		id?: string;
		class?: unknown;
		disabled?: boolean;
		onchange?: (value: T) => void;
	}
	let {
		value = $bindable(),
		options,
		wide = false,
		label,
		'aria-label': ariaLabel,
		id,
		class: extra,
		disabled,
		onchange
	}: Props = $props();
	const uid = $props.id();
	const fieldId = $derived(id ?? `select-${uid}`);
	const current = $derived(options.find((o) => o.value === value)?.label ?? '');
</script>

{#snippet field()}
	<span class={['relative inline-flex', wide && 'w-full', !label && (extra as string)]}>
		<Menu
			bind:value
			{options}
			id={fieldId}
			label={ariaLabel ?? label}
			width={wide ? 'trigger' : 'content'}
			{disabled}
			{onchange}
			class={[
				'flex min-h-12 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-input bg-surface2 py-2 pr-3 pl-3.5 text-left text-[1rem] font-semibold text-text disabled:opacity-50',
				'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent',
				wide && 'w-full'
			]
				.filter(Boolean)
				.join(' ')}
		>
			<span class={['min-w-0 truncate', !current && 'text-muted']}
				>{current || m.common_choose()}</span
			>
			<ChevronDown size={18} strokeWidth={2.4} aria-hidden="true" class="shrink-0 text-muted" />
		</Menu>
	</span>
{/snippet}

{#if label}
	<div class={['flex flex-col gap-1.5', wide && 'w-full', extra as string]}>
		<label for={fieldId} class="text-[0.8125rem] font-[650] text-muted">{label}</label>
		{@render field()}
	</div>
{:else}
	{@render field()}
{/if}
