<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { PROVIDER_NAME } from '#lib/shared/remote-models.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import { paceLabel } from '#lib/ui/goal-pace.ts';
	import SettingsList from '#lib/ui/shell/SettingsList.svelte';

	let { data } = $props();
	// The company a person's own key sends to, if any; otherwise the server.
	const speakScan = $derived.by(() => {
		if (!data.keysAllowed) return null;
		const chosen = [data.speakSource, data.scanSource].find((x) => x && x !== 'server');
		return chosen && chosen !== 'server' ? PROVIDER_NAME[chosen] : m.models_server();
	});
</script>

<svelte:head><title>{m.settings_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead href={resolve('/(app)/more')} label={m.nav_more()} title={m.settings_title()} />
	<SettingsList
		theme={data.theme}
		palette={data.palette}
		timeFormat={data.timeFormat}
		goal={data.goalPace === null ? null : paceLabel(data.goalPace)}
		reminders={data.pushKey !== null}
		{speakScan}
	/>
</main>
