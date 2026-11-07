<script lang="ts">
	// docs/ui.md, "Achievements, Journal and Help": flat circles. Kilo badges carry only the number, their tint deepening
	// every 10 kg; streaks, the goal and firsts show their picture on a light tint of their colour. The next mark is a
	// dashed outline with its number in the same type. Decorative: the words beside it carry the meaning.
	import type { Achievement } from '#lib/shared/achievements.ts';
	import { STREAK_LEVELS } from '#lib/shared/achievements.ts';
	import { badgeHue, kiloTint } from '#lib/shared/achievement-display.ts';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Scale from '@lucide/svelte/icons/scale';
	import Utensils from '@lucide/svelte/icons/utensils';
	import Picture from './Picture.svelte';
	import { achievementPicture } from './text.ts';

	interface Props {
		achievement: Pick<Achievement, 'kind' | 'level'>;
		/** The next one to reach: an outline only. */
		next?: boolean;
		size?: 'md' | 'sm';
	}
	let { achievement: a, next = false, size = 'md' }: Props = $props();

	const kilo = $derived(a.kind === 'weight');
	const tint = $derived(kilo ? kiloTint(Number(a.level)) : { percent: 16, ink: 1 as const });
	const hue = $derived(`var(--badge-${badgeHue(a, STREAK_LEVELS)})`);
	const numbered = $derived(a.kind === 'weight' || (next && a.kind === 'streak'));
	/** A first still to reach (a new account's Progress): a line icon in the outline, as in the demo. */
	const OUTLINE_ICONS = { weigh_in: Scale, day_logged: Utensils, complete_day: CircleCheck };
	const OutlineIcon = $derived(
		next && a.kind === 'first' ? OUTLINE_ICONS[a.level as keyof typeof OUTLINE_ICONS] : undefined
	);
</script>

<span
	aria-hidden="true"
	class={[
		'grid shrink-0 place-items-center rounded-full',
		size === 'md' ? 'size-16' : 'size-10',
		next && 'border-2 border-dashed border-line'
	]}
	style:background-color={next
		? undefined
		: `color-mix(in srgb, ${hue} ${tint.percent}%, var(--surface))`}
	style:color={next ? 'var(--muted)' : kilo ? `var(--kilo-ink-${tint.ink})` : undefined}
>
	{#if OutlineIcon}
		<OutlineIcon size={size === 'md' ? 26 : 18} aria-hidden="true" />
	{:else if numbered}
		<span
			class={[
				'font-display leading-none font-extrabold tracking-[-0.02em] tabular-nums',
				size === 'md' ? 'text-[24px]' : 'text-[15px]'
			]}>{a.level}</span
		>
	{:else}
		<Picture hex={achievementPicture(a as Achievement)} size={size === 'md' ? 36 : 24} />
	{/if}
</span>
