<script lang="ts" generics="T extends string">
	// A single-choice row of chips (radio group semantics). Two options always sit side by side at equal width, never
	// stacked (docs/ui.md); more options wrap.
	interface Option {
		value: T;
		label: string;
		disabled?: boolean;
	}
	interface Props {
		label: string;
		options: Option[];
		value: T;
		onchange?: (value: T) => void;
	}
	let { label, options, value = $bindable(), onchange }: Props = $props();
</script>

<fieldset class="flex flex-col gap-1.5">
	<legend class="mb-1.5 text-[13px] font-[650] text-muted">{label}</legend>
	<div
		class={options.length === 2 ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2'}
		role="radiogroup"
		aria-label={label}
	>
		{#each options as option (option.value)}
			<button
				type="button"
				role="radio"
				aria-checked={value === option.value}
				disabled={option.disabled}
				onclick={() => {
					value = option.value;
					onchange?.(option.value);
				}}
				class={[
					'min-h-11 rounded-input border px-4 py-1.5 text-[15px] leading-tight font-semibold disabled:opacity-40',
					value === option.value
						? 'border-accent bg-soft text-accent'
						: 'border-line bg-surface2 text-text'
				]}
			>
				{option.label}
			</button>
		{/each}
	</div>
</fieldset>
