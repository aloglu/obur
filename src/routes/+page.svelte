<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.app_name()}</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-[1064px] flex-col justify-center px-3.5 desk:px-7">
	<section class="rounded-card bg-surface p-[18px] shadow-card">
		<h1 class="text-[30px] font-extrabold tracking-[-0.02em] text-accent">{m.app_name()}</h1>
		<p class="mt-2 text-[15px] font-semibold">{m.app_tagline()}</p>
		<p class="mt-1 text-[14px] text-muted">{m.placeholder_building()}</p>
	</section>
</main>
