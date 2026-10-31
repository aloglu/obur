<script lang="ts">
	// The app's logo beside its name: the brown bowl in light, the cream bowl in dark (artwork in assets/brand/).
	let { size = 36 }: { size?: number } = $props();
</script>

<img src="/brand/logo-brown.png" alt="" width={size} height={size} class="shrink-0 dark:hidden" />
<img
	src="/brand/logo-cream.png"
	alt=""
	width={size}
	height={size}
	class="hidden shrink-0 dark:block"
/>
