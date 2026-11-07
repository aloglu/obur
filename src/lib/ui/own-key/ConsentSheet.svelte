<script lang="ts">
	// Before anything goes to a company (docs/ui.md, "Your own AI key for Speak and Scan"): name it and exactly what it
	// will receive. Only the main button agrees; the other leaves everything as it was.
	import { m } from '#lib/paraglide/messages.js';
	import { PROVIDER_NAME, type Feature, type Provider } from '#lib/shared/remote-models.ts';
	import Button from '../Button.svelte';
	import Sheet from '../Sheet.svelte';

	let {
		feature,
		provider,
		local,
		busy = false,
		onallow,
		onclose
	}: {
		feature: Feature;
		provider: Provider;
		/** The server has this add-on: the other button keeps it there. */
		local: boolean;
		busy?: boolean;
		onallow: () => void;
		onclose: () => void;
	} = $props();
	const name = $derived(PROVIDER_NAME[provider]);
	const speak = $derived(feature === 'speak');
</script>

<Sheet
	title={speak
		? m.models_consent_speak_title({ provider: name })
		: m.models_consent_scan_title({ provider: name })}
	{onclose}
>
	<p class="text-[0.9375rem] leading-snug">
		{speak
			? m.models_consent_from_now_speak({ provider: name })
			: m.models_consent_from_now_scan({ provider: name })}
	</p>
	<ul class="flex list-disc flex-col gap-1 pl-5 text-[0.9375rem] leading-snug">
		{#if speak}
			<li>{m.models_consent_speak_1()}</li>
			<li>{m.models_consent_speak_2()}</li>
		{:else}
			<li>{m.models_consent_scan_1()}</li>
		{/if}
	</ul>
	<p class="text-[0.9375rem] leading-snug">{m.models_consent_terms({ provider: name })}</p>
	<Button wide onclick={onallow} disabled={busy}>{m.models_consent_send({ provider: name })}</Button
	>
	<Button wide variant="ghost" onclick={onclose}>
		{local ? m.models_consent_keep() : m.models_consent_not_now()}
	</Button>
</Sheet>
