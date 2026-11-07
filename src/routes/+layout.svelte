<script lang="ts">
	import './layout.css';
	import { untrack } from 'svelte';
	import { appIconFile, manifestHref } from '#lib/shared/app-icons.ts';
	import { applyLook } from '#lib/client/prefs.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// The account's settings arrive with every page change (+layout.server.ts): one changed on another device shows
	// here without a reload, and this browser's cookies follow, so pages before signing in look the same.
	$effect(() => applyLook(data.theme, data.palette, data.appIcon, data.timeFormat));
	// Safari reads the Home Screen icon only when a page loads: an icon changed on another device loads the page again
	// once, on the next page change, so adding obur to the Home Screen gets it.
	const loadedIcon = untrack(() => data.appIcon);
	$effect(() => {
		// Not offline: saved copies of pages may disagree, and it would reload on every page change.
		if (data.appIcon !== loadedIcon && navigator.onLine) location.reload();
	});
</script>

<svelte:head>
	<!-- Read when obur is added to the Home Screen: kept current on every page change, not only the first load. -->
	<link rel="apple-touch-icon" href={appIconFile(data.appIcon, 'icon-180.png')} />
	<link rel="manifest" href={manifestHref(data.appIcon)} />
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
