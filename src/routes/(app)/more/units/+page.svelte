<script lang="ts">
	// docs/ui.md "More and settings": weight, height and waist, water and time follow the account. Weights, lengths and
	// water are stored in kilograms, centimetres and millilitres, so a change of unit changes only how they are shown
	// and typed.
	import PageHead from '#lib/ui/PageHead.svelte';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { savePreferences, setTimeFormat, type TimeFormat } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import MenuRow from '#lib/ui/MenuRow.svelte';
	import type { WeightUnit } from '#lib/shared/weight-unit.ts';
	import type { LengthUnit, WaterUnit } from '#lib/shared/body-units.ts';
	import type { Preferences } from '#lib/shared/preferences.ts';

	let { data } = $props();
	let time = $state<TimeFormat>(untrack(() => data.timeFormat));
	let units = $state<Pick<Preferences, 'weightUnit' | 'lengthUnit' | 'waterUnit'>>(
		untrack(() => ({
			weightUnit: data.preferences.weightUnit,
			lengthUnit: data.preferences.lengthUnit,
			waterUnit: data.preferences.waterUnit
		}))
	);

	async function changeUnit<K extends keyof typeof units>(key: K, next: (typeof units)[K]) {
		const before = $state.snapshot(units);
		units[key] = next;
		try {
			await savePreferences({ [key]: next });
			await invalidateAll();
		} catch {
			units = before;
			showToast({ message: m.settings_save_failed() });
		}
	}

	// The format last saved: the row is already showing the new one when this runs (Menu), so it is kept here.
	let savedTime = untrack(() => data.timeFormat);
	async function change(next: TimeFormat) {
		setTimeFormat(next);
		try {
			await savePreferences({ timeFormat: next });
			savedTime = next;
			await invalidateAll();
		} catch {
			setTimeFormat(savedTime);
			showToast({ message: m.settings_save_failed() });
			return false;
		}
	}
</script>

<svelte:head><title>{m.more_units()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead
		href={resolve('/(app)/more/settings')}
		label={m.settings_title()}
		title={m.more_units()}
	/>
	<div class="flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card">
		<MenuRow
			label={m.units_weight()}
			value={units.weightUnit}
			onchange={(v: WeightUnit) => changeUnit('weightUnit', v)}
			options={[
				{ value: 'kg', label: m.units_kg() },
				{ value: 'lb', label: m.units_lb() }
			]}
		/>
		<MenuRow
			label={m.units_length()}
			value={units.lengthUnit}
			onchange={(v: LengthUnit) => changeUnit('lengthUnit', v)}
			options={[
				{ value: 'cm', label: m.units_cm() },
				{ value: 'in', label: m.units_ftin() }
			]}
		/>
		<MenuRow
			label={m.units_water()}
			value={units.waterUnit}
			onchange={(v: WaterUnit) => changeUnit('waterUnit', v)}
			options={[
				{ value: 'ml', label: m.units_ml() },
				{ value: 'floz', label: m.units_floz() }
			]}
		/>
		<MenuRow
			label={m.units_time()}
			bind:value={time}
			onchange={change}
			options={[
				{ value: 'device', label: m.time_device() },
				{ value: '24', label: m.time_24() },
				{ value: '12', label: m.time_12() }
			]}
		/>
	</div>
</main>
