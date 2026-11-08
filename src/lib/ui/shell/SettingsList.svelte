<script lang="ts">
	// docs/ui.md "More and settings": More → Settings, compact rows with their current values; each opens its page.
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { ThemeChoice, TimeFormat } from '#lib/client/prefs.ts';
	import { paletteOf, type PaletteId } from '#lib/shared/themes.ts';
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
	}
	let { theme, palette, timeFormat, goal, reminders, speakScan = null }: Props = $props();

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
