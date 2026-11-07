<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { m } from '#lib/paraglide/messages.js';
	import { closeInlineOnOutsideTap } from '#lib/client/inline-field.svelte.ts';
	import HistorySection from '#lib/ui/progress/HistorySection.svelte';
	import RangeSelect from '#lib/ui/progress/RangeSelect.svelte';
	import Badge from '#lib/ui/achievements/Badge.svelte';
	import { achievementTitle } from '#lib/ui/achievements/text.ts';
	import type { Achievement } from '#lib/shared/achievements.ts';

	// A new account sees the first ones to reach, as outlines (owner, 2026-11-07); after the first, the row to the page.
	const FIRST_STEPS: Achievement[] = [
		{ kind: 'first', level: 'weigh_in', date: '' },
		{ kind: 'first', level: 'day_logged', date: '' },
		{ kind: 'first', level: 'complete_day', date: '' },
		{ kind: 'streak', level: 3, date: '' }
	];

	let { data } = $props();
	$effect(() => closeInlineOnOutsideTap());
	const setRange = (range: string) =>
		goto(`${resolve('/(app)/progress')}?range=${range}` as ResolvedPathname, {
			replace: true,
			reset: false
		});
</script>

<svelte:head><title>{m.progress_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[920px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<div class="flex items-center justify-between gap-3">
		<h1 class="text-[1.5rem] font-[750]">{m.progress_title()}</h1>
		<RangeSelect id="range" value={data.history.range} onchange={setRange} />
	</div>
	<HistorySection history={data.history} today={data.today} onchange={invalidateAll} />
	{#if data.achievements === 0}
		<section
			class="flex flex-col gap-3.5 rounded-card bg-surface p-[18px] shadow-card"
			aria-labelledby="achievements-title"
		>
			<div class="flex items-baseline justify-between gap-3">
				<h2 id="achievements-title" class="text-[1.0625rem] font-bold">{m.achievements_row()}</h2>
				<span class="text-[0.8125rem] text-muted">{m.achievements_row_count({ count: '0' })}</span>
			</div>
			<ul
				class="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-x-2 gap-y-4"
				aria-label={m.achievements_to_reach()}
			>
				{#each FIRST_STEPS as a (`${a.kind}:${a.level}`)}
					<li class="flex min-w-0 flex-col items-center gap-1.5 text-center">
						<Badge achievement={a} next />
						<span class="text-[0.8125rem] leading-tight font-[650] break-words"
							>{a.kind === 'streak'
								? m.achievements_streak_short({ days: String(a.level) })
								: achievementTitle(a)}</span
						>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<a
			href={resolve('/(app)/achievements')}
			class="flex min-h-14 items-center gap-3 rounded-card bg-surface px-[18px] py-3 shadow-card"
		>
			<span class="flex-1 text-[1.0625rem] font-bold">{m.achievements_row()}</span>
			<span class="text-[0.875rem] text-muted"
				>{m.achievements_row_count({ count: String(data.achievements) })}</span
			>
			<ChevronRight size={20} aria-hidden="true" class="text-muted" />
		</a>
	{/if}
</main>
