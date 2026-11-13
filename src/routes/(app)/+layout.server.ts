import { config } from '#lib/server/config.ts';
import { effectiveSource } from '#lib/server/model-source.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import type { Source } from '#lib/shared/remote-models.ts';
import { ACCOUNT_DATA } from '#lib/shared/account-data.ts';
import { progress } from '#lib/server/progress.ts';
import { body } from '#lib/server/body.ts';
import { goals } from '#lib/server/goals.ts';
import { catalog, recipes } from '#lib/server/catalog.ts';
import { diary, savedMeals } from '#lib/server/diary.ts';
import { updates } from '#lib/server/updates.ts';
import { maintainOffer } from '#lib/shared/goals.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import type { StoredAchievement } from '#lib/server/modules/progress/index.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends, parent }) => {
	// Everything here is asked for again just after every page change (+layout.svelte) and after every save that
	// refreshes the page, never as part of the page change itself: a page opens without waiting for it.
	depends(ACCOUNT_DATA);
	const today = localDate(new Date(), locals.zone);
	// Achievements reached in the last few days and not yet celebrated. A celebration must never stop a page from
	// opening, so a failure here only means no toast.
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
	// The pace a calculated budget asks for, for the Goal row in Settings; null without one.
	let goalPace: number | null = null;
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
			const requested = target?.inputs.requestedRateKgPerWeek;
			if (target?.mode === 'calculated')
				goalPace = typeof requested === 'number' ? requested : (target.rateKgPerWeek ?? 0);
		} catch (e) {
			console.error('maintain offer: failed', (e as Error).message);
		}
	}
	// What the More list shows beside its rows. Kept here, with everything else that refreshes behind a page change,
	// so More opens without asking the server. Null when it could not be read: a row then shows no number.
	let more: {
		deletedCount: number;
		foodCount: number;
		recipeCount: number;
		mealCount: number;
		/** A newer published version already known, for an admin who turned the check on (Household). */
		newerVersion: string | null;
	} | null = null;
	if (locals.session?.kind === 'normal') {
		try {
			const { userId, role } = locals.session;
			const [deleted, own, recipeList, meals, newerVersion] = await Promise.all([
				diary.trash(userId),
				catalog.ownFoods(userId, 0, 1),
				recipes.list(userId),
				savedMeals.list(userId),
				updates.known(userId, role === 'admin').catch(() => null)
			]);
			more = {
				deletedCount: deleted.length,
				foodCount: own.total,
				recipeCount: recipeList.filter((r) => !r.archived).length,
				mealCount: meals.length,
				newerVersion
			};
		} catch (e) {
			console.error('more: counts failed', (e as Error).message);
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
		maintainAtKg,
		goalPace,
		more
	};
};
