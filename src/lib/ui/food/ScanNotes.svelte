<script lang="ts">
	// Notes on Check the label (docs/ui.md, "Scan"): what was read and skipped, what matches, and what to check. A tick
	// for a decision, a question mark (amber) for something the person should look at. In the Nutrition card, in place
	// of the hint on copying a label.
	import Check from '@lucide/svelte/icons/check';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import { m } from '#lib/paraglide/messages.js';
	import { ENERGY_PARTS, energyCheckable, foodWarnings } from '#lib/shared/food-checks.ts';
	import type { LabelNote } from '#lib/shared/label-notes.ts';
	import { PROVIDER_NAME } from '#lib/shared/remote-models.ts';
	import type { NutrientCode, NutrientValue } from '#lib/shared/nutrients.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import type { Basis } from '#lib/shared/quantity.ts';

	interface Props {
		notes: LabelNote[];
		basis: Basis;
		/** The values the form starts from. */
		nutrients: NutrientValue[];
		/** A sodium value the form leaves out because salt is there too. */
		sodiumLeftOut: boolean;
		/** The photo looked blurry. */
		blurry?: boolean;
	}
	let { notes, basis, nutrients, sodiumLeftOut, blurry = false }: Props = $props();

	const NAME: Partial<Record<NutrientCode, () => string>> = {
		energy_kcal: m.nutrient_energy_kcal,
		energy_kj: m.nutrient_energy_kj,
		fat: m.nutrient_fat,
		saturated_fat: m.nutrient_saturated_fat,
		carbohydrate_excl_fibre: m.nutrient_carbohydrate,
		carbohydrate_total: m.nutrient_carbohydrate_total,
		sugars: m.nutrient_sugars,
		fibre: m.nutrient_fibre,
		protein: m.nutrient_protein,
		salt: m.nutrient_salt,
		sodium: m.nutrient_sodium
	};
	/** "Saturated fat (g)" → "Saturated fat". */
	const nameOf = (code: NutrientCode) => (NAME[code]?.() ?? code).replace(/\s*\(.*\)$/, '');
	/** "Fibre, sugars and salt": the first capitalised when it starts the sentence. */
	function names(codes: NutrientCode[], first = true) {
		const words = codes.map((c, i) => (i === 0 && first ? nameOf(c) : nameOf(c).toLowerCase()));
		return words.length < 2
			? words.join('')
			: m.list_and({ first: words.slice(0, -1).join(', '), last: words[words.length - 1] });
	}
	const basisText = (b: Basis) =>
		b === '100g'
			? m.food_basis_100g()
			: b === '100ml'
				? m.food_basis_100ml()
				: m.food_basis_serving();

	/** The values the form shows as rows; energy has its own warning when missing. */
	const ROWS: NutrientCode[][] = [
		['fat'],
		['saturated_fat'],
		['carbohydrate_excl_fibre', 'carbohydrate_total'],
		['sugars'],
		['fibre'],
		['protein'],
		['salt', 'sodium']
	];

	const lines = $derived.by(() => {
		const out: { check: boolean; text: string }[] = [];
		// First: a company's model read it (always checked against the photo), or a blurry photo.
		for (const note of notes) {
			if (note.kind === 'read_by')
				out.push({
					check: true,
					text: m.scan_note_read_by({ provider: PROVIDER_NAME[note.provider] })
				});
		}
		if (blurry) out.push({ check: true, text: m.scan_note_blurry() });
		const has = (code: NutrientCode) => nutrients.find((n) => n.code === code);
		// Numbers the OCR wasn't sure of: where a dropped decimal comma ("2,5" read as "25") is likeliest.
		for (const note of notes) {
			if (note.kind !== 'unclear') continue;
			const codes = note.codes.filter(
				(c) => c !== 'energy_kj' || !note.codes.includes('energy_kcal')
			);
			out.push({
				check: true,
				text:
					codes.length === 1
						? m.scan_note_unclear_one({ name: nameOf(codes[0]) })
						: m.scan_note_unclear_many({ names: names(codes) })
			});
		}
		for (const note of notes) {
			if (note.kind === 'columns') {
				const parts = [m.scan_note_read({ basis: basisText(note.used) })];
				if (note.skippedServing && note.skippedRi) parts.push(m.scan_note_skipped_both());
				else if (note.skippedServing) parts.push(m.scan_note_skipped_serving());
				else if (note.skippedRi) parts.push(m.scan_note_skipped_ri());
				out.push({ check: false, text: parts.join(' ') });
			} else if (note.kind === 'basis_from_title') {
				out.push({ check: false, text: m.scan_note_title({ basis: basisText(note.basis) }) });
			} else if (note.kind === 'running_text') {
				out.push({ check: true, text: m.scan_note_text() });
			}
		}
		const kcalValue = has('energy_kcal');
		const kjValue = has('energy_kj');
		if (kcalValue && kjValue && !foodWarnings(basis, nutrients).includes('energy_units_mismatch')) {
			out.push({
				check: false,
				text: m.scan_note_energy_match({
					kcal: formatDecimal(kcalValue.value, 1),
					kj: formatDecimal(kjValue.value, 1)
				})
			});
		}
		for (const note of notes) {
			if (note.kind === 'converted_mg')
				out.push({ check: false, text: m.scan_note_mg({ names: names(note.codes) }) });
		}
		if (sodiumLeftOut) out.push({ check: false, text: m.scan_note_sodium() });
		for (const note of notes) {
			if (note.kind === 'dropped')
				out.push({ check: true, text: m.scan_note_dropped({ names: names(note.codes) }) });
		}
		// The energy check is what catches most misreads; say when it couldn't run.
		if (nutrients.length && !energyCheckable(nutrients)) {
			const energyKnown = has('energy_kcal') || has('energy_kj');
			const absent = ENERGY_PARTS.filter((c) => !has(c));
			out.push({
				check: true,
				text: !energyKnown
					? m.scan_note_unchecked_energy()
					: absent.length
						? m.scan_note_unchecked_parts({ names: names(absent, false) })
						: m.scan_note_unchecked_energy_bound()
			});
		}
		const dropped = new Set(notes.flatMap((n) => (n.kind === 'dropped' ? n.codes : [])));
		const missing = ROWS.filter((codes) => !codes.some((c) => has(c) || dropped.has(c))).map(
			(codes) => codes[0]
		);
		if (missing.length === 1) {
			out.push({ check: true, text: m.scan_note_missing_one({ name: nameOf(missing[0]) }) });
		} else if (missing.length > 1) {
			out.push({ check: true, text: m.scan_note_missing_many({ names: names(missing) }) });
		}
		return out;
	});
</script>

<ul class="flex flex-col gap-1.5" aria-label={m.scan_notes()}>
	{#each lines as line, i (i)}
		<li
			class={[
				'flex gap-2 rounded-[12px] px-3 py-2.5 text-[0.84375rem] leading-snug',
				line.check ? 'bg-warn-soft font-[550] text-warn' : 'bg-surface2 text-muted'
			]}
		>
			{#if line.check}
				<CircleHelp size={18} aria-hidden="true" class="mt-px shrink-0" />
			{:else}
				<Check size={18} aria-hidden="true" class="mt-px shrink-0" />
			{/if}
			<span>{line.text}</span>
		</li>
	{/each}
</ul>
