<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { offline, startSync } from '#lib/client/offline/sync.svelte.ts';
	import { syncZoneCookie } from '#lib/client/prefs.ts';
	import AppShell from '#lib/ui/shell/AppShell.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let { children, data } = $props();

	onMount(() => {
		// The server decides which day "today" is from the device's time zone; refresh if it changed.
		if (syncZoneCookie()) invalidateAll();
		// Send anything this account queued while offline; refresh the page when something arrives.
		if (data.user) startSync(data.user.id, () => invalidateAll());
	});
	// Keep the service worker's copy of this page current, so an offline reload shows the latest data rather than
	// the page as it was first loaded. Only while online; failures are irrelevant.
	$effect(() => {
		void page.data;
		const url = page.url.href;
		const timer = setTimeout(() => {
			fetch(url, { headers: { accept: 'text/html' }, credentials: 'same-origin' }).catch(() => {});
		}, 800);
		return () => clearTimeout(timer);
	});

	const waiting = $derived(offline.items.filter((i) => i.status === 'pending').length);
</script>

<AppShell>
	{#if offline.authRequired && waiting > 0}
		<div class="mx-auto max-w-[1064px] px-3.5 pt-3 desk:px-7">
			<Notice>
				{m.offline_signin({ count: String(waiting) })}
				<a href={resolve('/login')} class="font-bold underline">{m.offline_signin_link()}</a>
			</Notice>
		</div>
	{/if}
	{#if offline.cachedCopy}
		<p class="mx-auto max-w-[1064px] px-3.5 pt-3 text-[13px] text-muted desk:px-7">
			{m.offline_cached_copy()}
		</p>
	{/if}
	{@render children()}
</AppShell>
