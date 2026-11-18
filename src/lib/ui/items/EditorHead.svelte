<script lang="ts">
	// The top of the recipe and saved meal editors (docs/ui.md, "Recipes and saved meals"): the way back and the title.
	// Their actions (Archive, Delete) sit in a card at the end of the page, above Cancel and Save, as on a food.
	import PageHead from '../PageHead.svelte';

	interface Props {
		backHref: string;
		backLabel: string;
		title: string;
	}
	let { backHref, backLabel, title }: Props = $props();
</script>

<PageHead href={backHref} label={backLabel} {title} />
