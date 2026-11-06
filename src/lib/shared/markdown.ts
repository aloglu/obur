// The small Markdown a day note understands (docs/ui.md, "Day notes"): headings, bold, italic, code, links, lists, to-dos
// and quotes. It parses to plain data, rendered by ui/today/NoteBody.svelte as ordinary elements, never as HTML, so a note
// can't inject anything into the page. Only http(s) links become links.
export type Inline =
	| { kind: 'text'; text: string }
	| { kind: 'bold' | 'italic' | 'code'; text: string }
	| { kind: 'link'; text: string; href: string };

export type Block =
	| { kind: 'heading'; level: 1 | 2; content: Inline[] }
	| { kind: 'paragraph'; lines: Inline[][] }
	| { kind: 'quote'; content: Inline[] }
	| { kind: 'list'; ordered: boolean; items: Inline[][] }
	| { kind: 'tasks'; items: { line: number; done: boolean; content: Inline[] }[] };

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

export function parseInline(source: string): Inline[] {
	const out: Inline[] = [];
	let at = 0;
	for (const m of source.matchAll(INLINE)) {
		if (m.index > at) out.push({ kind: 'text', text: source.slice(at, m.index) });
		if (m[1] !== undefined) out.push({ kind: 'code', text: m[1] });
		else if (m[2] !== undefined) out.push({ kind: 'bold', text: m[2] });
		else if (m[3] !== undefined) out.push({ kind: 'italic', text: m[3] });
		else out.push({ kind: 'link', text: m[4], href: m[5] });
		at = m.index + m[0].length;
	}
	if (at < source.length) out.push({ kind: 'text', text: source.slice(at) });
	return out;
}

const TASK = /^\s*[-*]\s+\[( |x|X)\]\s*(.*)/;

export function parseNote(source: string): Block[] {
	const blocks: Block[] = [];
	let paragraph: string[] = [];
	const endParagraph = () => {
		if (paragraph.length) blocks.push({ kind: 'paragraph', lines: paragraph.map(parseInline) });
		paragraph = [];
	};
	source.split('\n').forEach((line, index) => {
		let m: RegExpMatchArray | null;
		const last = blocks.at(-1);
		if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
			endParagraph();
			blocks.push({
				kind: 'heading',
				level: m[1].length === 1 ? 1 : 2,
				content: parseInline(m[2])
			});
		} else if ((m = line.match(TASK))) {
			endParagraph();
			const item = { line: index, done: m[1] !== ' ', content: parseInline(m[2]) };
			const open = blocks.at(-1);
			if (open?.kind === 'tasks') open.items.push(item);
			else blocks.push({ kind: 'tasks', items: [item] });
		} else if ((m = line.match(/^\s*[-*]\s+(.*)/)) || (m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
			endParagraph();
			const ordered = /^\s*\d/.test(line);
			const open = blocks.at(-1);
			if (open?.kind === 'list' && open.ordered === ordered) open.items.push(parseInline(m[1]));
			else blocks.push({ kind: 'list', ordered, items: [parseInline(m[1])] });
		} else if ((m = line.match(/^>\s?(.*)/))) {
			endParagraph();
			blocks.push({ kind: 'quote', content: parseInline(m[1]) });
		} else if (!line.trim()) {
			endParagraph();
			// A blank line ends a list, so the next list starts afresh.
			if (last?.kind === 'list' || last?.kind === 'tasks')
				blocks.push({ kind: 'paragraph', lines: [] });
		} else {
			paragraph.push(line);
		}
	});
	endParagraph();
	return blocks.filter((b) => b.kind !== 'paragraph' || b.lines.length > 0);
}

/** The first line without its Markdown, for the closed card. */
export function notePreview(source: string): string {
	const first = source.split('\n').find((l) => l.trim()) ?? '';
	return first
		.replace(/^\s*([-*]\s+(\[[ xX]\]\s*)?|#{1,3}\s+|>\s?|\d+[.)]\s+)/, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/\*\*|\*|`/g, '');
}

/** Ticks or unticks the to-do on a line. */
export function setTask(source: string, line: number, done: boolean): string {
	const lines = source.split('\n');
	lines[line] = lines[line].replace(/\[( |x|X)\]/, done ? '[x]' : '[ ]');
	return lines.join('\n');
}
