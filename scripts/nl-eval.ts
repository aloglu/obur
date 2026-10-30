// Scores the parser against a private case file and prints totals (and the failing cases, in this terminal only).
// Usage: node scripts/nl-eval.ts <cases.json> <transcripts.tsv>
// cases.json: { todayWeekday, cases: [[clip id, expected ParseResult], …] }; transcripts.tsv: clip<TAB>text<TAB>lang.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { parseEntry } from '../src/lib/server/modules/nl-parser/index.ts';

const [casesPath, transcriptsPath] = process.argv.slice(2);
if (!casesPath || !transcriptsPath)
	throw new Error('Usage: node scripts/nl-eval.ts <cases.json> <transcripts.tsv>');
const { todayWeekday, cases } = JSON.parse(readFileSync(casesPath, 'utf8')) as {
	todayWeekday: number;
	cases: [string, unknown][];
};
const rows = new Map(
	readFileSync(transcriptsPath, 'utf8')
		.trim()
		.split('\n')
		.slice(1)
		.map((line) => line.split('\t'))
		.map(([clip, text, lang]) => [clip, { text, lang }])
);

const byLang = new Map<string, { pass: number; total: number }>();
let pass = 0;
for (const [clip, expected] of cases) {
	const row = rows.get(clip);
	if (!row) throw new Error(`${clip} is not in the transcripts`);
	const got = parseEntry(row.text, todayWeekday);
	const ok = isDeepStrictEqual(JSON.parse(JSON.stringify(got)), expected);
	const lang = byLang.get(row.lang) ?? { pass: 0, total: 0 };
	lang.total += 1;
	if (ok) {
		pass += 1;
		lang.pass += 1;
	} else {
		console.log(
			`✗ ${clip}: ${row.text}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`
		);
	}
	byLang.set(row.lang, lang);
}
console.log(`\nComplete-result accuracy: ${pass}/${cases.length}`);
for (const [lang, c] of byLang) console.log(`  ${lang}: ${c.pass}/${c.total}`);
