<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { ACCOUNT_DATA } from '#lib/shared/account-data.ts';
	import MoreList from '#lib/ui/shell/MoreList.svelte';

	let { data } = $props();

	// More opens from what the app already holds. An admin's "Update available" is looked up afterwards (at most
	// one question to GitHub a day, and only with the check turned on in Members); if the answer is news, the
	// row follows.
	onMount(() => {
		if (data.user?.role !== 'admin') return;
		api<{ updates: { latest: string | null } }>('GET', '/api/v1/admin/update-check')
			.then(({ updates }) => {
				if (updates.latest !== (data.more?.newerVersion ?? null))
					void invalidate(ACCOUNT_DATA, true);
			})
			.catch(() => {});
	});
</script>

<svelte:head><title>{m.more_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="page-head text-[1.5rem] font-[750]">{m.more_title()}</h1>
	<MoreList
		isAdmin={data.user?.role === 'admin'}
		displayName={data.user?.displayName ?? ''}
		deletedCount={data.more?.deletedCount}
		foodCount={data.more?.foodCount}
		recipeCount={data.more?.recipeCount}
		mealCount={data.more?.mealCount}
		reminders={data.pushKey !== null}
		newerVersion={data.more?.newerVersion}
	/>
</main>
