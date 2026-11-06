<script lang="ts">
	// Budget setup in three steps (docs/ui.md, "Signing in and first day"; docs/design.md, "Targets, profile and activity"):
	// about you, the estimate (BMI with WHO adult categories and the muscle caveat, base burn), then goal and budget.
	// Estimates, not medical advice. Minors, pregnancy and breastfeeding get no calculated targets: they can enter a number
	// they were given, or just log.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
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
	import Chips from '#lib/ui/Chips.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import Roll from '#lib/ui/Roll.svelte';
	import TextField from '#lib/ui/TextField.svelte';
	import UnitField from '#lib/ui/UnitField.svelte';

	let { data } = $props();
	const start = untrack(() => data);
	const num = (v: number | null | undefined, digits = 1) =>
		v === null || v === undefined ? '' : formatDecimal(v, ',', digits);

	type Step = 1 | 2 | 3 | 'manual';
	let step = $state<Step>(1);
	function go(next: Step) {
		step = next;
		problem = '';
		scrollTo(0, 0);
	}

	let height = $state(num(start.profile?.heightCm));
	let weight = $state(num(start.latestWeight?.value, 2));
	let birthDate = $state(start.profile?.birthDate ?? '');
	let sex = $state<Sex | ''>(start.profile?.sex ?? '');
	let bodyFat = $state(num(start.profile?.bodyFatPct));
	let waist = $state(num(start.profile?.waistCm));
	let pregnant = $state(start.profile?.pregnant ?? false);
	let breastfeeding = $state(start.profile?.breastfeeding ?? false);
	let ownOpen = $state(false);
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
			await api('PUT', '/api/v1/profile', {
				heightCm: h,
				birthDate,
				sex,
				bodyFatPct: bf ?? null,
				waistCm: waistCm ?? null,
				pregnant: expecting,
				breastfeeding: nursing
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

	const rates = ['0', '0.25', '0.5', '0.75', '1'];
	const card = 'flex flex-col gap-4 rounded-card bg-surface p-[18px] shadow-card';
	const estimate = 'flex flex-col gap-1.5 rounded-card bg-surface p-[18px] shadow-card';
	const label = 'text-[13px] font-[650] text-muted';
	const big =
		'font-display text-[40px] leading-none font-extrabold tracking-[-0.03em] tabular-nums';
	const unit = 'ml-1.5 text-[15px] font-[650] text-muted';
	const why = 'text-[14px] text-muted';
	const eqnRow = 'flex justify-between gap-3 border-line py-2 not-first:border-t';
	const names = { 1: m.onb_step_about, 2: m.onb_step_estimate, 3: m.onb_step_goal };
</script>

<svelte:head><title>{m.onb_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<a
		href={back.href}
		class="-mb-1 flex min-h-11 items-center gap-0.5 self-start font-[650] text-accent"
	>
		<ChevronLeft size={22} aria-hidden="true" />{back.label}
	</a>
	<h1 class="text-[24px] font-[750]">{m.onb_title()}</h1>
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
							<UnitField label={m.onb_height()} unit="cm" bind:value={height} inputmode="decimal" />
							<UnitField label={m.onb_weight()} unit="kg" bind:value={weight} inputmode="decimal" />
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
								<label class="flex min-h-11 items-center gap-3 text-[15px]"
									><input type="checkbox" bind:checked={pregnant} />{m.onb_pregnant()}</label
								>
								<label class="flex min-h-11 items-center gap-3 text-[15px]"
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
								unit="cm"
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
					class="inline-flex min-h-11 items-center justify-center self-center text-[15px] font-[650] text-accent"
					>{m.onb_manual_title()}</button
				>
			{:else if step === 2 && facts && bmiValue !== null && burn}
				<div class={estimate}>
					<p class={label}>{m.onb_bmi_label()}</p>
					<p class={big}>{formatDecimal(bmiValue, ',', 1)}</p>
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
						<div class="relative h-4 text-[11.5px] text-muted tabular-nums" aria-hidden="true">
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
							{m.onb_whtr({ value: formatDecimal(waistCm / facts.heightCm, ',', 2) })}
						</p>
					{/if}
				</div>

				{#if allowed}
					<div class={estimate}>
						<p class={label}>{m.onb_base_label()}</p>
						<p>
							<span class={big}><Roll value={kcal(base)} /></span><span class={unit}
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
							class="-my-1 inline-flex min-h-11 items-center gap-1 self-start text-[15px] font-[650] text-accent"
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
						unit="kg"
						bind:value={goalWeight}
						inputmode="decimal"
						placeholder={m.onb_optional()}
					/>
					<Chips
						label={m.onb_rate()}
						bind:value={rate}
						options={rates.map((r) => ({
							value: r,
							label: r === '0' ? m.onb_rate_maintain() : formatDecimal(Number(r), ',', 2),
							disabled: Number(r) > cap
						}))}
					/>
					{#if rates.some((r) => Number(r) > cap)}<p class="-mt-2 text-[13px] text-muted">
							{m.onb_rate_capped()}
						</p>{/if}
					<UnitField label={m.onb_floor()} unit="kcal" bind:value={floorText} inputmode="numeric" />
				</div>
				<div class={estimate}>
					<p class={label}>{m.onb_budget_label()}</p>
					<p>
						<span class={big}><Roll value={kcal(preview)} /></span><span class={unit}>kcal</span>
					</p>
					<div class="flex flex-col text-[14px] tabular-nums">
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
				<p class="px-1 text-[13px] text-muted">{m.onb_disclaimer()}</p>
				<div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
					<Button variant="ghost" onclick={() => go(2)}>{m.common_back()}</Button>
					<Button
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
				</div>
			{:else if step === 'manual'}
				<div class={card}>
					<div class="flex flex-col gap-1.5">
						<h2 class="text-[19px] font-bold">{m.onb_manual_title()}</h2>
						<p class="text-[14px] text-muted">{m.onb_manual_body()}</p>
					</div>
					<UnitField
						label={m.onb_manual_kcal()}
						unit="kcal"
						bind:value={manualKcal}
						inputmode="numeric"
					/>
				</div>
				<p class="px-1 text-[13px] text-muted">{m.onb_disclaimer()}</p>
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
