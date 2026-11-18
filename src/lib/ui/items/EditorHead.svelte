<script lang="ts">
	// The top of the recipe and saved meal editors (docs/ui.md, "Recipes and saved meals"): the way back and the title.
	// A saved meal has its one action, Delete, as a trash icon at the end of the title's line, done straight away
	// (Undo and Recently deleted cover it). Recipes keep Archive at the end of the page, as foods do.
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import PageHead from '../PageHead.svelte';

	interface Props {
		backHref: string;
		backLabel: string;
		title: string;
		remove?: { label: string; run: () => void };
		busy: boolean;
	}
	let { backHref, backLabel, title, remove, busy }: Props = $props();
</script>

{#snippet trash()}
	<button
		type="button"
		aria-label={remove!.label}
		title={remove!.label}
		disabled={busy}
		onclick={remove!.run}
		class="grid size-11 place-items-center rounded-full text-bad"
	>
		<Trash2 size={22} aria-hidden="true" />
	</button>
{/snippet}
<PageHead href={backHref} label={backLabel} {title} end={remove ? trash : undefined} />
