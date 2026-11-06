<script lang="ts">
	// An on/off row: its name and a short detail on the left, the switch on the right.
	interface Props {
		label: string;
		detail?: string;
		checked: boolean;
		onchange?: (checked: boolean) => void;
	}
	let { label, detail, checked = $bindable(), onchange }: Props = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	onclick={() => {
		checked = !checked;
		onchange?.(checked);
	}}
	class="flex min-h-[60px] w-full items-center justify-between gap-3 py-1.5 text-left"
>
	<span class="min-w-0 text-[15px] font-semibold">
		{label}
		{#if detail}<small class="block text-[13px] font-normal text-muted">{detail}</small>{/if}
	</span>
	<span
		aria-hidden="true"
		class={[
			'relative h-7 w-12 shrink-0 rounded-full transition-colors',
			checked ? 'bg-good' : 'bg-line'
		]}
		><span
			class={[
				'absolute top-0.5 size-6 rounded-full bg-surface shadow-card transition-[left] motion-reduce:transition-none',
				checked ? 'left-[22px]' : 'left-0.5'
			]}
		></span></span
	>
</button>
