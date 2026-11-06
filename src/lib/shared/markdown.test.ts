import { describe, expect, it } from 'vitest';
import { notePreview, parseInline, parseNote, setTask } from './markdown.ts';

describe('parseInline', () => {
	it('reads bold, italic, code and links', () => {
		expect(parseInline('a **b** *c* `d` [e](https://f.example)')).toEqual([
			{ kind: 'text', text: 'a ' },
			{ kind: 'bold', text: 'b' },
			{ kind: 'text', text: ' ' },
			{ kind: 'italic', text: 'c' },
			{ kind: 'text', text: ' ' },
			{ kind: 'code', text: 'd' },
			{ kind: 'text', text: ' ' },
			{ kind: 'link', text: 'e', href: 'https://f.example' }
		]);
	});

	it('leaves anything but an http(s) link as text', () => {
		const source = '[x](javascript:alert(1)) <img src=x onerror=alert(1)>';
		expect(parseInline(source)).toEqual([{ kind: 'text', text: source }]);
	});
});

describe('parseNote', () => {
	it('groups lines into blocks and remembers each to-do’s line', () => {
		const blocks = parseNote(
			'# Day\nsoup\nwas a guess\n\n- one\n- two\n\n1. first\n- [ ] weigh\n- [x] walk\n> quiet'
		);
		expect(blocks.map((b) => b.kind)).toEqual([
			'heading',
			'paragraph',
			'list',
			'list',
			'tasks',
			'quote'
		]);
		expect(blocks[1]).toMatchObject({ lines: [[{ text: 'soup' }], [{ text: 'was a guess' }]] });
		expect(blocks[3]).toMatchObject({ ordered: true });
		expect(blocks[4]).toMatchObject({
			items: [
				{ line: 8, done: false },
				{ line: 9, done: true }
			]
		});
	});

	it('reads an empty note as nothing', () => {
		expect(parseNote('  \n\n')).toEqual([]);
	});
});

describe('notePreview', () => {
	it.each([
		['\n\n- [ ] **Weigh** in', 'Weigh in'],
		['# Heading', 'Heading'],
		['[a link](https://x.example) here', 'a link here'],
		['', '']
	])('%j reads %j', (source, preview) => {
		expect(notePreview(source)).toBe(preview);
	});
});

describe('setTask', () => {
	it('changes only the given line', () => {
		expect(setTask('- [ ] a\n- [ ] b', 1, true)).toBe('- [ ] a\n- [x] b');
		expect(setTask('- [x] a', 0, false)).toBe('- [ ] a');
	});
});
