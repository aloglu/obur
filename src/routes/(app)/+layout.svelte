<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { offline, recentlyUnreachable, startSync } from '#lib/client/offline/sync.svelte.ts';
	import { syncZoneCookie } from '#lib/client/prefs.ts';
	import AppShell from '#lib/ui/shell/AppShell.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let { children, data } = $props();

	onMount(() => {
		// The server decides which day "today" is from the device's time zone; refresh if it changed.
		if (syncZoneCookie()) invalidateAll();
		// Send anything this account queued while offline; refresh the page when something arrives.
		if (data.user) startSync(data.user.id, () => invalidateAll());
		// Keep a copy of every main tab on this device, so each one opens without a connection, not only the
		// pages visited while online. Done once per app start, after the current page has settled.
		const warm = setTimeout(() => {
			if (recentlyUnreachable()) return;
			const tabs = [
				resolve('/(app)'),
				resolve('/(app)/log'),
				resolve('/(app)/progress'),
				resolve('/(app)/more'),
				resolve('/(app)/settings'),
				resolve('/(app)/profile')
			];
			const get = (url: string, accept?: string) =>
				fetch(url, { credentials: 'same-origin', headers: accept ? { accept } : undefined }).catch(
					() => {}
				);
			for (const href of tabs) {
				// The page itself (for a reload), and its data as SvelteKit requests it on an in-app move. The
				// page that was opened first has its data built into the HTML, so it is fetched here explicitly.
				get(href, 'text/html');
				get(href === '/' ? '/__data.json?x-sveltekit-trailing-slash=1' : `${href}/__data.json`);
			}
		}, 3000);
		return () => clearTimeout(warm);
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
