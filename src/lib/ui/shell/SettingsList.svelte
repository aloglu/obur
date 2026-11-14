<script lang="ts">
	// docs/ui.md "More and settings": More → Settings, compact rows with their current values; each opens its page.
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { ThemeChoice, TimeFormat } from '#lib/client/prefs.ts';
	import { paletteOf, type PaletteId } from '#lib/shared/themes.ts';
	import { LANGUAGE_NAMES, type Language } from '#lib/shared/languages.ts';
	import { savePreferences, showLanguage } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import MenuRow from '#lib/ui/MenuRow.svelte';
	import NavRow from './NavRow.svelte';

	interface Props {
		theme: ThemeChoice;
		palette: PaletteId;
		timeFormat: TimeFormat;
		/** The goal row's value, when there's a calculated budget. */
		goal: string | null;
		/** Reminders are configured on this server. */
		reminders: boolean;
		/** The Speak and Scan row's value, when people may use their own key here. */
		speakScan?: string | null;
		/** The account's language, and the ones this server offers (the choice shows with more than one). */
		language: Language;
		languages: readonly Language[];
	}
	let {
		theme,
		palette,
		timeFormat,
		goal,
		reminders,
		speakScan = null,
		language,
		languages
	}: Props = $props();

	// A new language draws every page again: saved with the account, then the app reloads in it, its saved copies of
	// pages cleared (docs/design.md, "Interface language").
	let chosenLanguage = $derived(language);
	async function changeLanguage(next: Language) {
		try {
			await savePreferences({ language: next });
			await showLanguage(next, true);
		} catch {
			chosenLanguage = language;
			showToast({ message: m.settings_save_failed() });
		}
	}

	const mode = $derived(
		{ system: m.theme_system(), light: m.theme_light(), dark: m.theme_dark() }[theme]
	);
	const time = $derived(
		{ device: m.time_device(), '24': m.time_24(), '12': m.time_12() }[timeFormat]
	);

	const group = 'flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card';
</script>

<div class={group}>
	<NavRow href={resolve('/(app)/profile')} label={m.more_profile()} />
	<NavRow href={resolve('/(app)/more/goal')} label={m.more_goal()} value={goal ?? undefined} />
	{#if languages.length > 1}
		<MenuRow
			label={m.more_language()}
			bind:value={chosenLanguage}
			onchange={changeLanguage}
			options={languages.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
		/>
	{/if}
	<NavRow href={resolve('/(app)/more/units')} label={m.more_units()} value="kg · {time}" />
	<NavRow
		href={resolve('/(app)/more/appearance')}
		label={m.more_appearance()}
		value="{paletteOf(palette).name} · {mode}"
	/>
	{#if reminders}
		<NavRow href={resolve('/(app)/settings/reminders')} label={m.reminders_title()} />
	{/if}
	{#if speakScan !== null}
		<NavRow
			href={resolve('/(app)/more/speak-and-scan')}
			label={m.more_speak_scan()}
			value={speakScan}
		/>
	{/if}
</div>

<div class={group}>
	<NavRow href={resolve('/(app)/settings/data')} label={m.more_data()} />
	<NavRow href={resolve('/(app)/settings/security')} label={m.more_security()} />
</div>
