<script lang="ts">
	// Choosing a food's icon (docs/ui.md, "Food icons"): search by word in English or Turkish, or browse all; the
	// name's suggestion is offered first. Choosing closes the sheet.
	import { m } from '#lib/paraglide/messages.js';
	import { FOOD_ICONS, GENERIC_ICON } from '#lib/shared/food-icons.ts';
	import IconImage from '../IconImage.svelte';
	import { foldForSearch } from '#lib/shared/search-text.ts';
	import Sheet from '../Sheet.svelte';
	import TextField from '../TextField.svelte';

	interface Props {
		/** The icon the name suggests, if any. */
		suggested: string | null;
		chosen: string | null;
		/** Null: back to the suggestion. */
		onchoose: (hex: string | null) => void;
		onclose: () => void;
	}
	let { suggested, chosen, onchoose, onclose }: Props = $props();

	let query = $state('');
	const shown = $derived.by(() => {
		const q = foldForSearch(query);
		if (!q) return FOOD_ICONS;
		return FOOD_ICONS.filter((i) => i.words.some((w) => foldForSearch(w).includes(q)));
	});
</script>

<Sheet title={m.icon_title()} {onclose}>
	<TextField
		label={m.icon_search()}
		placeholder={m.icon_search_placeholder()}
		bind:value={query}
		type="search"
		autocomplete="off"
	/>
	{#if chosen}
		<button
			type="button"
			onclick={() => onchoose(null)}
			class="flex min-h-12 items-center gap-3 rounded-input bg-surface2 px-3 text-left text-[15px] font-semibold"
		>
			<span class="grid size-10 place-items-center rounded-small bg-icon-tile" aria-hidden="true"
				><IconImage hex={suggested ?? GENERIC_ICON} size={28} /></span
			>
			{suggested ? m.icon_use_suggestion() : m.icon_use_plate()}
		</button>
	{/if}
	{#if shown.length === 0}
		<p class="text-[14px] text-muted">{m.icon_none()}</p>
	{/if}
	<ul class="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2" aria-label={m.icon_title()}>
		{#each shown as icon (icon.hex)}
			<li>
				<button
					type="button"
					onclick={() => onchoose(icon.hex)}
					aria-label={icon.words[0]}
					aria-pressed={chosen === icon.hex}
					title={icon.words.slice(0, 4).join(', ')}
					class={[
						'grid aspect-square w-full place-items-center rounded-small bg-icon-tile',
						chosen === icon.hex && 'ring-3 ring-accent'
					]}
				>
					<IconImage hex={icon.hex} size={36} />
				</button>
			</li>
		{/each}
	</ul>
</Sheet>
