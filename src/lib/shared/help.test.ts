import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json' with { type: 'json' };
import { HELP, HELP_TOPICS, helpMatches } from './help.ts';

const messages = en as Record<string, string>;

describe('help', () => {
	it('has a question, every answer paragraph and search words in the catalog for each entry', () => {
		for (const h of HELP) {
			expect(messages[`help_${h.id}_q`], h.id).toBeTruthy();
			expect(messages[`help_${h.id}_k`], h.id).toBeTruthy();
			for (let i = 1; i <= h.answers; i++)
				expect(messages[`help_${h.id}_a${i}`], `${h.id} a${i}`).toBeTruthy();
			expect(
				messages[`help_${h.id}_a${h.answers + 1}`],
				`${h.id} has more paragraphs`
			).toBeUndefined();
			expect(HELP_TOPICS).toContain(h.topic);
		}
	});

	it('matches every word, ignoring case, accents and Turkish i forms', () => {
		expect(helpMatches('sutas', 'a few letters (“sutas” finds “Sütaş”)')).toBe(true);
		expect(helpMatches('HATIRLATMA', 'reminder hatırlatma')).toBe(true);
		expect(helpMatches('budget deficit', 'How is my daily budget worked out? … deficit')).toBe(
			true
		);
		expect(helpMatches('budget pizza', 'How is my daily budget worked out?')).toBe(false);
		expect(helpMatches('  ', 'anything')).toBe(true);
	});
});
