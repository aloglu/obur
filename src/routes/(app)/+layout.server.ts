import { config } from '#lib/server/config.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	zone: locals.zone,
	today: localDate(new Date(), locals.zone),
	/** Speak is offered only when a speech service is configured. */
	speech: config.speechUrl !== null,
	scan: config.ocrUrl !== null
});
