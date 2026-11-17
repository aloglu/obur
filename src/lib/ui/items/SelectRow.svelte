<script lang="ts">
	// One row of a list that can be selected (docs/ui.md, "Archived and deleted"): a link, or a row with its own action
	// at the right (Restore in Recently deleted); while selecting, a round check opens at the left and a tap toggles it,
	// as on Today.
	import Check from '@lucide/svelte/icons/check';
	import type { Snippet } from 'svelte';
	import FoodIcon from '../FoodIcon.svelte';

	interface Props {
		href?: string;
		icon: string | null | undefined;
		name: string;
		brand?: string | null;
		detail: string;
		/** Energy as shown, or null when it isn't known. */
		kcal: number | string | null;
		/** The words an icon is suggested from, when they aren't the row's name. */
		iconFrom?: { name: string; brand: string | null };
		selecting: boolean;
		selected: boolean;
		ontoggle: () => void;
		/** An action at the right when not selecting (Restore). */
		end?: Snippet;
	}
	let {
		href,
		icon,
		name,
		brand = null,
		detail,
		kcal,
		iconFrom,
		selecting,
		selected,
		ontoggle,
		end
	}: Props = $props();
	const row =
		'grid min-h-14 w-full grid-cols-[auto_40px_minmax(0,1fr)_auto] items-center rounded-input px-2.5 py-1.5 text-left transition-colors duration-700';
</script>

{#snippet body()}
	<span class={['check-slot', selecting && 'on']} aria-hidden="true">
		<span
			class={[
				'grid size-6 shrink-0 place-items-center rounded-full border-2',
				selected ? 'border-accent bg-fill text-on-accent' : 'border-muted bg-surface'
			]}
			>{#if selected}<Check size={14} strokeWidth={3} />{/if}</span
		>
	</span>
	<FoodIcon {icon} name={iconFrom?.name ?? name} brand={iconFrom?.brand ?? brand} />
	<span class="ml-3 min-w-0">
		<span class="line-clamp-2 text-[0.9375rem] leading-[1.3] font-semibold break-words"
			>{brand ? `${brand} ` : ''}{name}</span
		>
		<small class="block text-[0.8125rem] text-muted">{detail}</small>
	</span>
	<span class="ml-3 text-[0.9375rem] font-semibold tabular-nums">{kcal === null ? '–' : kcal}</span>
{/snippet}

<li class="flex items-center gap-1">
	{#if selecting}
		<button
			type="button"
			onclick={ontoggle}
			aria-pressed={selected}
			class={[row, selected ? 'bg-soft' : 'hover:bg-surface2']}>{@render body()}</button
		>
	{:else if href}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- every caller passes resolve(...) -->
		<a
			{href}
			onclick={(event) => {
				// Ctrl/⌘-click selects on desktop, as on Today.
				if (event.ctrlKey || event.metaKey) {
					event.preventDefault();
					ontoggle();
				}
			}}
			class={[row, 'hover:bg-surface2']}>{@render body()}</a
		>
	{:else}
		<div class={[row, 'min-w-0 flex-1']}>{@render body()}</div>
		{@render end?.()}
	{/if}
</li>

<style>
	/* The room for the check opens as selecting starts; closed, it takes no space, not even its gap. */
	.check-slot {
		display: grid;
		width: 0;
		margin-right: 0;
		overflow: hidden;
		opacity: 0;
		transition:
			width 300ms var(--ui),
			margin-right 300ms var(--ui),
			opacity 200ms;
	}
	.check-slot.on {
		width: 24px;
		margin-right: 12px;
		opacity: 1;
	}
	@media (prefers-reduced-motion: reduce) {
		.check-slot {
			transition: none;
		}
	}
</style>
