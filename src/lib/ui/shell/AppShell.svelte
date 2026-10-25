<script lang="ts">
	// Navigation per docs/ui.md: floating pill tab bar on phones; sticky 232 px side nav from 760 px.
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { m } from '#lib/paraglide/messages.js';
	import Toast from './Toast.svelte';

	let { children }: { children: Snippet } = $props();

	const path = $derived(page.url.pathname);
	const is = (prefix: string) => (prefix === '/' ? path === '/' : path.startsWith(prefix));
	const moreActive = $derived(
		['/more', '/profile', '/settings', '/foods', '/household'].some((p) => path.startsWith(p))
	);

	const sideItem = (active: boolean) => [
		'flex min-h-12 items-center gap-3 rounded-input px-3 text-[16px] font-semibold',
		active ? 'bg-soft text-accent' : 'text-text hover:bg-surface2'
	];
	const tabItem = (active: boolean) => [
		'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11.5px] font-bold',
		active ? 'bg-soft text-accent' : 'text-muted'
	];
</script>

<div class="min-h-dvh desk:grid desk:grid-cols-[232px_minmax(0,1fr)]">
	<!-- The column carries the background so it spans the full page height; the nav inside stays sticky. -->
	<div class="hidden border-r border-line bg-surface desk:block">
		<nav aria-label={m.nav_main()} class="sticky top-0 flex h-dvh flex-col gap-1 p-3">
			<a
				href={resolve('/(app)')}
				class="px-3 pt-2 pb-6 font-display text-[30px] font-extrabold tracking-[-0.02em] text-accent"
				>{m.app_name()}</a
			>
			<a
				href={resolve('/(app)')}
				class={sideItem(is('/'))}
				aria-current={is('/') ? 'page' : undefined}
				><CalendarDays size={22} aria-hidden="true" />{m.nav_today()}</a
			>
			<a
				href={resolve('/(app)/log')}
				class={sideItem(is('/log'))}
				aria-current={is('/log') ? 'page' : undefined}
				><CirclePlus size={22} aria-hidden="true" />{m.nav_log()}</a
			>
			<a
				href={resolve('/(app)/progress')}
				class={sideItem(is('/progress'))}
				aria-current={is('/progress') ? 'page' : undefined}
				><TrendingUp size={22} aria-hidden="true" />{m.nav_progress()}</a
			>
			<div class="flex-1"></div>
			<a
				href={resolve('/(app)/profile')}
				class={sideItem(is('/profile'))}
				aria-current={is('/profile') ? 'page' : undefined}
				><UserRound size={22} aria-hidden="true" />{m.nav_profile()}</a
			>
			<a
				href={resolve('/(app)/settings')}
				class={sideItem(is('/settings') || is('/foods') || is('/household'))}
				aria-current={is('/settings') ? 'page' : undefined}
				><SlidersHorizontal size={22} aria-hidden="true" />{m.nav_settings()}</a
			>
		</nav>
	</div>

	<div class="min-w-0 pb-[calc(96px+env(safe-area-inset-bottom))] desk:pb-0">
		{@render children()}
	</div>
</div>

<nav
	aria-label={m.nav_main()}
	class="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 flex gap-1 rounded-full border border-(--tabbar-border) bg-surface p-1.5 shadow-tabbar desk:hidden"
>
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
