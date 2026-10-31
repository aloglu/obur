import { config } from '#lib/server/config.ts';
import { progress } from '#lib/server/progress.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import type { StoredAchievement } from '#lib/server/modules/progress/index.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const today = localDate(new Date(), locals.zone);
	// Achievements reached in the last few days and not yet celebrated. Checked on every page change (reading the
	// path makes this load run again) and after every save that refreshes the page. A celebration must never stop a
	// page from opening, so a failure here only means no toast.
	void url.pathname;
	let celebrate: StoredAchievement[] = [];
	if (locals.session?.kind === 'normal') {
		try {
			const { list } = await progress.sync(locals.session.userId, today, locals.zone);
			celebrate = list.filter((a) => !a.seen);
		} catch (e) {
			console.error('achievements: sync failed', (e as Error).message);
		}
	}
	return {
		zone: locals.zone,
		today,
		/** Speak is offered only when a speech service is configured. */
		speech: config.speechUrl !== null,
		scan: config.ocrUrl !== null,
		/** Reminders are offered only with Web Push keys; the public key lets this device subscribe. */
		pushKey: config.pushKey,
		celebrate
	};
};
