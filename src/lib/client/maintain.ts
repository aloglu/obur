// The offer at the goal weight (shared/goals.ts, maintainOffer): accepted, the budget setting "When I reach my goal
// weight" becomes Maintain from today; declined, it stays away for this goal weight on every device.
import { invalidateAll } from '$app/navigation';
import { m } from '#lib/paraglide/messages.js';
import { api } from './api.ts';
import { savePreferences } from './prefs.ts';
import { showToast } from './toast.svelte.ts';

export async function switchToMaintain(): Promise<boolean> {
	try {
		await api('PATCH', '/api/v1/targets/settings', { atGoal: 'maintain' });
		await invalidateAll();
		showToast({ message: m.maintain_switched(), detail: m.maintain_switched_detail() });
		return true;
	} catch {
		showToast({ message: m.error_generic() });
		return false;
	}
}

export async function declineMaintain(goalKg: number): Promise<void> {
	try {
		await savePreferences({ maintainOfferDeclinedKg: goalKg });
		await invalidateAll();
		showToast({ message: m.maintain_declined(), detail: m.maintain_switched_detail() });
	} catch {
		// Not saved (offline): the offer shows again next time.
		showToast({ message: m.error_generic() });
	}
}
