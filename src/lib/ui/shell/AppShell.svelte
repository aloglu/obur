<script lang="ts">
	// Navigation per docs/ui.md: floating tab bar on phones; from 760 px a side nav, as icons until 1100 px.
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import { m } from '#lib/paraglide/messages.js';
	import AppLogo from '../AppLogo.svelte';
	import Celebration from '../achievements/Celebration.svelte';
	import Toast from './Toast.svelte';

	let { children }: { children: Snippet } = $props();

	const path = $derived(page.url.pathname);
	const is = (prefix: string) => (prefix === '/' ? path === '/' : path.startsWith(prefix));
	const moreActive = $derived(
		[
			'/more',
			'/profile',
			'/settings',
			'/foods',
			'/recipes',
			'/saved-meals',
			'/household',
			'/help'
		].some((p) => path.startsWith(p))
	);

	const activeTab = $derived(
		is('/') ? 0 : is('/log') ? 1 : is('/journal') ? 2 : is('/progress') ? 3 : moreActive ? 4 : -1
	);

	const sideItem = (active: boolean) => [
		'flex min-h-12 items-center justify-center gap-3 rounded-input px-3 text-[16px] font-semibold wide:justify-start',
		active ? 'bg-soft text-accent' : 'text-text hover:bg-surface2'
	];
	const tabItem = (active: boolean) => [
		'relative z-1 flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-input text-[11.5px] font-bold transition-colors',
		active ? 'text-accent' : 'text-muted'
	];
</script>

<div
	class="min-h-dvh desk:grid desk:grid-cols-[72px_minmax(0,1fr)] wide:grid-cols-[232px_minmax(0,1fr)]"
>
	<!-- The column carries the background so it spans the full page height; the nav inside stays sticky. -->
	<div class="hidden border-r border-line bg-surface desk:block">
		<nav aria-label={m.nav_main()} class="sticky top-0 flex h-dvh flex-col gap-1 p-3">
			<a
				href={resolve('/(app)')}
				class="flex items-center justify-center gap-2.5 pt-2 pb-6 font-display text-[30px] font-extrabold tracking-[-0.02em] text-accent wide:justify-start wide:px-3"
				><AppLogo size={32} /><span class="sr-only wide:not-sr-only">{m.app_name()}</span></a
			>
			<a
				href={resolve('/(app)')}
				class={sideItem(is('/'))}
				aria-current={is('/') ? 'page' : undefined}
				><CalendarDays size={22} aria-hidden="true" /><span class="sr-only wide:not-sr-only"
					>{m.nav_today()}</span
				></a
			>
			<a
				href={resolve('/(app)/log')}
				class={sideItem(is('/log'))}
				aria-current={is('/log') ? 'page' : undefined}
				><CirclePlus size={22} aria-hidden="true" /><span class="sr-only wide:not-sr-only"
					>{m.nav_log()}</span
				></a
			>
			<a
				href={resolve('/(app)/journal')}
				class={sideItem(is('/journal'))}
				aria-current={is('/journal') ? 'page' : undefined}
				><BookOpen size={22} aria-hidden="true" /><span class="sr-only wide:not-sr-only"
					>{m.nav_journal()}</span
				></a
			>
			<a
				href={resolve('/(app)/progress')}
				class={sideItem(is('/progress'))}
				aria-current={is('/progress') ? 'page' : undefined}
				><TrendingUp size={22} aria-hidden="true" /><span class="sr-only wide:not-sr-only"
					>{m.nav_progress()}</span
				></a
			>
			<a
				href={resolve('/(app)/more')}
				class={sideItem(moreActive)}
				aria-current={is('/more') ? 'page' : undefined}
				><Ellipsis size={22} aria-hidden="true" /><span class="sr-only wide:not-sr-only"
					>{m.nav_more()}</span
				></a
			>
		</nav>
	</div>

	<!-- Room for the phone's status bar at the top (the page draws under it, viewport-fit=cover; iOS blurs what scrolls
	     beneath it, and the blur fades out a little below the bar, hence the extra 12 px) and for the tab bar and home
	     indicator at the bottom. -->
	<div
		class="min-w-0 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(96px+env(safe-area-inset-bottom))] desk:pt-0 desk:pb-0"
	>
		{@render children()}
	</div>
</div>

<nav
	aria-label={m.nav_main()}
	class="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 flex gap-1 rounded-card border border-(--tabbar-border) bg-surface p-1.5 shadow-tabbar desk:hidden"
>
	{#if activeTab >= 0}<span class="tab-thumb" style:--at={activeTab} aria-hidden="true"></span>{/if}
	<a href={resolve('/(app)')} class={tabItem(is('/'))} aria-current={is('/') ? 'page' : undefined}
		><CalendarDays size={22} aria-hidden="true" />{m.nav_today()}</a
	>
	<a
		href={resolve('/(app)/log')}
		class={tabItem(is('/log'))}
		aria-current={is('/log') ? 'page' : undefined}
		><CirclePlus size={22} aria-hidden="true" />{m.nav_log()}</a
	>
	<a
		href={resolve('/(app)/journal')}
		class={tabItem(is('/journal'))}
		aria-current={is('/journal') ? 'page' : undefined}
		><BookOpen size={22} aria-hidden="true" />{m.nav_journal()}</a
	>
	<a
		href={resolve('/(app)/progress')}
		class={tabItem(is('/progress'))}
		aria-current={is('/progress') ? 'page' : undefined}
		><TrendingUp size={22} aria-hidden="true" />{m.nav_progress()}</a
	>
	<a
		href={resolve('/(app)/more')}
		class={tabItem(moreActive)}
		aria-current={is('/more') ? 'page' : undefined}
		><Ellipsis size={22} aria-hidden="true" />{m.nav_more()}</a
	>
</nav>

<Toast />
<Celebration />

<style>
	/* The five tabs share the bar's width: 6 px of padding each side and 4 px between them. */
	.tab-thumb {
		position: absolute;
		top: 6px;
		bottom: 6px;
		left: 6px;
		width: calc((100% - 12px - 16px) / 5);
		border-radius: var(--radius-input);
		background: var(--soft);
		transform: translateX(calc((100% + 4px) * var(--at)));
		transition: transform 380ms var(--travel);
	}
	@media (prefers-reduced-motion: reduce) {
		.tab-thumb {
			transition: none;
		}
	}
</style>
