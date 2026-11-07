<script lang="ts">
	// Add a key (docs/ui.md, "Your own AI key for Speak and Scan"): the company, the key pasted from its website, then
	// Check and save, which asks the company once. A key that doesn't work is never saved.
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import {
		PROVIDER_NAME,
		PROVIDERS,
		type KeySummary,
		type Provider
	} from '#lib/shared/remote-models.ts';
	import Button from '../Button.svelte';
	import Chips from '../Chips.svelte';
	import Sheet from '../Sheet.svelte';

	let {
		initial = 'openai',
		onsaved,
		onclose
	}: {
		initial?: Provider;
		onsaved: (keys: KeySummary[], provider: Provider) => void;
		onclose: () => void;
	} = $props();

	let provider = $state<Provider>(untrack(() => initial));
	let key = $state('');
	let checking = $state(false);
	let problem = $state('');
	const name = $derived(PROVIDER_NAME[provider]);

	async function save() {
		problem = '';
		const trimmed = key.trim();
		if (!/^[\x21-\x7e]{20,300}$/.test(trimmed)) {
			problem = m.models_key_invalid();
			return;
		}
		checking = true;
		try {
			const { keys } = await api<{ keys: KeySummary[] }>('POST', '/api/v1/remote-models/keys', {
				provider,
				key: trimmed
			});
			key = '';
			onsaved(keys, provider);
		} catch (e) {
			const code = e instanceof ApiError ? e.code : '';
			problem =
				code === 'key_refused'
					? m.models_key_refused({ provider: name })
					: m.models_key_unreachable({ provider: name });
		} finally {
			checking = false;
		}
	}
</script>

<Sheet title={m.models_add_title()} {onclose}>
	<Chips
		label={m.models_provider()}
		value={provider}
		onchange={(p) => ((provider = p as Provider), (problem = ''))}
		options={PROVIDERS.map((p) => ({ value: p, label: PROVIDER_NAME[p] }))}
	/>
	<div class="flex flex-col gap-1.5">
		<label for="model-key" class="text-[0.8125rem] font-[650] text-muted">{m.models_key_label()}</label>
		<input
			id="model-key"
			type="password"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			bind:value={key}
			aria-invalid={problem !== ''}
			aria-describedby="model-key-hint"
			class={[
				'min-h-12 rounded-input border bg-surface2 px-3.5 font-mono text-[1rem] text-text focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent',
				problem ? 'border-bad' : 'border-line'
			]}
		/>
		<p
			id="model-key-hint"
			class={['text-[0.8125rem] leading-snug', problem ? 'font-semibold text-bad' : 'text-muted']}
			aria-live="polite"
		>
			{problem ||
				(provider === 'openai' ? m.models_key_where_openai() : m.models_key_where_openrouter())}
		</p>
	</div>
	<Button wide onclick={save} disabled={checking || !key.trim()}>
		{checking ? m.models_checking({ provider: name }) : m.models_check_save()}
	</Button>
	<p class="text-[0.8125rem] leading-snug text-muted">{m.models_key_stored()}</p>
</Sheet>
