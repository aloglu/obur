<script lang="ts">
	// Onboarding (docs/design.md, "Targets, profile and activity"): details, BMI with WHO adult categories and the
	// muscle caveat, base burn, goal and pace, then a budget. Estimates, not medical advice. Minors, pregnancy and
	// breastfeeding get no calculated targets.
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { kcal } from '#lib/shared/format.ts';
	import {
		baseBurn,
		bmi,
		dailyBudget,
		dailyDeficit,
		DEFAULT_FLOOR,
		maxRate,
		targetsAllowed,
		whoAdultCategory,
		type BmiCategory,
		type Sex
	} from '#lib/shared/goals.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Chips from '#lib/ui/Chips.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	let { data } = $props();
	const start = untrack(() => data);
	const num = (v: number | null | undefined, digits = 1) =>
		v === null || v === undefined ? '' : formatDecimal(v, ',', digits);

	let height = $state(num(start.profile?.heightCm));
	let weight = $state(num(start.latestWeight?.value, 2));
	let birthDate = $state(start.profile?.birthDate ?? '');
	let sex = $state<Sex | ''>(start.profile?.sex ?? '');
	let bodyFat = $state(num(start.profile?.bodyFatPct));
	let waist = $state(num(start.profile?.waistCm));
	let pregnant = $state(start.profile?.pregnant ?? false);
	let breastfeeding = $state(start.profile?.breastfeeding ?? false);
	let shown = $state(false);
	let fixedBase = $state('');
	let goalWeight = $state('');
	let rate = $state('0.5');
	let floorText = $state('');
	let manualKcal = $state('');
	let busy = $state(false);
	let problem = $state('');

	const h = $derived(parseDecimal(height));
	const w = $derived(parseDecimal(weight));
	const bf = $derived(bodyFat.trim() ? parseDecimal(bodyFat) : null);
	const waistCm = $derived(waist.trim() ? parseDecimal(waist) : null);
	const detailsValid = $derived(
		!!h &&
			h >= 50 &&
			h <= 260 &&
			!!w &&
			w > 20 &&
			w < 700 &&
			/^\d{4}-\d{2}-\d{2}$/.test(birthDate) &&
			!!sex
	);
	const allowed = $derived(
		detailsValid && targetsAllowed({ birthDate, pregnant, breastfeeding }, data.today)
	);
	const facts = $derived(
		detailsValid ? { sex: sex as Sex, birthDate, heightCm: h!, weightKg: w!, bodyFatPct: bf } : null
	);
	const bmiValue = $derived(facts ? bmi(facts.weightKg, facts.heightCm) : null);
	const burn = $derived(facts ? baseBurn(facts, data.today) : null);
	const cap = $derived(w ? maxRate(w) : 0);
	const base = $derived(parseDecimal(fixedBase) ?? burn?.kcal ?? 0);
	const floor = $derived(parseDecimal(floorText) ?? (sex ? DEFAULT_FLOOR[sex] : 0));
	const deficit = $derived(w ? dailyDeficit(Number(rate), w) : 0);
	const preview = $derived(dailyBudget({ baseBurn: base, deficit, floor }, 0));

	const categoryText: Record<BmiCategory, () => string> = {
		underweight: m.bmi_underweight,
		normal: m.bmi_normal,
		overweight: m.bmi_overweight,
		obesity_1: m.bmi_obesity_1,
		obesity_2: m.bmi_obesity_2,
		obesity_3: m.bmi_obesity_3
	};

	async function saveDetails(event: SubmitEvent) {
		event.preventDefault();
		if (!detailsValid) return;
		busy = true;
		problem = '';
		try {
			await api('PUT', '/api/v1/profile', {
				heightCm: h,
				birthDate,
				sex,
				bodyFatPct: bf ?? null,
				waistCm: waistCm ?? null,
				pregnant,
				breastfeeding
			});
			// A new or changed weight is a genuine reading for today.
			if (w !== start.latestWeight?.value) {
				await api('POST', '/api/v1/body/weight', {
					id: crypto.randomUUID(),
					date: data.today,
					zone: deviceZone(),
					value: w
				});
			}
			if (!floorText && sex) floorText = String(DEFAULT_FLOOR[sex]);
			shown = true;
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}

	async function saveTarget(target: Record<string, unknown>) {
		busy = true;
		problem = '';
		try {
			await api('POST', '/api/v1/targets', { effectiveFrom: data.today, ...target });
			await invalidateAll();
			await goto(resolve('/(app)'));
			showToast({ message: m.onb_saved() });
		} catch (e) {
			problem =
				e instanceof ApiError && e.code === 'weight_required'
					? m.onb_weight_needed()
					: m.error_generic();
		} finally {
			busy = false;
		}
	}

	const rates = ['0', '0.25', '0.5', '0.75', '1'];
</script>

<svelte:head><title>{m.onb_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[24px] font-[750]">{m.onb_title()}</h1>
	<p class="text-[15px] text-muted">{m.onb_intro()}</p>
	{#if problem}<Notice>{problem}</Notice>{/if}

	<Card>
		<form class="flex flex-col gap-4" onsubmit={saveDetails}>
			<div class="grid grid-cols-2 gap-3">
				<TextField
					label={m.onb_height()}
					bind:value={height}
					inputmode="decimal"
					autocomplete="off"
				/>
				<TextField
					label={m.onb_weight()}
					bind:value={weight}
					inputmode="decimal"
					autocomplete="off"
				/>
			</div>
			<TextField label={m.onb_birth()} bind:value={birthDate} type="date" max={data.today} />
			<Chips
				label={m.onb_sex()}
				bind:value={sex}
				options={[
					{ value: 'female', label: m.onb_female() },
					{ value: 'male', label: m.onb_male() }
				]}
			/>
			<p class="-mt-2 text-[13px] text-muted">{m.onb_sex_hint()}</p>
			<div class="grid grid-cols-2 gap-3">
				<TextField
					label={m.onb_body_fat()}
					bind:value={bodyFat}
					inputmode="decimal"
					autocomplete="off"
				/>
				<TextField
					label={m.onb_waist()}
					bind:value={waist}
					inputmode="decimal"
					autocomplete="off"
				/>
			</div>
			<label class="flex min-h-11 items-center gap-3 text-[15px]"
				><input type="checkbox" bind:checked={pregnant} />{m.onb_pregnant()}</label
			>
			<label class="flex min-h-11 items-center gap-3 text-[15px]"
				><input type="checkbox" bind:checked={breastfeeding} />{m.onb_breastfeeding()}</label
			>
			<Button type="submit" wide disabled={busy || !detailsValid}>{m.onb_next()}</Button>
		</form>
	</Card>

	{#if shown && facts && bmiValue !== null && burn}
		<Card>
			<p class="text-[19px] font-bold tabular-nums">
				{m.onb_bmi({ value: formatDecimal(bmiValue, ',', 1) })}
			</p>
			<p class="text-[15px]">
				{allowed ? categoryText[whoAdultCategory(bmiValue)]() : m.onb_bmi_no_category()}
			</p>
			<p class="text-[13px] text-muted">{m.onb_bmi_note()}</p>
			{#if waistCm}
				<p class="text-[15px] tabular-nums">
					{m.onb_whtr({ value: formatDecimal(waistCm / facts.heightCm, ',', 2) })}
				</p>
				<p class="text-[13px] text-muted">{m.onb_whtr_note()}</p>
			{/if}
		</Card>

		{#if allowed}
			<Card>
				<p class="text-[17px] font-bold tabular-nums">{m.onb_base({ kcal: kcal(burn.kcal) })}</p>
				<p class="text-[13px] text-muted">
					{m.onb_base_note({
						formula:
							burn.formula === 'katch_mcardle' ? m.onb_formula_katch() : m.onb_formula_mifflin()
					})}
				</p>
				<TextField
					label={m.onb_fixed_base()}
					bind:value={fixedBase}
					inputmode="numeric"
					autocomplete="off"
				/>
				<TextField
					label={m.onb_goal_weight()}
					bind:value={goalWeight}
					inputmode="decimal"
					autocomplete="off"
				/>
				<Chips
					label={m.onb_rate()}
					bind:value={rate}
					options={rates.map((r) => ({
						value: r,
						label:
							r === '0'
								? m.onb_rate_maintain()
								: m.onb_rate_value({ kg: formatDecimal(Number(r), ',', 2) }),
						disabled: Number(r) > cap
					}))}
				/>
				{#if rates.some((r) => Number(r) > cap)}<p class="text-[13px] text-muted">
						{m.onb_rate_capped()}
					</p>{/if}
				<TextField
					label={m.onb_floor()}
					bind:value={floorText}
					inputmode="numeric"
					autocomplete="off"
				/>
				<div class="rounded-small bg-soft p-3.5">
					<p class="font-display text-[22px] font-extrabold tabular-nums">
						{m.onb_budget({ kcal: kcal(preview) })}
					</p>
					<p class="text-[13px] text-muted tabular-nums">
						{m.onb_budget_detail({ base: kcal(base), deficit: kcal(deficit) })}
					</p>
				</div>
				<p class="text-[13px] text-muted">{m.onb_disclaimer()}</p>
				<Button
					wide
					disabled={busy}
					onclick={() =>
						saveTarget({
							mode: 'calculated',
							rateKgPerWeek: Number(rate),
							goalWeightKg: parseDecimal(goalWeight) ?? null,
							fixedBaseBurnKcal: parseDecimal(fixedBase) ?? null,
							floorKcal: parseDecimal(floorText) ?? null
						})}>{m.onb_save()}</Button
				>
			</Card>
		{:else}
			<Notice tone="info">{m.onb_restricted()}</Notice>
		{/if}
	{/if}

	<Card title={m.onb_manual_title()}>
		<p class="text-[14px] text-muted">{m.onb_manual_body()}</p>
		<TextField
			label={m.onb_manual_kcal()}
			bind:value={manualKcal}
			inputmode="numeric"
			autocomplete="off"
		/>
		<Button
			variant="ghost"
			disabled={busy || !parseDecimal(manualKcal)}
			onclick={() => saveTarget({ mode: 'manual', budgetKcal: parseDecimal(manualKcal) })}
			>{m.onb_manual_save()}</Button
		>
		<Button variant="ghost" disabled={busy} onclick={() => saveTarget({ mode: 'none' })}
			>{m.onb_none()}</Button
		>
		<p class="text-[13px] text-muted">{m.onb_disclaimer()}</p>
	</Card>
</main>
