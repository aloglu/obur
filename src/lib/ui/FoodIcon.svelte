<script lang="ts">
	// A food's icon (docs/ui.md, "Food icons"): the chosen OpenMoji icon, else the one its name suggests, else a plate,
	// on a tile that follows the theme. Decorative: the food's name is always written beside it.
	import { GENERIC_ICON, suggestIcon } from '#lib/shared/food-icons.ts';
	import IconImage from './IconImage.svelte';

	interface Props {
		icon?: string | null;
		name: string;
		brand?: string | null;
		/** 40 px tile in rows; 32 px where space is tight. */
		size?: 40 | 32;
	}
	let { icon = null, name, brand = null, size = 40 }: Props = $props();
	const hex = $derived(icon ?? suggestIcon(name, brand) ?? GENERIC_ICON);
</script>

<span
	class="grid shrink-0 place-items-center rounded-small bg-icon-tile"
	style:width="{size}px"
	style:height="{size}px"
	aria-hidden="true"
>
	<IconImage {hex} size={size * 0.72} />
</span>
