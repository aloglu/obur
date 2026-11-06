<script lang="ts">
	// docs/ui.md "Themes": mode, then themes. Both are per device and apply at once.
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { m } from '#lib/paraglide/messages.js';
	import { setPalette, setTheme, type ThemeChoice } from '#lib/client/prefs.ts';
	import { PALETTES, type PaletteId } from '#lib/shared/themes.ts';
	import Card from '#lib/ui/Card.svelte';
	import Chips from '#lib/ui/Chips.svelte';

	let { data } = $props();
	let theme = $state<ThemeChoice>(untrack(() => data.theme));
	let palette = $state<PaletteId>(untrack(() => data.palette));

	function pick(id: PaletteId) {
		palette = id;
		setPalette(id);
	}
</script>

<svelte:head><title>{m.more_appearance()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<a href={resolve('/(app)/more')} class="flex items-center gap-1 self-start font-bold text-accent">
		<ChevronLeft size={20} aria-hidden="true" />{m.nav_more()}
	</a>
	<h1 class="text-[24px] font-[750]">{m.more_appearance()}</h1>
	<Card>
		<Chips
			label={m.more_mode()}
			bind:value={theme}
			onchange={setTheme}
			options={[
				{ value: 'system', label: m.theme_system() },
				{ value: 'light', label: m.theme_light() },
				{ value: 'dark', label: m.theme_dark() }
			]}
		/>
	</Card>
	<Card title={m.more_theme()}>
		<div class="grid grid-cols-4 gap-2" role="radiogroup" aria-label={m.more_theme()}>
			{#each PALETTES as p (p.id)}
				<button
					type="button"
					role="radio"
					aria-checked={palette === p.id}
					onclick={() => pick(p.id)}
					class="flex min-w-0 flex-col items-center gap-1.5 text-[13px] font-semibold"
				>
					<span
						class={[
							'relative block h-11 w-full overflow-hidden rounded-small border border-line',
							palette === p.id && 'outline-2 outline-offset-1 outline-accent'
						]}
						style:background={p.swatch[1]}
						aria-hidden="true"
					>
						<span
							class="absolute right-1.5 bottom-1.5 size-4 rounded-full"
							style:background={p.swatch[0]}
						></span>
					</span>
					{p.name}
				</button>
			{/each}
		</div>
	</Card>
</main>
