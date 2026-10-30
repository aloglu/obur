<script lang="ts">
	// One food icon in the current theme: OpenMoji's own file in light, the light-outlined variant in dark.
	import { iconUrl } from '#lib/shared/food-icons.ts';

	let { hex, size }: { hex: string; size: number } = $props();
</script>

<img src={iconUrl(hex)} alt="" width={size} height={size} loading="lazy" class="dark:hidden" />
<img
	src={iconUrl(hex, true)}
	alt=""
	width={size}
	height={size}
	loading="lazy"
	class="hidden dark:block"
/>
