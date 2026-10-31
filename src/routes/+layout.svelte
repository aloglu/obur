<script lang="ts">
	import './layout.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<!-- The tab icon follows the browser's light or dark scheme (artwork: scripts/brand-icons.sh). -->
	<link
		rel="icon"
		type="image/png"
		href="/brand/favicon-brown.png"
		media="(prefers-color-scheme: light)"
	/>
	<link
		rel="icon"
		type="image/png"
		href="/brand/favicon-cream.png"
		media="(prefers-color-scheme: dark)"
	/>
</svelte:head>

{@render children()}
