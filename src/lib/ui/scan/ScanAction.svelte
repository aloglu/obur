<script lang="ts">
	// A Scan button outside Log (docs/ui.md, "Scan inside New food"): Scan label, Show photo, Retake. Like Log's tiles,
	// the icon sits in Scan's ochre square and the words are in ordinary text.
	import ImageIcon from '@lucide/svelte/icons/image';
	import ScanLine from '@lucide/svelte/icons/scan-line';

	interface Props {
		label: string;
		icon: 'scan' | 'photo';
		onclick: () => void;
		expanded?: boolean;
		/** On a photo: a raised surface so it reads as a button over any background. */
		raised?: boolean;
	}
	let { label, icon, onclick, expanded, raised = false }: Props = $props();
</script>

<button
	type="button"
	{onclick}
	aria-expanded={expanded}
	class={[
		'inline-flex min-h-11 items-center gap-2 rounded-input text-[0.9375rem] font-semibold whitespace-nowrap text-text',
		raised ? 'bg-surface pr-3.5 pl-1.5 shadow-card' : 'px-1.5'
	]}
>
	<span class="grid size-8 shrink-0 place-items-center rounded-[10px] bg-scan-bg text-scan">
		{#if icon === 'scan'}<ScanLine size={18} aria-hidden="true" />{:else}<ImageIcon
				size={18}
				aria-hidden="true"
			/>{/if}
	</span>
	{label}
</button>
