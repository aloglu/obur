// Loads the curated generic foods as the schema owner (DATABASE_MIGRATOR_URL). Safe to run again; part of `obur
// migrate`. Usage: npm run curated:load
import postgres from 'postgres';
import { loadCuratedFoods, readCuratedFile } from '../src/lib/server/modules/catalog/curated.ts';

const url = process.env.DATABASE_MIGRATOR_URL;
if (!url) throw new Error('DATABASE_MIGRATOR_URL is not set');
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
	const result = await loadCuratedFoods(sql, readCuratedFile());
	console.log(
		`Curated foods: ${result.added} added, ${result.renamed} renamed, ${result.unchanged} unchanged.`
	);
} finally {
	await sql.end();
}
