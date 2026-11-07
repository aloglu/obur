<script lang="ts">
	// docs/ui.md "More": compact rows with their current values; Appearance and Units have their own pages.
	import { stopReminders } from '#lib/client/push.ts';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { clearDeviceData, flush, offline } from '#lib/client/offline/sync.svelte.ts';
	import type { ThemeChoice, TimeFormat } from '#lib/client/prefs.ts';
	import { paletteOf, type PaletteId } from '#lib/shared/themes.ts';
	import Button from '../Button.svelte';
	import NavRow from './NavRow.svelte';

	interface Props {
		isAdmin: boolean;
		displayName: string;
		theme: ThemeChoice;
		palette: PaletteId;
		timeFormat: TimeFormat;
		deletedCount: number;
		foodCount: number;
		recipeCount: number;
		mealCount: number;
		/** The goal row's value, when there's a calculated budget. */
		goal: string | null;
		/** Reminders are configured on this server. */
		reminders: boolean;
	}
	let {
		isAdmin,
		displayName,
		theme,
		palette,
		timeFormat,
		deletedCount,
		foodCount,
		recipeCount,
		mealCount,
		goal,
		reminders
	}: Props = $props();

	const mode = $derived(
		{ system: m.theme_system(), light: m.theme_light(), dark: m.theme_dark() }[theme]
	);
	const time = $derived(
		{ device: m.time_device(), '24': m.time_24(), '12': m.time_12() }[timeFormat]
	);

	async function signOut() {
		// Try to send anything waiting; never discard unsent entries without asking (docs/design.md, offline scope).
		await flush();
		const unsent = offline.items.length;
		if (unsent > 0 && !confirm(m.signout_pending({ count: String(unsent) }))) return;
		if (offline.ownerId) await clearDeviceData(offline.ownerId);
		// This device stops getting this person's reminders; whoever signs in next turns on their own.
		if (reminders) await stopReminders();
		await api('POST', '/api/v1/auth/logout', {});
		await invalidateAll();
		await goto(resolve('/login'));
	}

	const group = 'flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card';
</script>

<div class={group}>
	<NavRow
		href={resolve('/(app)/more/appearance')}
		label={m.more_appearance()}
		value="{paletteOf(palette).name} · {mode}"
	/>
	<NavRow href={resolve('/(app)/more/goal')} label={m.more_goal()} value={goal ?? undefined} />
	<NavRow href={resolve('/(app)/more/units')} label={m.more_units()} value="kg · {time}" />
	{#if reminders}
		<NavRow href={resolve('/(app)/settings/reminders')} label={m.reminders_title()} />
	{/if}
</div>

<div class={group}>
	<NavRow href={resolve('/(app)/profile')} label={m.more_profile()} />
	<NavRow href={resolve('/(app)/foods')} label={m.more_foods()} value={foodCount} />
	<NavRow href={resolve('/(app)/recipes')} label={m.recipes_title()} value={recipeCount} />
	<NavRow href={resolve('/(app)/saved-meals')} label={m.more_saved_meals()} value={mealCount} />
	<NavRow
		href={resolve('/(app)/more/deleted')}
		label={m.deleted_title()}
		value={deletedCount || undefined}
	/>
	<NavRow href={resolve('/(app)/settings/data')} label={m.more_data()} />
	<NavRow href={resolve('/(app)/settings/security')} label={m.more_security()} />
	{#if isAdmin}
		<NavRow href={resolve('/(app)/household')} label={m.more_household()} />
	{/if}
	<NavRow href={resolve('/(app)/help')} label={m.more_help()} />
</div>

<div
	class="flex items-center justify-between gap-3 rounded-card bg-surface p-[14px_18px] shadow-card"
>
	<p class="min-w-0 text-[0.875rem] break-words">
		{m.settings_signed_in_as({ name: displayName })}
	</p>
	<span class="shrink-0 whitespace-nowrap"
		><Button variant="ghost" onclick={signOut}>{m.home_sign_out()}</Button></span
	>
</div>

<!-- Credit the icons' licence requires (static/icons/food/LICENSE.txt, static/icons/achievements/LICENSE.txt). -->
<p class="px-1 text-[0.78125rem] text-muted">
	<a
		href="https://openmoji.org"
		target="_blank"
		rel="noreferrer"
		class="underline decoration-dotted underline-offset-2">{m.icon_credit()}</a
	>
</p>
