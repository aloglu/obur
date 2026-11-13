import { config } from '#lib/server/config.ts';
import { effectiveSource } from '#lib/server/model-source.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import type { Source } from '#lib/shared/remote-models.ts';
import { progress } from '#lib/server/progress.ts';
import { body } from '#lib/server/body.ts';
import { goals } from '#lib/server/goals.ts';
import { maintainOffer } from '#lib/shared/goals.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import type { StoredAchievement } from '#lib/server/modules/progress/index.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, parent }) => {
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
	// The goal weight is reached and the budget still has its deficit: Today and the goal's celebration offer to
	// switch to maintenance (shared/goals.ts). Like the celebration, it never stops a page from opening.
	let maintainAtKg: number | null = null;
	if (locals.session?.kind === 'normal') {
		try {
			const userId = locals.session.userId;
			const [{ preferences }, target, weight] = await Promise.all([
				parent(),
				goals.targetFor(userId, today),
				body.latestWeight(userId, today)
			]);
			maintainAtKg = maintainOffer(
				target,
				weight?.value ?? null,
				preferences.maintainOfferDeclinedKg
			);
		} catch (e) {
			console.error('maintain offer: failed', (e as Error).message);
		}
	}
	// What reads this person's recordings and photos: their own key, the server's add-on, or nothing yet.
	let speakSource: Source | null = config.speechUrl !== null ? 'server' : null;
	let scanSource: Source | null = config.ocrUrl !== null ? 'server' : null;
	let keysAllowed = false;
	if (locals.session) {
		const userId = locals.session.userId;
		[speakSource, scanSource, keysAllowed] = await Promise.all([
			effectiveSource(userId, 'speak'),
			effectiveSource(userId, 'scan'),
			remoteModels.allowed(userId)
		]);
	}
	return {
		zone: locals.zone,
		today,
		speakSource,
		scanSource,
		/** People may bring their own key here: Speak and Scan stay on Log even without the add-ons. */
		keysAllowed,
		/** The server's own add-ons, for "Read this one on obur's server instead". */
		local: { speak: config.speechUrl !== null, scan: config.ocrUrl !== null },
		/** The Speak and Scan tiles show when something can read them, or a key could. */
		speech: speakSource !== null || keysAllowed,
		scan: scanSource !== null || keysAllowed,
		/** Reminders are offered only with Web Push keys; the public key lets this device subscribe. */
		pushKey: config.pushKey,
		celebrate,
		/** The reached goal weight (kg) when switching to maintenance is on offer; otherwise null. */
		maintainAtKg
	};
};
