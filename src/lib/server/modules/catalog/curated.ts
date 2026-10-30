// Loads the curated generic foods (curated/usda-foods.json, built by `npm run curated:build`) as shared, ownerless
// foods. Runs as the schema owner during the upgrade procedure (`obur migrate`), never at request time, with plain
// SQL like the other operator scripts. Idempotent: a food already loaded (same dataset and USDA ID) follows the file
// only while nobody has edited it (version 1). Foods dropped from the list stay, as entries and saved meals may link
// to them.
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

async function insertChildren(
	tx: postgres.TransactionSql,
	foodId: string,
	f: CuratedFile['foods'][number]
) {
	for (const n of f.nutrients)
		await tx`insert into food_nutrients (food_id, code, value, qualifier)
			values (${foodId}, ${n.code}, ${n.value}, ${n.qualifier})`;
	for (const p of f.portions)
		await tx`insert into food_servings (food_id, name, amount, unit, source)
			values (${foodId}, ${p.name}, ${p.grams}, 'g', 'reference')`;
}

/**
 * Inserts missing curated foods and brings untouched ones (name, aliases, values, portions) in line with the file,
 * in one transaction. Entries and saved meals keep their own snapshots, so history never changes.
 */
export async function loadCuratedFoods(
	sql: postgres.Sql,
	file: CuratedFile
): Promise<{ added: number; updated: number; unchanged: number }> {
	const versions = Object.fromEntries(file.datasets.map((d) => [d.dataset, d.file]));
	const result = { added: 0, updated: 0, unchanged: 0 };
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
				await insertChildren(tx, created.id, f);
				continue;
			}
			// Already loaded: an untouched food (version 1) follows the file; an edited one is left alone.
			const [existing] = await tx`
				select id, version, name, search_key from foods
				where origin = 'curated' and source_meta ->> 'dataset' = ${f.dataset}
					and source_meta ->> 'fdcId' = ${String(f.fdcId)}`;
			if (!existing || existing.version !== 1) {
				result.unchanged += 1;
				continue;
			}
			// Compared in JavaScript, so database collation and numeric formatting play no part.
			const nutrients =
				await tx`select code, value, qualifier from food_nutrients where food_id = ${existing.id}`;
			const servings =
				await tx`select name, amount from food_servings where food_id = ${existing.id}`;
			const key = (rows: unknown[][]) => JSON.stringify(rows.map((r) => JSON.stringify(r)).sort());
			const same =
				existing.name === f.name &&
				existing.search_key === searchKey &&
				key(nutrients.map((n) => [n.code, Number(n.value), n.qualifier])) ===
					key(f.nutrients.map((n) => [n.code, n.value, n.qualifier])) &&
				key(servings.map((p) => [p.name, Number(p.amount)])) ===
					key(f.portions.map((p) => [p.name, p.grams]));
			if (same) {
				result.unchanged += 1;
				continue;
			}
			await tx`update foods set name = ${f.name}, search_key = ${searchKey}, source_meta = ${tx.json(meta)},
				updated_at = now() where id = ${existing.id}`;
			await tx`delete from food_nutrients where food_id = ${existing.id}`;
			await tx`delete from food_servings where food_id = ${existing.id}`;
			await insertChildren(tx, existing.id, f);
			result.updated += 1;
		}
	});
	return result;
}
