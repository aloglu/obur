<script lang="ts">
	// docs/ui.md "Signing in and first day": once, for someone who hasn't chosen yet. "Just log" records that choice, so
	// nothing on Today mentions a missing budget afterwards; a budget is a free choice.
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '../Button.svelte';

	let { name, busy, onskip }: { name: string; busy: boolean; onskip: () => void } = $props();
</script>

<section
	class="mb-3 flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-label={m.welcome_title({ name })}
>
	<h2 class="text-[1.1875rem] font-bold text-balance">{m.welcome_title({ name })}</h2>
	<p class="text-[0.90625rem] text-muted">{m.welcome_body()}</p>
	<div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
		<a
			href={resolve('/(app)/onboarding')}
			class="grid min-h-[46px] place-items-center rounded-input bg-fill px-4 text-[0.9375rem] font-[750] text-on-accent"
			>{m.profile_setup_short()}</a
		>
		<Button variant="ghost" disabled={busy} onclick={onskip}>{m.welcome_skip()}</Button>
	</div>
</section>
