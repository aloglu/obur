<script lang="ts">
	// An achievement's OpenMoji picture in the current theme (light-outlined variant in dark), like the food icons.
	import { pictureUrl } from '#lib/shared/achievement-display.ts';

	let { hex, size, class: extra = '' }: { hex: string; size: number; class?: string } = $props();
</script>

<img src={pictureUrl(hex)} alt="" width={size} height={size} class={['dark:hidden', extra]} />
<img
	src={pictureUrl(hex, true)}
	alt=""
	width={size}
	height={size}
	class={['hidden dark:block', extra]}
/>
