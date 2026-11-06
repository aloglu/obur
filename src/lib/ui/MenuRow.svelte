<script lang="ts" generics="T extends string">
	// A settings row showing its value; the whole row opens a menu only as wide as its longest option (docs/ui.md).
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Menu from './Menu.svelte';

	interface Props {
		label: string;
		value: T;
		options: { value: T; label: string; hint?: string }[];
		disabled?: boolean;
		onchange?: (value: T) => void;
	}
	let { label, value = $bindable(), options, disabled, onchange }: Props = $props();
	const current = $derived(options.find((o) => o.value === value)?.label ?? '');
</script>

<Menu
	bind:value
	{options}
	{label}
	{disabled}
	{onchange}
	class="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left text-[15px] font-semibold disabled:opacity-50"
>
	<span class="min-w-0">{label}</span>
	<span class="flex shrink-0 items-center gap-1.5 text-[14px] font-medium text-muted">
		{current}<ChevronDown size={18} aria-hidden="true" />
	</span>
</Menu>
