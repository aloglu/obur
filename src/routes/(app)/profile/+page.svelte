<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { BudgetSettings } from '#lib/shared/goal-types.ts';
	import Chips from '#lib/ui/Chips.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import { dayTitle, kcal } from '#lib/shared/format.ts';
	import Card from '#lib/ui/Card.svelte';

	let { data } = $props();
	const t = $derived(data.target);
	let busy = $state(false);
	let problem = $state('');
	// Follows the saved setting, but a tap shows at once (re-rendering must not put back the old value).
	let activityOn = $derived(t?.countActivity ?? true);

	// Applies from today: a new budget version with the same choices (docs/design.md, targets).
	async function change(settings: Partial<BudgetSettings>) {
		busy = true;
		problem = '';
		try {
			await api('PATCH', '/api/v1/targets/settings', settings);
			await invalidateAll();
			showToast({ message: m.profile_settings_saved(), detail: m.profile_settings_saved_detail() });
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.profile_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[24px] font-[750]">{m.profile_title()}</h1>
	<Card title={m.profile_target()}>
		{#if t?.mode === 'calculated'}
			<p class="text-[15px] tabular-nums">
				{m.profile_target_calculated({
					base: kcal(t.baseBurnKcal ?? 0),
					deficit: kcal(t.deficitKcal),
					floor: kcal(t.floorKcal)
				})}
			</p>
		{:else if t?.mode === 'manual'}
			<p class="text-[15px] tabular-nums">
				{m.profile_target_manual({ kcal: kcal(t.baseBurnKcal ?? 0) })}
			</p>
		{:else}
			<p class="text-[15px]">{m.profile_target_none()}</p>
		{/if}
		{#if t}<p class="text-[13px] text-muted">
				{m.profile_since({ day: dayTitle(t.effectiveFrom, data.today) })}
			</p>{/if}
		{#if t?.mode === 'calculated'}
			<p class="text-[13px] text-muted">{m.profile_follows_weight()}</p>
		{/if}
		<a
			href={resolve('/(app)/onboarding')}
			class="inline-flex min-h-11 items-center self-start rounded-button bg-accent px-4 font-[750] text-on-accent"
		>
			{t ? m.profile_recalc() : m.profile_setup()}
		</a>
	</Card>
	{#if t && t.mode !== 'none'}
		<Card title={m.profile_settings()}>
			<label class="flex min-h-11 cursor-pointer items-start gap-3">
				<input
					type="checkbox"
					bind:checked={activityOn}
					disabled={busy}
					onchange={() => change({ countActivity: activityOn })}
					class="mt-0.5 size-5 shrink-0 accent-accent"
				/>
				<span class="flex flex-col gap-0.5">
					<span class="text-[15px] font-semibold">{m.profile_settings_activity()}</span>
					<span class="text-[13px] text-muted">{m.profile_settings_activity_hint()}</span>
				</span>
			</label>
			{#if t.mode === 'calculated' && t.goalWeightKg !== null}
				<Chips
					label={m.profile_settings_goal()}
					value={t.atGoal}
					onchange={(atGoal) => change({ atGoal: atGoal as BudgetSettings['atGoal'] })}
					options={[
						{ value: 'keep', label: m.profile_settings_goal_keep() },
						{ value: 'maintain', label: m.profile_settings_goal_maintain() }
					]}
				/>
			{/if}
			{#if problem}<Notice>{problem}</Notice>{/if}
		</Card>
	{/if}
</main>
