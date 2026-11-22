<script lang="ts">
	// Budget setup in three steps (docs/ui.md, "Signing in and first day"; docs/design.md, "Targets, profile and activity"):
	// about you, the estimate (BMI with WHO adult categories and the muscle caveat, base burn), then goal and budget.
	// Estimates, not medical advice. Minors, pregnancy and breastfeeding get no calculated targets: they can enter a number
	// they were given, or just log.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import PageHead from '#lib/ui/PageHead.svelte';
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { deviceZone, savePreferences } from '#lib/client/prefs.ts';
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
	import { toKg, typedKg, weightNumber, type WeightUnit } from '#lib/shared/weight-unit.ts';
	import {
		cmToFeetInches,
		cmToInches,
		feetInchesToCm,
		inchesToCm,
		type LengthUnit,
		type WaterUnit
	} from '#lib/shared/body-units.ts';
	import { lengthUnit, waterUnit, weightUnit } from '#lib/client/units.ts';
	import FeetInchesField from '#lib/ui/FeetInchesField.svelte';
	import type { UnitChoice } from '#lib/ui/unit-choice.ts';
	import { paceAmount, paces } from '#lib/ui/goal-pace.ts';
	import Button from '#lib/ui/Button.svelte';
	import Chips from '#lib/ui/Chips.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import Roll from '#lib/ui/Roll.svelte';
	import TextField from '#lib/ui/TextField.svelte';
	import UnitField from '#lib/ui/UnitField.svelte';
	import type { DetailsOutcome } from '#lib/shared/goal-types.ts';

	let { data } = $props();
	const start = untrack(() => data);
	const num = (v: number | null | undefined, digits = 1) =>
		v === null || v === undefined ? '' : formatDecimal(v, digits);

	type Step = 1 | 2 | 3 | 'manual';
	let step = $state<Step>(1);
	function go(next: Step) {
		step = next;
		problem = '';
		scrollTo(0, 0);
	}

	// Weights, height and waist in the person's units (Units, or each field's unit button here, which saves them), kept
	// in kilograms and centimetres.
	let unit = $state<WeightUnit>(weightUnit());
	const startLength = lengthUnit();
	let lUnit = $state<LengthUnit>(startLength);
	let wUnit = $state<WaterUnit>(waterUnit());
	const startFt = start.profile?.heightCm ? cmToFeetInches(start.profile.heightCm) : null;
	let height = $state(startLength === 'cm' ? num(start.profile?.heightCm) : '');
	let heightFt = $state(startLength === 'in' && startFt ? String(startFt.feet) : '');
	let heightIn = $state(startLength === 'in' && startFt ? num(startFt.inches) : '');
	let weight = $state(
		start.latestWeight ? weightNumber(start.latestWeight.value, weightUnit()) : ''
	);
	let birthDate = $state(start.profile?.birthDate ?? '');
	let sex = $state<Sex | ''>(start.profile?.sex ?? '');
	let bodyFat = $state(num(start.profile?.bodyFatPct));
	let waist = $state(
		start.profile?.waistCm
			? num(startLength === 'in' ? cmToInches(start.profile.waistCm) : start.profile.waistCm)
			: ''
	);
	let pregnant = $state(start.profile?.pregnant ?? false);
	let breastfeeding = $state(start.profile?.breastfeeding ?? false);
	let ownOpen = $state(false);
	let fixedBase = $state('');
	let goalWeight = $state('');
	let rate = $state(String(paces(untrack(() => unit))[2]));
	let floorText = $state('');
	let manualKcal = $state('');
	let busy = $state(false);
	let problem = $state('');

	type Units = { weight: WeightUnit; length: LengthUnit; water: WaterUnit };
	const units = (): Units => ({ weight: unit, length: lUnit, water: wUnit });
	/** A typed weight in the other unit ("80" kg becomes "176.4" lb); text that isn't a number stays. */
	function convert(text: string, from: WeightUnit, to: WeightUnit) {
		const typed = parseDecimal(text);
		return typed === undefined || typed === null || from === to
			? text
			: weightNumber(toKg(typed, from), to);
	}
	/** Moves what was typed to other units: weights, height, waist and the pace. */
	function switchUnits(from: Units, to: Units) {
		weight = convert(weight, from.weight, to.weight);
		goalWeight = convert(goalWeight, from.weight, to.weight);
		// The same place in the other unit's paces ("0.5 kg" is "1 lb").
		const at = paces(from.weight).findIndex((p) => String(p) === rate);
		if (at >= 0) rate = String(paces(to.weight)[at]);
		if (from.length !== to.length) {
			const cm = h;
			const waistTyped = waist.trim() ? parseDecimal(waist) : undefined;
			if (to.length === 'in') {
				const fi = cm ? cmToFeetInches(cm) : null;
				heightFt = fi ? String(fi.feet) : '';
				heightIn = fi ? num(fi.inches) : '';
				if (waistTyped) waist = num(cmToInches(waistTyped));
			} else {
				height = cm ? num(cm) : '';
				if (waistTyped) waist = num(inchesToCm(waistTyped));
			}
		}
		unit = to.weight;
		lUnit = to.length;
		wUnit = to.water;
	}
	/** Some units changed here: what was typed moves with them, and the account keeps them. */
	async function setUnits(partial: Partial<Units>) {
		const before = units();
		const after = { ...before, ...partial };
		switchUnits(before, after);
		try {
			await savePreferences({
				weightUnit: after.weight,
				lengthUnit: after.length,
				waterUnit: after.water
			});
			await invalidateAll();
		} catch {
			switchUnits(after, before);
			showToast({ message: m.settings_save_failed() });
		}
	}

	// Each field's unit is a button that switches it (owner's pick, 2026-11-22: setup suits every mix, such as feet
	// and inches with kilograms, with no Metric / Imperial row).
	const weightChoice = $derived<UnitChoice>({
		options: [
			{ value: 'kg', label: 'kg' },
			{ value: 'lb', label: 'lb' }
		],
		value: unit,
		name: m.onb_unit_weight(),
		onchange: (v) => setUnits({ weight: v as WeightUnit })
	});
	const heightChoice = $derived<UnitChoice>({
		options: [
			{ value: 'cm', label: 'cm' },
			{ value: 'in', label: 'ft, in' }
		],
		value: lUnit,
		name: m.onb_unit_height(),
		onchange: (v) => setUnits({ length: v as LengthUnit })
	});
	const waistChoice = $derived<UnitChoice>({
		...heightChoice,
		options: [
			{ value: 'cm', label: 'cm' },
			{ value: 'in', label: 'in' }
		],
		name: m.onb_unit_waist()
	});

	// Centimetres, from "180" or from 5 ft 10 in (inches may be left empty: 6 ft).
	const h = $derived.by(() => {
		if (lUnit === 'cm') return parseDecimal(height);
		const ft = parseDecimal(heightFt);
		const inches = heightIn.trim() ? parseDecimal(heightIn) : 0;
		if (!ft || inches === undefined || inches === null || inches >= 12) return undefined;
		return feetInchesToCm(ft, inches);
	});
	const typedWeight = $derived(parseDecimal(weight));
	const w = $derived(typedWeight === undefined ? undefined : typedKg(typedWeight, unit));
	const bf = $derived(bodyFat.trim() ? parseDecimal(bodyFat) : null);
	const waistTyped = $derived(waist.trim() ? parseDecimal(waist) : null);
	const waistCm = $derived(
		waistTyped && lUnit === 'in' ? inchesToCm(waistTyped) : (waistTyped ?? null)
	);
	const expecting = $derived(sex === 'female' && pregnant);
	const nursing = $derived(sex === 'female' && breastfeeding);
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
		detailsValid &&
			targetsAllowed({ birthDate, pregnant: expecting, breastfeeding: nursing }, data.today)
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
	/** The BMI scale runs from 15 to 40; the marker stays on it. */
	const bmiAt = $derived(
		bmiValue === null ? 0 : Math.max(0, Math.min(100, ((bmiValue - 15) / 25) * 100))
	);

	const categoryText: Record<BmiCategory, () => string> = {
		underweight: m.bmi_underweight,
		normal: m.bmi_normal,
		overweight: m.bmi_overweight,
		obesity_1: m.bmi_obesity_1,
		obesity_2: m.bmi_obesity_2,
		obesity_3: m.bmi_obesity_3
	};

	const from = $derived(page.url.searchParams.get('from'));
	const back = $derived(
		from === 'profile'
			? { href: resolve('/(app)/profile'), label: m.profile_title() }
			: from === 'goal'
				? { href: resolve('/(app)/more/goal'), label: m.more_goal() }
				: { href: resolve('/(app)'), label: m.day_today() }
	);

	async function saveDetails(event: SubmitEvent) {
		event.preventDefault();
		if (!detailsValid) return;
		busy = true;
		problem = '';
		try {
			// A new or changed weight is a genuine reading for today; saved first, so the details below use it.
			if (w !== start.latestWeight?.value) {
				await api('POST', '/api/v1/body/weight', {
					id: crypto.randomUUID(),
					date: data.today,
					zone: deviceZone(),
					value: w
				});
			}
			// Saved now, not at the end: someone who came from Profile to change one detail may stop here, and a
			// calculated budget follows the details from today on all the same.
			const saved = await api<{ outcome: DetailsOutcome }>('PATCH', '/api/v1/profile/details', {
				heightCm: h,
				birthDate,
				sex,
				bodyFatPct: bf ?? null,
				waistCm: waistCm ?? null,
				pregnant: expecting,
				breastfeeding: nursing
			});
			if (!floorText && sex) floorText = String(DEFAULT_FLOOR[sex]);
			if (saved.outcome.kind === 'ended')
				showToast({ message: m.onb_budget_ended(), detail: m.onb_budget_ended_detail() });
			go(2);
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

	const rates = $derived(paces(unit).map(String));
	const goalKg = () => {
		const typed = parseDecimal(goalWeight);
		return typed === undefined ? null : typedKg(typed, unit);
	};
	const card = 'flex flex-col gap-4 rounded-card bg-surface p-[18px] shadow-card';
	const estimate = 'flex flex-col gap-1.5 rounded-card bg-surface p-[18px] shadow-card';
	const label = 'text-[0.8125rem] font-[650] text-muted';
	const big =
		'font-display text-[2.5rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums';
	const unitClass = 'ml-1.5 text-[0.9375rem] font-[650] text-muted';
	const why = 'text-[0.875rem] text-muted';
	const eqnRow = 'flex justify-between gap-3 border-line py-2 not-first:border-t';
	const names = { 1: m.onb_step_about, 2: m.onb_step_estimate, 3: m.onb_step_goal };
</script>

<svelte:head><title>{m.onb_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead href={back.href} label={back.label} title={m.onb_title()} />
	{#if step !== 'manual'}
		<div class="grid grid-cols-3 gap-1.5" aria-hidden="true">
			{#each [1, 2, 3] as s (s)}
				<i
					class={[
						'h-1 rounded-full transition-colors duration-300',
						s <= step ? 'bg-fill' : 'bg-track'
					]}
				></i>
			{/each}
		</div>
		<p class={label}>{m.onb_step({ step: String(step), name: names[step]() })}</p>
	{/if}
	{#if problem}<Notice>{problem}</Notice>{/if}

	{#key step}
		<div class="panel flex flex-col gap-3">
			{#if step === 1}
				<form class="flex flex-col gap-3" onsubmit={saveDetails}>
					<div class={card}>
						<div class="grid grid-cols-2 gap-3">
							{#if lUnit === 'in'}
								<FeetInchesField
									label={m.onb_height()}
									bind:feet={heightFt}
									bind:inches={heightIn}
									choice={heightChoice}
								/>
							{:else}
								<UnitField
									label={m.onb_height()}
									unit="cm"
									bind:value={height}
									inputmode="decimal"
									choice={heightChoice}
								/>
							{/if}
							<UnitField
								label={m.onb_weight()}
								{unit}
								bind:value={weight}
								inputmode="decimal"
								choice={weightChoice}
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
						<div class={['collapse-row -my-2', sex === 'female' && 'open']}>
							<div class="flex flex-col" inert={sex !== 'female'}>
								<label class="flex min-h-11 items-center gap-3 text-[0.9375rem]"
									><input type="checkbox" bind:checked={pregnant} />{m.onb_pregnant()}</label
								>
								<label class="flex min-h-11 items-center gap-3 text-[0.9375rem]"
									><input
										type="checkbox"
										bind:checked={breastfeeding}
									/>{m.onb_breastfeeding()}</label
								>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<UnitField
								label={m.onb_body_fat()}
								unit="%"
								bind:value={bodyFat}
								inputmode="decimal"
								placeholder={m.onb_optional()}
							/>
							<UnitField
								label={m.onb_waist()}
								unit={lUnit === 'in' ? 'in' : 'cm'}
								choice={waistChoice}
								bind:value={waist}
								inputmode="decimal"
								placeholder={m.onb_optional()}
							/>
						</div>
					</div>
					<Button type="submit" wide disabled={busy || !detailsValid}>{m.onb_next()}</Button>
				</form>
				<button
					type="button"
					onclick={() => go('manual')}
					class="inline-flex min-h-11 items-center justify-center self-center text-[0.9375rem] font-[650] text-accent"
					>{m.onb_manual_title()}</button
				>
			{:else if step === 2 && facts && bmiValue !== null && burn}
				<div class={estimate}>
					<p class={label}>{m.onb_bmi_label()}</p>
					<p class={big}>{formatDecimal(bmiValue, 1)}</p>
					<p class="font-[650]">
						{allowed ? categoryText[whoAdultCategory(bmiValue)]() : m.onb_bmi_no_category()}
					</p>
					{#if allowed}
						<div class="bmi-bar relative mt-2.5 mb-1 h-2 rounded-full" aria-hidden="true">
							<i
								class="absolute -top-1 h-4 w-1 -translate-x-0.5 rounded-sm bg-text"
								style:left="{bmiAt}%"
							></i>
						</div>
						<div class="relative h-4 text-[0.71875rem] text-muted tabular-nums" aria-hidden="true">
							{#each [[15, '15'], [18.5, '18,5'], [25, '25'], [30, '30'], [40, '40']] as const as [at, text] (at)}
								<span
									class={[
										'absolute',
										at === 15 ? '' : at === 40 ? '-translate-x-full' : '-translate-x-1/2'
									]}
									style:left="{((at - 15) / 25) * 100}%">{text}</span
								>
							{/each}
						</div>
					{/if}
					<p class={why}>{m.onb_bmi_note()}</p>
					{#if waistCm}
						<p class={why}>
							{m.onb_whtr({ value: formatDecimal(waistCm / facts.heightCm, 2) })}
						</p>
					{/if}
				</div>

				{#if allowed}
					<div class={estimate}>
						<p class={label}>{m.onb_base_label()}</p>
						<p>
							<span class={big}><Roll value={kcal(base)} /></span><span class={unitClass}
								>{m.onb_kcal_day()}</span
							>
						</p>
						<p class={why}>
							{m.onb_base_note({
								formula:
									burn.formula === 'katch_mcardle' ? m.onb_formula_katch() : m.onb_formula_mifflin()
							})}
						</p>
						<button
							type="button"
							aria-expanded={ownOpen}
							onclick={() => (ownOpen = !ownOpen)}
							class="-my-1 inline-flex min-h-11 items-center gap-1 self-start text-[0.9375rem] font-[650] text-accent"
						>
							{m.onb_own_toggle()}
							<ChevronDown
								size={18}
								aria-hidden="true"
								class={['transition-transform duration-300', ownOpen && 'rotate-180']}
							/>
						</button>
						<div class={['collapse-row', ownOpen && 'open']}>
							<div inert={!ownOpen}>
								<UnitField
									label={m.onb_fixed_base()}
									unit="kcal"
									bind:value={fixedBase}
									inputmode="numeric"
								/>
							</div>
						</div>
					</div>
					<div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
						<Button variant="ghost" onclick={() => go(1)}>{m.common_back()}</Button>
						<Button onclick={() => go(3)}>{m.onb_choose_goal()}</Button>
					</div>
				{:else}
					<div class={card}>
						<Notice tone="info">{m.onb_restricted()}</Notice>
						<Button wide onclick={() => go('manual')}>{m.onb_to_manual()}</Button>
						<Button
							wide
							variant="ghost"
							disabled={busy}
							onclick={() => saveTarget({ mode: 'none' })}>{m.onb_none()}</Button
						>
					</div>
					<Button variant="ghost" onclick={() => go(1)}>{m.common_back()}</Button>
				{/if}
			{:else if step === 3}
				<div class={card}>
					<UnitField
						label={m.onb_goal_weight()}
						{unit}
						bind:value={goalWeight}
						inputmode="decimal"
						placeholder={m.onb_optional()}
					/>
					<Chips
						label={m.onb_rate({ unit })}
						bind:value={rate}
						options={rates.map((r) => ({
							value: r,
							label: r === '0' ? m.onb_rate_maintain() : paceAmount(Number(r), unit),
							disabled: Number(r) > cap
						}))}
					/>
					{#if rates.some((r) => Number(r) > cap)}<p class="-mt-2 text-[0.8125rem] text-muted">
							{m.onb_rate_capped()}
						</p>{/if}
					<UnitField label={m.onb_floor()} unit="kcal" bind:value={floorText} inputmode="numeric" />
				</div>
				<div class={estimate}>
					<p class={label}>{m.onb_budget_label()}</p>
					<p>
						<span class={big}><Roll value={kcal(preview)} /></span><span class={unitClass}
							>kcal</span
						>
					</p>
					<div class="flex flex-col text-[0.875rem] tabular-nums">
						<div class={eqnRow}><span>{m.onb_base_label()}</span><span>{kcal(base)}</span></div>
						<div class={eqnRow}>
							<span>{m.profile_target_goal()}</span><span>−{kcal(deficit)}</span>
						</div>
						<div class={[eqnRow, 'font-bold']}>
							<span>{m.onb_budget_label()}</span><span>{kcal(preview)}</span>
						</div>
					</div>
					{#if base - deficit < floor}<p class={why}>
							{m.onb_floor_note({ floor: kcal(floor) })}
						</p>{/if}
					<p class={why}>{m.onb_budget_note()}</p>
				</div>
				<p class="px-1 text-[0.8125rem] text-muted">{m.onb_disclaimer()}</p>
				<div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
					<Button variant="ghost" onclick={() => go(2)}>{m.common_back()}</Button>
					<Button
						disabled={busy}
						onclick={() =>
							saveTarget({
								mode: 'calculated',
								rateKgPerWeek: Number(rate),
								goalWeightKg: goalKg(),
								fixedBaseBurnKcal: parseDecimal(fixedBase) ?? null,
								floorKcal: parseDecimal(floorText) ?? null
							})}>{m.onb_save()}</Button
					>
				</div>
			{:else if step === 'manual'}
				<div class={card}>
					<div class="flex flex-col gap-1.5">
						<h2 class="text-[1.1875rem] font-bold">{m.onb_manual_title()}</h2>
						<p class="text-[0.875rem] text-muted">{m.onb_manual_body()}</p>
					</div>
					<UnitField
						label={m.onb_manual_kcal()}
						unit="kcal"
						bind:value={manualKcal}
						inputmode="numeric"
					/>
				</div>
				<p class="px-1 text-[0.8125rem] text-muted">{m.onb_disclaimer()}</p>
				<div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
					<Button variant="ghost" onclick={() => go(detailsValid && !allowed ? 2 : 1)}
						>{m.common_back()}</Button
					>
					<Button
						disabled={busy || !parseDecimal(manualKcal)}
						onclick={() => saveTarget({ mode: 'manual', budgetKcal: parseDecimal(manualKcal) })}
						>{m.onb_manual_save()}</Button
					>
				</div>
			{/if}
		</div>
	{/key}
</main>

<style>
	.panel {
		animation: panel-in 260ms var(--ui);
	}
	@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	.bmi-bar {
		/* Under 18,5 and over 25 in the track colour, the healthy range tinted. */
		background: linear-gradient(
			90deg,
			var(--track) 0 14%,
			color-mix(in srgb, var(--good) 45%, var(--track)) 14% 40%,
			var(--track) 40%
		);
	}
	@media (prefers-reduced-motion: reduce) {
		.panel {
			animation: none;
		}
	}
</style>
