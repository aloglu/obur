// Scores voice end to end on a private clip set: each clip goes to a speech service (the same image as production),
// then the transcript and the reference sentence both go through the parser. Writes per-clip results to a private
// file and prints only totals. Usage:
//   node scripts/voice-eval.ts <transcripts.tsv> <raw dir> <speech url> <results.json> [prefix=prompt-file …]
// e.g. h=~/obur-private/results/prompt-owner.txt gives clips h… that prompt; clips without one get none.
// The add-on reads only 16 kHz mono WAV, as Speak makes it on the phone (A11): <clip>.wav is sent when it exists,
// otherwise <clip>.m4a is converted with the computer's own ffmpeg (its resampler, not the phone's averaging).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseEntry, type ParseResult } from '../src/lib/server/modules/nl-parser/index.ts';

const [tsv, rawDir, speechUrl, outPath, ...promptArgs] = process.argv.slice(2);
if (!tsv || !rawDir || !speechUrl || !outPath)
	throw new Error('see the usage at the top of this file');
const prompts = new Map(
	promptArgs.map((a) => {
		const [prefix, file] = a.split('=');
		return [prefix, readFileSync(file, 'utf8').trim()];
	})
);
const WEEKDAY = 5; // relative days resolve the same way for reference and transcript

/** Numbers in a parse (amounts, kcal, kg, ml, days ago), in order. */
const numbers = (p: ParseResult) => [
	p.daysAgo,
	...p.items.flatMap((i) =>
		i.kind === 'food' || i.kind === 'water' ? [i.amount] : i.kind === 'weight' ? [i.kg] : [i.kcal]
	)
];
const fold = (s: string) =>
	s
		.toLocaleLowerCase('tr')
		.replace(/ı/g, 'i')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9 ]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
/** The parse with food names folded, so "Pilavı" and "pilavi" compare equal. */
const comparable = (p: ParseResult) => ({
	...p,
	items: p.items.map((i) => ('text' in i ? { ...i, text: fold(i.text) } : i))
});

const rows = readFileSync(tsv, 'utf8')
	.split('\n')
	.slice(1)
	.filter(Boolean)
	.map((l) => l.split('\t'))
	.map(([clip, text, lang, conditions]) => ({ clip, text, lang, conditions }));

/** <clip>.m4a as 16 kHz mono WAV, through a file: written to a pipe, ffmpeg's header gives no real length. */
function converted(clip: string): Buffer {
	const out = path.join(mkdtempSync(path.join(tmpdir(), 'voice-eval-')), 'clip.wav');
	try {
		execFileSync('ffmpeg', [
			...['-loglevel', 'error', '-i', path.join(rawDir, `${clip}.m4a`)],
			...['-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', out]
		]);
		return readFileSync(out);
	} finally {
		rmSync(path.dirname(out), { recursive: true, force: true });
	}
}

const results = [];
for (const row of rows) {
	const wavPath = path.join(rawDir, `${row.clip}.wav`);
	const audio = existsSync(wavPath) ? readFileSync(wavPath) : converted(row.clip);
	const prompt = prompts.get(row.clip[0]) ?? null;
	const started = performance.now();
	const response = await fetch(`${speechUrl}/transcribe`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ audio: audio.toString('base64'), prompt })
	});
	const body = (await response.json()) as { text?: string; asrMs?: number; audioS?: number };
	const ms = Math.round(performance.now() - started);
	const heard = body.text ?? '';
	const ref = parseEntry(row.text, WEEKDAY);
	const hyp = parseEntry(heard, WEEKDAY);
	results.push({
		...row,
		heard,
		ms,
		audioS: body.audioS,
		transcriptExact: fold(heard) === fold(row.text),
		sameAsTyped: isDeepStrictEqual(comparable(hyp), comparable(ref)),
		numbersRight: isDeepStrictEqual(numbers(hyp), numbers(ref)),
		ref,
		hyp
	});
}
writeFileSync(outPath, JSON.stringify(results, null, '\t'));

const pct = (n: number, d: number) => `${n}/${d} (${Math.round((100 * n) / d)}%)`;
const report = (label: string, rs: typeof results) => {
	if (!rs.length) return;
	const times = rs.map((r) => r.ms).sort((a, b) => a - b);
	console.log(
		`${label.padEnd(16)} clips ${String(rs.length).padStart(2)} | same as typed ${pct(rs.filter((r) => r.sameAsTyped).length, rs.length)} | numbers right ${pct(rs.filter((r) => r.numbersRight).length, rs.length)} | transcript exact ${pct(rs.filter((r) => r.transcriptExact).length, rs.length)} | p50 ${times[Math.floor(times.length / 2)]} ms, max ${times.at(-1)} ms`
	);
};
for (const prefix of [...new Set(results.map((r) => r.clip[0]))]) {
	const set = results.filter((r) => r.clip[0] === prefix);
	report(`${prefix} all`, set);
	for (const lang of ['tr', 'en', 'mix'])
		report(
			`${prefix} ${lang}`,
			set.filter((r) => r.lang === lang)
		);
	report(
		`${prefix} quiet`,
		set.filter((r) => r.conditions === 'quiet')
	);
	report(
		`${prefix} harder`,
		set.filter((r) => r.conditions !== 'quiet')
	);
}
