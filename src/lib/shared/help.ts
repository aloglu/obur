// The Help page's questions (docs/ui.md, "Achievements, Journal and Help"): the words live in the message catalog
// (help_<id>_q, help_<id>_a1…, help_<id>_k for extra search words, English and Turkish); this lists them by topic.
import { foldForSearch } from './search-text.ts';

export const HELP_TOPICS = [
	'logging',
	'budget',
	'weight',
	'progress',
	'reminders',
	'privacy'
] as const;
export type HelpTopic = (typeof HELP_TOPICS)[number];

export interface HelpEntry {
	id: string;
	topic: HelpTopic;
	/** How many answer paragraphs it has. */
	answers: number;
}

export const HELP: HelpEntry[] = [
	{ id: 'log', topic: 'logging', answers: 2 },
	{ id: 'quick', topic: 'logging', answers: 1 },
	{ id: 'bulk', topic: 'logging', answers: 1 },
	{ id: 'budget', topic: 'budget', answers: 3 },
	{ id: 'activity', topic: 'budget', answers: 1 },
	{ id: 'smoothed', topic: 'weight', answers: 2 },
	{ id: 'weight_up', topic: 'weight', answers: 1 },
	{ id: 'complete', topic: 'progress', answers: 1 },
	{ id: 'averages', topic: 'progress', answers: 1 },
	{ id: 'journal', topic: 'progress', answers: 1 },
	{ id: 'rings', topic: 'progress', answers: 1 },
	{ id: 'achievements', topic: 'progress', answers: 2 },
	{ id: 'reminders', topic: 'reminders', answers: 1 },
	{ id: 'private', topic: 'privacy', answers: 1 },
	{ id: 'data', topic: 'privacy', answers: 1 }
];

/**
 * Whether a question matches a search: every word of the query appears in its text, ignoring case, accents and the
 * Turkish i forms ("sutas" matches "Sütaş", "hatirlatma" matches "hatırlatma").
 */
export function helpMatches(query: string, text: string): boolean {
	const words = foldForSearch(query).split(' ').filter(Boolean);
	if (!words.length) return true;
	const haystack = foldForSearch(text);
	return words.every((w) => haystack.includes(w));
}
