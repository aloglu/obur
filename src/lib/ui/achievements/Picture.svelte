<script lang="ts">
	// An achievement's OpenMoji picture in the current theme (light-outlined variant in dark), like the food icons.
	import { pictureUrl } from '#lib/shared/achievement-display.ts';

	let { hex, size }: { hex: string; size: number } = $props();
</script>

<img src={pictureUrl(hex)} alt="" width={size} height={size} class="dark:hidden" />
<img src={pictureUrl(hex, true)} alt="" width={size} height={size} class="hidden dark:block" />
