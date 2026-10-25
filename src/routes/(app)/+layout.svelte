<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { syncZoneCookie } from '#lib/client/prefs.ts';
	import AppShell from '#lib/ui/shell/AppShell.svelte';

	let { children } = $props();

	// The server decides which day "today" is from the device's time zone; refresh if it changed.
	onMount(() => {
		if (syncZoneCookie()) invalidateAll();
	});
</script>

<AppShell>{@render children()}</AppShell>
