<script lang="ts" generics="T extends string">
	// A form dropdown, styled like TextField beside it (border, fill, rounding, focus ring) with our chevron in place of
	// the browser's arrow; the native select underneath keeps the phone's own picker. Toolbar dropdowns use the tray
	// style of progress/RangeSelect instead.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLSelectAttributes, 'value'> {
		value: T;
		options: { value: T; label: string }[];
		/** Fill the width (for long labels); otherwise as wide as the longest option. */
		wide?: boolean;
		/** A visible label above, as TextField has; without it, give the select an aria-label. */
		label?: string;
	}
	let {
		value = $bindable(),
		options,
		wide = false,
		label,
		id,
		class: extra,
		...rest
	}: Props = $props();
	const uid = $props.id();
	const selectId = $derived(id ?? `select-${uid}`);
</script>

{#snippet field()}
	<span class={['relative inline-flex', wide && 'w-full', !label && extra]}>
		<select
			bind:value
			id={selectId}
			{...rest}
			class={[
				'min-h-12 cursor-pointer appearance-none rounded-input border border-line bg-surface2 py-2 pr-10 pl-3.5 text-[16px] font-semibold text-text focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent',
				wide && 'w-full'
			]}
		>
			{#each options as option (option.value)}<option value={option.value}>{option.label}</option
				>{/each}
		</select>
		<ChevronDown
			size={18}
			strokeWidth={2.4}
			aria-hidden="true"
			class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
		/>
	</span>
{/snippet}

{#if label}
	<div class={['flex flex-col gap-1.5', wide && 'w-full', extra]}>
		<label for={selectId} class="text-[13px] font-[650] text-muted">{label}</label>
		{@render field()}
	</div>
{:else}
	{@render field()}
{/if}
