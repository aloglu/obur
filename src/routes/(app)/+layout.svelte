<script lang="ts">
	import Cloud from '@lucide/svelte/icons/cloud';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import { onMount } from 'svelte';
	import {
		afterNavigate,
		invalidate,
		invalidateAll,
		onNavigate,
		preloadCode
	} from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { offer } from '#lib/client/celebration.svelte.ts';
	import {
		offline,
		recentlyUnreachable,
		serverReachable,
		startSync
	} from '#lib/client/offline/sync.svelte.ts';
	import { noteWaiting } from '#lib/client/offline/waiting.ts';
	import { syncZoneCookie } from '#lib/client/prefs.ts';
	import { ACCOUNT_DATA } from '#lib/shared/account-data.ts';
	import { forgetPrepared, startPreparing } from '#lib/client/prepare.ts';
	import { pageDirection } from '#lib/shared/page-tree.ts';
	import AppShell from '#lib/ui/shell/AppShell.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let { children, data } = $props();

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
		if (data.user)
			startSync(data.user.id, (sent) => {
				// Back after being offline: say so, and how many waiting entries went (docs/ui.md, one warning style).
				if (sent > 0 || wasOffline) {
					backOnline = sent;
					clearTimeout(backTimer);
					backTimer = setTimeout(() => (backOnline = null), 6000);
				}
				wasOffline = false;
				void invalidateAll();
			});
		// Keep a copy of every main tab on this device, so each one opens without a connection, not only the
		// pages visited while online. Done once per app start, after the current page has settled.
		let ahead: ReturnType<typeof setInterval> | undefined;
		const warm = setTimeout(() => {
			if (recentlyUnreachable()) return;
			const tabs = [
				resolve('/(app)'),
				resolve('/(app)/log'),
				resolve('/(app)/journal'),
				resolve('/(app)/progress'),
				resolve('/(app)/more'),
				resolve('/(app)/profile'),
				resolve('/(app)/offline')
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
			// Every page's code, one at a time, so the first visit to a page does not wait for it (the files are already
			// on this device, in the service worker's copy; this reads them in before the tap).
			const pages = [
				'/(app)',
				'/(app)/log',
				'/(app)/journal',
				'/(app)/progress',
				'/(app)/more',
				'/(app)/profile',
				'/(app)/more/settings',
				'/(app)/foods',
				'/(app)/recipes',
				'/(app)/saved-meals',
				'/(app)/more/deleted',
				'/(app)/household',
				'/(app)/help',
				'/(app)/achievements',
				'/(app)/more/goal',
				'/(app)/more/units',
				'/(app)/more/appearance',
				'/(app)/more/speak-and-scan',
				'/(app)/settings/reminders',
				'/(app)/settings/security',
				'/(app)/settings/data',
				'/(app)/foods/new',
				'/(app)/foods/[id]',
				'/(app)/scan'
			] as const;
			let next = 0;
			ahead = setInterval(() => {
				if (next >= pages.length) return clearInterval(ahead);
				preloadCode(pages[next++]).catch(() => {});
			}, 200);
		}, 3000);
		return () => {
			preparer?.stop();
			clearTimeout(warm);
			clearInterval(ahead);
			clearTimeout(accountTimer);
		};
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
	// Offline means the page is the saved copy (the queue's own test of reachability, never navigator.onLine).
	let wasOffline = false;
	$effect(() => {
		if (offline.cachedCopy) wasOffline = true;
	});
	/** How many waiting entries arrived when the connection came back; null when there is nothing to say. */
	let backOnline = $state<number | null>(null);
	let backTimer: ReturnType<typeof setTimeout> | undefined;
	// So the sign-in page can say whose entries are waiting if the session ends.
	$effect(() => {
		if (data.user && offline.ownerId === data.user.id)
			noteWaiting(data.user.id, data.user.displayName, waiting);
	});
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
		<div class="mx-auto max-w-[1064px] px-3.5 pt-3 desk:px-7">
			<Notice tone="info" icon={CloudOff} title={m.offline_now()}>{m.offline_now_line()}</Notice>
		</div>
	{:else if backOnline !== null}
		<div class="mx-auto max-w-[1064px] px-3.5 pt-3 desk:px-7">
			<Notice tone="good" icon={Cloud} title={m.offline_back()}>
				{#if backOnline > 0}{backOnline === 1
						? m.offline_back_sent_one()
						: m.offline_back_sent_many({ count: String(backOnline) })}{/if}
			</Notice>
		</div>
	{/if}
	{@render children()}
</AppShell>
