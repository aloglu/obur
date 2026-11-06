<script lang="ts">
	// Profile's "Your details" (owner review 2026-10-30): height, birth date, sex, the latest weight and a calculated
	// budget's goal weight, shown as rows and edited in place. A new weight is saved as today's weigh-in; a
	// calculated budget follows the details from today on, and the toast says when it moved.
	import { invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { BodyReading } from '#lib/shared/body-types.ts';
	import { dateWithYear, dayTitle, kcal } from '#lib/shared/format.ts';
	import type { DetailsOutcome, Profile, TargetVersion } from '#lib/shared/goal-types.ts';
	import { ageOn } from '#lib/shared/goals.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import Chips from '../Chips.svelte';
	import Notice from '../Notice.svelte';
	import TextField from '../TextField.svelte';

	interface Props {
		profile: Profile | null;
		latestWeight: BodyReading | null;
		target: TargetVersion | null;
		today: string;
	}
	let { profile, latestWeight, target, today }: Props = $props();

	const calculated = $derived(target?.mode === 'calculated');
	let editing = $state(false);
	let busy = $state(false);
	let problem = $state('');
	let showErrors = $state(false);
	let height = $state('');
	let birthDate = $state('');
	let sex = $state<'female' | 'male' | ''>('');
	let weight = $state('');
	let goal = $state('');

	const kg = (n: number) => formatDecimal(n, ',', 1);
	function startEditing() {
		height = profile?.heightCm ? formatDecimal(profile.heightCm, ',', 1) : '';
		birthDate = profile?.birthDate ?? '';
		sex = profile?.sex ?? '';
		weight = latestWeight ? formatDecimal(latestWeight.value, ',', 2) : '';
		goal = target?.goalWeightKg ? formatDecimal(target.goalWeightKg, ',', 2) : '';
		problem = '';
		showErrors = false;
		editing = true;
	}

	const heightCm = $derived(parseDecimal(height));
	const weightKg = $derived(parseDecimal(weight));
	const goalKg = $derived(goal.trim() === '' ? null : parseDecimal(goal));
	const errors = $derived({
		height: heightCm === undefined || heightCm < 50 || heightCm > 260,
		birth: !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > today,
		sex: sex === '',
		// An empty weight keeps the weigh-ins as they are.
		weight: weight.trim() !== '' && (weightKg === undefined || weightKg < 20 || weightKg > 700),
		goal: goalKg === undefined || (goalKg !== null && (goalKg < 20 || goalKg > 700))
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		showErrors = true;
		if (Object.values(errors).some(Boolean)) return;
		busy = true;
		problem = '';
		try {
			// A changed weight first, as today's weigh-in, so the budget below uses it.
			let before: number | undefined;
			let after: number | undefined;
			if (weightKg !== undefined && weightKg !== latestWeight?.value) {
				const r = await api<{ budget: { beforeKcal: number; afterKcal: number } | null }>(
					'POST',
					'/api/v1/body/weight',
					{ id: crypto.randomUUID(), date: today, zone: deviceZone(), value: weightKg }
				);
				if (r.budget) ({ beforeKcal: before, afterKcal: after } = r.budget);
			}
			const r = await api<{ outcome: DetailsOutcome }>('PATCH', '/api/v1/profile/details', {
				heightCm: heightCm!,
				birthDate,
				sex,
				...(calculated ? { goalWeightKg: goalKg } : {})
			});
			if (r.outcome.kind === 'recalculated') {
				before ??= r.outcome.beforeKcal;
				after = r.outcome.afterKcal;
			}
			await invalidateAll();
			editing = false;
			showToast({
				message: m.details_saved(),
				detail:
					r.outcome.kind === 'not_recalculated'
						? m.details_not_recalculated()
						: before !== undefined && after !== undefined && before !== after
							? m.toast_budget_now({ after: kcal(after), before: kcal(before) })
							: undefined
			});
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<section
	class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-labelledby="details-title"
>
	<div class="flex items-center justify-between gap-2">
		<h2 id="details-title" class="text-[19px] font-bold">{m.details_title()}</h2>
		{#if !editing}
			<button
				type="button"
				onclick={startEditing}
				aria-label={m.details_edit_label()}
				class="-my-2 -mr-2 min-h-11 rounded-input px-2 text-[14px] font-semibold text-accent"
				>{m.details_edit()}</button
			>
		{/if}
	</div>

	{#if !editing}
		{@const rows = [
			[
				m.details_height(),
				profile?.heightCm ? `${formatDecimal(profile.heightCm, ',', 1)} cm` : null
			],
			[
				m.details_birth(),
				profile?.birthDate
					? m.details_birth_value({
							date: dateWithYear(profile.birthDate),
							age: String(ageOn(profile.birthDate, today))
						})
					: null
			],
			[
				m.details_sex(),
				profile?.sex === 'female' ? m.onb_female() : profile?.sex === 'male' ? m.onb_male() : null
			],
			[
				m.details_weight(),
				latestWeight
					? `${kg(latestWeight.value)} kg · ${dayTitle(latestWeight.localDate, today)}`
					: null
			],
			...(calculated
				? [
						[
							m.details_goal(),
							target?.goalWeightKg ? `${kg(target.goalWeightKg)} kg` : m.details_no_goal()
						]
					]
				: [])
		]}
		<dl class="flex flex-col text-[15px]">
			{#each rows as [label, value] (label)}
				<div
					class="flex min-h-9 items-center justify-between gap-3 border-b border-line last:border-0"
				>
					<dt class="text-muted">{label}</dt>
					<dd class={['text-right font-semibold tabular-nums', !value && 'text-muted']}>
						{value ?? m.details_not_set()}
					</dd>
				</div>
			{/each}
		</dl>
	{:else}
		<form class="flex flex-col gap-3" onsubmit={save} novalidate>
			<TextField
				label={m.onb_height()}
				bind:value={height}
				inputmode="decimal"
				autocomplete="off"
				aria-invalid={showErrors && errors.height}
			/>
			<TextField
				label={m.onb_birth()}
				type="date"
				max={today}
				bind:value={birthDate}
				aria-invalid={showErrors && errors.birth}
			/>
			<Chips
				label={m.onb_sex()}
				bind:value={sex}
				options={[
					{ value: 'female', label: m.onb_female() },
					{ value: 'male', label: m.onb_male() }
				]}
			/>
			<TextField
				label={m.onb_weight()}
				hint={m.details_weight_hint()}
				bind:value={weight}
				inputmode="decimal"
				autocomplete="off"
				aria-invalid={showErrors && errors.weight}
			/>
			{#if calculated}
				<TextField
					label={m.onb_goal_weight()}
					bind:value={goal}
					inputmode="decimal"
					autocomplete="off"
					aria-invalid={showErrors && errors.goal}
				/>
			{/if}
			{#if showErrors && Object.values(errors).some(Boolean)}
				<Notice>{m.details_invalid()}</Notice>
			{/if}
			{#if problem}<Notice>{problem}</Notice>{/if}
			<p class="text-[13px] text-muted">
				{calculated ? m.details_budget_follows() : m.details_budget_kept()}
			</p>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					disabled={busy}
					onclick={() => (editing = false)}
					class="min-h-12 rounded-button border border-line bg-surface text-[16px] font-[750]"
					>{m.common_cancel()}</button
				>
				<button
					type="submit"
					disabled={busy}
					class="min-h-12 rounded-button bg-fill text-[16px] font-[750] text-on-accent disabled:opacity-50"
					>{m.details_save()}</button
				>
			</div>
		</form>
	{/if}
</section>
