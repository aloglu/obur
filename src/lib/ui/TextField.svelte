<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'value'> {
		label: string;
		hint?: string;
		value: string;
	}

	let { label, hint, value = $bindable(), id, ...rest }: Props = $props();
	const fieldId = $derived(id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
</script>

<div class="flex flex-col gap-1.5">
	<label for={fieldId} class="text-[13px] font-[650] text-muted">{label}</label>
	<input
		id={fieldId}
		bind:value
		aria-describedby={hint ? `${fieldId}-hint` : undefined}
		class="min-h-12 rounded-input border border-line bg-surface2 px-3.5 text-[16px] font-semibold text-text placeholder:text-muted focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent"
		{...rest}
	/>
	{#if hint}<p id="{fieldId}-hint" class="text-[13px] text-muted">{hint}</p>{/if}
</div>
