import { localDate } from '#lib/shared/diary-rules.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	zone: locals.zone,
	today: localDate(new Date(), locals.zone)
});
