<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import SettingsList from '#lib/ui/shell/SettingsList.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{m.settings_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[24px] font-[750]">{m.settings_title()}</h1>
	<SettingsList
		isAdmin={data.user?.role === 'admin'}
		displayName={data.user?.displayName ?? ''}
		initialTheme={data.theme}
	/>
</main>
