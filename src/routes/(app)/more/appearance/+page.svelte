<script lang="ts">
	// docs/ui.md "Themes" and "App icon": mode, then themes, then the app icon, kept with the account (on every device
	// and in the backup). Mode and theme apply at once; the icon shows the next time obur is added to the Home Screen.
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { m } from '#lib/paraglide/messages.js';
	import {
		savePreferences,
		setAppIcon,
		setPalette,
		setTheme,
		type ThemeChoice
	} from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { Preferences } from '#lib/shared/preferences.ts';
	import { APP_ICONS, appIconFile, type AppIconId } from '#lib/shared/app-icons.ts';
	import { PALETTES, type PaletteId } from '#lib/shared/themes.ts';
	import Card from '#lib/ui/Card.svelte';
	import Chips from '#lib/ui/Chips.svelte';

	let { data } = $props();
	let theme = $state<ThemeChoice>(untrack(() => data.theme));
	let palette = $state<PaletteId>(untrack(() => data.palette));
	let appIcon = $state<AppIconId>(untrack(() => data.appIcon));

	/** Shown at once, saved to the account; put back as it was when it couldn't be saved. */
	async function keep(change: Partial<Preferences>, show: () => void, undo: () => void) {
		show();
		try {
			await savePreferences(change);
		} catch {
			undo();
			showToast({ message: m.settings_save_failed() });
		}
	}
	function chooseTheme(next: ThemeChoice) {
		const before = theme;
		void keep(
			{ themeMode: next },
			() => ((theme = next), setTheme(next)),
			() => ((theme = before), setTheme(before))
		);
	}
	function pick(id: PaletteId) {
		const before = palette;
		void keep(
			{ palette: id },
			() => ((palette = id), setPalette(id)),
			() => ((palette = before), setPalette(before))
		);
	}
	// Safari reads the Home Screen icon when a page loads and ignores later changes to it (owner's iPhone,
	// 2026-11-07), so once saved, the page loads again with the new one; the toast carries over the reload.
	async function chooseIcon(id: AppIconId) {
		const before = appIcon;
		appIcon = id;
		try {
			await savePreferences({ appIcon: id });
		} catch {
			appIcon = before;
			showToast({ message: m.settings_save_failed() });
			return;
		}
		setAppIcon(id);
		showToast({ message: m.app_icon_saved(), detail: m.app_icon_saved_detail() });
		location.reload();
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
			value={theme}
			onchange={chooseTheme}
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
	<Card title={m.more_app_icon()}>
		<div class="grid grid-cols-4 gap-x-2 gap-y-3" role="radiogroup" aria-label={m.more_app_icon()}>
			{#each APP_ICONS as icon (icon.id)}
				<button
					type="button"
					role="radio"
					aria-checked={appIcon === icon.id}
					onclick={() => chooseIcon(icon.id)}
					class="flex min-w-0 flex-col items-center gap-1.5 text-center text-[13px] leading-tight font-semibold"
				>
					<img
						src={appIconFile(icon.id, 'icon-180.png')}
						alt=""
						width="64"
						height="64"
						loading="lazy"
						class={[
							'aspect-square w-full max-w-16 rounded-[22.5%]',
							appIcon === icon.id && 'outline-2 outline-offset-2 outline-accent'
						]}
					/>
					{icon.name}
				</button>
			{/each}
		</div>
		<p class="text-[13px] text-muted">{m.more_app_icon_hint()}</p>
	</Card>
</main>
