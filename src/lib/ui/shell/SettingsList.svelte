<script lang="ts">
	// docs/ui.md "More": Appearance first, then rows. Shared by the phone More tab and desktop Settings.
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { clearDeviceData, flush, offline } from '#lib/client/offline/sync.svelte.ts';
	import { setTheme, type ThemeChoice } from '#lib/client/prefs.ts';
	import Button from '../Button.svelte';
	import Card from '../Card.svelte';
	import Chips from '../Chips.svelte';

	interface Props {
		isAdmin: boolean;
		displayName: string;
		initialTheme: ThemeChoice;
	}
	let { isAdmin, displayName, initialTheme }: Props = $props();

	async function signOut() {
		// Try to send anything waiting; never discard unsent entries without asking (docs/design.md, offline scope).
		await flush();
		const unsent = offline.items.length;
		if (unsent > 0 && !confirm(m.signout_pending({ count: String(unsent) }))) return;
		if (offline.ownerId) await clearDeviceData(offline.ownerId);
		await api('POST', '/api/v1/auth/logout', {});
		await invalidateAll();
		await goto(resolve('/login'));
	}
	// The server rendered the page with this theme (cookie); changes apply only when a chip is tapped.
	let theme = $state<ThemeChoice>(untrack(() => initialTheme));

	const row = 'flex min-h-14 items-center justify-between gap-3 py-2 text-[15px] font-semibold';
</script>

<Card title={m.more_appearance()}>
	<Chips
		label={m.more_appearance()}
		bind:value={theme}
		onchange={setTheme}
		options={[
			{ value: 'system', label: m.theme_system() },
			{ value: 'light', label: m.theme_light() },
			{ value: 'dark', label: m.theme_dark() }
		]}
	/>
</Card>

<Card>
	<ul class="flex flex-col divide-y divide-line">
		<li>
			<a href={resolve('/(app)/profile')} class={row}
				>{m.more_profile()}<ChevronRight size={20} class="text-muted" aria-hidden="true" /></a
			>
		</li>
		<li>
			<span class={[row, 'text-muted']}
				>{m.more_units()}<span class="text-[13px] font-normal">{m.more_soon()}</span></span
			>
		</li>
		<li>
			<a href={resolve('/(app)/settings/data')} class={row}
				>{m.more_data()}<ChevronRight size={20} class="text-muted" aria-hidden="true" /></a
			>
		</li>
		<li>
			<a href={resolve('/(app)/foods')} class={row}
				>{m.more_foods()}<ChevronRight size={20} class="text-muted" aria-hidden="true" /></a
			>
		</li>
		<li>
			<a href={resolve('/(app)/settings/security')} class={row}
				>{m.more_security()}<ChevronRight size={20} class="text-muted" aria-hidden="true" /></a
			>
		</li>
		{#if isAdmin}
			<li>
				<a href={resolve('/(app)/household')} class={row}
					>{m.more_household()}<ChevronRight size={20} class="text-muted" aria-hidden="true" /></a
				>
			</li>
		{/if}
	</ul>
</Card>

<Card>
	<p class="text-[15px]">{m.settings_signed_in_as({ name: displayName })}</p>
	<Button variant="ghost" onclick={signOut}>{m.home_sign_out()}</Button>
</Card>
