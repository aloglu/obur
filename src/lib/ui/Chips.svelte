<script lang="ts" generics="T extends string">
	// A single-choice row of chips (radio group semantics).
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
	<div class="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
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
					'min-h-11 rounded-full border px-4 text-[15px] font-semibold disabled:opacity-40',
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
