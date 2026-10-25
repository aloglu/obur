<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Card from '#lib/ui/Card.svelte';
</script>

<svelte:head><title>{m.progress_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[1064px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[24px] font-[750]">{m.progress_title()}</h1>
	<Card><p class="text-[15px] text-muted">{m.progress_soon()}</p></Card>
</main>
