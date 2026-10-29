<script lang="ts">
	// Shown by the service worker for a page that was never saved on this device, instead of silently showing another
	// page (docs/design.md, "Offline scope and synchronization").
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Card from '#lib/ui/Card.svelte';
</script>

<svelte:head><title>{m.offline_page_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[24px] font-[750]">{m.offline_page_title()}</h1>
	<Card>
		<p class="text-[15px]">{m.offline_page_body()}</p>
		<a href={resolve('/(app)')} class="font-semibold text-accent underline"
			>{m.offline_page_link()}</a
		>
	</Card>
</main>
