<script lang="ts">
	// An on/off control: a row with its name and a short detail, or with `bare` only the switch, named for screen readers.
	interface Props {
		label: string;
		detail?: string;
		checked: boolean;
		bare?: boolean;
		onchange?: (checked: boolean) => void;
	}
	let { label, detail, checked = $bindable(), bare = false, onchange }: Props = $props();
	function toggle() {
		checked = !checked;
		onchange?.(checked);
	}
</script>

{#snippet track()}
	<span
		aria-hidden="true"
		class={[
			'relative block h-7 w-12 shrink-0 rounded-full transition-colors',
			checked ? 'bg-good' : 'bg-line'
		]}
		><span
			class={[
				'absolute top-0.5 size-6 rounded-full bg-surface shadow-card transition-[left] motion-reduce:transition-none',
				checked ? 'left-[22px]' : 'left-0.5'
			]}
		></span></span
	>
{/snippet}

{#if bare}
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		aria-label={label}
		onclick={toggle}
		class="grid min-h-11 shrink-0 place-items-center">{@render track()}</button
	>
{:else}
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		onclick={toggle}
		class="flex min-h-[60px] w-full items-center justify-between gap-3 py-1.5 text-left"
	>
		<span class="min-w-0 text-[0.9375rem] font-semibold">
			{label}
			{#if detail}<small class="block text-[0.8125rem] font-normal text-muted">{detail}</small>{/if}
		</span>
		{@render track()}
	</button>
{/if}
