<script lang="ts">
	// docs/ui.md, "Achievements, Journal and Help": search that ignores accents and Turkish letters, answers grouped
	// by topic that slide open in place (the shared .collapse-row), one search match opened by itself.
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import { m } from '#lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import PageHead from '#lib/ui/PageHead.svelte';
	import DayRing from '#lib/ui/progress/DayRing.svelte';
	import {
		HELP,
		HELP_TOPICS,
		helpMatches,
		type HelpEntry,
		type HelpTopic
	} from '#lib/shared/help.ts';

	const RING_EXAMPLES = [
		{ status: 'under', fill: 0.7, label: m.help_ring_under },
		{ status: 'over', fill: 1, label: m.help_ring_over },
		{ status: 'incomplete', fill: 0.6, label: m.help_ring_incomplete },
		{ status: 'unlogged', fill: 0, label: m.help_ring_unlogged }
	] as const;
	const messages = m as unknown as Record<string, () => string>;
	const text = (key: string) => messages[key]();
	const paragraphs = (h: HelpEntry) =>
		Array.from({ length: h.answers }, (_, i) => text(`help_${h.id}_a${i + 1}`));
	const topicName = (t: HelpTopic) => text(`help_topic_${t}`);

	let query = $state('');
	const shown = $derived(
		HELP.filter((h) =>
			helpMatches(
				query,
				[text(`help_${h.id}_q`), ...paragraphs(h), text(`help_${h.id}_k`)].join(' ')
			)
		)
	);
	const opened = new SvelteSet<string>();
	const open = (h: HelpEntry) => opened.has(h.id);
	const toggle = (h: HelpEntry) => (opened.has(h.id) ? opened.delete(h.id) : opened.add(h.id));
	// A search with one match opens it (and it can still be closed).
	const single = $derived(query.trim() !== '' && shown.length === 1 ? shown[0].id : null);
	$effect(() => {
		const id = single;
		if (id) untrack(() => opened.add(id));
	});
	const groups = $derived(HELP_TOPICS.filter((t) => shown.some((h) => h.topic === t)));
	// A formula paragraph ("Budget = …") is set apart.
	const formula = (p: string) => /^\S+ = /.test(p);
</script>

<svelte:head><title>{m.help_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead href={resolve('/(app)/more')} label={m.nav_more()} title={m.help_title()} />
	<div class="pinned-search">
		<label
			class="flex min-h-12 items-center gap-2.5 rounded-input border border-line bg-surface px-3.5 focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-accent"
		>
			<Search size={20} aria-hidden="true" class="shrink-0 text-muted" />
			<input
				type="search"
				bind:value={query}
				placeholder={m.help_search()}
				aria-label={m.help_search()}
				class="min-w-0 flex-1 bg-transparent py-2 text-[1rem] outline-none"
			/>
		</label>
	</div>

	{#each groups as g (g)}
		<section
			class="flex flex-col rounded-card bg-surface px-[18px] py-2 shadow-card"
			aria-labelledby="topic-{g}"
		>
			<h2
				id="topic-{g}"
				class="pt-2 pb-1 text-[0.75rem] font-bold tracking-[0.06em] text-muted uppercase"
			>
				{topicName(g)}
			</h2>
			<div class="flex flex-col divide-y divide-line">
				{#each shown.filter((h) => h.topic === g) as h (h.id)}
					<div>
						<h3>
							<button
								type="button"
								aria-expanded={open(h)}
								aria-controls="answer-{h.id}"
								onclick={() => toggle(h)}
								class="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left text-[0.9375rem] font-semibold"
							>
								{text(`help_${h.id}_q`)}
								<ChevronDown
									size={20}
									aria-hidden="true"
									class={[
										'shrink-0 text-muted transition-transform duration-300 motion-reduce:transition-none',
										open(h) && 'rotate-180'
									]}
								/>
							</button>
						</h3>
						<div id="answer-{h.id}" class={['collapse-row', open(h) && 'open']}>
							<div>
								<div class="flex flex-col gap-2.5 pb-4 text-[0.9375rem] leading-relaxed">
									{#each paragraphs(h) as p, i (i)}
										{#if formula(p)}
											<p
												class="rounded-tile bg-surface2 px-3.5 py-2.5 text-[0.875rem] font-semibold"
											>
												{p}
											</p>
										{:else}
											<p>{p}</p>
										{/if}
									{/each}
									{#if h.id === 'rings'}
										<ul class="flex flex-col gap-2.5">
											{#each RING_EXAMPLES as example (example.status)}
												<li
													class="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3 text-[0.875rem]"
												>
													<span class="size-9"
														><DayRing status={example.status} fill={example.fill} /></span
													>
													{example.label()}
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<p class="px-1 text-[0.9375rem] text-muted">{m.help_none({ query: query.trim() })}</p>
	{/each}
</main>
