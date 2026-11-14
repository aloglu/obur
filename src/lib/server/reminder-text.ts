// A reminder's text in the person's language (docs/design.md, "Interface language"). The worker sends it without a
// request, so it picks the catalog itself; a language that isn't enabled yet gets English.
import en from '../../../messages/en.json' with { type: 'json' };
import tr from '../../../messages/tr.json' with { type: 'json' };
import type { ReminderKind } from '../shared/reminders.ts';
import { DEFAULT_LANGUAGE, ENABLED_LANGUAGES, usable, type Language } from '../shared/languages.ts';

const CATALOGS: Record<Language, Record<string, string>> = { en, tr };

export function reminderTitle(
	kind: ReminderKind,
	language: Language,
	enabled: readonly Language[] = ENABLED_LANGUAGES
): string {
	const key = `reminder_${kind}`;
	return CATALOGS[usable(language, enabled) ?? DEFAULT_LANGUAGE][key] ?? en[key as keyof typeof en];
}
