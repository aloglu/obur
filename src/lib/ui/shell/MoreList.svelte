<script lang="ts">
	// docs/ui.md "More and settings": your foods, recipes and meals, then Settings, Members, Server and Help, then
	// signing out. Compact rows with their counts.
	import { accountHeaders, setAccount } from '#lib/client/account.ts';
	import { pushEndpoint } from '#lib/client/push.ts';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { showToast } from '#lib/client/toast.svelte.ts';
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
		/** A newer published version, for an admin who turned the check on (Server). */
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
		// This device stops getting this person's reminders with the sign-out itself, so one never happens without
		// the other; whoever signs in next turns on their own.
		const endpoint = reminders ? await pushEndpoint() : null;
		// Signed out on the server first: offline, nothing on this device is cleared and the person stays signed in.
		try {
			// A time limit: an iPhone can leave an offline request hanging instead of failing it.
			const response = await fetch('/api/v1/auth/logout', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'content-type': 'application/json', ...accountHeaders() },
				body: JSON.stringify(endpoint ? { pushEndpoint: endpoint } : {}),
				signal: AbortSignal.timeout(5000)
			});
			// Someone else signed in on this browser since this tab opened: never sign them out from here.
			if (response.status === 409) return void location.reload();
			if (!response.ok && response.status !== 401) throw new Error(`status ${response.status}`);
		} catch {
			showToast({ message: m.signout_offline(), detail: m.signout_offline_detail() });
			return;
		}
		setAccount(null);
		// Nothing prepared for this person stays in the service worker.
		navigator.serviceWorker?.controller?.postMessage({ type: 'obur:signed-out' });
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
		<NavRow href={resolve('/(app)/members')} label={m.more_members()} />
		<NavRow
			href={resolve('/(app)/server')}
			label={m.more_server()}
			value={newerVersion ? m.more_server_update() : undefined}
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
