<script lang="ts">
	// A short text field with its unit inside, at the end (docs/ui.md, "Budget setup"). For one fixed unit; when the unit is
	// a choice, AmountField is the one to use.
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'value'> {
		label: string;
		unit: string;
		hint?: string;
		value: string;
	}
	let { label, unit, hint, value = $bindable(), id, ...rest }: Props = $props();
	const uid = $props.id();
	const fieldId = $derived(id ?? uid);
</script>

<div class="flex min-w-0 flex-col gap-1.5">
	<label for={fieldId} class="text-[0.8125rem] font-[650] text-muted">{label}</label>
	<span
		class="flex min-h-12 items-center gap-1 rounded-input border border-line bg-surface2 px-3.5 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-accent has-aria-invalid:border-bad"
	>
		<input
			id={fieldId}
			bind:value
			autocomplete="off"
			aria-describedby={hint ? `${fieldId}-hint` : undefined}
			class="h-12 w-0 min-w-0 flex-1 bg-transparent text-[1rem] font-semibold text-text outline-none placeholder:font-medium placeholder:text-muted"
			{...rest}
		/>
		<span class="text-[0.875rem] font-[650] text-muted">{unit}</span>
	</span>
	{#if hint}<p id="{fieldId}-hint" class="text-[0.8125rem] text-muted">{hint}</p>{/if}
</div>
