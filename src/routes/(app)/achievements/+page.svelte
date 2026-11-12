<script lang="ts">
	// docs/ui.md, "Achievements, Journal and Help": the badge page. Kilos lost and streaks newest first after the one
	// next mark; the goal and firsts only once reached. Tapping an earned badge plays its celebration again.
	import PageHead from '#lib/ui/PageHead.svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { Achievement } from '#lib/shared/achievements.ts';
	import { shortDate } from '#lib/shared/format.ts';
	import Badge from '#lib/ui/achievements/Badge.svelte';
	import { firstName } from '#lib/ui/achievements/text.ts';
	import { replayCelebration } from '#lib/client/celebration.svelte.ts';

	let { data } = $props();
	const of = <K extends Achievement['kind']>(kind: K) =>
		data.achievements
			.filter((a): a is Extract<typeof a, { kind: K }> => a.kind === kind)
			.slice()
			.reverse();
	const weights = $derived(of('weight'));
	const goals = $derived(of('goal'));
	const streaks = $derived(of('streak'));
	const firsts = $derived(data.achievements.filter((a) => a.kind === 'first'));
	const kg = (v: number) => String(v).replace('.', ',');

	const card = 'flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card';
	const grid = 'grid grid-cols-4 gap-x-2 gap-y-3 desk:grid-cols-6';
	const item =
		'flex min-w-0 flex-col items-center gap-1.5 text-center text-[0.75rem] font-[650] leading-tight';
</script>

<svelte:head><title>{m.achievements_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[760px] flex-col gap-3 px-3.5 py-4 desk:gap-5 desk:px-7">
	<PageHead
		href={resolve('/(app)/progress')}
		label={m.nav_progress()}
		title={m.achievements_title()}
	/>

	<section class={card} aria-labelledby="weight-title">
		<div>
			<h2 id="weight-title" class="text-[1.1875rem] font-bold">{m.achievements_weight_title()}</h2>
			<p class="text-[0.8125rem] text-muted">
				{weights.length
					? m.achievements_weight_note({ count: String(weights.length) })
					: data.weightAllowed
						? m.achievements_weight_none()
						: m.achievements_weight_off()}
			</p>
		</div>
		{#if data.weightAllowed || weights.length}
			<ul class={grid}>
				{#if data.weightAllowed && data.next.weight !== null}
					<li class={[item, 'text-muted']}>
						<Badge achievement={{ kind: 'weight', level: data.next.weight }} next />
						<span class="sr-only"
							>{m.achievements_next_weight({ kg: String(data.next.weight) })}</span
						>
						<span aria-hidden="true">{m.achievements_next()}</span>
					</li>
				{/if}
				{#each weights as a (a.level)}
					<li>
						<button
							type="button"
							class={[item, 'w-full']}
							onclick={(e) => replayCelebration(a, e.currentTarget)}
						>
							<Badge achievement={a} />
							<span class="sr-only"
								>{m.achievements_weight_label({
									kg: String(a.level),
									date: shortDate(a.date)
								})}</span
							>
							<span aria-hidden="true">{shortDate(a.date)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if goals.length}
		<section class={card} aria-labelledby="goal-title">
			<h2 id="goal-title" class="text-[1.1875rem] font-bold">{m.achievements_goal_title()}</h2>
			<ul class={grid}>
				{#each goals as a (a.level)}
					<li>
						<button
							type="button"
							class={[item, 'w-full']}
							onclick={(e) => replayCelebration(a, e.currentTarget)}
						>
							<Badge achievement={a} />
							<span class="sr-only"
								>{m.achievements_goal_label({ kg: kg(a.level), date: shortDate(a.date) })}</span
							>
							<span aria-hidden="true">{kg(a.level)} kg</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class={card} aria-labelledby="streak-title">
		<h2 id="streak-title" class="text-[1.1875rem] font-bold">{m.achievements_streak_title()}</h2>
		<ul class={grid}>
			{#if data.next.streak !== null}
				<li class={[item, 'text-muted']}>
					<Badge achievement={{ kind: 'streak', level: data.next.streak }} next />
					<span class="sr-only"
						>{m.achievements_next_streak({ days: String(data.next.streak) })}</span
					>
					<span aria-hidden="true">{m.achievements_days({ days: String(data.next.streak) })}</span>
				</li>
			{/if}
			{#each streaks as a (a.level)}
				<li>
					<button
						type="button"
						class={[item, 'w-full']}
						onclick={(e) => replayCelebration(a, e.currentTarget)}
					>
						<Badge achievement={a} />
						<span class="sr-only"
							>{m.achievements_streak_label({
								days: String(a.level),
								date: shortDate(a.date)
							})}</span
						>
						<span aria-hidden="true">{m.achievements_days({ days: String(a.level) })}</span>
					</button>
				</li>
			{/each}
		</ul>
	</section>

	{#if firsts.length}
		<section class={card} aria-labelledby="firsts-title">
			<h2 id="firsts-title" class="text-[1.1875rem] font-bold">{m.achievements_firsts_title()}</h2>
			<ul class={grid}>
				{#each firsts as a (a.level)}
					<li>
						<button
							type="button"
							class={[item, 'w-full']}
							onclick={(e) => replayCelebration(a, e.currentTarget)}
						>
							<Badge achievement={a} />
							<span class="sr-only"
								>{m.achievements_first_label({
									name: firstName(a.level as 'scan' | 'voice' | 'recipe'),
									date: shortDate(a.date)
								})}</span
							>
							<span aria-hidden="true">{firstName(a.level as 'scan' | 'voice' | 'recipe')}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>
