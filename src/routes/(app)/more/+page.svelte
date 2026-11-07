<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { paceLabel } from '#lib/ui/goal-pace.ts';
	import SettingsList from '#lib/ui/shell/SettingsList.svelte';
	import { PROVIDER_NAME } from '#lib/shared/remote-models.ts';

	let { data } = $props();
	// The company a person's own key sends to, if any; otherwise the server.
	const speakScan = $derived.by(() => {
		if (!data.keysAllowed) return null;
		const chosen = [data.speakSource, data.scanSource].find((x) => x && x !== 'server');
		return chosen && chosen !== 'server' ? PROVIDER_NAME[chosen] : m.models_server();
	});
</script>

<svelte:head><title>{m.more_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[1.5rem] font-[750]">{m.more_title()}</h1>
	<SettingsList
		isAdmin={data.user?.role === 'admin'}
		displayName={data.user?.displayName ?? ''}
		theme={data.theme}
		palette={data.palette}
		timeFormat={data.timeFormat}
		deletedCount={data.deletedCount}
		foodCount={data.foodCount}
		recipeCount={data.recipeCount}
		mealCount={data.mealCount}
		goal={data.goal === null ? null : paceLabel(data.goal)}
		reminders={data.pushKey !== null}
		{speakScan}
	/>
</main>
