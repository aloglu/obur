<script lang="ts">
	// docs/ui.md "More and settings": your foods, recipes and meals, then Settings, Members and Help, then
	// signing out. Compact rows with their counts.
	import { stopReminders } from '#lib/client/push.ts';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { clearDeviceData, flush, offline } from '#lib/client/offline/sync.svelte.ts';
	import Button from '../Button.svelte';
	import NavRow from './NavRow.svelte';

	interface Props {
		isAdmin: boolean;
		displayName: string;
		/** The numbers beside the rows; undefined when they could not be read (the row then shows none). */
		deletedCount?: number;
		foodCount?: number;
		recipeCount?: number;
		mealCount?: number;
		/** Reminders are configured on this server (signing out stops them on this device). */
		reminders: boolean;
		/** A newer published version, for an admin who turned the check on (Members). */
		newerVersion?: string | null;
	}
	let {
		isAdmin,
		displayName,
		deletedCount,
		foodCount,
		recipeCount,
		mealCount,
		reminders,
		newerVersion = null
	}: Props = $props();

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
	<NavRow href={resolve('/(app)/foods')} label={m.more_foods()} value={foodCount} />
	<NavRow href={resolve('/(app)/recipes')} label={m.recipes_title()} value={recipeCount} />
	<NavRow href={resolve('/(app)/saved-meals')} label={m.more_saved_meals()} value={mealCount} />
	<NavRow
		href={resolve('/(app)/more/deleted')}
		label={m.deleted_title()}
		value={deletedCount || undefined}
	/>
</div>

<div class={group}>
	<NavRow href={resolve('/(app)/more/settings')} label={m.settings_title()} />
	{#if isAdmin}
		<NavRow
			href={resolve('/(app)/members')}
			label={m.more_members()}
			value={newerVersion ? m.more_members_update() : undefined}
		/>
	{/if}
	<NavRow href={resolve('/(app)/help')} label={m.more_help()} />
</div>

<div
	class="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-[14px_18px] shadow-card"
>
	<p class="min-w-0 flex-[1_1_12rem] text-[0.875rem] break-words">
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
