<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	// Profile (docs/ui.md, review demo account.html): the budget and where it comes from, then what feeds it. About you
	// is rows that open setup's first step; the budget settings apply from today.
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { BudgetSettings } from '#lib/shared/goal-types.ts';
	import Chips from '#lib/ui/Chips.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import NavRow from '#lib/ui/shell/NavRow.svelte';
	import Switch from '#lib/ui/Switch.svelte';
	import { dateWithYear, dayTitle, kcal } from '#lib/shared/format.ts';
	import { budgetForDay } from '#lib/shared/goals.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import Card from '#lib/ui/Card.svelte';
	import MacroSettings from '#lib/ui/profile/MacroSettings.svelte';

	let { data } = $props();
	const t = $derived(data.target);
	const day = $derived(budgetForDay(t, 0));
	let busy = $state(false);
	let problem = $state('');
	// Follows the saved setting, but a tap shows at once (re-rendering must not put back the old value).
	let activityOn = $derived(t?.countActivity ?? true);
	let atGoal = $derived(t?.atGoal ?? 'keep');

	const p = $derived(data.profile);
	const setupHref = `${resolve('/(app)/onboarding')}?from=profile`;
	const notSet = m.details_not_set();
	const about = $derived([
		[m.details_height(), p?.heightCm ? `${formatDecimal(p.heightCm, ',', 1)} cm` : notSet],
		[m.details_birth(), p?.birthDate ? dateWithYear(p.birthDate) : notSet],
		[
			m.details_sex(),
			p?.sex === 'female' ? m.onb_female() : p?.sex === 'male' ? m.onb_male() : notSet
		],
		[m.details_body_fat(), p?.bodyFatPct ? `${formatDecimal(p.bodyFatPct, ',', 1)} %` : notSet]
	]);
	const group = 'flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card';

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
	<PageHead
		href={resolve('/(app)/more/settings')}
		label={m.settings_title()}
		title={m.profile_title()}
	/>
	{#if t && day}
		<Card title={m.profile_target()}>
			<!-- A headline and labelled rows, so nothing wraps mid-sentence (owner review 2026-10-30). -->
			<p class="flex items-baseline gap-2">
				<span class="font-display text-[1.75rem] leading-none font-extrabold tabular-nums"
					>{kcal(day.budget)}</span
				>
				<span class="text-[0.9375rem] font-semibold text-muted">{m.profile_target_per_day()}</span>
			</p>
			{#if t.mode === 'calculated'}
				<dl class="flex flex-col text-[0.9375rem]">
					{#each [[m.profile_target_base(), kcal(t.baseBurnKcal ?? 0)], [m.profile_target_goal(), `− ${kcal(t.deficitKcal)}`], [m.profile_target_floor(), kcal(t.floorKcal)]] as [label, value] (label)}
						<div
							class="flex min-h-9 items-center justify-between gap-3 border-b border-line last:border-0"
						>
							<dt class="text-muted">{label}</dt>
							<dd class="font-semibold tabular-nums">{value} kcal</dd>
						</div>
					{/each}
				</dl>
			{:else}
				<p class="text-[0.9375rem] text-muted">{m.profile_target_own()}</p>
			{/if}
			<p class="text-[0.8125rem] text-muted">
				{m.profile_since({ day: dayTitle(t.effectiveFrom, data.today) })}
			</p>
			{#if t.mode === 'calculated'}
				<p class="text-[0.8125rem] text-muted">{m.profile_follows_weight()}</p>
			{/if}
			<a
				href="{resolve('/(app)/onboarding')}?from=profile"
				class="inline-flex min-h-11 items-center self-start rounded-button bg-fill px-4 font-[750] text-on-accent"
			>
				{m.profile_recalc()}
			</a>
		</Card>
	{:else}
		<!-- A budget is a free choice: optional, said once, and only here (docs/ui.md). -->
		<Card title={m.profile_budget_title()}>
			<p class="text-[0.875rem] text-muted">{m.profile_budget_optional()}</p>
			<a
				href="{resolve('/(app)/onboarding')}?from=profile"
				class="grid min-h-12 place-items-center rounded-input bg-fill px-4 text-[0.9375rem] font-[750] text-on-accent"
			>
				{m.profile_setup()}
			</a>
		</Card>
	{/if}
	<section aria-labelledby="about-label">
		<h2 id="about-label" class="mb-1.5 px-1 text-[0.8125rem] font-[650] text-muted">
			{m.profile_about()}
		</h2>
		<div class={group}>
			{#each about as [label, value] (label)}
				<NavRow href={setupHref} {label} {value} />
			{/each}
		</div>
		<p class="mt-1.5 px-1 text-[0.8125rem] text-muted">{m.details_weight_from_today()}</p>
	</section>
	{#if t && t.mode !== 'none'}
		<section aria-labelledby="settings-label">
			<h2 id="settings-label" class="mb-1.5 px-1 text-[0.8125rem] font-[650] text-muted">
				{m.profile_settings()}
			</h2>
			<div class={group}>
				<Switch
					label={m.profile_settings_activity()}
					bind:checked={activityOn}
					onchange={(on) => change({ countActivity: on })}
				/>
				{#if t.mode === 'calculated' && t.goalWeightKg !== null}
					<div class="py-3.5">
						<Chips
							label={m.profile_settings_goal()}
							bind:value={atGoal}
							onchange={(v) => change({ atGoal: v as BudgetSettings['atGoal'] })}
							options={[
								{ value: 'keep', label: m.profile_settings_goal_keep() },
								{ value: 'maintain', label: m.profile_settings_goal_maintain() }
							]}
						/>
					</div>
				{/if}
			</div>
			<p class="mt-1.5 px-1 text-[0.8125rem] text-muted">{m.profile_settings_hint()}</p>
		</section>
		{#if day}
			<Card>
				<MacroSettings
					target={t}
					budgetKcal={day.budget}
					{busy}
					onsave={(macros) => change({ macros })}
				/>
			</Card>
		{/if}
		{#if problem}<Notice>{problem}</Notice>{/if}
	{/if}
</main>
