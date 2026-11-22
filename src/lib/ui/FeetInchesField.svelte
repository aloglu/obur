<script lang="ts">
	// A height in feet and inches: one field with two numbers, so it takes the place of UnitField's "cm" field
	// (docs/ui.md, "Budget setup"). Each number has its own name for screen readers ("Height, feet").
	import type { UnitChoice } from './unit-choice.ts';
	import UnitSwitch from './UnitSwitch.svelte';

	interface Props {
		label: string;
		feet: string;
		inches: string;
		invalid?: boolean;
		/** The unit as a choice (setup). */
		choice?: UnitChoice;
	}
	let {
		label,
		feet = $bindable(),
		inches = $bindable(),
		invalid = false,
		choice
	}: Props = $props();
	const uid = $props.id();
	const unit = 'text-[0.875rem] font-[650] text-muted';
</script>

<div class="flex min-w-0 flex-col gap-1.5" role="group" aria-labelledby="{uid}-label">
	<span id="{uid}-label" class="text-[0.8125rem] font-[650] text-muted">{label}</span>
	<span
		class={[
			'flex min-h-12 items-center gap-1 rounded-input border bg-surface2 px-3.5 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-accent',
			invalid ? 'border-bad' : 'border-line'
		]}
	>
		<input
			id="{uid}-feet"
			bind:value={feet}
			inputmode="numeric"
			autocomplete="off"
			aria-label="{label}, ft"
			aria-invalid={invalid || undefined}
			class="h-11.5 w-0 min-w-0 flex-1 bg-transparent text-[1rem] font-semibold text-text outline-none placeholder:font-medium placeholder:text-muted"
		/>
		<span class={unit}>ft</span>
		<input
			id="{uid}-inches"
			bind:value={inches}
			inputmode="decimal"
			autocomplete="off"
			aria-label="{label}, in"
			aria-invalid={invalid || undefined}
			class="ml-2 h-11.5 w-0 min-w-0 flex-1 bg-transparent text-[1rem] font-semibold text-text outline-none placeholder:font-medium placeholder:text-muted"
		/>
		{#if choice}
			<UnitSwitch {choice} text="in" />
		{:else}
			<span class={unit}>in</span>
		{/if}
	</span>
</div>
