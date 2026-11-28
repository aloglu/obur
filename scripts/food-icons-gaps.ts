// Which foods in a person's own history have no icon (docs/ui.md, "Food icons"): a list for extending the word lists.
// Reads export files the person made themselves, an obur export (More → Export) or a LoseIt export, and lists the
// food names that fall back to the plate, most logged first. Nothing is sent anywhere and no database is opened.
// The output holds food names from the diary: keep it on your own machine and share only what you choose.
//   node scripts/food-icons-gaps.ts <export.zip> [more exports…] [--all]
// --all lists every name with the icon it gets now (or "plate"), not only the gaps.
import { readFileSync } from 'node:fs';
import { strFromU8 } from 'fflate';
import { suggestIcon } from '../src/lib/shared/food-icons.ts';
import { foldForSearch } from '../src/lib/shared/search-text.ts';
import {
	archiveKind,
	readLoseItArchive
} from '../src/lib/server/modules/imports-exports/loseit.ts';
import { unzipLimited } from '../src/lib/server/modules/imports-exports/unzip.ts';

interface Logged {
	name: string;
	brand: string | null;
	/** An icon the person chose for the food; it never falls back to the plate. */
	chosen: string | null;
}

/** The diary's entries in an obur export: logged foods and quick adds, without deleted ones. */
function fromObur(bytes: Uint8Array): Logged[] {
	const files = unzipLimited(bytes, (name) => name === 'data/diary.json', 200 * 1024 * 1024);
	if (files === 'too_large') throw new Error('The export is too large to read.');
	const diary = files['data/diary.json'];
	if (!diary) throw new Error('No diary in this obur export.');
	const entries = JSON.parse(strFromU8(diary)) as {
		kind: 'food' | 'quick';
		food: { name: string; brand: string | null; icon?: string | null } | null;
		description: string | null;
		deletedAt: string | null;
	}[];
	return entries
		.filter((e) => e.deletedAt === null)
		.map((e) =>
			e.kind === 'food' && e.food
				? { name: e.food.name, brand: e.food.brand, chosen: e.food.icon ?? null }
				: { name: e.description ?? '', brand: null, chosen: null }
		)
		.filter((e) => e.name.trim() !== '');
}

/** A LoseIt export's active diary rows (its food names include the brand). */
const fromLoseIt = (bytes: Uint8Array): Logged[] =>
	readLoseItArchive(bytes).entries.map((e) => ({ name: e.name, brand: null, chosen: null }));

const args = process.argv.slice(2);
const all = args.includes('--all');
const paths = args.filter((a) => a !== '--all');
if (paths.length === 0) {
	console.error('Usage: node scripts/food-icons-gaps.ts <export.zip> [more exports…] [--all]');
	process.exit(2);
}

const logged: Logged[] = [];
for (const path of paths) {
	const bytes = new Uint8Array(readFileSync(path));
	const kind = archiveKind(bytes);
	if (kind === 'obur') logged.push(...fromObur(bytes));
	else if (kind === 'loseit') logged.push(...fromLoseIt(bytes));
	else throw new Error(`${path}: not an obur or LoseIt export (${kind}).`);
}

// Names that differ only in case or Turkish letters count as one; the most common spelling is shown.
const groups = new Map<string, { count: number; spellings: Map<string, number>; icon: string }>();
for (const e of logged) {
	const icon = e.chosen ?? suggestIcon(e.name, e.brand) ?? 'plate';
	const key = foldForSearch(e.name.trim());
	const g = groups.get(key) ?? { count: 0, spellings: new Map(), icon };
	g.count++;
	g.spellings.set(e.name.trim(), (g.spellings.get(e.name.trim()) ?? 0) + 1);
	groups.set(key, g);
}

const rows = [...groups.values()]
	.map((g) => ({
		count: g.count,
		icon: g.icon,
		name: [...g.spellings].sort((a, b) => b[1] - a[1])[0][0]
	}))
	.filter((r) => all || r.icon === 'plate')
	.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'));

const plate = logged.filter((e) => !e.chosen && !suggestIcon(e.name, e.brand)).length;
console.log(
	`# ${logged.length} diary entries, ${groups.size} different names; ${plate} entries ` +
		`(${Math.round((plate / Math.max(logged.length, 1)) * 100)}%) show the plate.`
);
console.log(all ? 'times\ticon\tname' : 'times\tname');
for (const r of rows)
	console.log(all ? `${r.count}\t${r.icon}\t${r.name}` : `${r.count}\t${r.name}`);
