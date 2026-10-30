// The confirmation after logging a saved meal: how many items went where, with one Undo for all of them.
import { m } from '#lib/paraglide/messages.js';
import type { DiaryEntry } from '#lib/shared/diary-types.ts';
import { kcal, mealName } from '#lib/shared/format.ts';
import { api } from './api.ts';
import { showToast } from './toast.svelte.ts';

export function showLoggedMeal(entries: DiaryEntry[], refresh: () => Promise<unknown>) {
	const total = entries.reduce((sum, e) => sum + (e.nutrients.energy_kcal?.value ?? 0), 0);
	showToast({
		message:
			entries.length === 1
				? m.saved_logged_one()
				: m.saved_logged_many({ count: String(entries.length) }),
		detail: m.toast_logged_detail({ meal: mealName(entries[0].meal), kcal: kcal(total) }),
		undo: async () => {
			for (const e of entries) await api('POST', `/api/v1/diary/entries/${e.id}?action=delete`, {});
			await refresh();
		}
	});
}
