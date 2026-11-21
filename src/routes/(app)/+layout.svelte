<script lang="ts">
	import { onMount } from 'svelte';
	import {
		afterNavigate,
		invalidate,
		invalidateAll,
		onNavigate,
		preloadCode
	} from '$app/navigation';
	import { resolve } from '$app/paths';
	import { offer } from '#lib/client/celebration.svelte.ts';
	import { recentlyUnreachable, serverReachable } from '#lib/client/api.ts';
	import { sendOldQueue } from '#lib/client/old-queue.svelte.ts';
	import { setAccount } from '#lib/client/account.ts';
	import { syncZoneCookie } from '#lib/client/prefs.ts';
	import { ACCOUNT_DATA } from '#lib/shared/account-data.ts';
	import { forgetPrepared, startPreparing } from '#lib/client/prepare.ts';
	import { pageDirection } from '#lib/shared/page-tree.ts';
	import AppShell from '#lib/ui/shell/AppShell.svelte';

	let { children, data } = $props();

	// Writes from this tab say whose they are; the server refuses them if someone else has signed in since.
	// Someone else signed in since this tab opened (its data refreshed with them): everything on it, a draft
	// note, a chosen file, prepared pages, belongs to the person before. The tab starts again for the new one,
	// and keeps saying it is the earlier person's until then, so nothing still on it is saved for them (A01).
	let shown: string | null | undefined;
	$effect.pre(() => {
		const id = data.user?.id ?? null;
		if (shown && id !== shown) {
			forgetPrepared();
			location.reload();
			return;
		}
		shown = id;
		setAccount(id);
	});

	// Achievements the server found waiting: the toast offers the most notable (docs/ui.md).
	$effect(() => offer(data.celebrate));

	// A page change loads only the page. What every page shares (settings, today's date, celebrations) is asked for
	// again in the background: after a page change once it is half a minute old, and when the app comes back to the
	// foreground, so a change made on another device still arrives without a reload. Saves refresh it at once.
	const ACCOUNT_STALE_MS = 30_000;
	let accountAt = Date.now();
	$effect(() => {
		// Any refresh of it counts, including the one every save makes (a fresh list each time it loads).
		void data.celebrate;
		accountAt = Date.now();
	});
	let accountTimer: ReturnType<typeof setTimeout> | undefined;
	function refreshAccount(always = false) {
		if (!always && Date.now() - accountAt < ACCOUNT_STALE_MS) return;
		clearTimeout(accountTimer);
		accountTimer = setTimeout(async () => {
			if (recentlyUnreachable()) return;
			// A refresh that fails must never replace the page (SvelteKit shows an error or loads the page again,
			// losing what is being typed). The service worker answers "nothing new" when the server cannot; without
			// one (the very first visit, before it has taken over), ask only once the server is known to be there.
			if (!navigator.serviceWorker?.controller && !(await serverReachable())) return;
			accountAt = Date.now();
			void invalidate(ACCOUNT_DATA, true);
		}, 250);
	}
	// Page changes move on phones only (routes/layout.css, "Page changes"): into a page and back out push, another tab
	// slides in tab order. Not on desktop, not for a change within one page (another day on Today), not for the
	// browser's own back and forward (Safari's swipe already moves the page), and not with reduced motion.
	onNavigate((navigation) => {
		const from = navigation.from?.url.pathname;
		const to = navigation.to?.url.pathname;
		if (!document.startViewTransition || !from || !to || from === to) return;
		if (navigation.type === 'popstate' || navigation.willUnload) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		if (!matchMedia('(max-width: 759.98px)').matches) return;
		const direction = pageDirection(from, to);
		if (!direction) return;
		return new Promise<void>((ready) => {
			document.documentElement.dataset.nav = direction;
			const transition = document.startViewTransition(async () => {
				ready();
				// A page change that fails or is replaced by another simply ends the movement.
				await navigation.complete.catch(() => {});
			});
			transition.ready.catch(() => {});
			transition.finished.finally(() => {
				if (document.documentElement.dataset.nav === direction)
					delete document.documentElement.dataset.nav;
			});
		});
	});

	// The pages likely to be opened next are prepared ahead (client/prepare.ts), so a tap shows them at once.
	let preparer: ReturnType<typeof startPreparing> | undefined;
	afterNavigate(({ type }) => {
		preparer?.again();
		// The first page arrives with all of it.
		if (type !== 'enter') refreshAccount();
	});
	$effect(() => {
		const back = () => {
			// Back from another app (where a setting may just have changed): always.
			if (document.visibilityState === 'visible') refreshAccount(true);
		};
		document.addEventListener('visibilitychange', back);
		return () => document.removeEventListener('visibilitychange', back);
	});

	onMount(() => {
		// The server decides which day "today" is from the device's time zone; refresh if it changed.
		if (syncZoneCookie()) {
			forgetPrepared();
			invalidateAll();
		}
		preparer = startPreparing([
			resolve('/(app)'),
			resolve('/(app)/log'),
			resolve('/(app)/journal'),
			resolve('/(app)/progress'),
			resolve('/(app)/more')
		]);
		// Send anything this account queued while offline; refresh the page when something arrives.
		// Entries an older version kept on this device for this person are sent now (one release only).
		const sendOld = () => {
			if (data.user && document.visibilityState === 'visible')
				void sendOldQueue(data.user.id).then((sent) => {
					if (sent > 0) void invalidateAll();
				});
		};
		sendOld();
		document.addEventListener('visibilitychange', sendOld);
		// Every page's code is read in ahead of the first visit, once per app start, after the current page has settled.
		let ahead: ReturnType<typeof setInterval> | undefined;
		const warm = setTimeout(() => {
			if (recentlyUnreachable()) return;
			// One at a time, so the first visit to a page does not wait for it (the files are already on this device, in
			// the service worker's copy; this reads them in before the tap).
			// Every page, found by the build (shared/app-pages.ts): a new one is never left out.
			const pages = __APP_PAGES__;
			let next = 0;
			ahead = setInterval(() => {
				if (next >= pages.length) return clearInterval(ahead);
				// Route IDs from the files, so they are real ones.
				preloadCode(pages[next++] as Parameters<typeof preloadCode>[0]).catch(() => {});
			}, 200);
		}, 3000);
		return () => {
			preparer?.stop();
			clearTimeout(warm);
			clearInterval(ahead);
			clearTimeout(accountTimer);
			document.removeEventListener('visibilitychange', sendOld);
		};
	});
</script>

<AppShell>
	{@render children()}
</AppShell>
