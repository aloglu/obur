<script lang="ts">
	// docs/ui.md, "Achievements, Journal and Help": search that ignores accents and Turkish letters, topic chips,
	// short real answers that open in place.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import { m } from '#lib/paraglide/messages.js';
	import {
		HELP,
		HELP_TOPICS,
		helpMatches,
		type HelpEntry,
		type HelpTopic
	} from '#lib/shared/help.ts';

	const messages = m as unknown as Record<string, () => string>;
	const text = (key: string) => messages[key]();
	const paragraphs = (h: HelpEntry) =>
		Array.from({ length: h.answers }, (_, i) => text(`help_${h.id}_a${i + 1}`));
	const topicName = (t: HelpTopic) => text(`help_topic_${t}`);

	let query = $state('');
	let topic = $state<HelpTopic | 'all'>('all');
	const shown = $derived(
		HELP.filter(
			(h) =>
				(topic === 'all' || h.topic === topic) &&
				helpMatches(
					query,
					[text(`help_${h.id}_q`), ...paragraphs(h), text(`help_${h.id}_k`)].join(' ')
				)
		)
	);
	const groups = $derived(HELP_TOPICS.filter((t) => shown.some((h) => h.topic === t)));
	// A formula paragraph ("Budget = …") is set apart.
	const formula = (p: string) => /^\S+ = /.test(p);
</script>

<svelte:head><title>{m.help_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[24px] font-[750]">{m.help_title()}</h1>
	<label
		class="flex min-h-12 items-center gap-2.5 rounded-input border border-line bg-surface px-3.5 focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-accent"
	>
		<Search size={20} aria-hidden="true" class="shrink-0 text-muted" />
		<input
			type="search"
			bind:value={query}
			placeholder={m.help_search()}
			aria-label={m.help_search()}
			class="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none"
		/>
	</label>
	<div class="flex flex-wrap gap-2" role="group" aria-label={m.help_topics()}>
		{#each ['all' as const, ...HELP_TOPICS] as t (t)}
			<button
				type="button"
				aria-pressed={topic === t}
				onclick={() => (topic = t)}
				class={[
					'min-h-11 rounded-full px-4 text-[14px] font-semibold',
					topic === t ? 'bg-fill text-on-accent' : 'bg-surface2 text-text'
				]}>{t === 'all' ? m.help_all() : topicName(t)}</button
			>
		{/each}
	</div>

	{#each groups as g (g)}
		<section
			class="flex flex-col rounded-card bg-surface px-[18px] py-2 shadow-card"
			aria-labelledby="topic-{g}"
		>
			<h2
				id="topic-{g}"
				class="pt-2 pb-1 text-[12px] font-bold tracking-[0.06em] text-muted uppercase"
			>
				{topicName(g)}
			</h2>
			<div class="flex flex-col divide-y divide-line">
				{#each shown.filter((h) => h.topic === g) as h (h.id)}
					<details class="group" open={query.trim() !== '' && shown.length === 1}>
						<summary
							class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-2 text-[15px] font-semibold [&::-webkit-details-marker]:hidden"
						>
							{text(`help_${h.id}_q`)}
							<ChevronDown
								size={20}
								aria-hidden="true"
								class="shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
							/>
						</summary>
						<div class="flex flex-col gap-2.5 pb-4 text-[15px] leading-relaxed">
							{#each paragraphs(h) as p, i (i)}
								{#if formula(p)}
									<p class="rounded-tile bg-surface2 px-3.5 py-2.5 text-[14px] font-semibold">
										{p}
									</p>
								{:else}
									<p>{p}</p>
								{/if}
							{/each}
						</div>
					</details>
				{/each}
			</div>
		</section>
	{:else}
		<p class="px-1 text-[15px] text-muted">{m.help_none({ query: query.trim() })}</p>
	{/each}
</main>
