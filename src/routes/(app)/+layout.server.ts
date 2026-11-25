import { config } from '#lib/server/config.ts';
import { allSources } from '#lib/server/model-source.ts';
import { ACCOUNT_DATA } from '#lib/shared/account-data.ts';
import { syncOnce } from '#lib/server/progress.ts';
import { body } from '#lib/server/body.ts';
import { goals } from '#lib/server/goals.ts';
import { catalog, recipes } from '#lib/server/catalog.ts';
import { diary, savedMeals } from '#lib/server/diary.ts';
import { updates } from '#lib/server/updates.ts';
import { maintainOffer } from '#lib/shared/goals.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import type { StoredAchievement } from '#lib/server/modules/progress/index.ts';
import { describeError } from '#lib/server/log.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends, parent }) => {
	// Everything here is asked for again just after every page change (+layout.svelte) and after every save that
	// refreshes the page, never as part of the page change itself: a page opens without waiting for it.
	depends(ACCOUNT_DATA);
	const today = localDate(new Date(), locals.zone);
	const normal = locals.session?.kind === 'normal' ? locals.session : null;
	type More = {
		deletedCount: number;
		foodCount: number;
		recipeCount: number;
		mealCount: number;
		/** A newer published version already known, for an admin who turned the check on (Server). */
		newerVersion: string | null;
	};
	// The parts below are independent, so they are read at the same time (2026-11-23 Gemini audit 2, H10: four
	// waves, one after another). A part that fails only leaves out what it shows.
	const [celebrate, offer, more, sources] = await Promise.all([
		// Achievements reached in the last few days and not yet celebrated. A celebration must never stop a page from
		// opening, so a failure here only means no toast.
		normal
			? syncOnce(locals, normal.userId, today, locals.zone)
					.then(({ list }): StoredAchievement[] => list.filter((a) => !a.seen))
					.catch((e): StoredAchievement[] => {
						console.error('achievements: sync failed', describeError(e));
						return [];
					})
			: ([] as StoredAchievement[]),
		// The goal weight is reached and the budget still has its deficit: Today and the goal's celebration offer to
		// switch to maintenance (shared/goals.ts). Like the celebration, it never stops a page from opening. Also the
		// pace a calculated budget asks for, for the Goal row in Settings; null without one.
		normal
			? Promise.all([
					parent(),
					goals.targetFor(normal.userId, today),
					body.latestWeight(normal.userId, today)
				])
					.then(([{ preferences }, target, weight]) => {
						const requested = target?.inputs.requestedRateKgPerWeek;
						return {
							maintainAtKg: maintainOffer(
								target,
								weight?.value ?? null,
								preferences.maintainOfferDeclinedKg
							),
							goalPace:
								target?.mode === 'calculated'
									? typeof requested === 'number'
										? requested
										: (target.rateKgPerWeek ?? 0)
									: null
						};
					})
					.catch((e) => {
						console.error('maintain offer: failed', describeError(e));
						return { maintainAtKg: null, goalPace: null };
					})
			: { maintainAtKg: null, goalPace: null },
		// What the More list shows beside its rows. Kept here, with everything else that refreshes behind a page
		// change, so More opens without asking the server. Null when it could not be read: a row then shows no number.
		normal
			? Promise.all([
					diary.trashCount(normal.userId),
					catalog.trashCount(normal.userId),
					savedMeals.trashCount(normal.userId),
					catalog.ownCount(normal.userId),
					recipes.count(normal.userId),
					savedMeals.count(normal.userId),
					updates.known(normal.userId, normal.role === 'admin').catch(() => null)
				])
					.then(
						([
							deletedEntries,
							deletedFoods,
							deletedMeals,
							foodCount,
							recipeCount,
							mealCount,
							newerVersion
						]): More => ({
							deletedCount: deletedEntries + deletedFoods + deletedMeals,
							foodCount,
							recipeCount,
							mealCount,
							newerVersion
						})
					)
					.catch((e): More | null => {
						console.error('more: counts failed', describeError(e));
						return null;
					})
			: null,
		// What reads this person's recordings and photos: their own key, the server's add-on, or nothing yet.
		locals.session
			? allSources(locals.session.userId)
			: {
					speak: config.speechUrl !== null ? ('server' as const) : null,
					scan: config.ocrUrl !== null ? ('server' as const) : null,
					keysAllowed: false
				}
	]);
	const { maintainAtKg, goalPace } = offer;
	const { speak: speakSource, scan: scanSource, keysAllowed } = sources;
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
		maintainAtKg,
		goalPace,
		more
	};
};
