<script lang="ts" generics="T extends string">
	// An amount with its unit inside the field (docs/ui.md, "Choices"): "piece ⌄" opens a menu when there are several
	// units; a single unit is plain text, not a button.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { m } from '#lib/paraglide/messages.js';
	import Menu from './Menu.svelte';

	interface Props {
		amount: string;
		unit: T;
		units: { value: T; label: string }[];
		label?: string;
		id?: string;
		invalid?: boolean;
		large?: boolean;
		onunit?: (unit: T) => void;
	}
	let {
		amount = $bindable(),
		unit = $bindable(),
		units,
		label,
		id,
		invalid = false,
		large = true,
		onunit
	}: Props = $props();
	const uid = $props.id();
	const fieldId = $derived(id ?? `amount-${uid}`);
	const current = $derived(units.find((u) => u.value === unit)?.label);
</script>

<div class="flex flex-col gap-1.5">
	<label for={fieldId} class="text-[0.8125rem] font-[650] text-muted"
		>{label ?? m.amount_amount()}</label
	>
	<div
		class="flex min-h-14 items-center gap-1 rounded-input bg-surface2 pr-1.5 focus-within:outline-2 focus-within:outline-accent"
	>
		<input
			id={fieldId}
			bind:value={amount}
			inputmode="decimal"
			autocomplete="off"
			aria-invalid={invalid}
			class={[
				'h-14 min-w-0 flex-1 bg-transparent px-3.5 font-bold tabular-nums outline-none',
				large ? 'text-[1.25rem]' : 'text-[1rem]'
			]}
		/>
		{#if units.length > 1}
			<Menu
				bind:value={unit}
				options={units}
				label={m.amount_unit()}
				onchange={onunit}
				class="flex h-11 max-w-[60%] min-w-0 shrink-0 items-center gap-1.5 rounded-small bg-surface px-3 text-[0.9375rem] font-semibold"
			>
				<span class="truncate">{current ?? m.entry_unit()}</span>
				<ChevronDown size={16} strokeWidth={2.4} aria-hidden="true" class="shrink-0 text-muted" />
			</Menu>
		{:else if current}
			<span class="px-2.5 text-[0.9375rem] font-semibold whitespace-nowrap text-muted"
				>{current}</span
			>
		{/if}
	</div>
</div>
