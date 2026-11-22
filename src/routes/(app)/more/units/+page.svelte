<script lang="ts">
	// docs/ui.md "More and settings": weight unit and time follow the account. Weights are stored in kilograms, so a
	// change of unit changes only how they are shown and typed.
	import PageHead from '#lib/ui/PageHead.svelte';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { savePreferences, setTimeFormat, type TimeFormat } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import MenuRow from '#lib/ui/MenuRow.svelte';
	import type { WeightUnit } from '#lib/shared/weight-unit.ts';

	let { data } = $props();
	let time = $state<TimeFormat>(untrack(() => data.timeFormat));
	let unit = $state<WeightUnit>(untrack(() => data.preferences.weightUnit));

	async function changeUnit(next: WeightUnit) {
		const before = unit;
		try {
			await savePreferences({ weightUnit: next });
			await invalidateAll();
		} catch {
			unit = before;
			showToast({ message: m.settings_save_failed() });
		}
	}

	async function change(next: TimeFormat) {
		const before = time;
		setTimeFormat(next);
		try {
			await savePreferences({ timeFormat: next });
			await invalidateAll();
		} catch {
			time = before;
			setTimeFormat(before);
			showToast({ message: m.settings_save_failed() });
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
			bind:value={unit}
			onchange={changeUnit}
			options={[
				{ value: 'kg', label: m.units_kg() },
				{ value: 'lb', label: m.units_lb() }
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
