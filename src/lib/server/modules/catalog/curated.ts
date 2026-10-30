// Loads the curated generic foods (curated/usda-foods.json, built by `npm run curated:build`) as shared, ownerless
// foods. Runs as the schema owner during the upgrade procedure (`obur migrate`), never at request time, with plain
// SQL like the other operator scripts. Idempotent: a food already loaded (same dataset and USDA ID) keeps its values;
// only its name and aliases follow the list, and only while nobody has edited it (version 1). Foods dropped from the
// list stay, as entries and saved meals may link to them.
import { readFileSync } from 'node:fs';
import type postgres from 'postgres';
import { searchKeyWithAliases } from '../../../shared/search-text.ts';
import type { CuratedFood } from './usda.ts';

export interface CuratedFile {
	source: string;
	datasets: { dataset: string; file: string; sha256: string }[];
	foods: (CuratedFood & { name: string; aliases: string[] })[];
}

export const CURATED_FILE = new URL('./curated/usda-foods.json', import.meta.url);

export function readCuratedFile(path: URL | string = CURATED_FILE): CuratedFile {
	return JSON.parse(readFileSync(path, 'utf8')) as CuratedFile;
}

/** Inserts missing curated foods and refreshes names and aliases of untouched ones, in one transaction. */
export async function loadCuratedFoods(
	sql: postgres.Sql,
	file: CuratedFile
): Promise<{ added: number; renamed: number; unchanged: number }> {
	const versions = Object.fromEntries(file.datasets.map((d) => [d.dataset, d.file]));
	const result = { added: 0, renamed: 0, unchanged: 0 };
	await sql.begin(async (tx) => {
		for (const f of file.foods) {
			const meta = {
				dataset: f.dataset,
				fdcId: String(f.fdcId),
				datasetFile: versions[f.dataset],
				description: f.description,
				publicationDate: f.publicationDate,
				energySource: f.energySource,
				aliases: f.aliases
			};
			const searchKey = searchKeyWithAliases(f.name, null, meta);
			const [created] = await tx`
				insert into foods (owner_id, visibility, name, search_key, basis, origin, source_meta)
				values (null, 'shared', ${f.name}, ${searchKey}, '100g', 'curated', ${tx.json(meta)})
				on conflict do nothing
				returning id`;
			if (created) {
				result.added += 1;
				for (const n of f.nutrients)
					await tx`insert into food_nutrients (food_id, code, value, qualifier)
						values (${created.id}, ${n.code}, ${n.value}, ${n.qualifier})`;
				for (const p of f.portions)
					await tx`insert into food_servings (food_id, name, amount, unit, source)
						values (${created.id}, ${p.name}, ${p.grams}, 'g', 'reference')`;
				continue;
			}
			const updated = await tx`
				update foods set name = ${f.name}, search_key = ${searchKey}, source_meta = ${tx.json(meta)},
					updated_at = now()
				where origin = 'curated' and source_meta ->> 'dataset' = ${f.dataset}
					and source_meta ->> 'fdcId' = ${String(f.fdcId)} and version = 1
					and (name <> ${f.name} or search_key <> ${searchKey})
				returning id`;
			if (updated.length) result.renamed += 1;
			else result.unchanged += 1;
		}
	});
	return result;
}
