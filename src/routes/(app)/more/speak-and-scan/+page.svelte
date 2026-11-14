<script lang="ts">
	// More → Speak and Scan (docs/ui.md, "Your own AI key for Speak and Scan"): what reads this person's recordings and
	// label photos, their own keys (last four characters only) and this month's counts. Only they see this page's
	// choices and keys.
	import PageHead from '#lib/ui/PageHead.svelte';
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { dayAndMonth } from '#lib/shared/format.ts';
	import {
		FEATURES,
		PROVIDER_NAME,
		type Feature,
		type KeySummary,
		type ModelChoices,
		type Provider,
		type Source
	} from '#lib/shared/remote-models.ts';
	import Card from '#lib/ui/Card.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import AddKeySheet from '#lib/ui/own-key/AddKeySheet.svelte';
	import ConsentSheet from '#lib/ui/own-key/ConsentSheet.svelte';

	let { data } = $props();
	const s = untrack(() => data.settings);
	let choices = $state<ModelChoices>(s.choices);
	let keys = $state<KeySummary[]>(s.keys);
	let adding = $state(false);
	let asking = $state<{ feature: Feature; provider: Provider } | null>(null);
	let saving = $state(false);

	const usable = $derived(s.allowed ? keys.filter((k) => !k.unreadable) : []);
	const checked = (iso: string) => {
		const day = iso.slice(0, 10);
		return day === data.today ? m.day_today().toLowerCase() : dayAndMonth(day);
	};

	// Why "On this server" is unavailable: an admin can install the add-on, so they are told which one and where.
	const notInstalled = (feature: Feature) =>
		data.user?.role !== 'admin'
			? m.models_server_none()
			: feature === 'speak'
				? m.models_server_none_admin_speak()
				: m.models_server_none_admin_scan();

	async function choose(feature: Feature, source: Source, allowed = false) {
		if (choices[feature] === source) return;
		if (source !== 'server' && !allowed) {
			asking = { feature, provider: source };
			return;
		}
		saving = true;
		try {
			({ choices } = await api<{ choices: ModelChoices }>('PUT', '/api/v1/remote-models/choice', {
				feature,
				source,
				allowed
			}));
			asking = null;
			showToast({ message: m.models_choice_saved() });
			await invalidateAll();
		} catch {
			showToast({ message: m.settings_save_failed() });
		} finally {
			saving = false;
		}
	}

	async function remove(provider: Provider) {
		try {
			({ keys, choices } = await api<{ keys: KeySummary[]; choices: ModelChoices }>(
				'DELETE',
				'/api/v1/remote-models/keys',
				{ provider }
			));
			showToast({ message: m.models_key_removed() });
			await invalidateAll();
		} catch {
			showToast({ message: m.settings_save_failed() });
		}
	}
</script>

<svelte:head><title>{m.more_speak_scan()} · {m.app_name()}</title></svelte:head>

{#snippet option(feature: Feature, value: Source, title: string, line: string, disabled = false)}
	<button
		type="button"
		role="radio"
		aria-checked={choices[feature] === value}
		{disabled}
		onclick={() => choose(feature, value)}
		class="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_22px] items-center gap-3 py-2 text-left disabled:opacity-45"
	>
		<span class="min-w-0">
			<b class="block text-[0.9375rem] font-[650]">{title}</b>
			<small class="block text-[0.8125rem] text-muted">{line}</small>
		</span>
		<span
			aria-hidden="true"
			class={[
				'size-[22px] rounded-full border-2',
				choices[feature] === value ? 'border-[7px] border-accent' : 'border-line'
			]}
		></span>
	</button>
{/snippet}

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead
		href={resolve('/(app)/more/settings')}
		label={m.settings_title()}
		title={m.more_speak_scan()}
	/>
	<p class="text-[0.9375rem] text-muted">{m.models_intro()}</p>
	{#if !s.allowed}
		<Notice tone="info">{s.adminOff ? m.models_off_members() : m.models_off_server()}</Notice>
	{/if}

	{#each FEATURES as feature (feature)}
		<Card title={feature === 'speak' ? m.speak_title() : m.models_scan_title()}>
			<p class="-mt-1 text-[0.875rem] text-muted">
				{feature === 'speak' ? m.models_speak_line() : m.models_scan_line()}
			</p>
			<div
				role="radiogroup"
				aria-label={feature === 'speak' ? m.speak_title() : m.models_scan_title()}
				class="flex flex-col divide-y divide-line"
			>
				{@render option(
					feature,
					'server',
					m.models_server(),
					s.local[feature] ? m.models_server_line() : notInstalled(feature),
					!s.local[feature]
				)}
				{#each usable as k (k.provider)}
					{@render option(
						feature,
						k.provider,
						m.models_with_key({ provider: PROVIDER_NAME[k.provider] }),
						feature === 'speak'
							? m.models_speak_goes({ provider: PROVIDER_NAME[k.provider] })
							: m.models_scan_goes({ provider: PROVIDER_NAME[k.provider] })
					)}
				{:else}
					{#if s.allowed}
						{@render option(feature, 'openai', m.models_own_key(), m.models_add_first(), true)}
					{/if}
				{/each}
			</div>
		</Card>
	{/each}

	{#if s.allowed || keys.length}
		<Card title={m.models_keys()}>
			{#if keys.length === 0}
				<p class="text-[0.875rem] leading-snug text-muted">{m.models_keys_none()}</p>
			{/if}
			<div class="flex flex-col divide-y divide-line">
				{#each keys as k (k.provider)}
					{@const use = s.usage[k.provider]}
					<div class="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
						<span class="min-w-0">
							<b class="block text-[0.9375rem] font-[650]">{PROVIDER_NAME[k.provider]}</b>
							<small class={['block text-[0.8125rem]', k.unreadable ? 'text-bad' : 'text-muted']}>
								{k.unreadable
									? m.models_key_unreadable()
									: m.models_key_row({ last4: k.last4, when: checked(k.checkedAt) })}
							</small>
							{#if use}
								<small class="block text-[0.8125rem] text-muted">
									{m.models_usage({
										provider: PROVIDER_NAME[k.provider],
										speak: String(use.speak ?? 0),
										scan: String(use.scan ?? 0)
									})}
								</small>
							{/if}
						</span>
						<button
							type="button"
							onclick={() => remove(k.provider)}
							aria-label={m.models_remove_label({ provider: PROVIDER_NAME[k.provider] })}
							class="ml-auto min-h-11 px-1 text-[0.9375rem] font-bold text-accent"
							>{m.models_remove()}</button
						>
					</div>
				{/each}
			</div>
			{#if s.allowed}
				<button
					type="button"
					onclick={() => (adding = true)}
					class="min-h-11 self-start text-[0.9375rem] font-bold text-accent"
					>{keys.length ? m.models_add_another() : m.models_add_key()}</button
				>
			{/if}
		</Card>
	{/if}
</main>

{#if adding}
	<AddKeySheet
		initial={keys.some((k) => k.provider === 'openai') ? 'openrouter' : 'openai'}
		onsaved={(next) => {
			keys = next;
			adding = false;
			showToast({ message: m.models_key_saved() });
		}}
		onclose={() => (adding = false)}
	/>
{/if}
{#if asking}
	<ConsentSheet
		feature={asking.feature}
		provider={asking.provider}
		local={s.local[asking.feature]}
		busy={saving}
		onallow={() => asking && choose(asking.feature, asking.provider, true)}
		onclose={() => (asking = null)}
	/>
{/if}
