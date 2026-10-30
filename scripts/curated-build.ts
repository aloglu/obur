// Regenerates the curated generic foods from downloaded USDA FoodData Central JSON archives (build time only; the app
// never contacts USDA). Usage: npm run curated:build -- <sr_legacy .zip> <foundation .zip>
// The archives must match the checksums below; a new dataset version is a deliberate change here.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { SELECTION } from '../src/lib/server/modules/catalog/curated/selection.ts';
import { curatedFromUsda, type UsdaDataset } from '../src/lib/server/modules/catalog/usda.ts';

const DATASETS: Record<UsdaDataset, { file: string; sha256: string; key: string }> = {
	sr_legacy: {
		file: 'FoodData_Central_sr_legacy_food_json_2018-04.zip',
		sha256: '0fe8ae486a2c8eb42cb96413f058deb51863a46c8fb8eeb4b1fb45006dd338ef',
		key: 'SRLegacyFoods'
	},
	foundation: {
		file: 'FoodData_Central_foundation_food_json_2026-10-29.zip',
		sha256: 'dd414cc9f1a132626bad354ef6655972c78b44aff14f16114dc899708663c579',
		key: 'FoundationFoods'
	}
};
const OUT = 'src/lib/server/modules/catalog/curated/usda-foods.json';

const records = new Map<string, unknown>();
for (const path of process.argv.slice(2)) {
	const bytes = readFileSync(path);
	const sha = createHash('sha256').update(bytes).digest('hex');
	const entry = Object.entries(DATASETS).find(([, d]) => d.sha256 === sha);
	if (!entry) throw new Error(`${path}: not a known dataset version (SHA-256 ${sha})`);
	const [dataset, meta] = entry;
	for (const [name, file] of Object.entries(unzipSync(bytes))) {
		if (!name.endsWith('.json')) continue;
		const foods = (JSON.parse(strFromU8(file)) as Record<string, { fdcId: number }[]>)[meta.key];
		if (!Array.isArray(foods)) throw new Error(`${path}: no ${meta.key}`);
		for (const f of foods) records.set(`${dataset}:${f.fdcId}`, f);
	}
}

const seen = new Set<string>();
const foods = SELECTION.map((s) => {
	const id = `${s.dataset}:${s.fdcId}`;
	if (seen.has(id)) throw new Error(`${id} is selected twice`);
	seen.add(id);
	const record = records.get(id);
	if (!record) throw new Error(`${id} (${s.name}) is not in the datasets given`);
	const food = curatedFromUsda(s.dataset, record);
	// Names people choose by are metric (US cups say so); fail rather than ship a US measure unnoticed.
	for (const p of food.portions)
		if (
			/"|\b(oz|lb|pound|inch|inches|dia|tbsp|tsp|quart)\b/i.test(p.name) ||
			/^cup\b/i.test(p.name)
		)
			throw new Error(`${id} (${s.name}): portion "${p.name}" still has a US measure`);
	const kcal = food.nutrients.find((n) => n.code === 'energy_kcal')!.value;
	console.log(
		`${s.name.padEnd(38)} ← ${food.description.slice(0, 70).padEnd(70)} ${String(kcal).padStart(6)} kcal  ${food.portions.length} portions`
	);
	return { ...food, name: s.name, aliases: s.aliases };
});

const used = [...new Set(SELECTION.map((s) => s.dataset))];
writeFileSync(
	OUT,
	JSON.stringify(
		{
			source: 'USDA FoodData Central (public domain)',
			datasets: used.map((d) => ({
				dataset: d,
				file: DATASETS[d].file,
				sha256: DATASETS[d].sha256
			})),
			foods
		},
		null,
		'\t'
	) + '\n'
);
console.log(`\n${foods.length} foods written to ${OUT}`);
