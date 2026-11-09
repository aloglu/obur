<script lang="ts">
	// The app's logo beside its name, in the app icon the person chose: the O in that icon's colour, the bowl brown in
	// light and cream in dark (artwork in assets/brand/, files from scripts/brand-icons.sh).
	import { page } from '$app/state';
	import { appLogoFile, DEFAULT_APP_ICON } from '#lib/shared/app-icons.ts';

	let { size = 36 }: { size?: number } = $props();
	const icon = $derived(page.data.appIcon ?? DEFAULT_APP_ICON);
</script>

<img
	src={appLogoFile(icon, 'light')}
	alt=""
	width={size}
	height={size}
	class="shrink-0 dark:hidden"
/>
<img
	src={appLogoFile(icon, 'dark')}
	alt=""
	width={size}
	height={size}
	class="hidden shrink-0 dark:block"
/>
