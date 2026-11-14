<script lang="ts">
	// docs/ui.md "More and settings": goal weight, and pace as a row opening a menu; the budget it comes to, on an inactive
	// day, follows along. A change makes a new budget version from today; past days keep theirs. A budget set by hand
	// takes a goal weight too (owner, 2026-11-08), for the weight chart and achievements only; without a budget, the way
	// to set one up.
	import PageHead from '#lib/ui/PageHead.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { kcal } from '#lib/shared/format.ts';
	import { budgetForDay, maxRate } from '#lib/shared/goals.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import Button from '#lib/ui/Button.svelte';
	import { paceLabel, PACES } from '#lib/ui/goal-pace.ts';
	import MenuRow from '#lib/ui/MenuRow.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import Roll from '#lib/ui/Roll.svelte';
	import UnitField from '#lib/ui/UnitField.svelte';

	let { data } = $props();
	const t = $derived(data.target);
	const calculated = $derived(t?.mode === 'calculated');
	const manual = $derived(t?.mode === 'manual');
	const inactive = $derived(budgetForDay(t, 0)?.budget ?? null);
	const requested = $derived.by(() => {
		const asked = t?.inputs.requestedRateKgPerWeek;
		return typeof asked === 'number' ? asked : (t?.rateKgPerWeek ?? 0);
	});
	const cap = $derived(data.latestWeight ? maxRate(data.latestWeight.value) : 1);

	let busy = $state(false);
	let problem = $state('');
	let editing = $state(false);
	let goalText = $state('');
	const goalKg = $derived(goalText.trim() === '' ? null : parseDecimal(goalText));
	const goalValid = $derived(
		goalKg === null || (goalKg !== undefined && goalKg >= 20 && goalKg <= 700)
	);

	async function change(settings: { rateKgPerWeek?: number; goalWeightKg?: number | null }) {
		busy = true;
		problem = '';
		try {
			await api('PATCH', '/api/v1/targets/settings', settings);
			await invalidateAll();
			editing = false;
			showToast({ message: m.profile_settings_saved(), detail: m.profile_settings_saved_detail() });
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
	function openGoal() {
		goalText = t?.goalWeightKg ? formatDecimal(t.goalWeightKg, 1) : '';
		editing = !editing;
	}
	const options = $derived(
		PACES.filter((p) => p <= cap || p === requested).map((p) => ({
			value: String(p),
			label: paceLabel(p)
		}))
	);
</script>

<svelte:head><title>{m.more_goal()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead
		href={resolve('/(app)/more/settings')}
		label={m.settings_title()}
		title={m.more_goal()}
	/>
	{#if problem}<Notice>{problem}</Notice>{/if}
	{#if manual && !data.goalAllowed}
		<Notice tone="info">{m.goal_not_offered()}</Notice>
	{:else if (calculated || manual) && t}
		<div class="flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card">
			<div>
				<button
					type="button"
					aria-expanded={editing}
					onclick={openGoal}
					class="flex min-h-14 w-full items-center justify-between gap-3 text-left text-[0.9375rem] font-semibold"
				>
					{m.goal_weight()}
					<span class="flex items-center gap-1 text-[0.875rem] font-medium text-muted tabular-nums">
						{t.goalWeightKg ? `${formatDecimal(t.goalWeightKg, 1)} kg` : m.details_no_goal()}
						<ChevronRight
							size={18}
							aria-hidden="true"
							class={['transition-transform duration-300', editing && 'rotate-90']}
						/>
					</span>
				</button>
				<div class={['collapse-row', editing && 'open']}>
					<div inert={!editing}>
						<form
							class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 pb-3.5"
							onsubmit={(e) => {
								e.preventDefault();
								if (goalValid && goalKg !== undefined) void change({ goalWeightKg: goalKg });
							}}
						>
							<UnitField
								label={m.goal_new_weight()}
								unit="kg"
								bind:value={goalText}
								inputmode="decimal"
								placeholder={m.onb_optional()}
								aria-invalid={!goalValid}
							/>
							<Button type="submit" disabled={busy || !goalValid}>{m.common_save()}</Button>
						</form>
					</div>
				</div>
			</div>
			{#if calculated}
				<MenuRow
					label={m.onb_rate_short()}
					value={String(requested)}
					onchange={(v) => change({ rateKgPerWeek: Number(v) })}
					{options}
				/>
				<div class="flex min-h-14 items-center justify-between gap-3 text-[0.9375rem]">
					<span class="font-semibold">{m.goal_inactive()}</span>
					<span class="whitespace-nowrap text-muted"
						><b class="font-bold text-text tabular-nums"><Roll value={kcal(inactive ?? 0)} /></b> kcal</span
					>
				</div>
			{/if}
		</div>
		<p class="px-1 text-[0.8125rem] text-muted">
			{calculated ? m.goal_note() : m.goal_manual_note()}
		</p>
	{:else}
		<div class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
			<p class="text-[0.9375rem]">{m.goal_needs_budget()}</p>
			<a
				href="{resolve('/(app)/onboarding')}?from=goal"
				class="grid min-h-12 place-items-center rounded-input bg-fill px-4 text-[0.9375rem] font-[750] text-on-accent"
				>{m.profile_setup()}</a
			>
		</div>
	{/if}
</main>
